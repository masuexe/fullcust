import { bugMatchesRule, getBugRule, getCardBugType } from "./panel-effects";
import type { Data } from "./game-data";
import { isPartCompatible } from "./compatibility";
import {
    analyzeSolutionBugs,
    computeBuildStats, computePlacedBuildStats,
    findPartIndexByAbility,
    getEffectiveInBattleBugs,
    getPartEffect,
    getBusterStatLimits,
    getPartBugTypes,
    isBenignBug,
    isSolutionAcceptable,
    normalizeBugType,
    BuildStats,
    SolutionBugAnalysis,
} from "./effects";
import {
    getModCards,
    getModCard,
    computeDeckStats,
    ModCard,
} from "./modcards";
import { BODY_ELEMENTS, GAUGE_VALUES, BUSTER_STATS, getBusterMinimums, BugPolicy, BugTolerance, BuildConstraints, DEFAULT_BUG_POLICY, Problem, makeGridSettings } from "./problem";
import { meetsPlacementBugConstraints, placeAll, solve, GridSettings, Requirement, Solution } from "./solver";

export type OptimizationTarget = "max_hp" | "max_attack";
export type ModCardMode = "none" | "auto" | "keep";

export interface OptimizeOptions {
    data: Data;
    problem: Problem;
    policy?: BugPolicy;
    target?: OptimizationTarget;
    timeoutMs?: number;
    beamWidth?: number;
    modCardMode?: ModCardMode;
    constraints?: BuildConstraints;
    /** Counts search work, including repeated candidates; does not affect selection. */
    onSearchWork?: (kind: "candidate" | "placement") => void;
}

export interface OptimizeResult {
    problem: Problem;
    solution: Solution;
    stats: BuildStats;
    analysis: SolutionBugAnalysis;
    addedPartIndices: number[];
    addedCardIds?: string[];
}

export function occupiedBuildCells(data: Data, result: OptimizeResult): number {
    return result.solution.reduce((sum, placement, index) => {
        const part = data.parts[result.problem.requirements[index].partIndex];
        return sum + (placement.compressed ? part.compressedMask : part.uncompressedMask).filter(Boolean).length;
    }, 0);
}

/** Preserve effects when simplifying a build, except optional automatic BugStop. */
export function haveSameBuildEffects(a: BuildStats, b: BuildStats, constraints?: BuildConstraints): boolean {
    const normalize = (stats: BuildStats) => constraints?.requiredAbilities?.includes("bugStop") ? stats :
        { ...stats, abilities: stats.abilities.filter(ability => ability !== "bugStop") };
    return JSON.stringify(normalize(a)) === JSON.stringify(normalize(b));
}

/** Clean a valid completed build, without pruning intermediate search states. */
export function removeRedundantAbilityParts(options: OptimizeOptions, result: OptimizeResult): OptimizeResult {
    const { data, problem, constraints = problem.constraints,
        policy = problem.bugPolicy ?? DEFAULT_BUG_POLICY } = options;
    const grid = makeGridSettings(data, result.problem);
    const cards = result.problem.modCards ?? [];
    let cleaned = result;
    const candidates = result.problem.requirements.map((req, index) => {
        const effect = getPartEffect(data.gameId, data.partMetas[req.partIndex].id);
        const pureAbility = effect?.abilities?.length && !Object.entries(effect).some(([key, value]) => key !== "abilities" && value);
        return { req, index, abilityCount: effect?.abilities?.length ?? 0, pureAbility };
    }).filter(c => c.index >= problem.requirements.length && c.pureAbility && c.req.constraint.minBugLevel === 0)
        .sort((a, b) => a.abilityCount - b.abilityCount || b.index - a.index);
    const removed = new Set<number>();
    for (const candidate of candidates) {
        // Translate the original index after earlier removals; repeated part
        // indices may have different placement constraints and must stay distinct.
        const index = candidate.index - [...removed].filter(i => i < candidate.index).length;
        const requirements = cleaned.problem.requirements.filter((_, i) => i !== index);
        const solution = cleaned.solution.filter((_, i) => i !== index);
        const stats = computePlacedBuildStats(data.gameId, data.partMetas, requirements,
            placeAll(data.parts, requirements, solution, grid), grid, cards, problem.baseHp ?? 1000);
        // Optional automatic BugStop can disappear only if the remaining layout
        // still satisfies the full policy, requirements and placement constraints.
        if (!haveSameBuildEffects(stats, cleaned.stats, constraints)) continue;
        if (!meetsPlacementBugConstraints(data.parts, requirements, solution, grid)) continue;
        const analysis = analyzeSolutionBugs(data.gameId, data.partMetas, requirements,
            placeAll(data.parts, requirements, solution, grid), grid, "en", cards);
        if (!isSolutionAcceptable(analysis, policy, constraints?.forbiddenBugs, constraints?.bugRules) ||
            !doesBuildSatisfyConstraints(stats, analysis, constraints)) continue;
        cleaned = { ...cleaned, problem: { ...cleaned.problem, requirements }, solution, stats, analysis,
            addedPartIndices: requirements.slice(problem.requirements.length).map(req => req.partIndex) };
        removed.add(candidate.index);
    }
    return cleaned;
}

export interface ModCardOptimizeOptions {
    gameId: string;
    existingCardIds?: string[];
    target?: OptimizationTarget;
    policy?: BugPolicy;
    constraints?: BuildConstraints;
    lockedCardIds?: string[];
}

/** Safe upper bounds before packing; a fixed deck cannot change during search. */
export function busterMinimumsPossible(options: OptimizeOptions): boolean {
    const { data, problem, constraints = problem.constraints, modCardMode = "keep" } = options;
    const minimums = getBusterMinimums(constraints);
    const limits = getBusterStatLimits(data.gameId);
    if (modCardMode !== "auto" || data.gameId === "bn3") {
        const cards = modCardMode === "keep" && data.gameId !== "bn3" ? problem.modCards ?? [] : [];
        const deck = computeDeckStats(cards, data.gameId);
        const attackCap = (data.gameId === "bn6" && cards.length > 0) || (data.gameId === "bn5" && deck.stats.attackMult > 1) ? 10 : 5;
        limits.attack = Math.max(1, Math.min(attackCap, 5 * deck.stats.attackMult + deck.stats.attack));
        limits.rapid = Math.max(1, Math.min(5, 5 + deck.stats.rapid));
        limits.charge = Math.max(1, Math.min(5, 5 + deck.stats.charge));
    }
    return BUSTER_STATS.every(stat => (minimums[stat] ?? 1) <= limits[stat]);
}

