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
    isNonBattleProgram,
    isSolutionAcceptable,
    NON_BATTLE_ABILITIES,
    normalizeBugType,
    BugDefinition,
    BuildStats,
    GAME_BUG_DEFINITIONS,
    SolutionBugAnalysis,
} from "./effects";
import {
    getModCards,
    getModCard,
    computeDeckStats,
    repairsBugType,
    ModCard,
} from "./modcards";
import { BODY_ELEMENTS, GAUGE_VALUES, BUSTER_STATS, BusterStat, getBusterMinimums, getMaxAllowedBugLevel, BugPolicy, BugTolerance, BuildConstraints, DEFAULT_BUG_POLICY, Problem, makeGridSettings } from "./problem";
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

/** Preserve effects when simplifying a build, except optional automatic BugStop and unrequested non-battle abilities. */
export function haveSameBuildEffects(a: BuildStats, b: BuildStats, constraints?: BuildConstraints): boolean {
    const normalize = (stats: BuildStats) => ({
        ...stats,
        abilities: stats.abilities.filter(ability =>
            constraints?.requiredAbilities?.includes(ability) ||
            (ability !== "bugStop" && !NON_BATTLE_ABILITIES.has(ability))
        ),
    });
    return JSON.stringify(normalize(a)) === JSON.stringify(normalize(b));
}

/** Clean a valid completed build, without pruning intermediate search states. */
export function removeRedundantAbilityParts(options: OptimizeOptions, result: OptimizeResult): OptimizeResult {
    const { data, problem, constraints = problem.constraints,
        policy = problem.bugPolicy ?? DEFAULT_BUG_POLICY } = options;
    const grid = makeGridSettings(data, result.problem);
    const cards = result.problem.modCards ?? [];
    let cleaned = result;
    const initialCells = placeAll(data.parts, result.problem.requirements, result.solution, grid);
    const onLine = new Set<number>();
    for (let x = 0; x < grid.width; x++) {
        const index = initialCells[grid.commandLineRow * grid.width + x];
        if (index != null && index >= 0) onLine.add(index);
    }
    const candidates = result.problem.requirements.map((req, index) => {
        const partId = data.partMetas[req.partIndex].id;
        const isSolid = data.parts[req.partIndex].isSolid;
        const isOffLineSolid = isSolid && !onLine.has(index);
        const effect = getPartEffect(data.gameId, partId);
        const nonBattle = isNonBattleProgram(data.gameId, partId, constraints?.requiredAbilities);
        const pureAbility = Boolean(effect?.abilities?.length && !Object.entries(effect).some(([key, value]) => key !== "abilities" && value));
        return { req, index, abilityCount: effect?.abilities?.length ?? 0, pureAbility, isOffLineSolid, effect, nonBattle };
    }).filter(c => c.index >= problem.requirements.length && c.req.constraint.minBugLevel === 0 &&
        (c.isOffLineSolid || c.effect !== undefined || c.nonBattle))
        .sort((a, b) => Number(!a.isOffLineSolid) - Number(!b.isOffLineSolid) ||
            Number(!a.pureAbility) - Number(!b.pureAbility) ||
            a.abilityCount - b.abilityCount || b.index - a.index);
    const removed = new Set<number>();
    for (const candidate of candidates) {
        // Translate the original index after earlier removals; repeated part
        // indices may have different placement constraints and must stay distinct.
        const index = candidate.index - [...removed].filter(i => i < candidate.index).length;
        const requirements = cleaned.problem.requirements.filter((_, i) => i !== index);
        const solution = cleaned.solution.filter((_, i) => i !== index);
        const cells = placeAll(data.parts, requirements, solution, grid);
        const stats = computePlacedBuildStats(data.gameId, data.partMetas, requirements,
            cells, grid, cards, problem.baseHp ?? 1000);
        // Optional automatic BugStop can disappear only if the remaining layout
        // still satisfies the full policy, requirements and placement constraints.
        if (!haveSameBuildEffects(stats, cleaned.stats, constraints)) continue;
        if (!meetsPlacementBugConstraints(data.parts, requirements, solution, grid)) continue;
        const analysis = analyzeSolutionBugs(data.gameId, data.partMetas, requirements,
            cells, grid, "en", cards);
        if (!isSolutionAcceptable(analysis, policy, constraints?.forbiddenBugs, constraints?.bugRules,
                constraints?.allowSupportBugGlitch) ||
            !doesBuildSatisfyConstraints(stats, analysis, constraints, data.gameId)) continue;
        cleaned = { ...cleaned, problem: { ...cleaned.problem, requirements }, solution, stats, analysis,
            addedPartIndices: requirements.slice(problem.requirements.length).map(req => req.partIndex) };
        removed.add(candidate.index);
    }
    return cleaned;
}

/** Check whether a part directly generates a specific normalized bug type when placed improperly. */
export function partDirectlySuppliesBug(
    data: Data,
    partIndex: number,
    targetNormalizedBug: string
): boolean {
    const meta = data.partMetas[partIndex];
    if (!meta) return false;
    for (const rawType of getPartBugTypes(data.gameId, meta.id)) {
        const expandedTypes =
            (data.gameId === "bn5" || data.gameId === "bn6") && rawType === "panel"
                ? ["panelCrack"]
                : data.gameId === "bn4" && rawType === "player"
                    ? ["player", "playerConfuse", "playerMoveForward", "playerMoveBackward"]
                    : data.gameId === "bn3" && rawType === "involuntaryMove"
                        ? ["involuntaryMove", "movement", "involuntaryMoveUp", "involuntaryMoveDown", "involuntaryMoveConfuse"]
                        : data.gameId === "bn3" && rawType === "charge"
                            ? ["charge", "chargeCube", "chargeWater", "chargeFlower"]
                            : data.gameId === "bn3" && rawType === "buster"
                                ? ["buster", "busterBlank", "busterBlank1", "busterBlank2", "busterGuard"]
                                : [normalizeBugType(rawType)];
        if (expandedTypes.some(t => bugMatchesRule(t, targetNormalizedBug))) {
            return true;
        }
    }
    return false;
}

/** Check whether a part can contribute to any bug rule marked "required". */
export function partCanSupplyRequiredBug(
    data: Data,
    partIndex: number,
    rules?: Partial<Record<string, BugTolerance>>
): boolean {
    const requiredKeys = Object.entries(rules ?? {})
        .filter(([, tol]) => tol === "required")
        .map(([k]) => normalizeBugType(k));
    if (requiredKeys.length === 0) return false;
    if (data.gameId !== "bn3" && requiredKeys.some(k => k === "status" || k === "colorStatus")) {
        return true;
    }
    return requiredKeys.some(reqKey => partDirectlySuppliesBug(data, partIndex, reqKey));
}

/** Check whether a non-BugStop part directly supplies a required bug or requested move panel. */
export function partSuppliesRequiredPanelOrBug(
    data: Data,
    partIndex: number,
    rules?: Partial<Record<string, BugTolerance>>,
    allowedMovePanels?: string[]
): boolean {
    const meta = data.partMetas[partIndex];
    if (!meta) return false;
    if (getPartEffect(data.gameId, meta.id)?.abilities?.includes("bugStop")) {
        return false;
    }
    const requiredKeys = Object.entries(rules ?? {})
        .filter(([, tol]) => tol === "required")
        .map(([k]) => normalizeBugType(k));
    if (requiredKeys.some(reqKey => partDirectlySuppliesBug(data, partIndex, reqKey))) {
        return true;
    }
    if (
        allowedMovePanels &&
        allowedMovePanels.length > 0 &&
        !allowedMovePanels.some(p => p.toLowerCase() === "none") &&
        getPartBugTypes(data.gameId, meta.id).includes("panel")
    ) {
        const ncPanels = data.gameId === "bn4"
            ? ["panelCrack", "panelHole", "panelPoison"]
            : ["panelCrack1", "panelCrack2", "panelCrack3"];
        if (ncPanels.some(actual => allowedMovePanels.some(target => matchMovePanel(actual, target)))) {
            return true;
        }
    }
    return false;
}

/**
 * Determine whether an automatically placed (or unconstrained) solid program should be locked on the command line.
 * Off-line solid programs contribute no ability/stat effects and are only useful when triggering a requested bug.
 */
