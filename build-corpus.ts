import bn3Seeds from "./data/bn3-build-seeds.json";
import bn4Seeds from "./data/bn4-build-seeds.json";
import bn5Seeds from "./data/bn5-build-seeds.json";
import bn6Seeds from "./data/bn6-build-seeds.json";
import { colorCompatibility } from "./compatibility";
import { analyzeSolutionBugs, computePlacedBuildStats, isSolutionAcceptable } from "./effects";
import { compareBuildStats, doesBuildSatisfyConstraints, OptimizeOptions, OptimizeResult, occupiedBuildCells, removeRedundantAbilityParts } from "./optimizer";
import { computeDeckStats } from "./modcards";
import { DEFAULT_BUG_POLICY, makeGridSettings } from "./problem";
import { isSolutionGeometryValid, placeAll, Requirement, Solution } from "./solver";

export interface BuildSeed {
    parts: [number, string, number, number, number, boolean][];
    cards: string[];
}
export const BUILD_SEEDS_BY_GAME: Record<string, BuildSeed[]> = {
    bn3: bn3Seeds as unknown as BuildSeed[],
    bn4: bn4Seeds as unknown as BuildSeed[],
    bn5: bn5Seeds as unknown as BuildSeed[],
    bn6: bn6Seeds as unknown as BuildSeed[],
};

/** Legacy alias kept for tests and scripts. */
export const BN6_BUILD_SEEDS = BUILD_SEEDS_BY_GAME.bn6;

/** Known-build warm-start seeds for a game; empty when the game has no corpus yet. */
export function getBuildSeeds(gameId: string): BuildSeed[] {
    return BUILD_SEEDS_BY_GAME[gameId] ?? [];
}

/** Revalidate every seed against current data, selected core, base HP, policy and constraints. */
export function findKnownBuild(options: OptimizeOptions & {
    shouldStop?: () => boolean;
    onImprove?: (result: OptimizeResult) => void;
}, corpus?: BuildSeed[]): OptimizeResult | null {
    const { data, problem, constraints = problem.constraints, modCardMode = "keep",
        policy = problem.bugPolicy ?? DEFAULT_BUG_POLICY, target = "max_hp", shouldStop = () => false } = options;
    const activeCorpus = corpus ?? getBuildSeeds(data.gameId);
    if (activeCorpus.length === 0) return null;
    const grid = makeGridSettings(data, problem);
    let best: OptimizeResult | null = null;
    for (const seed of activeCorpus) {
        if (shouldStop()) break;
        options.onSearchWork?.("candidate");
        if (modCardMode === "none" && seed.cards.length) continue;
        if (modCardMode === "keep" && JSON.stringify(seed.cards) !== JSON.stringify(problem.modCards ?? [])) continue;
        if (computeDeckStats(seed.cards, data.gameId).isOverCapacity) continue;
        const indices = seed.parts.map(([id, color]) => data.partMetas.findIndex(meta => meta.id === id && data.colors[meta.color] === color));
        if (indices.some(i => i < 0) || problem.requirements.length > indices.length) continue;
        const placements: Solution = seed.parts.map(([, , x, y, rotation, compressed]) => ({ loc: { position: { x, y }, rotation }, compressed }));
        const sourceReqs: Requirement[] = indices.map(partIndex => ({ partIndex,
            constraint: { compressed: null, onCommandLine: null, minBugLevel: 0, maxBugLevel: Infinity } }));
        if (!isSolutionGeometryValid(data.parts, sourceReqs, placements, grid, problem.spinnableColors)) continue;
        const cells = placeAll(data.parts, sourceReqs, placements, grid);
        const onLine = new Set(cells.slice(grid.commandLineRow * grid.width, (grid.commandLineRow + 1) * grid.width));
        const chosen: number[] = [], used = new Set<number>();
        const matchCore = (n: number): OptimizeResult | null => {
            if (shouldStop()) return null;
            if (n < problem.requirements.length) {
                const req = problem.requirements[n];
                for (let i = 0; i < indices.length; i++) {
                    if (used.has(i) || indices[i] !== req.partIndex ||
                        (req.constraint.compressed !== null && req.constraint.compressed !== placements[i].compressed) ||
                        (req.constraint.onCommandLine !== null && req.constraint.onCommandLine !== onLine.has(i))) continue;
                    used.add(i); chosen.push(i);
                    const result = matchCore(n + 1);
                    if (result) return result;
                    chosen.pop(); used.delete(i);
                }
                return null;
            }
            const order = [...chosen, ...indices.map((_, i) => i).filter(i => !used.has(i))];
            const requirements = [...problem.requirements, ...order.slice(chosen.length).map(i => sourceReqs[i])];
            const solution = order.map(i => placements[i]);
            const candidateProblem = { ...problem, requirements, modCards: [...seed.cards], constraints, bugPolicy: policy };
            if (colorCompatibility(data, candidateProblem).error ||
                !isSolutionGeometryValid(data.parts, requirements, solution, grid, problem.spinnableColors)) return null;
            const occupied = placeAll(data.parts, requirements, solution, grid);
            const stats = computePlacedBuildStats(data.gameId, data.partMetas, requirements, occupied, grid, seed.cards, problem.baseHp ?? 1000);
            const analysis = analyzeSolutionBugs(data.gameId, data.partMetas, requirements, occupied, grid, "en", seed.cards);
            if (!isSolutionAcceptable(analysis, policy, constraints?.forbiddenBugs, constraints?.bugRules,
                    constraints?.allowSupportBugGlitch) ||
                !doesBuildSatisfyConstraints(stats, analysis, constraints, data.gameId)) return null;
            return removeRedundantAbilityParts(options, { problem: candidateProblem, solution, stats, analysis,
                addedPartIndices: requirements.slice(problem.requirements.length).map(r => r.partIndex),
                addedCardIds: modCardMode === "auto" ? [...seed.cards] : [] });
        };
        const result = matchCore(0);
        if (result && (!best || compareBuildStats(result.stats, best.stats, target) > 0 ||
            (compareBuildStats(result.stats, best.stats, target) === 0 && occupiedBuildCells(data, result) < occupiedBuildCells(data, best)))) {
            best = result;
            options.onImprove?.(best);
        }
    }
    return best;
}