/**
 * Checks whether a mod card's inherent bugs comply with the user's BugPolicy, forbidden bugs, and bug rules.
 */
function isCardAcceptableUnderPolicy(
    card: ModCard,
    policy: BugPolicy,
    forbiddenBugs?: string[],
    bugRules?: Partial<Record<string, BugTolerance>>
): boolean {
    const activeRules = bugRules || policy.customRules;
    if (activeRules && Object.keys(activeRules).length > 0) {
        if (!card.bugs || card.bugs.length === 0) return true;
        for (const b of card.bugs) {
            const norm = normalizeBugType(getCardBugType(card.id, b.type, card.movePanel));
            const rule = getBugRule(activeRules, norm, b.type);
            if (rule === "forbidden") return false;
            if (rule === "allowed_lv1" && (b.level ?? 1) > 1) return false;
        }
        return true;
    }

    if (!card.bugs || card.bugs.length === 0) return true;
    if (forbiddenBugs && forbiddenBugs.length > 0) {
        if (card.bugs.some(b => {
            const norm = normalizeBugType(getCardBugType(card.id, b.type, card.movePanel)).toLowerCase();
            return forbiddenBugs.some(fb => bugMatchesRule(norm, normalizeBugType(fb)));
        })) {
            return false;
        }
        return card.bugs.every(b => {
            const norm = normalizeBugType(getCardBugType(card.id, b.type, card.movePanel)).toLowerCase();
            return norm === "buster" || norm === "customhp" || norm === "emotion" || isBenignBug(norm, b.level ?? 1);
        });
    }
    if (policy.type === "no_bugs") return false;
    if (policy.type === "benign_allowed") {
        return card.bugs.every(b => isBenignBug(b.type, b.level ?? 1));
    }
    return true;
}

/**
 * Evaluates the fitness score of a mod card based on the target.
 */
function evaluateCardScore(card: ModCard, target: OptimizationTarget, requiredBugs?: string[]): number {
    const hp = (card.stats.hp ?? 0) + (card.stats.hpPercent ? card.stats.hpPercent * 15 : 0);
    const attack = (card.stats.attack ?? 0) + (card.stats.attackMult && card.stats.attackMult > 1 ? 5 : 0);

    let abilityBonus = 0;
    if (card.abilities) {
        if (card.abilities.includes("superArmor")) abilityBonus += 50;
        if (card.abilities.includes("floatShoes")) abilityBonus += 30;
        if (card.abilities.includes("airShoes")) abilityBonus += 30;
        if (card.abilities.includes("underShirt")) abilityBonus += 20;
        if (card.abilities.includes("statusGuard")) abilityBonus += 40;
    }

    if (requiredBugs && requiredBugs.length > 0 && card.bugs) {
        for (const b of card.bugs) {
            const norm = normalizeBugType(getCardBugType(card.id, b.type, card.movePanel)).toLowerCase();
            if (requiredBugs.some(rb => normalizeBugType(rb).toLowerCase() === norm)) {
                abilityBonus += 300;
            }
        }
    }

    return (target === "max_attack" ? attack * 120 + hp * 0.2 : hp + attack * 10) + abilityBonus;
}

export function matchSpecialMove(cardBPwrAtk: string | undefined, req: string): boolean {
    if (req === "ChargeShot") {
        return !cardBPwrAtk || cardBPwrAtk.toLowerCase() === "chargeshot";
    }
    if (!cardBPwrAtk) return false;
    const normCard = cardBPwrAtk.replace(/[\s\-_]/g, "").toLowerCase();
    const normReq = req.replace(/[\s\-_]/g, "").toLowerCase();
    return normCard === normReq || normCard.startsWith(normReq) || normReq.startsWith(normCard);
}

export function matchBLeft(cardBLeft: string | undefined, req: string): boolean {
    if (!cardBLeft) return false;
    const normCard = cardBLeft.replace(/[\s\-_]/g, "").toLowerCase();
    const normReq = req.replace(/[\s\-_]/g, "").toLowerCase();
    return normCard === normReq || normCard.startsWith(normReq) || normReq.startsWith(normCard);
}

export function matchBButton(cardBButton: string | undefined, req: string): boolean {
    if (req === "none") return !cardBButton;
    if (!cardBButton) return false;
    if (req === "Meteor1") return cardBButton.startsWith("Meteor1");
    return cardBButton === req || cardBButton.toLowerCase().includes(req.toLowerCase());
}

export function matchChargeAddition(cardCA: string | undefined, req: string): boolean {
    if (!cardCA) return false;
    if (req === "Chip Destruction") return cardCA.startsWith("Chip Destruction");
    if (req === "Instant Delete") return cardCA.startsWith("Instant Delete");
    return cardCA === req || cardCA.toLowerCase().includes(req.toLowerCase());
}

export function matchBusterAddition(cardBA: string | undefined, req: string): boolean {
    if (!cardBA) return false;
    return cardBA === req || cardBA.toLowerCase().includes(req.toLowerCase());
}

export function matchBody(cardBody: string | undefined, req: string): boolean {
    return (cardBody ?? "Normal").toLowerCase() === req.toLowerCase();
}

export function isBodyAllowed(body: string | undefined, constraints?: BuildConstraints): boolean {
    return (!constraints?.requiredBody || matchBody(body, constraints.requiredBody)) &&
        (constraints?.allowedBodies === undefined || constraints.allowedBodies.some(allowed => matchBody(body, allowed)));
}

export function bodyConstraintsPossible(constraints?: BuildConstraints): boolean {
    return BODY_ELEMENTS.some(body => isBodyAllowed(body, constraints));
}

