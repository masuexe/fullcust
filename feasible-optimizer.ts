import { colorCompatibility } from "./compatibility";
import { analyzeSolutionBugs, BuildStats, computeBuildStats, getPartEffect, isSolutionAcceptable } from "./effects";
import { computeDeckStats, getModCards } from "./modcards";
import { BUSTER_STATS, getBusterMinimums, DEFAULT_BUG_POLICY, makeGridSettings } from "./problem";
import { Requirement, placeAll, solve } from "./solver";
import { bodyConstraintsPossible, busterMinimumsPossible, doesBuildSatisfyConstraints, OptimizeOptions, OptimizeResult, removeRedundantAbilityParts, requirementsUnderPolicy } from "./optimizer";

interface Goal {
    satisfied: (stats: BuildStats) => boolean;
    advances: (before: BuildStats, after: BuildStats) => boolean;
}

/** Constraint-directed first-solution pass. Never establishes infeasibility;
 * exhaustive search remains the fallback for choices this pass does not visit.
 */
export function findFeasibleBuild(
    options: Omit<OptimizeOptions, "timeoutMs" | "beamWidth"> & { shouldStop: () => boolean }
): OptimizeResult | null {
    const { data, problem, constraints = problem.constraints,
        policy = problem.bugPolicy ?? DEFAULT_BUG_POLICY, modCardMode = "keep", shouldStop } = options;
    if (!bodyConstraintsPossible(constraints) || !busterMinimumsPossible(options)) return null;
    const grid = makeGridSettings(data, problem);
    const capacity = grid.height * grid.width - (grid.hasOob ? 4 : 0);
    const availableCards = data.gameId !== "bn3" && modCardMode === "auto" ? getModCards(data.gameId) : [];
    const emptyAnalysis = analyzeSolutionBugs(data.gameId, data.partMetas, [],
        new Array(grid.height * grid.width).fill(null), grid, "en");
    const goals: Goal[] = [];
    const addGoal = (satisfied: Goal["satisfied"], advances?: Goal["advances"]) => {
        goals.push({ satisfied, advances: advances ?? ((_before, after) => satisfied(after)) });
    };
    for (const ability of constraints?.requiredAbilities ?? []) addGoal(stats => stats.abilities.includes(ability));
    const minimums = getBusterMinimums(constraints);
    for (const stat of BUSTER_STATS.filter(stat => minimums[stat] !== undefined)) {
        addGoal(stats => stats[stat] >= minimums[stat]!, (before, after) => after[stat] > before[stat]);
    }
    if (constraints?.minCustom !== undefined) {
        addGoal(stats => stats.custom >= constraints.minCustom!, (before, after) => after.custom > before.custom);
    }
    const { requiredAbilities: _abilities, requiredMaxBusterStats: _buster,
        minBusterStats: _minimums,
        minCustom: _minCustom,
        bugRules: _rules, forbiddenBugs: _forbidden, ...cardConstraints } = constraints ?? {};
    for (const [key, value] of Object.entries(cardConstraints)) {
        if (value !== undefined) addGoal(stats => doesBuildSatisfyConstraints(stats, emptyAnalysis, { [key]: value }));
    }
    const freeReqs: Requirement[] = data.parts.map((_, partIndex) => ({ partIndex,
        constraint: { onCommandLine: null, compressed: null, minBugLevel: 0, maxBugLevel: Infinity } }));
    const minimumCells = (req: Requirement) => {
        const part = data.parts[req.partIndex];
        const c = part.compressedMask.filter(Boolean).length;
        const u = part.uncompressedMask.filter(Boolean).length;
        return req.constraint.compressed === null ? Math.min(c, u) : req.constraint.compressed ? c : u;
    };
    const partSizes = freeReqs.map(minimumCells);
    const visited = new Set<string>();
    const statsFor = (requirements: Requirement[], cards: string[]) => computeBuildStats(data.gameId,
        requirements.map(r => data.partMetas[r.partIndex].id), cards, problem.baseHp ?? 1000);
    interface State {
        requirements: Requirement[];
        cards: string[];
        added: number[];
        occupied: number;
        stats: BuildStats;
    }
    function visit(state: State): OptimizeResult | null {
        if (shouldStop() || state.occupied > capacity) return null;
        const deck = computeDeckStats(state.cards, data.gameId);
        if (deck.isOverCapacity || deck.hasSlotConflict) return null;
        if (colorCompatibility(data, { ...problem, requirements: state.requirements }).error) return null;
        if (data.gameId !== "bn3" && new Set(state.requirements.map(r => data.parts[r.partIndex].color)).size > 4) return null;
        const key = JSON.stringify([[...state.added].sort((a, b) => a - b), state.cards]);
        if (visited.has(key)) return null;
        visited.add(key);
        const missing = goals.filter(goal => !goal.satisfied(state.stats));
        if (missing.length === 0) {
            const reqs = requirementsUnderPolicy(data, state.requirements, policy,
                constraints?.forbiddenBugs ?? [], constraints?.bugRules, state.cards);
            for (const solution of solve(data.parts, reqs, grid, problem.spinnableColors, shouldStop, false)) {
                if (shouldStop()) return null;
                const analysis = analyzeSolutionBugs(data.gameId, data.partMetas, state.requirements,
                    placeAll(data.parts, state.requirements, solution, grid), grid, "en", state.cards);
                if (!isSolutionAcceptable(analysis, policy, constraints?.forbiddenBugs, constraints?.bugRules) ||
                    !doesBuildSatisfyConstraints(state.stats, analysis, constraints)) continue;
                return removeRedundantAbilityParts(options, {
                    problem: { ...problem, requirements: state.requirements, modCards: state.cards, constraints, bugPolicy: policy },
                    solution, stats: state.stats, analysis, addedPartIndices: state.added,
                    addedCardIds: modCardMode === "auto" ? state.cards : [],
                });
            }
            // BugStop is useful even when it supplies no missing stat or ability.
            // Other policy-repair combinations are left to the exhaustive pass.
        }
        interface Choice { state: State; gain: number; cost: number }
        const choices: Choice[] = [];
        const currentCovered = goals.filter(g => g.satisfied(state.stats)).length;
        const consider = (next: State, cost: number) => {
            const nextDeck = computeDeckStats(next.cards, data.gameId);
            if (nextDeck.isOverCapacity || nextDeck.hasSlotConflict) return;
            if (!missing.some(g => g.advances(state.stats, next.stats)) && missing.length > 0) return;
            choices.push({ state: next, cost, gain: goals.filter(g => g.satisfied(next.stats)).length - currentCovered });
        };
        for (const req of freeReqs) {
            if (shouldStop()) return null;
            const occupied = state.occupied + partSizes[req.partIndex];
            if (occupied > capacity) continue;
            if (missing.length === 0 && !getPartEffect(data.gameId, data.partMetas[req.partIndex].id)?.abilities?.includes("bugStop")) continue;
            const requirements = [...state.requirements, req];
            consider({ requirements, cards: state.cards, added: [...state.added, req.partIndex], occupied,
                stats: statsFor(requirements, state.cards) }, partSizes[req.partIndex] / capacity);
        }
        for (const card of availableCards) {
            if (shouldStop()) return null;
            if (missing.length === 0 && card.repairs.length === 0) continue;
            const cards = [...state.cards, card.id];
            consider({ ...state, cards, stats: statsFor(state.requirements, cards) }, data.gameId === "bn4" ? 1 / 5 : card.mb / 80);
        }
        // Branch on the missing requirement with the fewest suppliers. This locks
        // card-only moves and abilities before exploring optional filler programs.
        let selected = choices;
        if (missing.length > 0) {
            for (const goal of missing) {
                const providers = choices.filter(c => goal.advances(state.stats, c.state.stats));
                if (providers.length === 0) return null;
                if (providers.length < selected.length) selected = providers;
            }
        }
        selected.sort((a, b) => b.gain - a.gain || a.cost - b.cost);
        for (const choice of selected) {
            if (shouldStop()) return null;
            // Only geometric impossibility is safe for intermediate states;
            // a later neighbor may still satisfy an explicit minimum bug level.
            const relaxed = choice.state.requirements.map(r => ({ ...r, constraint: { ...r.constraint, minBugLevel: 0 } }));
            if (solve(data.parts, relaxed, grid, problem.spinnableColors, shouldStop, false)[Symbol.iterator]().next().done) continue;
            const result = visit(choice.state);
            if (result) return result;
        }
        return null;
    }
    const cards = data.gameId !== "bn3" && modCardMode === "keep" ? problem.modCards ?? [] : [];
    return visit({ requirements: [...problem.requirements], cards, added: [],
        occupied: problem.requirements.reduce((sum, req) => sum + minimumCells(req), 0), stats: statsFor(problem.requirements, cards) });
}
