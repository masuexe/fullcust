import { colorCompatibility } from "./compatibility";
import { analyzeSolutionBugs, computeBuildStats, isSolutionAcceptable } from "./effects";
import { findFeasibleBuild } from "./feasible-optimizer";
import { computeDeckStats, getModCards } from "./modcards";
import { doesBuildSatisfyConstraints, evaluateBuildScore, occupiedBuildCells, OptimizeOptions, OptimizeResult, optimizeBuild, removeRedundantAbilityParts } from "./optimizer";
import { BUSTER_STATS, getBusterMinimums, DEFAULT_BUG_POLICY, makeGridSettings } from "./problem";
import { placeAll } from "./solver";

interface LocalOptions extends Omit<OptimizeOptions, "timeoutMs" | "beamWidth"> {
    initialBest: OptimizeResult;
    shouldStop: () => boolean;
    onImprove?: (result: OptimizeResult) => void;
}

/** Finite neighborhood of insertions, replacements, removals and loading orders. */
export function* neighboringDecks(current: string[], availableIds: string[]): Generator<string[]> {
    yield current;
    for (let i = 0; i < current.length; i++) {
        const rest = current.filter((_, index) => index !== i);
        yield rest;
        for (let position = 0; position < current.length; position++) {
            if (position === i) continue;
            const moved = [...rest];
            moved.splice(position, 0, current[i]);
            yield moved;
        }
        for (const id of availableIds) {
            if (id !== current[i]) yield current.map((value, index) => index === i ? id : value);
        }
    }
    for (const id of availableIds) {
        for (let position = 0; position <= current.length; position++) {
            yield [...current.slice(0, position), id, ...current.slice(position)];
        }
    }
}

/** Improve a valid incumbent before exhaustive search. MB is an upper bound,
 * never a reward. Every published build satisfies the original constraints.
 */