export function matchGauge(cardGauge: string | undefined, req: string): boolean {
    const effectiveGauge = (cardGauge ?? "normal").toLowerCase();
    const target = req.toLowerCase();
    if (target === "not_slow") {
        return effectiveGauge !== "slow";
    }
    return effectiveGauge === target;
}

export function isGaugeAllowed(gauge: string | undefined, constraints?: BuildConstraints): boolean {
    const current = (gauge ?? "normal").toLowerCase();
    if (constraints?.allowedGauges !== undefined) {
        if (!constraints.allowedGauges.some(g => g.toLowerCase() === current)) {
            return false;
        }
    }
    if (constraints?.requiredGauge) {
        if (!matchGauge(current, constraints.requiredGauge)) {
            return false;
        }
    }
    return true;
}

export function gaugeConstraintsPossible(constraints?: BuildConstraints): boolean {
    return GAUGE_VALUES.some(gauge => isGaugeAllowed(gauge, constraints));
}

/**
 * Orders mod cards sequentially so that required moves, additions, and attributes are placed last
 * among cards that modify those attributes, preventing accidental overwriting.
 */
export function orderModCardsForConstraints(
    cardIds: string[],
    gameId: string,
    constraints?: BuildConstraints
): string[] {
    if (!constraints || cardIds.length <= 1) return cardIds;
    const sorted = [...cardIds];

    if (constraints.requiredSpecialMove) {
        sorted.sort((aId, bId) => {
            const cardA = getModCard(aId, gameId);
            const cardB = getModCard(bId, gameId);
            const aMatches = matchSpecialMove(cardA?.bPwrAtk, constraints.requiredSpecialMove!);
            const bMatches = matchSpecialMove(cardB?.bPwrAtk, constraints.requiredSpecialMove!);
            if (aMatches && !bMatches) return 1;
            if (!aMatches && bMatches) return -1;
            return 0;
        });
    }

    if (constraints.requiredBLeft) {
        sorted.sort((aId, bId) => {
            const cardA = getModCard(aId, gameId);
            const cardB = getModCard(bId, gameId);
            const aMatches = matchBLeft(cardA?.bLeft, constraints.requiredBLeft!);
            const bMatches = matchBLeft(cardB?.bLeft, constraints.requiredBLeft!);
            if (aMatches && !bMatches) return 1;
            if (!aMatches && bMatches) return -1;
            return 0;
        });
    }

    if (constraints.requiredBButton && constraints.requiredBButton !== "none") {
        sorted.sort((aId, bId) => {
            const cardA = getModCard(aId, gameId);
            const cardB = getModCard(bId, gameId);
            const aMatches = matchBButton(cardA?.bButton, constraints.requiredBButton!);
            const bMatches = matchBButton(cardB?.bButton, constraints.requiredBButton!);
            if (aMatches && !bMatches) return 1;
            if (!aMatches && bMatches) return -1;
            return 0;
        });
    }

    if (constraints.requiredChargeAddition) {
        sorted.sort((aId, bId) => {
            const cardA = getModCard(aId, gameId);
            const cardB = getModCard(bId, gameId);
            const aMatches = matchChargeAddition(cardA?.chargeAddition, constraints.requiredChargeAddition!);
            const bMatches = matchChargeAddition(cardB?.chargeAddition, constraints.requiredChargeAddition!);
            if (aMatches && !bMatches) return 1;
            if (!aMatches && bMatches) return -1;
            return 0;
        });
    }

    if (constraints.requiredBusterAddition) {
        sorted.sort((aId, bId) => {
            const cardA = getModCard(aId, gameId);
            const cardB = getModCard(bId, gameId);
            const aMatches = matchBusterAddition(cardA?.busterAddition, constraints.requiredBusterAddition!);
            const bMatches = matchBusterAddition(cardB?.busterAddition, constraints.requiredBusterAddition!);
            if (aMatches && !bMatches) return 1;
            if (!aMatches && bMatches) return -1;
            return 0;
        });
    }

    if (constraints.requiredBody) {
        sorted.sort((aId, bId) => {
            const cardA = getModCard(aId, gameId);
            const cardB = getModCard(bId, gameId);
            const aMatches = cardA?.body !== undefined && matchBody(cardA.body, constraints.requiredBody!);
            const bMatches = cardB?.body !== undefined && matchBody(cardB.body, constraints.requiredBody!);
            if (aMatches && !bMatches) return 1;
            if (!aMatches && bMatches) return -1;
            return 0;
        });
    }

    if (constraints.allowedBodies !== undefined) {
        sorted.sort((aId, bId) => {
            const a = getModCard(aId, gameId);
            const b = getModCard(bId, gameId);
            const aMatches = a?.body !== undefined && isBodyAllowed(a.body, constraints);
            const bMatches = b?.body !== undefined && isBodyAllowed(b.body, constraints);
            return Number(aMatches) - Number(bMatches);
        });
    }

    if (constraints.allowedGauges !== undefined || constraints.requiredGauge) {
        sorted.sort((aId, bId) => {
            const cardA = getModCard(aId, gameId);
            const cardB = getModCard(bId, gameId);
            const aMatches = cardA?.gauge !== undefined && isGaugeAllowed(cardA.gauge, constraints);
            const bMatches = cardB?.gauge !== undefined && isGaugeAllowed(cardB.gauge, constraints);
            return Number(aMatches) - Number(bMatches);
        });
    }

    return sorted;
}

/**
 * Optimizes the equipped Mod Cards:
 * - BN6 & BN5: 0-1 Knapsack DP within 80 MB capacity.
 * - BN4: Slot-based greedy optimization across slots 0A through 0E.
 * Respects the user's BugPolicy and keeps any existingCardIds.
 */
