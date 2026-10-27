import { colorCompatibility } from "./compatibility";
import { analyzeSolutionBugs, computeBuildStats, computePlacedBuildStats, getPartEffect, isSolutionAcceptable } from "./effects";
import { computeDeckStats, getModCards, ModCard } from "./modcards";
import { BUSTER_STATS, getBusterMinimums, DEFAULT_BUG_POLICY, makeGridSettings } from "./problem";
import { placeAll, Requirement, solve } from "./solver";
import {
    doesBuildSatisfyConstraints, compareBuildStats, haveSameBuildEffects, getCandidateFillerParts,
    OptimizeOptions, OptimizeResult, requirementsUnderPolicy,
    occupiedBuildCells, removeRedundantAbilityParts,
    bodyConstraintsPossible,
    gaugeConstraintsPossible,
    busterMinimumsPossible,
} from "./optimizer";

export interface SearchProgress {
    checkedBuilds: number;
    best: OptimizeResult | null;
}

export interface ExhaustiveOptions extends Omit<OptimizeOptions, "timeoutMs" | "beamWidth"> {
    shouldStop?: () => boolean;
    onProgress?: (progress: SearchProgress) => void;
    initialBest?: OptimizeResult | null;
}

// Order matters: later cards can repair bugs or overwrite earlier properties.
// Enumerate every legal ordered deck, including subsets, without filtering cards
// individually by bugs (a later repair can make such a deck legal).
export function* enumerateCardDecks(
    cards: ModCard[], gameId: string, length?: number, shouldStop: () => boolean = () => false
): Generator<string[]> {
    const chosen: ModCard[] = [];
    const slots = new Set<string>();
    function* visit(mb: number): Generator<string[]> {
        if (shouldStop()) return;
        if (length === undefined || chosen.length === length) yield chosen.map(c => c.id);
        if (chosen.length === length) return;
        for (const card of cards) {
            if (shouldStop()) return;
            if (gameId !== "bn4" && card.mb <= 0) throw new Error("MB-based cards must have positive sizes");
            if (gameId === "bn4" ? chosen.length >= 5 || (card.slot && slots.has(card.slot)) : mb + card.mb > 80) continue;
            chosen.push(card);
            if (card.slot) slots.add(card.slot);
            yield* visit(mb + card.mb);
            if (card.slot) slots.delete(card.slot);
            chosen.pop();
        }
    }
    yield* visit(0);
}

/** Complete search of NC multisets, all compression choices, layouts and card orders.
 * No beam, elapsed-time cutoff, or rejection of an invalid intermediate build.
 * Termination without cancellation is the only proof of exhaustion.
 */