export function improveBuildLocally(options: LocalOptions): OptimizeResult {
    const { data, problem, initialBest, shouldStop, onImprove,
        constraints = problem.constraints, policy = problem.bugPolicy ?? DEFAULT_BUG_POLICY,
        target = "max_hp", modCardMode = "keep" } = options;
    if (shouldStop()) return initialBest;
    let best = removeRedundantAbilityParts(options, initialBest);
    let bestScore = evaluateBuildScore(best.stats, target);
    let bestCells = occupiedBuildCells(data, best);
    if (best !== initialBest) onImprove?.(best);
    const grid = makeGridSettings(data, problem);
    const ids = modCardMode === "auto" && data.gameId !== "bn3" ? getModCards(data.gameId).map(card => card.id) : [];
    const minimums = getBusterMinimums(constraints);
    const cardConstraints = { ...constraints, requiredAbilities: undefined, requiredMaxBusterStats: undefined, minBusterStats: undefined, minCustom: undefined,
        bugRules: undefined, forbiddenBugs: undefined };
    const emptyAnalysis = analyzeSolutionBugs(data.gameId, data.partMetas, [],
        new Array(grid.height * grid.width).fill(null), grid, "en");
    const accept = (candidate: OptimizeResult) => {
        const result = removeRedundantAbilityParts(options, candidate);
        const deck = computeDeckStats(result.problem.modCards ?? [], data.gameId);
        if (deck.isOverCapacity || deck.hasSlotConflict || colorCompatibility(data, result.problem).error ||
            !isSolutionAcceptable(result.analysis, policy, constraints?.forbiddenBugs, constraints?.bugRules) ||
            !doesBuildSatisfyConstraints(result.stats, result.analysis, constraints)) return;
        const score = evaluateBuildScore(result.stats, target);
        const cells = occupiedBuildCells(data, result);
        if (score < bestScore || (score === bestScore &&
            (cells >= bestCells || JSON.stringify(result.stats) !== JSON.stringify(best.stats)))) return;
        best = { ...result,
            problem: { ...result.problem, constraints, bugPolicy: policy },
            addedPartIndices: result.problem.requirements.slice(problem.requirements.length).map(req => req.partIndex),
            addedCardIds: modCardMode === "auto" ? result.problem.modCards : [],
        };
        bestScore = score;
        bestCells = cells;
        onImprove?.(best);
    };
    // Changes in card coverage may free automatic NC parts even when the score
    // with the current NC layout does not improve. Explore those repackings too.
    const supplySignature = (cards: string[]) => {
        const deck = computeDeckStats(cards, data.gameId);
        const stats = computeBuildStats(data.gameId, [], cards, problem.baseHp ?? 1000);
        return JSON.stringify([
            stats.abilities,
            (constraints?.requiredAbilities ?? []).map(ability => stats.abilities.includes(ability)),
            BUSTER_STATS.filter(stat => minimums[stat] !== undefined).map(stat => stats[stat]),
            constraints?.minCustom !== undefined ? stats.custom : undefined,
            constraints?.minChipRecovery ? stats.modChipRecovery ?? 0 : undefined,
            deck.activeBugs.map(b => [b.bug.type, b.bug.level]), deck.repairedBugs,
        ]);
    };
    const repacked = new Set<string>();
    const triedRemovals = new Set<string>();
    while (!shouldStop()) {
        const roundScore = bestScore;
        const roundCells = bestCells;
        const improvedThisRound = () => bestScore > roundScore || bestCells < roundCells;
        const base = best;
        const partIds = base.problem.requirements.map(req => data.partMetas[req.partIndex].id);
        const cells = placeAll(data.parts, base.problem.requirements, base.solution, grid);
        const seen = new Set<string>();
        const candidates: { cards: string[]; score: number; changesSupply: boolean }[] = [];
        const signature = supplySignature(base.problem.modCards ?? []);
        const neighbors = ids.length > 0 ? neighboringDecks(base.problem.modCards ?? [], ids) : [base.problem.modCards ?? []];
        for (const cards of neighbors) {
            if (shouldStop()) return best;
            const key = JSON.stringify(cards);
            if (seen.has(key)) continue;
            seen.add(key);
            const deck = computeDeckStats(cards, data.gameId);
            if (deck.isOverCapacity || deck.hasSlotConflict) continue;
            const stats = computeBuildStats(data.gameId, partIds, cards, problem.baseHp ?? 1000);
            if (!doesBuildSatisfyConstraints(stats, emptyAnalysis, cardConstraints)) continue;
            candidates.push({ cards, score: evaluateBuildScore(stats, target), changesSupply: supplySignature(cards) !== signature });
        }
        candidates.sort((a, b) => b.score - a.score);
        // First evaluate all card moves on the known layout. This is cheap and
        // yields an improvement without waiting for NC repacking to finish.
        for (const { cards, score, changesSupply } of candidates) {
            if (shouldStop()) return best;
            if (score < bestScore || (score === bestScore && !changesSupply)) continue;
            const analysis = analyzeSolutionBugs(data.gameId, data.partMetas, base.problem.requirements, cells, grid, "en", cards);
            const stats = computeBuildStats(data.gameId, partIds, cards, problem.baseHp ?? 1000);
            accept({ ...base, problem: { ...base.problem, modCards: cards }, stats, analysis });
        }
        // Follow a successful card move immediately, so another useful small
        // card can use the remaining capacity before slower repacking work.
        if (improvedThisRound()) continue;
        // Remove one automatic NC part at a time, then refill the freed cells.
        // A lower-scoring intermediate seed may lead to a better final packing;
        // publish only the final result if it improves and remains valid.
        for (let index = problem.requirements.length; index < base.problem.requirements.length; index++) {
            if (shouldStop()) return best;
            const removalKey = JSON.stringify([base.problem, index]);
            if (triedRemovals.has(removalKey)) continue;
            triedRemovals.add(removalKey);
            const requirements = base.problem.requirements.filter((_, i) => i !== index);
            const solution = base.solution.filter((_, i) => i !== index);
            const cards = base.problem.modCards ?? [];
            const stats = computeBuildStats(data.gameId, requirements.map(req => data.partMetas[req.partIndex].id), cards, problem.baseHp ?? 1000);
            const analysis = analyzeSolutionBugs(data.gameId, data.partMetas, requirements,
                placeAll(data.parts, requirements, solution, grid), grid, "en", cards);
            const reduced: OptimizeResult = { ...base, problem: { ...base.problem, requirements }, solution, stats, analysis };
            const valid = isSolutionAcceptable(analysis, policy, constraints?.forbiddenBugs, constraints?.bugRules) &&
                doesBuildSatisfyConstraints(stats, analysis, constraints);
            const deadline = Date.now() + 30;
            const seed = valid ? reduced : findFeasibleBuild({ ...options, problem: reduced.problem, modCardMode: "keep",
                shouldStop: () => shouldStop() || Date.now() >= deadline });
            if (!seed) continue;
            accept(seed);
            if (shouldStop()) return best;
            const filled = optimizeBuild({ ...options, problem: seed.problem, modCardMode: "keep", timeoutMs: 80 });
            if (filled) accept(filled);
            if (improvedThisRound()) break;
        }
        if (improvedThisRound()) continue;
        const decksToRepack = [best.problem.modCards ?? [], ...candidates.filter(c => c.changesSupply).map(c => c.cards)];
        for (const cards of decksToRepack) {
            if (shouldStop()) return best;
            const key = JSON.stringify(cards);
            if (repacked.has(key)) continue;
            repacked.add(key);
            const deadline = Date.now() + 50;
            // Rebuild from user-selected core parts, allowing automatic ability
            // and MAX parts to disappear when the new cards supply their effects.
            const seed = findFeasibleBuild({ ...options,
                problem: { ...problem, modCards: cards }, modCardMode: "keep",
                shouldStop: () => shouldStop() || Date.now() >= deadline });
            if (!seed) continue;
            accept(seed);
            if (shouldStop()) return best;
            const filled = optimizeBuild({ ...options, problem: seed.problem, modCardMode: "keep", timeoutMs: 100 });
            if (filled) accept(filled);
            if (improvedThisRound()) break;
        }
        if (!improvedThisRound()) break;
    }
    return best;
}