export function optimizeModCards(options: ModCardOptimizeOptions): string[] {
    const {
        gameId,
        existingCardIds = [],
        target = "max_hp",
        policy = DEFAULT_BUG_POLICY,
        constraints,
        lockedCardIds = [],
    } = options;

    if (gameId === "bn3") return [];
    if (!bodyConstraintsPossible(constraints) || !gaugeConstraintsPossible(constraints)) return [];

    const allCards = getModCards(gameId);
    if (!allCards || allCards.length === 0) return [...existingCardIds];

    const forbiddenBugs = constraints?.forbiddenBugs || [];
    const bugRules = constraints?.bugRules || policy.customRules;
    const requiredBugs = bugRules
        ? Object.entries(bugRules).filter(([_, tol]) => tol === "required").map(([b]) => b)
        : [];
    const locked = [...existingCardIds, ...lockedCardIds];

    // Lock required special move (Charge Shot) if specified
    if (constraints?.requiredSpecialMove && constraints.requiredSpecialMove !== "ChargeShot" && !locked.some(id => {
        const c = getModCard(id, gameId);
        return matchSpecialMove(c?.bPwrAtk, constraints.requiredSpecialMove!);
    })) {
        const matchingCards = allCards.filter(
            c => matchSpecialMove(c.bPwrAtk, constraints.requiredSpecialMove!) && isCardAcceptableUnderPolicy(c, policy, forbiddenBugs, bugRules)
        );
        if (matchingCards.length > 0) {
            matchingCards.sort((a, b) => evaluateCardScore(b, target, requiredBugs) - evaluateCardScore(a, target, requiredBugs));
            locked.push(matchingCards[0].id);
        }
    }

    // Lock required B+Left move if specified
    if (constraints?.requiredBLeft && !locked.some(id => {
        const c = getModCard(id, gameId);
        return matchBLeft(c?.bLeft, constraints.requiredBLeft!);
    })) {
        const matchingCards = allCards.filter(
            c => matchBLeft(c.bLeft, constraints.requiredBLeft!) && isCardAcceptableUnderPolicy(c, policy, forbiddenBugs, bugRules)
        );
        if (matchingCards.length > 0) {
            matchingCards.sort((a, b) => evaluateCardScore(b, target, requiredBugs) - evaluateCardScore(a, target, requiredBugs));
            locked.push(matchingCards[0].id);
        }
    }

    // Lock required B-Button override if specified
    if (constraints?.requiredBButton && constraints.requiredBButton !== "none" && !locked.some(id => {
        const c = getModCard(id, gameId);
        return matchBButton(c?.bButton, constraints.requiredBButton!);
    })) {
        const matchingCards = allCards.filter(
            c => matchBButton(c.bButton, constraints.requiredBButton!) && isCardAcceptableUnderPolicy(c, policy, forbiddenBugs, bugRules)
        );
        if (matchingCards.length > 0) {
            matchingCards.sort((a, b) => evaluateCardScore(b, target, requiredBugs) - evaluateCardScore(a, target, requiredBugs));
            locked.push(matchingCards[0].id);
        }
    }

    // Lock required Charge Addition if specified
    if (constraints?.requiredChargeAddition && !locked.some(id => {
        const c = getModCard(id, gameId);
        return matchChargeAddition(c?.chargeAddition, constraints.requiredChargeAddition!);
    })) {
        const matchingCards = allCards.filter(
            c => matchChargeAddition(c.chargeAddition, constraints.requiredChargeAddition!) &&
                 (!c.bPwrAtk || c.bPwrAtk.toLowerCase() === "chargeshot") &&
                 isCardAcceptableUnderPolicy(c, policy, forbiddenBugs, bugRules)
        );
        if (matchingCards.length > 0) {
            matchingCards.sort((a, b) => evaluateCardScore(b, target, requiredBugs) - evaluateCardScore(a, target, requiredBugs));
            locked.push(matchingCards[0].id);
        }
    }

    // Lock required Buster Addition if specified
    if (constraints?.requiredBusterAddition && !locked.some(id => {
        const c = getModCard(id, gameId);
        return matchBusterAddition(c?.busterAddition, constraints.requiredBusterAddition!);
    })) {
        const matchingCards = allCards.filter(
            c => matchBusterAddition(c.busterAddition, constraints.requiredBusterAddition!) &&
                 !c.bButton &&
                 isCardAcceptableUnderPolicy(c, policy, forbiddenBugs, bugRules)
        );
        if (matchingCards.length > 0) {
            matchingCards.sort((a, b) => evaluateCardScore(b, target, requiredBugs) - evaluateCardScore(a, target, requiredBugs));
            locked.push(matchingCards[0].id);
        }
    }

    // Lock required Body Element if specified
    if (constraints?.requiredBody && !matchBody(computeDeckStats(locked, gameId).body, constraints.requiredBody)) {
        const matchingCards = allCards.filter(
            c => c.body !== undefined && matchBody(c.body, constraints.requiredBody!) && isCardAcceptableUnderPolicy(c, policy, forbiddenBugs, bugRules)
        );
        if (matchingCards.length > 0) {
            matchingCards.sort((a, b) => evaluateCardScore(b, target, requiredBugs) - evaluateCardScore(a, target, requiredBugs));
            locked.push(matchingCards[0].id);
        }
    }

    if (constraints?.allowedBodies !== undefined && !isBodyAllowed(computeDeckStats(locked, gameId).body, constraints)) {
        const matchingCards = allCards.filter(c => c.body !== undefined && isBodyAllowed(c.body, constraints) &&
            isCardAcceptableUnderPolicy(c, policy, forbiddenBugs, bugRules));
        matchingCards.sort((a, b) => evaluateCardScore(b, target, requiredBugs) - evaluateCardScore(a, target, requiredBugs));
        if (matchingCards.length > 0) locked.push(matchingCards[0].id);
    }

    // Lock required Gauge speed if specified (only if baseline 'normal' does not already satisfy it)
    const gaugeRestricted = constraints?.allowedGauges !== undefined || constraints?.requiredGauge;
    const baselineGaugeSatisfied = isGaugeAllowed(undefined, constraints);
    if (gaugeRestricted && !baselineGaugeSatisfied && !locked.some(id => isGaugeAllowed(getModCard(id, gameId)?.gauge, constraints))) {
        const matchingCards = allCards.filter(
            c => c.gauge && isGaugeAllowed(c.gauge, constraints) && isCardAcceptableUnderPolicy(c, policy, forbiddenBugs, bugRules)
        );
        if (matchingCards.length > 0) {
            matchingCards.sort((a, b) => evaluateCardScore(b, target, requiredBugs) - evaluateCardScore(a, target, requiredBugs));
            locked.push(matchingCards[0].id);
        }
    }

    const lockedSet = new Set(locked);

    const candidateCards = allCards.filter(c => {
        if (lockedSet.has(c.id)) return false;
        if (!isCardAcceptableUnderPolicy(c, policy, forbiddenBugs, bugRules)) return false;
        if (constraints?.requiredSpecialMove) {
            if (constraints.requiredSpecialMove === "ChargeShot") {
                if (c.bPwrAtk && c.bPwrAtk.toLowerCase() !== "chargeshot") return false;
            } else {
                if (c.bPwrAtk && !matchSpecialMove(c.bPwrAtk, constraints.requiredSpecialMove)) return false;
            }
        }
        if (constraints?.requiredBLeft && c.bLeft && !matchBLeft(c.bLeft, constraints.requiredBLeft)) return false;
        if (constraints?.requiredBButton) {
            if (constraints.requiredBButton === "none") {
                if (c.bButton) return false;
            } else {
                if (c.bButton && !matchBButton(c.bButton, constraints.requiredBButton)) return false;
            }
        }
        if (constraints?.requiredChargeAddition) {
            if (c.disabledChargeAddition) return false;
            if (c.bPwrAtk && c.bPwrAtk.toLowerCase() !== "chargeshot") return false;
            if (c.chargeAddition && !matchChargeAddition(c.chargeAddition, constraints.requiredChargeAddition)) return false;
        }
        if (constraints?.requiredBusterAddition) {
            if (c.disabledBusterAddition) return false;
            if (c.bButton) return false;
            if (c.busterAddition && !matchBusterAddition(c.busterAddition, constraints.requiredBusterAddition)) return false;
        }
        if (c.body !== undefined && !isBodyAllowed(c.body, constraints)) return false;
        if (c.gauge && !isGaugeAllowed(c.gauge, constraints)) return false;
        return true;
    });

    if (gameId === "bn4") {
        const usedSlots = new Set<string>();
        for (const id of locked) {
            const card = getModCard(id, gameId);
            if (card && card.slot) usedSlots.add(card.slot);
        }

        const mainSlots = ["0A", "0B", "0C", "0D", "0E"];
        const selected = [...locked];

        for (const slot of mainSlots) {
            if (usedSlots.has(slot)) continue;
            const slotCandidates = candidateCards
                .filter(c => c.slot === slot)
                .map(c => ({ card: c, score: evaluateCardScore(c, target, requiredBugs) }))
                .filter(item => item.score > 0)
                .sort((a, b) => b.score - a.score);

            if (slotCandidates.length > 0) {
                selected.push(slotCandidates[0].card.id);
                usedSlots.add(slot);
            }
        }
        return orderModCardsForConstraints(selected, gameId, constraints);
    }

    // BN5 / BN6: 80 MB Knapsack DP with Bitmask over required abilities
    const maxCapacity = 80;
    let usedMb = 0;
    const coveredAbilities = new Set<string>();
    for (const id of locked) {
        const card = getModCard(id, gameId);
        if (card) {
            usedMb += card.mb;
            for (const ab of card.abilities || []) {
                coveredAbilities.add(ab);
            }
        }
    }

    const remainingMb = maxCapacity - usedMb;
    if (remainingMb <= 0) return [...locked];

    const reqAbilities = (constraints?.requiredAbilities || []).filter(ab => !coveredAbilities.has(ab));
    const numReq = Math.min(reqAbilities.length, 6);
    const maxMask = 1 << numReq;

    interface DpState {
        score: number;
        items: string[];
    }

    const dp: DpState[][] = Array.from({ length: maxMask }, () =>
        Array.from({ length: remainingMb + 1 }, () => ({
            score: -1,
            items: [],
        }))
    );
    dp[0][0] = { score: 0, items: [] };

    for (const card of candidateCards) {
        const weight = card.mb;
        if (weight > remainingMb) continue;

        let cardMask = 0;
        for (let i = 0; i < numReq; i++) {
            if (card.abilities && card.abilities.includes(reqAbilities[i])) {
                cardMask |= (1 << i);
            }
        }

        const baseVal = evaluateCardScore(card, target, requiredBugs);
        if (baseVal <= 0 && cardMask === 0) continue;

        for (let mask = maxMask - 1; mask >= 0; mask--) {
            const nextMask = mask | cardMask;
            const newlyCovered = nextMask ^ mask;
            let abilityBonus = 0;
            for (let i = 0; i < numReq; i++) {
                if (newlyCovered & (1 << i)) {
                    abilityBonus += 400; // Big bonus for satisfying a required ability
                }
            }
            const val = baseVal + abilityBonus;

            for (let w = remainingMb - weight; w >= 0; w--) {
                if (dp[mask][w].score < 0) continue;
                const newScore = dp[mask][w].score + val;
                if (newScore > dp[nextMask][w + weight].score) {
                    dp[nextMask][w + weight] = {
                        score: newScore,
                        items: [...dp[mask][w].items, card.id],
                    };
                }
            }
        }
    }

    // Find state covering the most required abilities, then best score
    let best = dp[0][0];
    let bestMaskPop = -1;

    for (let mask = maxMask - 1; mask >= 0; mask--) {
        const pop = mask.toString(2).replace(/0/g, "").length;
        if (pop < bestMaskPop) continue;

        for (let w = 0; w <= remainingMb; w++) {
            if (dp[mask][w].score >= 0) {
                if (pop > bestMaskPop || dp[mask][w].score > best.score) {
                    best = dp[mask][w];
                    bestMaskPop = pop;
                }
            }
        }
    }

    return orderModCardsForConstraints([...locked, ...best.items], gameId, constraints);
}