export function shouldLockSolidOnCommandLine(
    data: Data,
    partIndex: number,
    rules?: Partial<Record<string, BugTolerance>>,
    allowSupportBugGlitch?: boolean,
    allowedMovePanels?: string[],
    requiredAbilities?: readonly string[]
): boolean {
    if (!data.parts[partIndex]?.isSolid) return false;
    const meta = data.partMetas[partIndex];
    if (!meta) return false;
    if (isNonBattleProgram(data.gameId, meta.id, requiredAbilities)) {
        return false;
    }
    if (getPartEffect(data.gameId, meta.id)?.abilities?.some(ab => requiredAbilities?.includes(ab))) {
        return true;
    }
    if (data.gameId === "bn5" && allowSupportBugGlitch && (meta.id === 30 || meta.id === 31)) {
        return false;
    }
    if (partCanSupplyRequiredBug(data, partIndex, rules)) {
        return false;
    }
    if (
        allowedMovePanels &&
        allowedMovePanels.length > 0 &&
        !allowedMovePanels.some(p => p.toLowerCase() === "none") &&
        getPartBugTypes(data.gameId, meta.id).includes("panel")
    ) {
        const ncPanels = data.gameId === "bn4"
            ? ["panelCrack", "panelHole", "panelPoison"]
            : ["panelCrack1", "panelCrack2", "panelCrack3"];
        if (ncPanels.some(actual => allowedMovePanels.some(target => matchMovePanel(actual, target)))) {
            return false;
        }
    }
    return true;
}

/** Mark unconstrained non-battle programs whose own bug is allowed so the solver tries off-line in-bounds first. */
export function buildPreferOffLineReqs(
    data: Data,
    requirements: Requirement[],
    requiredAbilities?: readonly string[]
): boolean[] {
    return requirements.map(req =>
        isNonBattleProgram(data.gameId, data.partMetas[req.partIndex]?.id, requiredAbilities) &&
        req.constraint.onCommandLine !== true &&
        req.constraint.maxBugLevel > 0
    );
}

/** Score NC placement bug load so tie-breakers prefer cleaner, zero-bug layouts. */
export function countNcPlacementBugLoad(
    analysis: SolutionBugAnalysis,
    requiredAbilities?: readonly string[],
    rules?: Partial<Record<string, BugTolerance>>
): number {
    const gameId = analysis.gameId ?? "bn6";
    const bugs = analysis.bugs ?? [];
    const wantsColorBug = rules?.status === "required" || rules?.colorStatus === "required";
    const rawLoad = bugs.reduce((sum, b) => {
        if (isNonBattleProgram(gameId, b.partId, requiredAbilities) && !b.causes.includes("outOfBounds")) {
            return sum;
        }
        return sum + b.level;
    }, 0) + (!wantsColorBug && analysis.tooManyColors ? Math.max(0, analysis.distinctColorCount - 4) : 0);
    const activeNcLoad = (analysis.activeBugs ?? [])
        .filter(b => !b.isModCardBug)
        .reduce((sum, b) => {
            if (b.bugType === "colorStatus" && wantsColorBug) return sum;
            const matchingRaw = bugs.filter(raw => normalizeBugType(raw.bugType) === normalizeBugType(b.bugType));
            const onlyNonBattleInBounds = b.bugType !== "colorStatus" &&
                matchingRaw.length > 0 &&
                matchingRaw.every(raw =>
                    isNonBattleProgram(gameId, raw.partId, requiredAbilities) &&
                    !raw.causes.includes("outOfBounds"));
            return onlyNonBattleInBounds ? sum : sum + b.level;
        }, 0);
    return activeNcLoad * 100 + rawLoad;
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

/** Safe upper bound for BN5 Soul Time before packing. */
export function soulTimeMinimumPossible(options: OptimizeOptions): boolean {
    const { data, problem, constraints = problem.constraints, modCardMode = "keep" } = options;
    if (data.gameId !== "bn5") return true;
    const minSoulTime = constraints?.minSoulTime;
    if (minSoulTime === undefined) return true;
    if (modCardMode === "auto") {
        // Max 4 copies of SoulT+1 (2x2) on BN5's 5x5 grid (+4) plus SnakeMan (+2).
        return minSoulTime <= 9;
    }
    const cards = modCardMode === "keep" ? problem.modCards ?? [] : [];
    const deck = computeDeckStats(cards, "bn5");
    const maxSoulTime = Math.max(1, 3 + 4 + (deck.stats.soulTime ?? 0));
    return minSoulTime <= maxSoulTime;
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
            const norm = normalizeBugType(getCardBugType(card.id, b.type, card.movePanel, b.level));
            const rule = getBugRule(activeRules, norm, b.type);
            if (rule === "forbidden" || (b.level ?? 1) > getMaxAllowedBugLevel(rule)) return false;
        }
        return true;
    }

    if (!card.bugs || card.bugs.length === 0) return true;
    if (forbiddenBugs && forbiddenBugs.length > 0) {
        if (card.bugs.some(b => {
            const norm = normalizeBugType(getCardBugType(card.id, b.type, card.movePanel, b.level)).toLowerCase();
            return forbiddenBugs.some(fb => bugMatchesRule(norm, normalizeBugType(fb)));
        })) {
            return false;
        }
        return card.bugs.every(b => {
            const norm = normalizeBugType(getCardBugType(card.id, b.type, card.movePanel, b.level)).toLowerCase();
            return norm === "buster" || norm === "customhp" || norm === "emotion" || isBenignBug(norm, b.level ?? 1);
        });
    }
    if (policy.type === "no_bugs") return false;
    if (policy.type === "benign_allowed") {
        return card.bugs.every(b => isBenignBug(getCardBugType(card.id, b.type, card.movePanel, b.level), b.level ?? 1));
    }
    return true;
}

/**
 * Evaluates the fitness score of a mod card based on the target.
 */
function evaluateCardScore(
    card: ModCard,
    target: OptimizationTarget,
    requiredBugs?: string[],
    requiredAbilities?: string[],
    minSoulTime?: number
): number {
    const hp = (card.stats.hp ?? 0) + (card.stats.hpPercent ? card.stats.hpPercent * 15 : 0);
    const attack = (card.stats.attack ?? 0) + (card.stats.attackMult && card.stats.attackMult > 1 ? 5 : 0);

    let abilityBonus = 0;
    if (card.abilities) {
        if (card.abilities.includes("superArmor")) abilityBonus += 50;
        if (card.abilities.includes("floatShoes")) abilityBonus += 30;
        if (card.abilities.includes("airShoes")) abilityBonus += 30;
        if (card.abilities.includes("underShirt")) abilityBonus += 20;
        if (card.abilities.includes("statusGuard")) abilityBonus += 40;
        if (requiredAbilities && requiredAbilities.length > 0) {
            for (const ab of requiredAbilities) {
                if (card.abilities.includes(ab)) {
                    abilityBonus += 400;
                }
            }
        }
    }

    if (requiredBugs && requiredBugs.length > 0 && card.bugs) {
        for (const b of card.bugs) {
            const norm = normalizeBugType(getCardBugType(card.id, b.type, card.movePanel, b.level)).toLowerCase();
            if (requiredBugs.some(rb => normalizeBugType(rb).toLowerCase() === norm)) {
                abilityBonus += 300;
            }
        }
    }

    let soulTimeBonus = 0;
    if (minSoulTime !== undefined && card.stats.soulTime) {
        if (card.stats.soulTime > 0) {
            soulTimeBonus += card.stats.soulTime * (minSoulTime > 3 ? 250 : 120);
        } else if (card.stats.soulTime < 0 && 3 + card.stats.soulTime < minSoulTime) {
            soulTimeBonus += card.stats.soulTime * 350;
        }
    }

    return (target === "max_attack" ? attack * 120 + hp * 0.2 : hp + attack * 10) + abilityBonus + soulTimeBonus;
}

export function matchSpecialMove(cardBPwrAtk: string | undefined, req: string): boolean {
    if (req === "ChargeShot" || req === "none") {
        return !cardBPwrAtk || cardBPwrAtk.toLowerCase() === "chargeshot" || cardBPwrAtk === "none";
    }
    if (!cardBPwrAtk) return false;
    const normCard = cardBPwrAtk.replace(/[\s\-_]/g, "").toLowerCase();
    const normReq = req.replace(/[\s\-_]/g, "").toLowerCase();
    return normCard === normReq || normCard.startsWith(normReq) || normReq.startsWith(normCard);
}

export function matchBLeft(cardBLeft: string | undefined, req: string): boolean {
    if (req === "none") return !cardBLeft || cardBLeft === "none";
    if (!cardBLeft) return false;
    const normCard = cardBLeft.replace(/[\s\-_]/g, "").toLowerCase();
    const normReq = req.replace(/[\s\-_]/g, "").toLowerCase();
    return normCard === normReq || normCard.startsWith(normReq) || normReq.startsWith(normCard);
}

export function matchBButton(cardBButton: string | undefined, req: string): boolean {
    if (req === "none") return !cardBButton || cardBButton === "none";
    if (!cardBButton) return false;
    if (req === "Meteor1") return cardBButton.startsWith("Meteor1");
    return cardBButton === req || cardBButton.toLowerCase().includes(req.toLowerCase());
}

