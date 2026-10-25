import type { Data } from "./game-data";
import { isPartCompatible } from "./compatibility";
import {
    analyzeSolutionBugs,
    computeBuildStats,
    getPartEffect,
    isBenignBug,
    isSolutionAcceptable,
    BuildStats,
    SolutionBugAnalysis,
} from "./effects";
import {
    getModCards,
    getModCard,
    computeDeckStats,
    ModCard,
} from "./modcards";
import { BugPolicy, DEFAULT_BUG_POLICY, Problem, makeGridSettings } from "./problem";
import { placeAll, solve, Requirement, Solution } from "./solver";

export type OptimizationTarget = "max_hp" | "max_buster" | "balanced";
export type ModCardMode = "none" | "auto" | "keep";

export interface OptimizeOptions {
    data: Data;
    problem: Problem;
    policy?: BugPolicy;
    target?: OptimizationTarget;
    timeoutMs?: number;
    beamWidth?: number;
    modCardMode?: ModCardMode;
}

export interface OptimizeResult {
    problem: Problem;
    solution: Solution;
    stats: BuildStats;
    analysis: SolutionBugAnalysis;
    addedPartIndices: number[];
    addedCardIds?: string[];
}

export interface ModCardOptimizeOptions {
    gameId: string;
    existingCardIds?: string[];
    target?: OptimizationTarget;
    policy?: BugPolicy;
}

/**
 * Checks whether a mod card's inherent bugs comply with the user's BugPolicy.
 */
function isCardAcceptableUnderPolicy(card: ModCard, policy: BugPolicy): boolean {
    if (!card.bugs || card.bugs.length === 0) return true;
    if (policy.type === "no_bugs") return false;
    if (policy.type === "benign_allowed") {
        return card.bugs.every(b => isBenignBug(b.type, b.level ?? 1));
    }
    if (policy.type === "custom") {
        const rules = policy.customRules || {};
        for (const b of card.bugs) {
            const rule = rules[b.type] ?? "forbidden";
            if (rule === "forbidden") return false;
            if (rule === "allowed_lv1" && (b.level ?? 1) > 1) return false;
        }
        return true;
    }
    return true;
}

/**
 * Evaluates the fitness score of a mod card based on the target.
 */
function evaluateCardScore(card: ModCard, target: OptimizationTarget): number {
    const hp = (card.stats.hp ?? 0) + (card.stats.hpPercent ? card.stats.hpPercent * 15 : 0);
    const attack = (card.stats.attack ?? 0) + (card.stats.attackMult && card.stats.attackMult > 1 ? 5 : 0);
    const charge = card.stats.charge ?? 0;
    const rapid = card.stats.rapid ?? 0;
    const custom = card.stats.custom ?? 0;
    const mega = card.stats.megaFolder ?? 0;
    const giga = card.stats.gigaFolder ?? 0;

    let abilityBonus = 0;
    if (card.abilities) {
        if (card.abilities.includes("superArmor")) abilityBonus += 50;
        if (card.abilities.includes("floatShoes")) abilityBonus += 30;
        if (card.abilities.includes("airShoes")) abilityBonus += 30;
        if (card.abilities.includes("underShirt")) abilityBonus += 20;
        if (card.abilities.includes("statusGuard")) abilityBonus += 40;
    }

    if (target === "max_hp") {
        return hp * 1.0 + (attack * 10) + (custom * 20) + abilityBonus;
    }
    if (target === "max_buster") {
        return (attack * 120) + (charge * 60) + (rapid * 40) + (hp * 0.2) + abilityBonus;
    }
    return (hp * 0.6) + (custom * 100) + (mega * 80) + (giga * 120) + (attack * 50) + abilityBonus;
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
    } = options;

    if (gameId === "bn3") return [];

    const allCards = getModCards(gameId);
    if (!allCards || allCards.length === 0) return [...existingCardIds];

    const existingSet = new Set(existingCardIds);

    const candidateCards = allCards.filter(
        c => !existingSet.has(c.id) && isCardAcceptableUnderPolicy(c, policy)
    );

    if (gameId === "bn4") {
        const usedSlots = new Set<string>();
        for (const id of existingCardIds) {
            const card = getModCard(id, gameId);
            if (card && card.slot) usedSlots.add(card.slot);
        }

        const mainSlots = ["0A", "0B", "0C", "0D", "0E"];
        const selected = [...existingCardIds];

        for (const slot of mainSlots) {
            if (usedSlots.has(slot)) continue;
            const slotCandidates = candidateCards
                .filter(c => c.slot === slot)
                .map(c => ({ card: c, score: evaluateCardScore(c, target) }))
                .filter(item => item.score > 0)
                .sort((a, b) => b.score - a.score);

            if (slotCandidates.length > 0) {
                selected.push(slotCandidates[0].card.id);
                usedSlots.add(slot);
            }
        }
        return selected;
    }

    // BN5 / BN6: 80 MB 0-1 Knapsack DP
    const maxCapacity = 80;
    let usedMb = 0;
    for (const id of existingCardIds) {
        const card = getModCard(id, gameId);
        if (card) usedMb += card.mb;
    }

    const remainingMb = maxCapacity - usedMb;
    if (remainingMb <= 0) return [...existingCardIds];

    interface DpState {
        score: number;
        items: string[];
    }

    const dp: DpState[] = Array.from({ length: remainingMb + 1 }, () => ({
        score: 0,
        items: [],
    }));

    for (const card of candidateCards) {
        const weight = card.mb;
        const val = evaluateCardScore(card, target);
        if (val <= 0 || weight > remainingMb) continue;

        for (let w = remainingMb; w >= weight; w--) {
            if (dp[w - weight].score + val > dp[w].score) {
                dp[w] = {
                    score: dp[w - weight].score + val,
                    items: [...dp[w - weight].items, card.id],
                };
            }
        }
    }

    let best = dp[0];
    for (let w = 0; w <= remainingMb; w++) {
        if (dp[w].score > best.score) {
            best = dp[w];
        }
    }

    return [...existingCardIds, ...best.items];
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
    const charge = effect.chargeMax ? 5 : (effect.charge ?? 0);
    const rapid = effect.rapidMax ? 5 : (effect.rapid ?? 0);
    const custom = effect.numberOpen ? 10 : (effect.custom ?? 0);
    const mega = effect.megaFolder ?? 0;
    const giga = effect.gigaFolder ?? 0;

    if (target === "max_hp") {
        return hp * 1.0 + (attack * 10) + (custom * 20);
    }
    if (target === "max_buster") {
        return (attack * 120) + (charge * 60) + (rapid * 40) + (hp * 0.2);
    }
    // balanced
    return (hp * 0.6) + (custom * 100) + (mega * 80) + (giga * 120) + (attack * 50);
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