interface RankedCandidate {
    partIndex: number;
    id: number;
    name: string;
    score: number;
    cellCount: number;
    density: number;
}

/**
 * Calculates a priority score for candidate parts based on the optimization target.
 */
function evaluatePartScore(gameId: string, partMeta: { id: number; name: string }, target: OptimizationTarget): number {
    const effect = getPartEffect(gameId, partMeta.id);
    if (!effect) return 0;

    const hp = effect.hp ?? 0;
    const attack = effect.attackMax ? 5 : (effect.attack ?? 0);
    return target === "max_attack" ? attack * 120 + hp * 0.2 : hp + attack * 10;
}

/**
 * Extracts and ranks all beneficial filler parts available in the game dataset.
 */
export function getCandidateFillerParts(data: Data, target: OptimizationTarget = "max_hp"): number[] {
    const scored: RankedCandidate[] = [];

    for (let idx = 0; idx < data.partMetas.length; idx++) {
        const meta = data.partMetas[idx];
        const part = data.parts[idx];
        const score = evaluatePartScore(data.gameId, meta, target);
        if (score <= 0) continue;

        // Count cells in compressed mask
        const cellCount = part.compressedMask.filter(Boolean).length || 1;
        const density = score / cellCount;

        scored.push({
            partIndex: idx,
            id: meta.id,
            name: meta.name,
            score,
            cellCount,
            density,
        });
    }

    // Sort descending by score, then density
    scored.sort((a, b) => b.score - a.score || b.density - a.density);
    return scored.map(s => s.partIndex);
}