export function matchChargeAddition(cardCA: string | undefined, req: string): boolean {
    if (req === "none") return !cardCA || cardCA === "none";
    if (!cardCA) return false;
    if (req === "Chip Destruction") return cardCA.startsWith("Chip Destruction");
    if (req === "Instant Delete") return cardCA.startsWith("Instant Delete");
    return cardCA === req || cardCA.toLowerCase().includes(req.toLowerCase());
}

export function matchBusterAddition(cardBA: string | undefined, req: string): boolean {
    if (req === "none") return !cardBA || cardBA === "none";
    if (!cardBA) return false;
    return cardBA === req || cardBA.toLowerCase().includes(req.toLowerCase());
}

export function isSpecialMoveAllowed(move: string | undefined, constraints?: BuildConstraints): boolean {
    if (constraints?.requiredSpecialMove && !matchSpecialMove(move, constraints.requiredSpecialMove)) {
        return false;
    }
    if (constraints?.allowedSpecialMoves !== undefined) {
        if (constraints.allowedSpecialMoves.length === 0) return false;
        return constraints.allowedSpecialMoves.some(allowed => matchSpecialMove(move, allowed));
    }
    return true;
}

export function isBLeftAllowed(bLeft: string | undefined, constraints?: BuildConstraints): boolean {
    if (constraints?.requiredBLeft && !matchBLeft(bLeft, constraints.requiredBLeft)) {
        return false;
    }
    if (constraints?.allowedBLefts !== undefined) {
        if (constraints.allowedBLefts.length === 0) return false;
        return constraints.allowedBLefts.some(allowed => matchBLeft(bLeft, allowed));
    }
    return true;
}

export function isBButtonAllowed(bButton: string | undefined, constraints?: BuildConstraints): boolean {
    if (constraints?.requiredBButton && !matchBButton(bButton, constraints.requiredBButton)) {
        return false;
    }
    if (constraints?.allowedBButtons !== undefined) {
        if (constraints.allowedBButtons.length === 0) return false;
        return constraints.allowedBButtons.some(allowed => matchBButton(bButton, allowed));
    }
    return true;
}

export function isChargeAdditionAllowed(ca: string | undefined, constraints?: BuildConstraints): boolean {
    if (constraints?.requiredChargeAddition && !matchChargeAddition(ca, constraints.requiredChargeAddition)) {
        return false;
    }
    if (constraints?.allowedChargeAdditions !== undefined) {
        if (constraints.allowedChargeAdditions.length === 0) return false;
        return constraints.allowedChargeAdditions.some(allowed => matchChargeAddition(ca, allowed));
    }
    return true;
}

export function isBusterAdditionAllowed(ba: string | undefined, constraints?: BuildConstraints): boolean {
    if (constraints?.requiredBusterAddition && !matchBusterAddition(ba, constraints.requiredBusterAddition)) {
        return false;
    }
    if (constraints?.allowedBusterAdditions !== undefined) {
        if (constraints.allowedBusterAdditions.length === 0) return false;
        return constraints.allowedBusterAdditions.some(allowed => matchBusterAddition(ba, allowed));
    }
    return true;
}

export function matchBody(cardBody: string | undefined, req: string): boolean {
    return (cardBody ?? "Normal").toLowerCase() === req.toLowerCase();
}