/**
 * Evaluates the total fitness score of a build state.
 */
function evaluateBuildScore(stats: BuildStats, target: OptimizationTarget): number {
    if (target === "max_hp") {
        return stats.finalHp * 1.0 + stats.attack * 20 + stats.custom * 30;
    }
    if (target === "max_buster") {
        return (stats.attack * 200) + (stats.charge * 100) + (stats.rapid * 80) + stats.finalHp * 0.2;
    }
    return (stats.finalHp * 0.6) + (stats.custom * 120) + (stats.megaFolder * 80) + (stats.gigaFolder * 150) + (stats.attack * 60);
}

interface SearchNode {
    requirements: Requirement[];
    solution: Solution;
    stats: BuildStats;
    analysis: SolutionBugAnalysis;
    score: number;
    addedPartIndices: number[];
}

/**
 * Optimizes the build by automatically selecting and packing optimal filler parts
 * onto the remaining NaviCust grid while satisfying the user's BugPolicy.
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
    } = options;

    const startTime = Date.now();
    const gridSettings = makeGridSettings(data, problem);
    const spinnableColors = problem.spinnableColors;
    const baseHp = problem.baseHp ?? 1000;

    let modCards: string[] = [];
    let addedCardIds: string[] = [];

    if (data.gameId !== "bn3") {
        if (modCardMode === "none") {
            modCards = [];
        } else if (modCardMode === "auto") {
            modCards = optimizeModCards({
                gameId: data.gameId,
                existingCardIds: [],
                target,
                policy,
            });
            addedCardIds = [...modCards];
        } else {
            // "keep"
            modCards = problem.modCards || [];
        }
    } else {
        modCards = [];
    }

    // 1. Verify that the initial core requirements can be solved under the policy
    const initialReqs = problem.requirements;
    const initialSolIter = solve(data.parts, initialReqs, gridSettings, spinnableColors);
    let rootSolution: Solution | null = null;
    let rootAnalysis: SolutionBugAnalysis | null = null;

    let initSteps = 0;
    for (const value of initialSolIter) {
        if (++initSteps > 40) break;
        const occ = placeAll(data.parts, initialReqs, value, gridSettings);
        const analysis = analyzeSolutionBugs(data.gameId, data.partMetas, initialReqs, occ, gridSettings, "en", modCards);
        if (isSolutionAcceptable(analysis, policy)) {
            rootSolution = value;
            rootAnalysis = analysis;
            break;
        }
    }

    if (!rootSolution || !rootAnalysis) {
        return null;
    }

    const rootPartIds = initialReqs.map(r => data.partMetas[r.partIndex].id);
    const rootStats = computeBuildStats(data.gameId, rootPartIds, modCards, baseHp);
    const rootScore = evaluateBuildScore(rootStats, target);

    const rootNode: SearchNode = {
        requirements: initialReqs,
        solution: rootSolution,
        stats: rootStats,
        analysis: rootAnalysis,
        score: rootScore,
        addedPartIndices: [],
    };

    let bestNode: SearchNode = rootNode;
    let beam: SearchNode[] = [rootNode];

    // 2. Candidate filler parts
    const allCandidates = getCandidateFillerParts(data, target);

    // 3. Beam Search
    while (beam.length > 0) {
        if (Date.now() - startTime >= timeoutMs) break;

        const nextNodes: SearchNode[] = [];

        for (const node of beam) {
            if (Date.now() - startTime >= timeoutMs) break;
            if (node.requirements.length >= 25) continue;

            const existingIndices = new Set(node.requirements.map(r => r.partIndex));
            const existingColors = new Set(node.requirements.map(r => data.parts[r.partIndex].color));

            // Determine if BugStop is currently active in this node
            const hasBugStop = node.analysis.bugStopActive;

            for (const candIdx of allCandidates) {
                if (Date.now() - startTime >= timeoutMs) break;
                if (existingIndices.has(candIdx)) continue;

                const candMeta = data.partMetas[candIdx];
                const candPart = data.parts[candIdx];

                // Color limit check (4 colors in BN4/5/6)
                if (data.gameId !== "bn3") {
                    if (!existingColors.has(candPart.color) && existingColors.size >= 4) {
                        continue;
                    }
                } else if (data.styleColorRules) {
                    // BN3 Style compatibility check
                    const ok = isPartCompatible(data, {
                        ...problem,
                        requirements: node.requirements,
                    }, candIdx);
                    if (!ok) continue;
                }

                // If policy is no_bugs and no BugStop, assign proper command-line constraint
                let onCommandLineConstraint: boolean | null = null;
                let maxBug = Infinity;
                if (policy.type === "no_bugs" && !hasBugStop) {
                    onCommandLineConstraint = candMeta.isSolid;
                    maxBug = 0;
                }

                const candReq: Requirement = {
                    partIndex: candIdx,
                    constraint: {
                        onCommandLine: onCommandLineConstraint,
                        minBugLevel: 0,
                        maxBugLevel: maxBug,
                        compressed: true,
                    },
                };

                const testReqs = [...node.requirements, candReq];

                // Attempt to solve
                const solIter = solve(data.parts, testReqs, gridSettings, spinnableColors);
                let foundSolution: Solution | null = null;
                let foundAnalysis: SolutionBugAnalysis | null = null;

                let candSteps = 0;
                for (const value of solIter) {
                    if (++candSteps > 25) break;
                    const occ = placeAll(data.parts, testReqs, value, gridSettings);
                    const analysis = analyzeSolutionBugs(data.gameId, data.partMetas, testReqs, occ, gridSettings, "en", modCards);
                    if (isSolutionAcceptable(analysis, policy)) {
                        foundSolution = value;
                        foundAnalysis = analysis;
                        break;
                    }
                }

                if (foundSolution && foundAnalysis) {
                    const testPartIds = testReqs.map(r => data.partMetas[r.partIndex].id);
                    const testStats = computeBuildStats(data.gameId, testPartIds, modCards, baseHp);
                    const testScore = evaluateBuildScore(testStats, target);

                    const childNode: SearchNode = {
                        requirements: testReqs,
                        solution: foundSolution,
                        stats: testStats,
                        analysis: foundAnalysis,
                        score: testScore,
                        addedPartIndices: [...node.addedPartIndices, candIdx],
                    };

                    nextNodes.push(childNode);

                    if (testScore > bestNode.score) {
                        bestNode = childNode;
                    }
                }
            }
        }

        if (nextNodes.length === 0) break;

        // Sort descending by score and pick top beamWidth
        nextNodes.sort((a, b) => b.score - a.score);
        beam = nextNodes.slice(0, beamWidth);
    }

    return {
        problem: {
            ...problem,
            requirements: bestNode.requirements,
            bugPolicy: policy,
            modCards,
        },
        solution: bestNode.solution,
        stats: bestNode.stats,
        analysis: bestNode.analysis,
        addedPartIndices: bestNode.addedPartIndices,
        addedCardIds,
    };
}