/** Positive means a is better. Hard constraints are checked before ranking builds. */
export function compareBuildStats(a: BuildStats, b: BuildStats, target: OptimizationTarget): number {
    return target === "max_attack"
        ? a.attack - b.attack || a.finalHp - b.finalHp
        : a.finalHp - b.finalHp || a.attack - b.attack;
}

interface SearchNode {
    requirements: Requirement[];
    solution: Solution;
    stats: BuildStats;
    analysis: SolutionBugAnalysis;
    addedPartIndices: number[];
}

/** Push only forbidden placement bugs into the solver; allowed bugs remain searchable. */
export function requirementsUnderPolicy(
    data: Data,
    requirements: Requirement[],
    policy: BugPolicy,
    forbiddenBugs: string[],
    bugRules?: Partial<Record<string, BugTolerance>>,
    modCards: string[] = []
): Requirement[] {
    // BugStop can absorb other parts' placement bugs. Judge those layouts as a whole.
    if (requirements.some(r => getPartEffect(data.gameId, data.partMetas[r.partIndex].id)?.abilities?.includes("bugStop"))) {
        return requirements;
    }
    // Card repairs can also neutralize placement bugs; leave their interpretation
    // to the full analysis instead of assuming every local bug remains active.
    if (modCards.length > 0 && computeDeckStats(modCards, data.gameId).repairedBugs.length > 0) return requirements;
    const rules = bugRules ?? policy.customRules;
    return requirements.map(req => {
        const forbidden = getPartBugTypes(data.gameId, data.partMetas[req.partIndex].id).some(type => {
            const norm = data.gameId === "bn6" && type === "panel" ? "panelCrack" : normalizeBugType(type);
            if (rules !== undefined || policy.type === "custom") {
                return getBugRule(rules, norm, type) === "forbidden";
            } else if (forbiddenBugs.length > 0) {
                return forbiddenBugs.some(b => normalizeBugType(b).toLowerCase() === norm.toLowerCase()) ||
                    !(["buster", "customhp", "emotion"].includes(norm.toLowerCase()) || isBenignBug(type, 1));
            } else {
                return policy.type === "no_bugs" || !isBenignBug(type, 1);
            }
        });
        return forbidden ? {
            ...req,
            constraint: { ...req.constraint, maxBugLevel: Math.min(req.constraint.maxBugLevel, 0) },
        } : req;
    });
}

/**
 * Verifies whether a completed build satisfies all user constraints.
 */
export function doesBuildSatisfyConstraints(
    stats: BuildStats,
    analysis: SolutionBugAnalysis,
    constraints?: BuildConstraints
): boolean {
    if (!constraints) return true;

    // Check the final capped values, including all card bonuses and penalties.
    const minimums = getBusterMinimums(constraints);
    if (BUSTER_STATS.some(stat => stats[stat] < (minimums[stat] ?? 1))) return false;
    if ((stats.modChipRecovery ?? 0) < (constraints.minChipRecovery ?? 0)) return false;
    if (constraints.minCustom !== undefined && stats.custom < constraints.minCustom) return false;

    if (constraints.requiredAbilities && constraints.requiredAbilities.length > 0) {
        const buildAbilities = new Set(stats.abilities || []);
        for (const ab of constraints.requiredAbilities) {
            if (!buildAbilities.has(ab)) return false;
        }
    }

    if (constraints.requiredSpecialMove) {
        if (!matchSpecialMove(stats.modBPwrAtk, constraints.requiredSpecialMove)) {
            return false;
        }
    }

    if (constraints.requiredBLeft) {
        if (!matchBLeft(stats.modBLeft, constraints.requiredBLeft)) {
            return false;
        }
    }

    if (constraints.requiredBButton) {
        if (!matchBButton(stats.modBButton, constraints.requiredBButton)) return false;
    }

    if (constraints.requiredChargeAddition) {
        if (!matchChargeAddition(stats.modChargeAddition, constraints.requiredChargeAddition)) return false;
    }

    if (constraints.requiredBusterAddition) {
        if (!matchBusterAddition(stats.modBusterAddition, constraints.requiredBusterAddition)) return false;
    }

    if (!isBodyAllowed(stats.modBody, constraints)) return false;

    if (!isGaugeAllowed(stats.modGauge, constraints)) return false;

    const effectiveBugs = getEffectiveInBattleBugs(analysis);

    if (constraints.bugRules && Object.keys(constraints.bugRules).length > 0) {
        for (const b of effectiveBugs) {
            const norm = normalizeBugType(b.bugType);
            const tolerance = getBugRule(constraints.bugRules, norm, b.bugType);
            if (tolerance === "forbidden") return false;
            if (tolerance === "allowed_lv1" && b.level > 1) return false;
        }

        for (const [bugType, tolerance] of Object.entries(constraints.bugRules)) {
            if (tolerance === "required") {
                const norm = normalizeBugType(bugType).toLowerCase();
                const found = effectiveBugs.some(
                    b => bugMatchesRule(normalizeBugType(b.bugType), norm) && b.level >= 1
                );
                if (!found) return false;
            }
        }
    } else if (constraints.forbiddenBugs && constraints.forbiddenBugs.length > 0) {
        for (const b of effectiveBugs) {
            const norm = normalizeBugType(b.bugType).toLowerCase();
            if (constraints.forbiddenBugs.some(fb => bugMatchesRule(norm, normalizeBugType(fb)))) {
                return false;
            }
        }
    }

    return true;
}