export function isBodyAllowed(body: string | undefined, constraints?: BuildConstraints, gameId?: string): boolean {
    if (gameId === "bn3" || gameId === "bn4") return true;
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

export function getEffectiveMovePanel(
    analysis: SolutionBugAnalysis,
    gameId?: string,
    stats?: BuildStats
): string {
    const effectiveBugs = getEffectiveInBattleBugs(analysis);
    const cardPanelBug = effectiveBugs.find(b => b.isModCardBug && (
        b.bugType === "panelGrass" ||
        b.bugType === "panelIce" ||
        b.bugType === "panelHoly" ||
        b.bugType === "panelSea" ||
        b.bugType === "panelHole" ||
        b.bugType === "panelMetal" ||
        b.bugType === "panelPoison" ||
        b.bugType === "panelCrack" ||
        b.bugType === "panel"
    ));

    const panelBug = cardPanelBug ?? effectiveBugs.find(b =>
        b.bugType === "panel" ||
        b.bugType === "panelCrack" ||
        b.bugType === "panelGrass" ||
        b.bugType === "panelIce" ||
        b.bugType === "panelHoly" ||
        b.bugType === "panelSea" ||
        b.bugType === "panelHole" ||
        b.bugType === "panelMetal" ||
        b.bugType === "panelPoison"
    );

    if (panelBug) {
        if (panelBug.bugType === "panelCrack" || panelBug.bugType === "panel") {
            if (gameId === "bn4") {
                if (panelBug.level === 2) return "panelHole";
                if (panelBug.level === 3) return "panelPoison";
                return "panelCrack";
            }
            const lvl = Math.min(3, Math.max(1, panelBug.level ?? 1));
            return `panelCrack${lvl}`;
        }
        return panelBug.bugType;
    }

    if (stats?.modPanelEffect) {
        return stats.modPanelEffect;
    }

    return "none";
}

export function matchMovePanel(actual: string, target: string): boolean {
    if (actual.toLowerCase() === target.toLowerCase()) return true;
    if (target.toLowerCase() === "panelcrack" && actual.toLowerCase().startsWith("panelcrack")) return true;
    return false;
}

export function isMovePanelAllowed(
    analysis: SolutionBugAnalysis,
    allowedMovePanels?: string[],
    gameId?: string,
    stats?: BuildStats
): boolean {
    if (allowedMovePanels === undefined) return true;
    if (allowedMovePanels.length === 0) return false;
    const actual = getEffectiveMovePanel(analysis, gameId, stats);
    return allowedMovePanels.some(target => matchMovePanel(actual, target));
}

export function cardSpecConstraintsPossible(constraints?: BuildConstraints): boolean {
    if (!constraints) return true;
    if (!bodyConstraintsPossible(constraints)) return false;
    if (!gaugeConstraintsPossible(constraints)) return false;
    if (constraints.allowedSpecialMoves !== undefined && constraints.allowedSpecialMoves.length === 0) return false;
    if (constraints.allowedBLefts !== undefined && constraints.allowedBLefts.length === 0) return false;
    if (constraints.allowedBButtons !== undefined && constraints.allowedBButtons.length === 0) return false;
    if (constraints.allowedChargeAdditions !== undefined && constraints.allowedChargeAdditions.length === 0) return false;
    if (constraints.allowedBusterAdditions !== undefined && constraints.allowedBusterAdditions.length === 0) return false;
    if (constraints.allowedMovePanels !== undefined && constraints.allowedMovePanels.length === 0) return false;
    if (constraints.requiredSpecialMove && !isSpecialMoveAllowed(constraints.requiredSpecialMove, constraints)) return false;
    if (constraints.requiredBLeft && !isBLeftAllowed(constraints.requiredBLeft, constraints)) return false;
    if (constraints.requiredBButton && !isBButtonAllowed(constraints.requiredBButton, constraints)) return false;
    if (constraints.requiredChargeAddition && !isChargeAdditionAllowed(constraints.requiredChargeAddition, constraints)) return false;
    if (constraints.requiredBusterAddition && !isBusterAdditionAllowed(constraints.requiredBusterAddition, constraints)) return false;
    return true;
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

    if (constraints.requiredSpecialMove || constraints.allowedSpecialMoves !== undefined) {
        sorted.sort((aId, bId) => {
            const cardA = getModCard(aId, gameId);
            const cardB = getModCard(bId, gameId);
            const aMatches = cardA?.bPwrAtk !== undefined && isSpecialMoveAllowed(cardA.bPwrAtk, constraints);
            const bMatches = cardB?.bPwrAtk !== undefined && isSpecialMoveAllowed(cardB.bPwrAtk, constraints);
            return Number(aMatches) - Number(bMatches);
        });
    }

    if (constraints.requiredBLeft || constraints.allowedBLefts !== undefined) {
        sorted.sort((aId, bId) => {
            const cardA = getModCard(aId, gameId);
            const cardB = getModCard(bId, gameId);
            const aMatches = cardA?.bLeft !== undefined && isBLeftAllowed(cardA.bLeft, constraints);
            const bMatches = cardB?.bLeft !== undefined && isBLeftAllowed(cardB.bLeft, constraints);
            return Number(aMatches) - Number(bMatches);
        });
    }

    if (constraints.requiredBButton || constraints.allowedBButtons !== undefined) {
        sorted.sort((aId, bId) => {
            const cardA = getModCard(aId, gameId);
            const cardB = getModCard(bId, gameId);
            const aMatches = cardA?.bButton !== undefined && isBButtonAllowed(cardA.bButton, constraints);
            const bMatches = cardB?.bButton !== undefined && isBButtonAllowed(cardB.bButton, constraints);
            return Number(aMatches) - Number(bMatches);
        });
    }

    if (constraints.requiredChargeAddition || constraints.allowedChargeAdditions !== undefined) {
        sorted.sort((aId, bId) => {
            const cardA = getModCard(aId, gameId);
            const cardB = getModCard(bId, gameId);
            const aMatches = cardA?.chargeAddition !== undefined && isChargeAdditionAllowed(cardA.chargeAddition, constraints);
            const bMatches = cardB?.chargeAddition !== undefined && isChargeAdditionAllowed(cardB.chargeAddition, constraints);
            return Number(aMatches) - Number(bMatches);
        });
    }

    if (constraints.requiredBusterAddition || constraints.allowedBusterAdditions !== undefined) {
        sorted.sort((aId, bId) => {
            const cardA = getModCard(aId, gameId);
            const cardB = getModCard(bId, gameId);
            const aMatches = cardA?.busterAddition !== undefined && isBusterAdditionAllowed(cardA.busterAddition, constraints);
            const bMatches = cardB?.busterAddition !== undefined && isBusterAdditionAllowed(cardB.busterAddition, constraints);
            return Number(aMatches) - Number(bMatches);
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

    if (constraints.allowedMovePanels !== undefined) {
        sorted.sort((aId, bId) => {
            const cardA = getModCard(aId, gameId);
            const cardB = getModCard(bId, gameId);
            const aType = cardA?.movePanel ? getCardBugType(aId, "panel", cardA.movePanel) : cardA?.bugs?.find(b => b.type === "panel") ? getCardBugType(aId, "panel") : "none";
            const bType = cardB?.movePanel ? getCardBugType(bId, "panel", cardB.movePanel) : cardB?.bugs?.find(b => b.type === "panel") ? getCardBugType(bId, "panel") : "none";
            const aMatches = constraints.allowedMovePanels!.some(allowed => matchMovePanel(aType, allowed));
            const bMatches = constraints.allowedMovePanels!.some(allowed => matchMovePanel(bType, allowed));
            return Number(aMatches) - Number(bMatches);
        });
    }

    if (constraints.bugRules?.busterCharge === "required") {
        sorted.sort((aId, bId) => {
            const cardA = getModCard(aId, gameId);
            const cardB = getModCard(bId, gameId);
            const aSupplies = Boolean(cardA?.bugs?.some(b => getCardBugType(aId, b.type, cardA.movePanel, b.level) === "busterCharge"));
            const bSupplies = Boolean(cardB?.bugs?.some(b => getCardBugType(bId, b.type, cardB.movePanel, b.level) === "busterCharge"));
            return Number(aSupplies) - Number(bSupplies);
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
    if (!cardSpecConstraintsPossible(constraints)) return [];

    const allCards = getModCards(gameId);
    if (!allCards || allCards.length === 0) return [...existingCardIds];

    const forbiddenBugs = constraints?.forbiddenBugs || [];
    const bugRules = constraints?.bugRules || policy.customRules;
    const requiredBugs = bugRules
        ? Object.entries(bugRules).filter(([_, tol]) => tol === "required").map(([b]) => b)
        : [];
    const locked = [...existingCardIds, ...lockedCardIds];
    const minSoulTime = gameId === "bn5" ? constraints?.minSoulTime : undefined;

    if (minSoulTime !== undefined && minSoulTime > 7 && !locked.includes("136-B035")) {
        const snake = getModCard("136-B035", "bn5");
        if (snake && isCardAcceptableUnderPolicy(snake, policy, forbiddenBugs, bugRules)) {
            locked.push("136-B035");
        }
    }

    // Lock required special move (Charge Shot) if specified and not satisfied by baseline or locked cards
    const specialMoveRestricted = constraints?.allowedSpecialMoves !== undefined || constraints?.requiredSpecialMove;
    if (specialMoveRestricted && !isSpecialMoveAllowed(undefined, constraints) && !locked.some(id => isSpecialMoveAllowed(getModCard(id, gameId)?.bPwrAtk, constraints))) {
        const matchingCards = allCards.filter(
            c => isSpecialMoveAllowed(c.bPwrAtk, constraints) && isCardAcceptableUnderPolicy(c, policy, forbiddenBugs, bugRules)
        );
        if (matchingCards.length > 0) {
            matchingCards.sort((a, b) => evaluateCardScore(b, target, requiredBugs) - evaluateCardScore(a, target, requiredBugs));
            locked.push(matchingCards[0].id);
        }
    }

    // Lock required B+Left move if specified
    const bLeftRestricted = constraints?.allowedBLefts !== undefined || constraints?.requiredBLeft;
    if (bLeftRestricted && !isBLeftAllowed(undefined, constraints) && !locked.some(id => isBLeftAllowed(getModCard(id, gameId)?.bLeft, constraints))) {
        const matchingCards = allCards.filter(
            c => isBLeftAllowed(c.bLeft, constraints) && isCardAcceptableUnderPolicy(c, policy, forbiddenBugs, bugRules)
        );
        if (matchingCards.length > 0) {
            matchingCards.sort((a, b) => evaluateCardScore(b, target, requiredBugs) - evaluateCardScore(a, target, requiredBugs));
            locked.push(matchingCards[0].id);
        }
    }

    // Lock required B-Button override if specified
    const bButtonRestricted = constraints?.allowedBButtons !== undefined || constraints?.requiredBButton;
    if (bButtonRestricted && !isBButtonAllowed(undefined, constraints) && !locked.some(id => isBButtonAllowed(getModCard(id, gameId)?.bButton, constraints))) {
        const matchingCards = allCards.filter(
            c => isBButtonAllowed(c.bButton, constraints) && isCardAcceptableUnderPolicy(c, policy, forbiddenBugs, bugRules)
        );
        if (matchingCards.length > 0) {
            matchingCards.sort((a, b) => evaluateCardScore(b, target, requiredBugs) - evaluateCardScore(a, target, requiredBugs));
            locked.push(matchingCards[0].id);
        }
    }

    // Lock required Charge Addition if specified
    const chargeAdditionRestricted = constraints?.allowedChargeAdditions !== undefined || constraints?.requiredChargeAddition || constraints?.requireGlitch100ChargeAddition;
    if (chargeAdditionRestricted && !isChargeAdditionAllowed(undefined, constraints) && !locked.some(id => isChargeAdditionAllowed(getModCard(id, gameId)?.chargeAddition, constraints))) {
        const matchingCards = allCards.filter(
            c => isChargeAdditionAllowed(c.chargeAddition, constraints) &&
                 (!c.bPwrAtk || c.bPwrAtk.toLowerCase() === "chargeshot") &&
                 isCardAcceptableUnderPolicy(c, policy, forbiddenBugs, bugRules)
        );
        if (matchingCards.length > 0) {
            matchingCards.sort((a, b) => evaluateCardScore(b, target, requiredBugs, constraints?.requiredAbilities) - evaluateCardScore(a, target, requiredBugs, constraints?.requiredAbilities));
            locked.push(matchingCards[0].id);
        }
    }

    // Lock required ChargeShot PwrAtk if 100% glitch is requested
    if (constraints?.requireGlitch100ChargeAddition && (gameId === "bn5" || gameId === "bn6")) {
        const currentDeck = computeDeckStats(locked, gameId);
        if (currentDeck.bPwrAtk?.toLowerCase() !== "chargeshot") {
            const csCards = allCards.filter(
                c => c.bPwrAtk && c.bPwrAtk.toLowerCase() === "chargeshot" &&
                     !c.disabledChargeAddition &&
                     isCardAcceptableUnderPolicy(c, policy, forbiddenBugs, bugRules)
            );
            if (csCards.length > 0) {
                csCards.sort((a, b) => evaluateCardScore(b, target, requiredBugs, constraints?.requiredAbilities) - evaluateCardScore(a, target, requiredBugs, constraints?.requiredAbilities));
                locked.push(csCards[0].id);
            }
        }
        if (!currentDeck.chargeAddition && !locked.some(id => Boolean(getModCard(id, gameId)?.chargeAddition))) {
            const caCards = allCards.filter(
                c => c.chargeAddition && isChargeAdditionAllowed(c.chargeAddition, constraints) &&
                     (!c.bPwrAtk || c.bPwrAtk.toLowerCase() === "chargeshot") &&
                     isCardAcceptableUnderPolicy(c, policy, forbiddenBugs, bugRules)
            );
            if (caCards.length > 0) {
                caCards.sort((a, b) => evaluateCardScore(b, target, requiredBugs, constraints?.requiredAbilities) - evaluateCardScore(a, target, requiredBugs, constraints?.requiredAbilities));
                locked.push(caCards[0].id);
            }
        }
    }

    // Lock Erball (136-A006) in BN5 if Support Bug glitch is enabled and support abilities are requested
    if (gameId === "bn5" && constraints?.allowSupportBugGlitch && constraints.requiredAbilities?.some(ab => ab === "rush" || ab === "beat")) {
        const erballCard = getModCard("136-A006", "bn5");
        if (erballCard && isCardAcceptableUnderPolicy(erballCard, policy, forbiddenBugs, bugRules)) {
            if (!locked.includes("136-A006")) {
                locked.push("136-A006");
            }
        }
    }

    // Lock required Buster Addition if specified
    const busterAdditionRestricted = constraints?.allowedBusterAdditions !== undefined || constraints?.requiredBusterAddition;
    if (busterAdditionRestricted && !isBusterAdditionAllowed(undefined, constraints) && !locked.some(id => isBusterAdditionAllowed(getModCard(id, gameId)?.busterAddition, constraints))) {
        const matchingCards = allCards.filter(
            c => isBusterAdditionAllowed(c.busterAddition, constraints) &&
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

    // Lock required abilities in BN4
    if (gameId === "bn4" && constraints?.requiredAbilities && constraints.requiredAbilities.length > 0) {
        const covered = new Set<string>();
        for (const id of locked) {
            const card = getModCard(id, gameId);
            for (const ab of card?.abilities || []) covered.add(ab);
        }
        for (const ab of constraints.requiredAbilities) {
            if (covered.has(ab)) continue;
            const matchingCards = allCards.filter(
                c => c.abilities && c.abilities.includes(ab) && isCardAcceptableUnderPolicy(c, policy, forbiddenBugs, bugRules)
            );
            if (matchingCards.length > 0) {
                matchingCards.sort((a, b) => evaluateCardScore(b, target, requiredBugs, constraints?.requiredAbilities) - evaluateCardScore(a, target, requiredBugs, constraints?.requiredAbilities));
                const pick = matchingCards[0];
                locked.push(pick.id);
                for (const a of pick.abilities || []) covered.add(a);
            }
        }
    }

    // Lock card-only busterCharge (TopMan) when required and not yet supplied
    if (requiredBugs.some(b => normalizeBugType(b) === "busterCharge")) {
        const hasBusterCharge = computeDeckStats(locked, gameId).activeBugs.some(entry => {
            const card = getModCard(entry.sourceCardId, gameId);
            return getCardBugType(entry.sourceCardId, entry.bug.type, card?.movePanel, entry.bug.level) === "busterCharge";
        });
        if (!hasBusterCharge) {
            const matchingCards = allCards.filter(c =>
                Boolean(c.bugs?.some(b => getCardBugType(c.id, b.type, c.movePanel, b.level) === "busterCharge")) &&
                isCardAcceptableUnderPolicy(c, policy, forbiddenBugs, bugRules) &&
                (!c.bPwrAtk || isSpecialMoveAllowed(c.bPwrAtk, constraints)) &&
                (!c.bLeft || isBLeftAllowed(c.bLeft, constraints)) &&
                (!c.bButton || isBButtonAllowed(c.bButton, constraints)) &&
                (!c.disabledChargeAddition || isChargeAdditionAllowed("none", constraints)) &&
                (!c.chargeAddition || isChargeAdditionAllowed(c.chargeAddition, constraints)) &&
                (!c.disabledBusterAddition || isBusterAdditionAllowed("none", constraints)) &&
                (!c.busterAddition || isBusterAdditionAllowed(c.busterAddition, constraints)) &&
                (c.body === undefined || isBodyAllowed(c.body, constraints, gameId)) &&
                (!c.gauge || isGaugeAllowed(c.gauge, constraints))
            );
            if (matchingCards.length > 0) {
                matchingCards.sort((a, b) => evaluateCardScore(b, target, requiredBugs, constraints?.requiredAbilities, minSoulTime) - evaluateCardScore(a, target, requiredBugs, constraints?.requiredAbilities, minSoulTime));
                locked.push(matchingCards[0].id);
            }
        }
    }

    const lockedSet = new Set(locked);
    const lockedSoulTime = gameId === "bn5" ? (computeDeckStats(locked, "bn5").stats.soulTime ?? 0) : 0;
    const lockedMb = gameId === "bn5" ? computeDeckStats(locked, "bn5").totalMb : 0;

    const candidateCards = allCards.filter(c => {
        if (lockedSet.has(c.id)) return false;
        if (!isCardAcceptableUnderPolicy(c, policy, forbiddenBugs, bugRules)) return false;
        if (c.bPwrAtk && !isSpecialMoveAllowed(c.bPwrAtk, constraints)) return false;
        if (c.bLeft && !isBLeftAllowed(c.bLeft, constraints)) return false;
        if (c.bButton && !isBButtonAllowed(c.bButton, constraints)) return false;
        if (c.disabledChargeAddition && !isChargeAdditionAllowed("none", constraints)) return false;
        if (c.chargeAddition && !isChargeAdditionAllowed(c.chargeAddition, constraints)) return false;
        if (constraints?.requireGlitch100ChargeAddition) {
            if (c.bPwrAtk && c.bPwrAtk.toLowerCase() !== "chargeshot") return false;
            if (c.disabledChargeAddition) return false;
        }
        if (c.disabledBusterAddition && !isBusterAdditionAllowed("none", constraints)) return false;
        if (c.busterAddition && !isBusterAdditionAllowed(c.busterAddition, constraints)) return false;
        if (c.body !== undefined && !isBodyAllowed(c.body, constraints)) return false;
        if (c.gauge && !isGaugeAllowed(c.gauge, constraints)) return false;
        if (minSoulTime !== undefined && (c.stats.soulTime ?? 0) < 0) {
            if (3 + 4 + lockedSoulTime + c.stats.soulTime! < minSoulTime) {
                const canAddSnake = !lockedSet.has("136-B035") && 80 - lockedMb - c.mb >= 44;
                if (!canAddSnake) return false;
            }
        }
        return true;
    });

    if (gameId === "bn4") {
        const requiredAbilities = constraints?.requiredAbilities || [];
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
                .map(c => ({ card: c, score: evaluateCardScore(c, target, requiredBugs, requiredAbilities) }))
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

        const baseVal = evaluateCardScore(card, target, requiredBugs, undefined, minSoulTime);
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

/** Push placement bug level caps into the solver while leaving absorbed, repaired, or overwritten bugs searchable. */
export function requirementsUnderPolicy(
    data: Data,
    requirements: Requirement[],
    policy: BugPolicy,
    forbiddenBugs: string[],
    bugRules?: Partial<Record<string, BugTolerance>>,
    modCards: string[] = [],
    allowSupportBugGlitch?: boolean
): Requirement[] {
    // BugStop can absorb other parts' placement bugs. Judge those layouts as a whole.
    if (requirements.some(r => getPartEffect(data.gameId, data.partMetas[r.partIndex].id)?.abilities?.includes("bugStop"))) {
        return requirements;
    }

    const deck = modCards.length > 0 ? computeDeckStats(modCards, data.gameId) : undefined;
    const isBn5Or6 = data.gameId === "bn5" || data.gameId === "bn6";
    const cardBugTypes = isBn5Or6 && deck
        ? deck.activeBugs.map(entry => {
            const card = getModCard(entry.sourceCardId, data.gameId);
            return normalizeBugType(getCardBugType(entry.sourceCardId, entry.bug.type, card?.movePanel, entry.bug.level));
        })
        : [];
    const cardBattleHpBug = isBn5Or6 && deck
        ? deck.activeBugs.find(entry => normalizeBugType(entry.bug.type) === "battleHp")
        : undefined;
    const cardBattleHpLevel = cardBattleHpBug ? (cardBattleHpBug.bug.level ?? 1) : 0;

    const isOverwrittenByCard = (norm: string): boolean => {
        if (!isBn5Or6 || cardBugTypes.length === 0) return false;
        if (norm === "buster") return cardBugTypes.includes("buster") || cardBugTypes.includes("busterCharge");
        if (norm === "status") return cardBugTypes.includes("status");
        if (norm === "panelCrack") return cardBugTypes.some(t => t.startsWith("panel"));
        if (norm === "customDamage") return cardBugTypes.includes("customDamage");
        if (norm === "emotion") return cardBugTypes.includes("emotion");
        return false;
    };

    const gameDefs = GAME_BUG_DEFINITIONS[data.gameId] ?? GAME_BUG_DEFINITIONS["bn6"];
    const getNcMaxLevel = (rawType: string): number => {
        const bugDef = (gameDefs[rawType] ?? GAME_BUG_DEFINITIONS["bn6"][rawType]) as (BugDefinition & { ncMaxLevel?: number }) | undefined;
        if (bugDef?.ncMaxLevel !== undefined) return bugDef.ncMaxLevel;
        const levels = bugDef?.levels ? Object.keys(bugDef.levels).map(Number) : [];
        return levels.length > 0 ? Math.max(...levels) : 1;
    };

    const rules = bugRules ?? policy.customRules;
    const getMaxAllowedForPartBug = (type: string, norm: string): number => {
        if (rules !== undefined || policy.type === "custom") {
            const group = (data.gameId === "bn4" && type === "player")
                ? ["playerConfuse", "playerMoveForward", "playerMoveBackward"] as const
                : (data.gameId === "bn3" && type === "involuntaryMove")
                    ? ["involuntaryMoveUp", "involuntaryMoveDown", "involuntaryMoveConfuse"] as const
                    : (data.gameId === "bn3" && type === "charge")
                        ? ["chargeCube", "chargeWater", "chargeFlower"] as const
                        : (data.gameId === "bn3" && type === "buster")
                            ? ["busterBlank1", "busterBlank2", "busterGuard"] as const
                            : undefined;
            if (group) {
                let best = 0;
                for (let lv = 1; lv <= group.length; lv++) {
                    if (getMaxAllowedBugLevel(getBugRule(rules, group[lv - 1])) >= lv) {
                        best = lv;
                    }
                }
                return best;
            }
            return getMaxAllowedBugLevel(getBugRule(rules, norm, type));
        }
        if (forbiddenBugs.length > 0) {
            const explicitlyForbidden = forbiddenBugs.some(b => normalizeBugType(b).toLowerCase() === norm.toLowerCase());
            if (explicitlyForbidden) return 0;
            if (["buster", "customhp", "emotion"].includes(norm.toLowerCase()) || isBenignBug(type, 1)) {
                return Infinity;
            }
            return 0;
        }
        if (policy.type === "no_bugs") return 0;
        if (policy.type === "benign_allowed") {
            if (!isBenignBug(type, 1)) return 0;
            return norm.toLowerCase() === "resultzenny" ? Infinity : 1;
        }
        return Infinity;
    };

    return requirements.map(req => {
        let cap = Infinity;
        for (const type of getPartBugTypes(data.gameId, data.partMetas[req.partIndex].id)) {
            const norm = isBn5Or6 && type === "panel" ? "panelCrack" : normalizeBugType(type);
            if (allowSupportBugGlitch && norm === "support") continue;
            if (deck?.repairedBugs.some(rep => repairsBugType(rep, norm))) continue;
            if (isOverwrittenByCard(norm)) continue;

            const maxAllowed = getMaxAllowedForPartBug(type, norm);
            const effectiveMaxForNc = (norm === "battleHp" && isBn5Or6 && cardBattleHpLevel > 0)
                ? (maxAllowed === Infinity ? Infinity : Math.max(0, maxAllowed - cardBattleHpLevel))
                : maxAllowed;
            const ncMaxLevel = getNcMaxLevel(type);
            // Only cap when effectiveMaxForNc < ncMaxLevel because NC violations clamp at ncMaxLevel.
            if (effectiveMaxForNc < ncMaxLevel) {
                cap = Math.min(cap, effectiveMaxForNc);
            }
        }
        if (cap < Infinity) {
            const currentMax = req.constraint.maxBugLevel ?? Infinity;
            if (cap < currentMax) {
                return {
                    ...req,
                    constraint: { ...req.constraint, maxBugLevel: cap },
                };
            }
        }
        return req;
    });
}

/**
 * Verifies whether a completed build satisfies all user constraints.
 */
export function doesBuildSatisfyConstraints(
    stats: BuildStats,
    analysis: SolutionBugAnalysis,
    constraints?: BuildConstraints,
    gameId?: string
): boolean {
    if (!constraints) return true;

    // Check the final capped values, including all card bonuses and penalties.
    const minimums = getBusterMinimums(constraints);
    if (BUSTER_STATS.some(stat => stats[stat] < (minimums[stat] ?? 1))) return false;
    if ((stats.modChipRecovery ?? 0) < (constraints.minChipRecovery ?? 0)) return false;
    if (constraints.minCustom !== undefined && stats.custom < constraints.minCustom) return false;
    if (constraints.minSoulTime !== undefined && (gameId === undefined || gameId === "bn5") && (stats.soulTime ?? 3) < constraints.minSoulTime) return false;

    if (constraints.requiredAbilities && constraints.requiredAbilities.length > 0) {
        const buildAbilities = new Set(stats.abilities || []);
        for (const ab of constraints.requiredAbilities) {
            if (!buildAbilities.has(ab)) return false;
        }
    }

    if (!isSpecialMoveAllowed(stats.modBPwrAtk, constraints)) return false;
    if (!isBLeftAllowed(stats.modBLeft, constraints)) return false;
    if (!isBButtonAllowed(stats.modBButton, constraints)) return false;
    if (!isChargeAdditionAllowed(stats.modChargeAddition, constraints)) return false;
    if (constraints.requireGlitch100ChargeAddition && !stats.isGlitch100ChargeAddition) return false;
    if (!isBusterAdditionAllowed(stats.modBusterAddition, constraints)) return false;

    if (!isBodyAllowed(stats.modBody, constraints, gameId)) return false;

    if (!isGaugeAllowed(stats.modGauge, constraints)) return false;

    if (!isMovePanelAllowed(analysis, constraints.allowedMovePanels, gameId, stats)) return false;

    const effectiveBugs = getEffectiveInBattleBugs(analysis, constraints.allowSupportBugGlitch);

    if (constraints.bugRules && Object.keys(constraints.bugRules).length > 0) {
        for (const b of effectiveBugs) {
            const norm = normalizeBugType(b.bugType);
            const tolerance = getBugRule(constraints.bugRules, norm, b.bugType);
            if (tolerance === "forbidden" || b.level > getMaxAllowedBugLevel(tolerance)) return false;
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
    onSearchWork?: OptimizeOptions["onSearchWork"],
    allowSupportBugGlitch?: boolean,
    allowedMovePanels?: string[],
    requiredAbilities?: readonly string[]
): SearchNode | null {
    const shouldStop = () => Date.now() - startTime >= timeoutMs;
    const activeRules = bugRules ?? policy.customRules;
    const findPlacement = (requirements: Requirement[]) => {
        onSearchWork?.("candidate");
        const searchReqs = requirementsUnderPolicy(data, requirements, policy, forbiddenBugs, bugRules, modCards, allowSupportBugGlitch);
        const preferOffLine = buildPreferOffLineReqs(data, searchReqs, requiredAbilities);
        for (const solution of solve(data.parts, searchReqs, gridSettings, spinnableColors, shouldStop, true, onSearchWork ? () => onSearchWork("placement") : undefined, true, preferOffLine)) {
            if (shouldStop()) break;
            const occ = placeAll(data.parts, requirements, solution, gridSettings);
            const analysis = analyzeSolutionBugs(data.gameId, data.partMetas, requirements, occ, gridSettings, "en", modCards);
            if (isSolutionAcceptable(analysis, policy, forbiddenBugs, bugRules, allowSupportBugGlitch)) {
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
                        onCommandLine: shouldLockSolidOnCommandLine(
                            data,
                            candIdx,
                            activeRules,
                            allowSupportBugGlitch,
                            allowedMovePanels,
                            requiredAbilities
                        ) ? true : null,
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

                    const statCmp = compareBuildStats(testStats, bestNode.stats, target);
                    if (statCmp > 0 || (statCmp === 0 &&
                        countNcPlacementBugLoad(foundAnalysis, requiredAbilities, activeRules) <
                        countNcPlacementBugLoad(bestNode.analysis, requiredAbilities, activeRules))) {
                        bestNode = childNode;
                    }
                }
            }
        }

        if (nextNodes.length === 0) break;
        nextNodes.sort((a, b) =>
            compareBuildStats(b.stats, a.stats, target) ||
            countNcPlacementBugLoad(a.analysis, requiredAbilities, activeRules) -
            countNcPlacementBugLoad(b.analysis, requiredAbilities, activeRules));
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

    if (!cardSpecConstraintsPossible(constraints) || !busterMinimumsPossible(options) || !soulTimeMinimumPossible(options)) return null;
    const startTime = Date.now();
    const gridSettings = makeGridSettings(data, problem);
    const spinnableColors = problem.spinnableColors;
    const baseHp = problem.baseHp ?? 1000;
    const forbiddenBugs = constraints?.forbiddenBugs || [];
    const allCandidates = getCandidateFillerParts(data, target);
    const activeRules = constraints?.bugRules ?? policy.customRules;
    const gridCapacity = gridSettings.width * gridSettings.height - (gridSettings.hasOob ? 4 : 0);

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
                        onCommandLine: shouldLockSolidOnCommandLine(
                            data,
                            partIdx,
                            activeRules,
                            constraints?.allowSupportBugGlitch,
                            constraints?.allowedMovePanels,
                            constraints?.requiredAbilities
                        ) ? true : null,
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

    const compressedCells = (idx: number) => data.parts[idx].compressedMask.filter(Boolean).length || 1;
    const isBugStopPart = (idx: number) =>
        Boolean(getPartEffect(data.gameId, data.partMetas[idx].id)?.abilities?.includes("bugStop"));

    // Seed required NC bugs (preferring smallest non-battle parts) and 5-color overflow when status is required.
    const createReqsForRequiredBugs = (currentReqs: Requirement[], modCards: string[]): Requirement[] => {
        const reqs = currentReqs.map(r => ({ ...r, constraint: { ...r.constraint } }));
        const deck = modCards.length > 0 ? computeDeckStats(modCards, data.gameId) : undefined;
        const cardBugTypes = deck
            ? deck.activeBugs.map(entry => {
                const card = getModCard(entry.sourceCardId, data.gameId);
                return normalizeBugType(getCardBugType(entry.sourceCardId, entry.bug.type, card?.movePanel, entry.bug.level));
            })
            : [];

        const existingIndices = new Set(reqs.map(r => r.partIndex));
        const existingColors = new Set(reqs.map(r => data.parts[r.partIndex].color));
        let occupiedCells = reqs.reduce((sum, r) => sum + compressedCells(r.partIndex), 0);

        const requiredKeys: string[] = [];
        for (const [key, tol] of Object.entries(activeRules ?? {})) {
            if (tol === "required") requiredKeys.push(key);
        }
        const allowedMovePanels = constraints?.allowedMovePanels;
        if (
            allowedMovePanels &&
            allowedMovePanels.length > 0 &&
            !allowedMovePanels.some(p => p.toLowerCase() === "none") &&
            !deck?.movePanel &&
            !cardBugTypes.some(t => t.startsWith("panel"))
        ) {
            const ncPanels = data.gameId === "bn4"
                ? ["panelCrack", "panelHole", "panelPoison"]
                : ["panelCrack1", "panelCrack2", "panelCrack3"];
            if (ncPanels.some(actual => allowedMovePanels.some(target => matchMovePanel(actual, target)))) {
                const panelKey = data.gameId === "bn4" ? "panel" : "panelCrack";
                if (!requiredKeys.some(k => normalizeBugType(k) === panelKey)) {
                    requiredKeys.push(panelKey);
                }
            }
        }

        for (const rawKey of requiredKeys) {
            const normKey = normalizeBugType(rawKey);
            if (normKey === "busterCharge" || normKey === "status" || normKey === "colorStatus") continue;
            if (cardBugTypes.some(t => bugMatchesRule(t, normKey))) continue;
            if (normKey === "support" && constraints?.allowSupportBugGlitch && data.gameId === "bn5" && modCards.includes("136-A006")) {
                continue;
            }

            const existingNonBattleIdx = reqs.findIndex(r =>
                !isBugStopPart(r.partIndex) &&
                isNonBattleProgram(data.gameId, data.partMetas[r.partIndex].id, constraints?.requiredAbilities) &&
                partDirectlySuppliesBug(data, r.partIndex, normKey)
            );
            if (existingNonBattleIdx >= 0) {
                const r = reqs[existingNonBattleIdx];
                if (r.constraint.onCommandLine !== true && r.constraint.maxBugLevel >= 1) {
                    r.constraint.minBugLevel = Math.max(r.constraint.minBugLevel, 1);
                }
                continue;
            }

            const matching = data.parts.map((_, idx) => idx).filter(idx => {
                if (existingIndices.has(idx) || isBugStopPart(idx)) return false;
                if (!partDirectlySuppliesBug(data, idx, normKey)) return false;
                if (occupiedCells + compressedCells(idx) > gridCapacity) return false;
                if (data.gameId !== "bn3") {
                    return existingColors.has(data.parts[idx].color) || existingColors.size < 6;
                }
                return !data.styleColorRules || isPartCompatible(data, { ...problem, requirements: reqs }, idx);
            }).sort((a, b) =>
                Number(isNonBattleProgram(data.gameId, data.partMetas[b].id, constraints?.requiredAbilities)) -
                Number(isNonBattleProgram(data.gameId, data.partMetas[a].id, constraints?.requiredAbilities)) ||
                compressedCells(a) - compressedCells(b) ||
                a - b
            );

            const hasExistingCombatSupplier = reqs.some(r =>
                !isBugStopPart(r.partIndex) && partDirectlySuppliesBug(data, r.partIndex, normKey)
            );
            if (hasExistingCombatSupplier) {
                // Only add a dedicated supplier when a non-battle program exists so combat programs stay clean.
                const nonBattlePick = matching.find(idx =>
                    isNonBattleProgram(data.gameId, data.partMetas[idx].id, constraints?.requiredAbilities)
                );
                if (nonBattlePick === undefined) continue;
                reqs.push({
                    partIndex: nonBattlePick,
                    constraint: { onCommandLine: null, minBugLevel: 1, maxBugLevel: Infinity, compressed: true },
                });
                existingIndices.add(nonBattlePick);
                existingColors.add(data.parts[nonBattlePick].color);
                occupiedCells += compressedCells(nonBattlePick);
                continue;
            }

            if (matching.length > 0) {
                const pick = matching[0];
                reqs.push({
                    partIndex: pick,
                    constraint: { onCommandLine: null, minBugLevel: 1, maxBugLevel: Infinity, compressed: true },
                });
                existingIndices.add(pick);
                existingColors.add(data.parts[pick].color);
                occupiedCells += compressedCells(pick);
            }
        }

        const wantsColorStatus = data.gameId !== "bn3" &&
            (activeRules?.status === "required" || activeRules?.colorStatus === "required") &&
            !cardBugTypes.some(t => t === "status" || t === "colorStatus") &&
            !reqs.some(r => isBugStopPart(r.partIndex));

        if (wantsColorStatus) {
            let onLineCount = reqs.filter(r => r.constraint.onCommandLine === true).length;
            while (existingColors.size < 5) {
                const colorCandidates = data.parts.map((_, idx) => idx).filter(idx => {
                    if (existingIndices.has(idx) || isBugStopPart(idx)) return false;
                    const color = data.parts[idx].color;
                    if (existingColors.has(color)) return false;
                    if (problem.spinnableColors[color] === undefined) return false;
                    if (occupiedCells + compressedCells(idx) > gridCapacity) return false;
                    const [pol] = requirementsUnderPolicy(
                        data,
                        [{ partIndex: idx, constraint: { compressed: true, onCommandLine: null, minBugLevel: 0, maxBugLevel: Infinity } }],
                        policy,
                        forbiddenBugs,
                        constraints?.bugRules,
                        modCards,
                        constraints?.allowSupportBugGlitch
                    );
                    const needsZeroBug = (pol.constraint.maxBugLevel ?? Infinity) === 0;
                    if (data.parts[idx].isSolid && needsZeroBug && onLineCount >= gridSettings.width) {
                        return false;
                    }
                    return true;
                }).sort((a, b) =>
                    compressedCells(a) - compressedCells(b) ||
                    Number(isNonBattleProgram(data.gameId, data.partMetas[b].id, constraints?.requiredAbilities)) -
                    Number(isNonBattleProgram(data.gameId, data.partMetas[a].id, constraints?.requiredAbilities)) ||
                    a - b
                );

                if (colorCandidates.length === 0) break;
                const pick = colorCandidates[0];
                const lockOnLine = shouldLockSolidOnCommandLine(
                    data,
                    pick,
                    activeRules,
                    constraints?.allowSupportBugGlitch,
                    constraints?.allowedMovePanels,
                    constraints?.requiredAbilities
                );
                const [pol] = requirementsUnderPolicy(
                    data,
                    [{ partIndex: pick, constraint: { compressed: true, onCommandLine: null, minBugLevel: 0, maxBugLevel: Infinity } }],
                    policy,
                    forbiddenBugs,
                    constraints?.bugRules,
                    modCards,
                    constraints?.allowSupportBugGlitch
                );
                if (data.parts[pick].isSolid && (lockOnLine || (pol.constraint.maxBugLevel ?? Infinity) === 0)) {
                    onLineCount++;
                }
                reqs.push({
                    partIndex: pick,
                    constraint: {
                        onCommandLine: lockOnLine ? true : null,
                        minBugLevel: 0,
                        maxBugLevel: Infinity,
                        compressed: true,
                    },
                });
                existingIndices.add(pick);
                existingColors.add(data.parts[pick].color);
                occupiedCells += compressedCells(pick);
            }
        }

        return reqs;
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
            branches.push({ modCards: modCards0, reqs: createReqsForRequiredBugs(reqs0, modCards0), isAutoCards: true });
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
            branches.push({ modCards: modCards1, reqs: createReqsForRequiredBugs(reqs1, modCards1), isAutoCards: true });
        }
    } else {
        // modCardMode === "none" or "keep"
        let modCards: string[] = [];
        if (data.gameId !== "bn3" && modCardMode === "keep") {
            modCards = problem.modCards || [];
        }

        const deck = computeDeckStats(modCards, data.gameId);
        if (!isSpecialMoveAllowed(deck.bPwrAtk, constraints)) return null;
        if (!isBLeftAllowed(deck.bLeft, constraints)) return null;
        if (!isBButtonAllowed(deck.bButton, constraints)) return null;
        if (!isChargeAdditionAllowed(deck.chargeAddition, constraints)) return null;
        if (constraints?.requireGlitch100ChargeAddition && !deck.isGlitch100ChargeAddition) return null;
        if (!isBusterAdditionAllowed(deck.busterAddition, constraints)) return null;
        if (!isBodyAllowed(deck.body, constraints)) return null;
        if (!isGaugeAllowed(deck.gauge, constraints)) return null;

        const covered = new Set(deck.activeAbilities || []);
        const uncovered = (constraints?.requiredAbilities || []).filter(ab => !covered.has(ab));
        const reqs = createReqsForAbilities(uncovered);
        if (reqs) {
            branches.push({ modCards, reqs: createReqsForRequiredBugs(reqs, modCards), isAutoCards: false });
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
            options.onSearchWork,
            constraints?.allowSupportBugGlitch,
            constraints?.allowedMovePanels,
            constraints?.requiredAbilities
        );

        if (!node) continue;

        if (!doesBuildSatisfyConstraints(node.stats, node.analysis, constraints, data.gameId)) {
            continue;
        }

        const candidateResult = removeRedundantAbilityParts(options, {
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
        });

        const cmp = bestResult ? compareBuildStats(candidateResult.stats, bestResult.stats, target) : 1;
        if (cmp > 0 || (cmp === 0 && bestResult && (
            (haveSameBuildEffects(candidateResult.stats, bestResult.stats, constraints) &&
                occupiedBuildCells(data, candidateResult) < occupiedBuildCells(data, bestResult)) ||
            ((!haveSameBuildEffects(candidateResult.stats, bestResult.stats, constraints) ||
                occupiedBuildCells(data, candidateResult) === occupiedBuildCells(data, bestResult)) &&
                countNcPlacementBugLoad(candidateResult.analysis, constraints?.requiredAbilities, activeRules) <
                countNcPlacementBugLoad(bestResult.analysis, constraints?.requiredAbilities, activeRules))
        ))) {
            bestResult = candidateResult;
        }
    }

    return bestResult;
}

export interface PolicySolveOptions {
    data: Data;
    requirements: Requirement[];
    gridSettings: GridSettings;
    spinnableColors: boolean[];
    bugPolicy?: BugPolicy;
    constraints?: BuildConstraints;
    modCards?: string[];
    baseHp?: number;
    shouldStop?: () => boolean;
}

/**
 * Enumerate layouts for display while enforcing active bug policies, achievable placement-sensitive
 * constraints, and preferring non-required-bug solid programs on the command line.
 */
export function* solveForDisplay(options: PolicySolveOptions): Iterable<Solution> {
    const {
        data,
        requirements,
        gridSettings,
        spinnableColors,
        shouldStop = () => false,
    } = options;
    const hasActivePolicy = Boolean(options.constraints) ||
        Boolean(options.bugPolicy && options.bugPolicy.type !== "no_bugs");
    if (!hasActivePolicy) {
        const preferOffLine = buildPreferOffLineReqs(data, requirements);
        yield* solve(data.parts, requirements, gridSettings, spinnableColors, shouldStop, true, undefined, true, preferOffLine);
        return;
    }

    const policy = options.bugPolicy ?? DEFAULT_BUG_POLICY;
    const constraints = options.constraints;
    const cards = options.modCards ?? [];
    const baseHp = options.baseHp ?? 1000;
    const rules = constraints?.bugRules ?? policy.customRules;

    const policyReqs = requirementsUnderPolicy(
        data,
        requirements,
        policy,
        constraints?.forbiddenBugs ?? [],
        constraints?.bugRules,
        cards,
        constraints?.allowSupportBugGlitch
    );

    let tightenedChanged = false;
    const candidateTightened = policyReqs.map(req => {
        if (
            req.constraint.onCommandLine === null &&
            req.constraint.minBugLevel === 0 &&
            shouldLockSolidOnCommandLine(
                data,
                req.partIndex,
                rules,
                constraints?.allowSupportBugGlitch,
                constraints?.allowedMovePanels,
                constraints?.requiredAbilities
            )
        ) {
            tightenedChanged = true;
            return { ...req, constraint: { ...req.constraint, onCommandLine: true } };
        }
        return req;
    });
    const onLineCount = candidateTightened.filter(r => r.constraint.onCommandLine === true).length;
    const tightenedReqs = tightenedChanged && onLineCount <= gridSettings.width
        ? candidateTightened
        : policyReqs;

    let effectiveConstraints: BuildConstraints | undefined;
    if (constraints) {
        const installedStats = computeBuildStats(
            data.gameId,
            requirements.map(r => data.partMetas[r.partIndex].id),
            cards,
            baseHp
        );
        const minimums = getBusterMinimums(constraints);
        const achievableBuster = Object.fromEntries(
            BUSTER_STATS
                .filter(stat => minimums[stat] !== undefined && minimums[stat]! <= installedStats[stat])
                .map(stat => [stat, minimums[stat]!])
        ) as Partial<Record<BusterStat, number>>;
        const achievableAbilities = (constraints.requiredAbilities ?? [])
            .filter(ab => installedStats.abilities.includes(ab));
        effectiveConstraints = {
            ...(achievableAbilities.length > 0 ? { requiredAbilities: achievableAbilities } : {}),
            ...(Object.keys(achievableBuster).length > 0 ? { minBusterStats: achievableBuster } : {}),
            ...(constraints.minCustom !== undefined && installedStats.custom >= constraints.minCustom
                ? { minCustom: constraints.minCustom } : {}),
            ...(constraints.minSoulTime !== undefined && (data.gameId !== "bn5" || (installedStats.soulTime ?? 3) >= constraints.minSoulTime)
                ? { minSoulTime: constraints.minSoulTime } : {}),
            ...(constraints.minChipRecovery !== undefined && (installedStats.modChipRecovery ?? 0) >= constraints.minChipRecovery
                ? { minChipRecovery: constraints.minChipRecovery } : {}),
            ...(constraints.allowedMovePanels !== undefined ? { allowedMovePanels: constraints.allowedMovePanels } : {}),
            ...(constraints.allowSupportBugGlitch ? { allowSupportBugGlitch: true } : {}),
            ...(constraints.forbiddenBugs ? { forbiddenBugs: constraints.forbiddenBugs } : {}),
            ...(constraints.bugRules ? { bugRules: constraints.bugRules } : {}),
        };
    }

    function* yieldValidFrom(searchReqs: Requirement[]): Iterable<Solution> {
        const preferOffLine = buildPreferOffLineReqs(data, searchReqs, constraints?.requiredAbilities);
        for (const solution of solve(data.parts, searchReqs, gridSettings, spinnableColors, shouldStop, true, undefined, true, preferOffLine)) {
            if (shouldStop()) return;
            const cells = placeAll(data.parts, requirements, solution, gridSettings);
            const analysis = analyzeSolutionBugs(data.gameId, data.partMetas, requirements, cells, gridSettings, "en", cards);
            if (!isSolutionAcceptable(analysis, policy, constraints?.forbiddenBugs, constraints?.bugRules,
                    constraints?.allowSupportBugGlitch)) {
                continue;
            }
            if (effectiveConstraints) {
                const stats = computePlacedBuildStats(data.gameId, data.partMetas, requirements,
                    cells, gridSettings, cards, baseHp);
                if (!doesBuildSatisfyConstraints(stats, analysis, effectiveConstraints, data.gameId)) {
                    continue;
                }
            }
            yield solution;
        }
    }

    let yielded = 0;
    for (const solution of yieldValidFrom(tightenedReqs)) {
        yielded++;
        yield solution;
    }
    if (yielded === 0 && tightenedReqs !== policyReqs && !shouldStop()) {
        yield* yieldValidFrom(policyReqs);
    }
}