export function searchBuilds(options: ExhaustiveOptions): SearchProgress & { completed: boolean } {
    const { data, problem, policy = problem.bugPolicy ?? DEFAULT_BUG_POLICY,
        constraints = problem.constraints, target = "max_hp", modCardMode = "keep",
        shouldStop = () => false, onProgress } = options;
    const grid = makeGridSettings(data, problem);
    const capacity = grid.height * grid.width - (grid.hasOob ? 4 : 0);
    const forbidden = constraints?.forbiddenBugs ?? [];
    const minimums = getBusterMinimums(constraints);
    const initial = options.initialBest ? removeRedundantAbilityParts(options, options.initialBest) : null;
    const initialDeck = initial ? computeDeckStats(initial.problem.modCards ?? [], data.gameId) : null;
    const validInitial = initial && !initialDeck?.isOverCapacity && !initialDeck?.hasSlotConflict &&
        !colorCompatibility(data, initial.problem).error &&
        isSolutionAcceptable(initial.analysis, policy, forbidden, constraints?.bugRules) &&
        doesBuildSatisfyConstraints(initial.stats, initial.analysis, constraints);
    const progress: SearchProgress = { checkedBuilds: 0, best: validInitial ? initial : null };
    if (progress.best) onProgress?.({ ...progress });
    let bestCells = progress.best ? occupiedBuildCells(data, progress.best) : Infinity;
    let lastReport = 0;
    const stopped = () => {
        const now = Date.now();
        if (now - lastReport >= 500) {
            lastReport = now;
            onProgress?.({ ...progress });
        }
        return shouldStop();
    };
    const minimumCells = (req: Requirement) => {
        const p = data.parts[req.partIndex];
        const c = p.compressedMask.filter(Boolean).length;
        const u = p.uncompressedMask.filter(Boolean).length;
        return req.constraint.compressed === null ? Math.min(c, u) : req.constraint.compressed ? c : u;
    };
    const freeReq = (partIndex: number): Requirement => ({ partIndex,
        constraint: { compressed: null, onCommandLine: null, minBugLevel: 0, maxBugLevel: Infinity } });
    // Heuristics affect order only. All parts, including zero-score support parts,
    // all color variants, and repeated copies remain in the exhaustive search.
    const ranked = getCandidateFillerParts(data, target);
    const priorities = new Map(ranked.map((index, rank) => [index, rank]));
    const candidates = data.parts.map((_, i) => i).sort((a, b) => {
        const abilities = (i: number) => getPartEffect(data.gameId, data.partMetas[i].id)?.abilities ?? [];
        const boostsRequiredStat = (i: number) => {
            const effect = getPartEffect(data.gameId, data.partMetas[i].id);
            return (constraints?.minCustom !== undefined && ((effect?.custom ?? 0) > 0 || effect?.numberOpen)) ||
                BUSTER_STATS.some(stat => minimums[stat] !== undefined &&
                ((effect?.[stat] ?? 0) > 0 || effect?.[`${stat}Max`]));
        };
        const priority = (i: number) => abilities(i).some(ab => constraints?.requiredAbilities?.includes(ab)) ? -2 :
            boostsRequiredStat(i) ? -2 : abilities(i).includes("bugStop") ? -1 : (priorities.get(i) ?? data.parts.length);
        return priority(a) - priority(b) || a - b;
    });
    const coreCells = problem.requirements.reduce((sum, r) => sum + minimumCells(r), 0);
    if (!bodyConstraintsPossible(constraints) || !gaugeConstraintsPossible(constraints) || !busterMinimumsPossible(options) || coreCells > capacity || colorCompatibility(data, problem).error ||
        (data.gameId !== "bn3" && new Set(problem.requirements.map(r => data.parts[r.partIndex].color)).size > (data.gameId === "bn6" ? 6 : 4))) {
        return { ...progress, completed: !shouldStop() };
    }
    const smallestPart = Math.min(...data.parts.map((_, i) => minimumCells(freeReq(i))));
    const maxAdded = Math.max(0, Math.floor((capacity - coreCells) / smallestPart));
    const autoCards = data.gameId !== "bn3" && modCardMode === "auto";
    const cards = autoCards ? getModCards(data.gameId) : [];
    const maxCards = cards.length === 0 ? 0 : data.gameId === "bn4" ? 5 :
        Math.floor(80 / Math.min(...cards.map(card => card.mb)));

    function searchDeck(modCards: string[], additions: number): void {
        if (stopped()) return;
        options.onSearchWork?.("candidate");
        const deck = computeDeckStats(modCards, data.gameId);
        if (deck.isOverCapacity || deck.hasSlotConflict || (data.gameId === "bn4" && modCards.length > 5)) return;
        // NC cannot change card-only properties. Ability and bug constraints are
        // deliberately excluded here because added NC parts can still satisfy them.
        const cardConstraints = { ...constraints, requiredAbilities: undefined, requiredMaxBusterStats: undefined, minBusterStats: undefined, minCustom: undefined,
            bugRules: undefined, forbiddenBugs: undefined };
        const emptyAnalysis = analyzeSolutionBugs(data.gameId, data.partMetas, [],
            new Array(grid.height * grid.width).fill(null), grid, "en", modCards);
        const deckStats = computeBuildStats(data.gameId, [], modCards, problem.baseHp ?? 1000);
        if (!doesBuildSatisfyConstraints(deckStats, emptyAnalysis, cardConstraints)) return;

        const requirements = [...problem.requirements];
        const added: number[] = [];
        function visit(start: number, occupied: number, remaining: number): void {
            if (stopped() || occupied > capacity) return;
            if (remaining * smallestPart + occupied > capacity) return;
            if (colorCompatibility(data, { ...problem, requirements }).error) return;
            if (data.gameId !== "bn3" && new Set(requirements.map(r => data.parts[r.partIndex].color)).size > (data.gameId === "bn6" ? 6 : 4)) return;
            options.onSearchWork?.("candidate");
            const ids = requirements.map(r => data.partMetas[r.partIndex].id);
            const stats = computeBuildStats(data.gameId, ids, modCards, problem.baseHp ?? 1000);
            const missing = (constraints?.requiredAbilities ?? []).filter(ab => !stats.abilities.includes(ab));
            // An ability absent from every remaining part cannot appear later.
            if (missing.some(ab => deck.disabledAbilities.includes(ab) || !candidates.slice(start).some(i =>
                getPartEffect(data.gameId, data.partMetas[i].id)?.abilities?.includes(ab)))) return;

            // Geometric impossibility is monotone. Minimum bug levels are not:
            // another same-color neighbor can satisfy them later, so relax minima.
            const geometric = requirements.map(r => ({ ...r, constraint: { ...r.constraint, minBugLevel: 0 } }));
            if (solve(data.parts, geometric, grid, problem.spinnableColors, stopped, false, options.onSearchWork ? () => options.onSearchWork!("placement") : undefined, true)[Symbol.iterator]().next().done) return;
            progress.checkedBuilds++;
            if (remaining === 0 && missing.length === 0) {
                const searchReqs = requirementsUnderPolicy(data, requirements, policy, forbidden, constraints?.bugRules, modCards);
                for (const solution of solve(data.parts, searchReqs, grid, problem.spinnableColors, stopped, false, options.onSearchWork ? () => options.onSearchWork!("placement") : undefined, true)) {
                    if (stopped()) return;
                    const placedStats = computePlacedBuildStats(data.gameId, data.partMetas, requirements,
                        placeAll(data.parts, requirements, solution, grid), grid, modCards, problem.baseHp ?? 1000);
                    const analysis = analyzeSolutionBugs(data.gameId, data.partMetas, requirements,
                        placeAll(data.parts, requirements, solution, grid), grid, "en", modCards);
                    if (!isSolutionAcceptable(analysis, policy, forbidden, constraints?.bugRules) ||
                        !doesBuildSatisfyConstraints(placedStats, analysis, constraints)) continue;
                    const comparison = progress.best ? compareBuildStats(placedStats, progress.best.stats, target) : 1;
                    if (comparison >= 0) {
                        const candidate = removeRedundantAbilityParts(options, {
                            problem: { ...problem, requirements: [...requirements], modCards: [...modCards], bugPolicy: policy, constraints },
                            solution, stats: placedStats, analysis, addedPartIndices: [...added],
                            addedCardIds: modCardMode === "auto" ? [...modCards] : [],
                        });
                        const cells = occupiedBuildCells(data, candidate);
                        if (comparison > 0 || (cells < bestCells && progress.best && haveSameBuildEffects(candidate.stats, progress.best.stats, constraints))) {
                            bestCells = cells;
                            progress.best = candidate;
                            lastReport = Date.now();
                            onProgress?.({ ...progress });
                        }
                    }
                    // Installed effects are an upper bound. If a program is off
                    // line, another layout can activate it and improve the score.
                    if (JSON.stringify(placedStats) === JSON.stringify(stats)) break;
                }
            }
            if (remaining === 0) return;
            for (let n = start; n < candidates.length; n++) {
                if (stopped()) return;
                const req = freeReq(candidates[n]);
                const cells = minimumCells(req);
                if (occupied + cells > capacity) continue;
                requirements.push(req);
                added.push(req.partIndex);
                visit(n, occupied + cells, remaining - 1);
                added.pop();
                requirements.pop();
            }
        }
        visit(0, coreCells, additions);
    }

    // Iterative deepening across both domains visits small feasible builds
    // before large optimization branches without discarding any combinations.
    for (let size = 0; size <= maxAdded + maxCards && !stopped(); size++) {
        for (let cardCount = Math.max(0, size - maxAdded); cardCount <= Math.min(size, maxCards) && !stopped(); cardCount++) {
            const additions = size - cardCount;
            const decks: Iterable<string[]> = autoCards ? enumerateCardDecks(cards, data.gameId, cardCount, stopped) :
                [data.gameId === "bn3" || modCardMode === "none" ? [] : problem.modCards ?? []];
            for (const modCards of decks) {
                if (stopped()) break;
                searchDeck(modCards, additions);
            }
        }
    }
    return { ...progress, completed: !shouldStop() };
}