/**
 * Runs Beam Search to pack filler parts on the NaviCust grid.
 */
function runNaviCustBeamSearch(
    data: Data,
    baseProblem: Problem,
    initialReqs: Requirement[],
    modCards: string[],
    policy: BugPolicy,
    target: OptimizationTarget,
    gridSettings: GridSettings,
    spinnableColors: boolean[],
    baseHp: number,
    allCandidates: number[],
    forbiddenBugs: string[],
    bugRules: Partial<Record<string, BugTolerance>> | undefined,
    startTime: number,
    timeoutMs: number,
    beamWidth: number,
    onSearchWork?: OptimizeOptions["onSearchWork"]
): SearchNode | null {
    const shouldStop = () => Date.now() - startTime >= timeoutMs;
    const findPlacement = (requirements: Requirement[]) => {
        onSearchWork?.("candidate");
        const searchReqs = requirementsUnderPolicy(data, requirements, policy, forbiddenBugs, bugRules, modCards);
        for (const solution of solve(data.parts, searchReqs, gridSettings, spinnableColors, shouldStop, true, onSearchWork ? () => onSearchWork("placement") : undefined, true)) {
            if (shouldStop()) break;
            const occ = placeAll(data.parts, requirements, solution, gridSettings);
            const analysis = analyzeSolutionBugs(data.gameId, data.partMetas, requirements, occ, gridSettings, "en", modCards);
            if (isSolutionAcceptable(analysis, policy, forbiddenBugs, bugRules)) {
                return { solution, analysis, stats: computePlacedBuildStats(data.gameId, data.partMetas, requirements,
                    occ, gridSettings, modCards, baseHp) };
            }
        }
        return null;
    };
    const root = findPlacement(initialReqs);
    if (!root) return null;

    const rootStats = root.stats;

    const rootNode: SearchNode = {
        requirements: initialReqs,
        solution: root.solution,
        stats: rootStats,
        analysis: root.analysis,
        addedPartIndices: [],
    };

    let bestNode: SearchNode = rootNode;
    let beam: SearchNode[] = [rootNode];

    while (beam.length > 0) {
        if (Date.now() - startTime >= timeoutMs) break;

        const nextNodes: SearchNode[] = [];

        for (const node of beam) {
            if (Date.now() - startTime >= timeoutMs) break;
            if (node.requirements.length >= 25) continue;

            const existingIndices = new Set(node.requirements.map(r => r.partIndex));
            const existingColors = new Set(node.requirements.map(r => data.parts[r.partIndex].color));

            for (const candIdx of allCandidates) {
                if (Date.now() - startTime >= timeoutMs) break;
                if (existingIndices.has(candIdx)) continue;

                const candPart = data.parts[candIdx];

                // BN4-6 allow six colors; their overflow bug is checked by the final policy.
                if (data.gameId !== "bn3") {
                    if (!existingColors.has(candPart.color) && existingColors.size >= 6) {
                        continue;
                    }
                } else if (data.styleColorRules) {
                    const ok = isPartCompatible(data, {
                        ...baseProblem,
                        requirements: node.requirements,
                    }, candIdx);
                    if (!ok) continue;
                }

                const candReq: Requirement = {
                    partIndex: candIdx,
                    constraint: {
                        onCommandLine: null,
                        minBugLevel: 0,
                        maxBugLevel: Infinity,
                        compressed: true,
                    },
                };

                const testReqs = [...node.requirements, candReq];
                const found = findPlacement(testReqs);
                const foundSolution = found?.solution;
                const foundAnalysis = found?.analysis;

                if (foundSolution && foundAnalysis) {
                    const testStats = found.stats;

                    const childNode: SearchNode = {
                        requirements: testReqs,
                        solution: foundSolution,
                        stats: testStats,
                        analysis: foundAnalysis,
                        addedPartIndices: [...node.addedPartIndices, candIdx],
                    };

                    nextNodes.push(childNode);

                    if (compareBuildStats(testStats, bestNode.stats, target) > 0) {
                        bestNode = childNode;
                    }
                }
            }
        }

        if (nextNodes.length === 0) break;
        nextNodes.sort((a, b) => compareBuildStats(b.stats, a.stats, target));
        beam = nextNodes.slice(0, beamWidth);
    }

    return bestNode;
}

/**
 * Optimizes the build by automatically selecting and packing optimal filler parts
 * onto the remaining NaviCust grid while satisfying the user's BugPolicy and constraints.
 */
