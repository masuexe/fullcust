import type { Data } from "./game-data";
import { isPartCompatible } from "./compatibility";
import {
    analyzeSolutionBugs,
    computeBuildStats,
    getPartEffect,
    isSolutionAcceptable,
    BuildStats,
    SolutionBugAnalysis,
} from "./effects";
import { BugPolicy, DEFAULT_BUG_POLICY, Problem, makeGridSettings } from "./problem";
import { placeAll, solve, Requirement, Solution } from "./solver";

export type OptimizationTarget = "max_hp" | "max_buster" | "balanced";

export interface OptimizeOptions {
    data: Data;
    problem: Problem;
    policy?: BugPolicy;
    target?: OptimizationTarget;
    timeoutMs?: number;
    beamWidth?: number;
}

export interface OptimizeResult {
    problem: Problem;
    solution: Solution;
    stats: BuildStats;
    analysis: SolutionBugAnalysis;
    addedPartIndices: number[];
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
    } = options;

    const startTime = Date.now();
    const gridSettings = makeGridSettings(data, problem);
    const spinnableColors = problem.spinnableColors;
    const baseHp = problem.baseHp ?? 1000;
    const modCards = problem.modCards || [];

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
        },
        solution: bestNode.solution,
        stats: bestNode.stats,
        analysis: bestNode.analysis,
        addedPartIndices: bestNode.addedPartIndices,
    };
}