export function optimizeBuild(options: OptimizeOptions): OptimizeResult | null {
    const {
        data,
        problem,
        policy = problem.bugPolicy ?? DEFAULT_BUG_POLICY,
        target = "max_hp",
        timeoutMs = 3000,
        beamWidth = 6,
        modCardMode = "keep",
        constraints = problem.constraints,
    } = options;

    if (!bodyConstraintsPossible(constraints) || !gaugeConstraintsPossible(constraints) || !busterMinimumsPossible(options)) return null;
    const startTime = Date.now();
    const gridSettings = makeGridSettings(data, problem);
    const spinnableColors = problem.spinnableColors;
    const baseHp = problem.baseHp ?? 1000;
    const forbiddenBugs = constraints?.forbiddenBugs || [];
    const allCandidates = getCandidateFillerParts(data, target);

    // Helper to generate NC requirements for missing abilities
    const createReqsForAbilities = (abilities: string[]): Requirement[] | null => {
        const extraReqs: Requirement[] = [];
        const existingIndices = new Set(problem.requirements.map(r => r.partIndex));
        const covered = new Set(computeBuildStats(data.gameId,
            problem.requirements.map(req => data.partMetas[req.partIndex].id), [], baseHp).abilities);
        for (const ab of abilities) {
            if (covered.has(ab)) continue;
            const partIdx = findPartIndexByAbility(data, ab);
            if (partIdx === -1) return null; // NC cannot provide this ability
            if (!existingIndices.has(partIdx)) {
                extraReqs.push({
                    partIndex: partIdx,
                    constraint: {
                        onCommandLine: null,
                        minBugLevel: 0,
                        maxBugLevel: Infinity,
                        compressed: true,
                    },
                });
                existingIndices.add(partIdx);
            }
        }
        return [...problem.requirements, ...extraReqs];
    };

    interface CandidateBranch {
        modCards: string[];
        reqs: Requirement[];
        isAutoCards: boolean;
    }

    const branches: CandidateBranch[] = [];

    if (data.gameId !== "bn3" && modCardMode === "auto") {
        // Branch 0: Mod Cards prioritized to cover abilities
        const modCards0 = optimizeModCards({
            gameId: data.gameId,
            existingCardIds: [],
            target,
            policy,
            constraints,
        });
        const deck0 = computeDeckStats(modCards0, data.gameId);
        const covered0 = new Set(deck0.activeAbilities || []);
        const uncovered0 = (constraints?.requiredAbilities || []).filter(ab => !covered0.has(ab));
        const reqs0 = createReqsForAbilities(uncovered0);
        if (reqs0) {
            branches.push({ modCards: modCards0, reqs: reqs0, isAutoCards: true });
        }

        // Branch 1: NC covers all required abilities that NC can provide, Mod Cards optimize remaining
        const ncFeasibleAbilities = (constraints?.requiredAbilities || []).filter(
            ab => findPartIndexByAbility(data, ab) >= 0
        );
        const reqs1 = createReqsForAbilities(ncFeasibleAbilities);
        if (reqs1) {
            const modConstraints1: BuildConstraints = {
                ...constraints,
                requiredAbilities: (constraints?.requiredAbilities || []).filter(
                    ab => findPartIndexByAbility(data, ab) < 0
                ),
            };
            const modCards1 = optimizeModCards({
                gameId: data.gameId,
                existingCardIds: [],
                target,
                policy,
                constraints: modConstraints1,
            });
            branches.push({ modCards: modCards1, reqs: reqs1, isAutoCards: true });
        }
    } else {
        // modCardMode === "none" or "keep"
        let modCards: string[] = [];
        if (data.gameId !== "bn3" && modCardMode === "keep") {
            modCards = problem.modCards || [];
        }

        if (constraints?.requiredSpecialMove) {
            const deck = computeDeckStats(modCards, data.gameId);
            if (!matchSpecialMove(deck.bPwrAtk, constraints.requiredSpecialMove)) return null;
        }
        if (constraints?.requiredBLeft) {
            const deck = computeDeckStats(modCards, data.gameId);
            if (!matchBLeft(deck.bLeft, constraints.requiredBLeft)) return null;
        }
        if (constraints?.requiredBButton) {
            const deck = computeDeckStats(modCards, data.gameId);
            if (!matchBButton(deck.bButton, constraints.requiredBButton)) return null;
        }
        if (constraints?.requiredChargeAddition) {
            const deck = computeDeckStats(modCards, data.gameId);
            if (!matchChargeAddition(deck.chargeAddition, constraints.requiredChargeAddition)) return null;
        }
        if (constraints?.requiredBusterAddition) {
            const deck = computeDeckStats(modCards, data.gameId);
            if (!matchBusterAddition(deck.busterAddition, constraints.requiredBusterAddition)) return null;
        }
        if (!isBodyAllowed(computeDeckStats(modCards, data.gameId).body, constraints)) return null;
        if (!isGaugeAllowed(computeDeckStats(modCards, data.gameId).gauge, constraints)) return null;

        const deck = computeDeckStats(modCards, data.gameId);
        const covered = new Set(deck.activeAbilities || []);
        const uncovered = (constraints?.requiredAbilities || []).filter(ab => !covered.has(ab));
        const reqs = createReqsForAbilities(uncovered);
        if (reqs) {
            branches.push({ modCards, reqs, isAutoCards: false });
        }
    }

    if (branches.length === 0) {
        return null;
    }

    let bestResult: OptimizeResult | null = null;

    for (const [branchIndex, branch] of branches.entries()) {
        if (Date.now() - startTime >= timeoutMs) break;

        // Reserve time for each alternative NC/card allocation.
        const elapsed = Date.now() - startTime;
        const branchDeadline = elapsed + (timeoutMs - elapsed) / (branches.length - branchIndex);

        const node = runNaviCustBeamSearch(
            data,
            problem,
            branch.reqs,
            branch.modCards,
            policy,
            target,
            gridSettings,
            spinnableColors,
            baseHp,
            allCandidates,
            forbiddenBugs,
            constraints?.bugRules,
            startTime,
            branchDeadline,
            beamWidth,
            options.onSearchWork
        );

        if (!node) continue;

        if (!doesBuildSatisfyConstraints(node.stats, node.analysis, constraints)) {
            continue;
        }

        if (!bestResult || compareBuildStats(node.stats, bestResult.stats, target) > 0) {
            bestResult = {
                problem: {
                    ...problem,
                    requirements: node.requirements,
                    bugPolicy: policy,
                    modCards: branch.modCards,
                    constraints,
                },
                solution: node.solution,
                stats: node.stats,
                analysis: node.analysis,
                addedPartIndices: [
                    ...branch.reqs.slice(problem.requirements.length).map(r => r.partIndex),
                    ...node.addedPartIndices,
                ],
                addedCardIds: branch.isAutoCards ? branch.modCards : [],
            };
        }
    }

    return bestResult ? removeRedundantAbilityParts(options, bestResult) : null;
}
