import { bugMatchesRule, getBugRule, getCardBugType, PANEL_BUG_TYPES } from "./panel-effects";
import { colorCompatibility } from "./compatibility";
import { analyzeSolutionBugs, BuildStats, computeBuildStats, computePlacedBuildStats, getPartEffect, getPartBugTypes, isSolutionAcceptable, normalizeBugType } from "./effects";
import { computeDeckStats, getModCard, getModCards } from "./modcards";
import { BUSTER_STATS, getBusterMinimums, DEFAULT_BUG_POLICY, makeGridSettings } from "./problem";
import { Requirement, placeAll, solve } from "./solver";
import { cardSpecConstraintsPossible, busterMinimumsPossible, doesBuildSatisfyConstraints, matchMovePanel, OptimizeOptions, OptimizeResult, removeRedundantAbilityParts, requirementsUnderPolicy } from "./optimizer";

/** A goal is judged on the final stats plus the bugs the chosen parts and deck
 * can supply. Bug supply is an approximation used for branching only; the
 * completed build is still validated against the real analysis.
 */
interface GoalState {
    stats: BuildStats;
    bugs: Set<string>;
}

interface Goal {
    satisfied: (state: GoalState) => boolean;
    advances: (before: GoalState, after: GoalState) => boolean;
}

/** Constraint-directed first-solution pass. Never establishes infeasibility;
 * exhaustive search remains the fallback for choices this pass does not visit.
 */
export function findFeasibleBuild(
    options: Omit<OptimizeOptions, "timeoutMs" | "beamWidth"> & {
        shouldStop: () => boolean;
        preferBugStop?: boolean;
        excludeAutomaticBugStop?: boolean;
    }
): OptimizeResult | null {
    const { data, problem, constraints = problem.constraints,
        policy = problem.bugPolicy ?? DEFAULT_BUG_POLICY, modCardMode = "keep", shouldStop: isCancelled } = options;
    let preferredDeadline = Infinity;
    const shouldStop = () => isCancelled() || Date.now() >= preferredDeadline;
    if (!cardSpecConstraintsPossible(constraints) || !busterMinimumsPossible(options)) return null;
    const grid = makeGridSettings(data, problem);
    const capacity = grid.height * grid.width - (grid.hasOob ? 4 : 0);
    const availableCards = data.gameId !== "bn3" && modCardMode === "auto" ? getModCards(data.gameId) : [];
    const emptyAnalysis = analyzeSolutionBugs(data.gameId, data.partMetas, [],
        new Array(grid.height * grid.width).fill(null), grid, "en");
    const rules = constraints?.bugRules ?? policy.customRules;
    const requiredBugKeys = Object.entries(rules ?? {})
        .filter(([, tolerance]) => tolerance === "required")
        .map(([key]) => key);
    /** BN5/BN6 report NaviCust panel bugs as the cracked-panel level. */
    const normalizePartBug = (type: string) =>
        (data.gameId === "bn6" || data.gameId === "bn5") && type === "panel" ? "panelCrack" : normalizeBugType(type);
    const providesRequiredBug = (partIndex: number) =>
        getPartBugTypes(data.gameId, data.partMetas[partIndex].id)
            .some(type => requiredBugKeys.some(key => bugMatchesRule(normalizePartBug(type), normalizeBugType(key))));
    const cardBugs = (cards: string[]): Set<string> => {
        const supplied = new Set<string>();
        if (cards.length === 0 || requiredBugKeys.length === 0) return supplied;
        for (const entry of computeDeckStats(cards, data.gameId).activeBugs) {
            const card = getModCard(entry.sourceCardId, data.gameId);
            const type = getCardBugType(entry.sourceCardId, entry.bug.type, card?.movePanel, entry.bug.level);
            for (const key of requiredBugKeys) {
                if (bugMatchesRule(normalizeBugType(type), normalizeBugType(key))) supplied.add(key);
            }
        }
        return supplied;
    };
    // A required bug with no choosable supplier here (for example the implicit
    // color overflow bug) cannot be directed by this pass. Leave it to the final
    // validation instead of turning it into a dead end.
    const supplierCards = modCardMode === "auto" && data.gameId !== "bn3" ? getModCards(data.gameId) : [];
    const hasSupplier = (key: string) => {
        const normalized = normalizeBugType(key);
        if (data.partMetas.some(part => getPartBugTypes(data.gameId, part.id)
            .some(type => bugMatchesRule(normalizePartBug(type), normalized)))) return true;
        return supplierCards.some(card => (card.bugs ?? []).some(bug =>
            bugMatchesRule(normalizeBugType(getCardBugType(card.id, bug.type, card.movePanel, bug.level)), normalized)));
    };
    const goals: Goal[] = [];
    const addGoal = (satisfied: Goal["satisfied"], advances?: Goal["advances"]) => {
        goals.push({ satisfied, advances: advances ?? ((_before, after) => satisfied(after)) });
    };
    for (const ability of constraints?.requiredAbilities ?? []) addGoal(state => state.stats.abilities.includes(ability));
    // A required bug must actually appear. Panel bugs can come from cards (final
    // panel effect) or from a buggy NaviCust program; every other bug can only
    // come from a buggy program or a card, so track supply instead of the
    // card-only panel field.
    for (const key of requiredBugKeys.filter(hasSupplier)) {
        const normalized = normalizeBugType(key);
        addGoal(state => state.bugs.has(normalized) ||
            (PANEL_BUG_TYPES.includes(normalized as typeof PANEL_BUG_TYPES[number]) && state.stats.modPanelEffect === normalized),
            (before, after) => (after.bugs.has(normalized) && !before.bugs.has(normalized)) ||
                (!before.stats.modPanelEffect && after.stats.modPanelEffect === normalized));
    }
    if (constraints?.allowedMovePanels !== undefined && constraints.allowedMovePanels.length > 0 && !constraints.allowedMovePanels.includes("none")) {
        addGoal(state => state.stats.modPanelEffect !== undefined && constraints.allowedMovePanels!.some(allowed => matchMovePanel(state.stats.modPanelEffect!, allowed)));
    }
    const minimums = getBusterMinimums(constraints);
    for (const stat of BUSTER_STATS.filter(stat => minimums[stat] !== undefined)) {
        addGoal(state => state.stats[stat] >= minimums[stat]!, (before, after) => after.stats[stat] > before.stats[stat]);
    }
    if (constraints?.minCustom !== undefined) {
        addGoal(state => state.stats.custom >= constraints.minCustom!, (before, after) => after.stats.custom > before.stats.custom);
    }
    const { requiredAbilities: _abilities, requiredMaxBusterStats: _buster,
        minBusterStats: _minimums,
        minCustom: _minCustom,
        bugRules: _rules, forbiddenBugs: _forbidden,
        allowedMovePanels: _panels,
        ...cardConstraints } = constraints ?? {};
    for (const [key, value] of Object.entries(cardConstraints)) {
        if (value !== undefined) addGoal(state => doesBuildSatisfyConstraints(state.stats, emptyAnalysis, { [key]: value }));
    }
    const freeReqs: Requirement[] = data.parts.map((_, partIndex) => ({ partIndex,
        constraint: { onCommandLine: null, compressed: null, minBugLevel: 0, maxBugLevel: Infinity } }));
    const minimumCells = (req: Requirement) => {
        const part = data.parts[req.partIndex];
        const c = part.compressedMask.filter(Boolean).length;
        const u = part.uncompressedMask.filter(Boolean).length;
        return req.constraint.compressed === null ? Math.min(c, u) : req.constraint.compressed ? c : u;
    };
    const isBugStop = (req: Requirement) => getPartEffect(data.gameId, data.partMetas[req.partIndex].id)?.abilities?.includes("bugStop");
    const partSizes = freeReqs.map(minimumCells);
    const visited = new Set<string>();
    const statsFor = (requirements: Requirement[], cards: string[]) => computeBuildStats(data.gameId,
        requirements.map(r => data.partMetas[r.partIndex].id), cards, problem.baseHp ?? 1000);
    const bugsFor = (requirements: Requirement[], cards: string[]): Set<string> => {
        const supplied = cardBugs(cards);
        for (const key of requiredBugKeys) {
            const normalized = normalizeBugType(key);
            if (requirements.some(req => providesRequiredBug(req.partIndex) &&
                getPartBugTypes(data.gameId, data.partMetas[req.partIndex].id)
                    .some(type => bugMatchesRule(normalizePartBug(type), normalized)))) supplied.add(normalized);
        }
        return supplied;
    };
    interface State {
        requirements: Requirement[];
        cards: string[];
        added: number[];
        occupied: number;
        stats: BuildStats;
        bugs: Set<string>;
    }
    function visit(state: State): OptimizeResult | null {
        if (shouldStop() || state.occupied > capacity) return null;
        const deck = computeDeckStats(state.cards, data.gameId);
        if (deck.isOverCapacity || deck.hasSlotConflict) return null;
        if (colorCompatibility(data, { ...problem, requirements: state.requirements }).error) return null;
        if (data.gameId !== "bn3" && new Set(state.requirements.map(r => data.parts[r.partIndex].color)).size > 6) return null;
        const key = JSON.stringify([[...state.added].sort((a, b) => a - b), state.cards]);
        if (visited.has(key)) return null;
        visited.add(key);
        options.onSearchWork?.("candidate");
        const missing = goals.filter(goal => !goal.satisfied(state));
        if (missing.length === 0) {
            const reqs = requirementsUnderPolicy(data, state.requirements, policy,
                constraints?.forbiddenBugs ?? [], constraints?.bugRules, state.cards);
            for (const solution of solve(data.parts, reqs, grid, problem.spinnableColors, shouldStop, false, options.onSearchWork ? () => options.onSearchWork!("placement") : undefined, true)) {
                if (shouldStop()) return null;
                const stats = computePlacedBuildStats(data.gameId, data.partMetas, state.requirements,
                    placeAll(data.parts, state.requirements, solution, grid), grid, state.cards, problem.baseHp ?? 1000);
                const analysis = analyzeSolutionBugs(data.gameId, data.partMetas, state.requirements,
                    placeAll(data.parts, state.requirements, solution, grid), grid, "en", state.cards);
                if (!isSolutionAcceptable(analysis, policy, constraints?.forbiddenBugs, constraints?.bugRules,
                        constraints?.allowSupportBugGlitch) ||
                    !doesBuildSatisfyConstraints(stats, analysis, constraints, data.gameId)) continue;
                return removeRedundantAbilityParts(options, {
                    problem: { ...problem, requirements: state.requirements, modCards: state.cards, constraints, bugPolicy: policy },
                    solution, stats, analysis, addedPartIndices: state.added,
                    addedCardIds: modCardMode === "auto" ? state.cards : [],
                });
            }
            // BugStop is useful even when it supplies no missing stat or ability.
            // Other policy-repair combinations are left to the exhaustive pass.
        }
        interface Choice { state: State; gain: number; cost: number }
        const choices: Choice[] = [];
        const currentCovered = goals.filter(g => g.satisfied(state)).length;
        const consider = (next: State, cost: number) => {
            const nextDeck = computeDeckStats(next.cards, data.gameId);
            if (nextDeck.isOverCapacity || nextDeck.hasSlotConflict) return;
            if (!missing.some(g => g.advances(state, next)) && missing.length > 0) return;
            choices.push({ state: next, cost, gain: goals.filter(g => g.satisfied(next)).length - currentCovered });
        };
        for (const req of freeReqs) {
            if (shouldStop()) return null;
            if (options.excludeAutomaticBugStop && isBugStop(req)) continue;
            const occupied = state.occupied + partSizes[req.partIndex];
            if (occupied > capacity) continue;
            if (missing.length === 0 && !getPartEffect(data.gameId, data.partMetas[req.partIndex].id)?.abilities?.includes("bugStop")) continue;
            // A program that supplies a required bug must actually be bugged: force
            // the minimum bug level so the placement solver keeps it buggy.
            const constraint = providesRequiredBug(req.partIndex) && req.constraint.minBugLevel < 1
                ? { ...req.constraint, minBugLevel: 1 }
                : req.constraint;
            const requirements = [...state.requirements, { ...req, constraint }];
            consider({ requirements, cards: state.cards, added: [...state.added, req.partIndex], occupied,
                stats: statsFor(requirements, state.cards), bugs: bugsFor(requirements, state.cards) },
                partSizes[req.partIndex] / capacity);
        }
        for (const card of availableCards) {
            if (shouldStop()) return null;
            if (missing.length === 0 && card.repairs.length === 0) continue;
            const cards = [...state.cards, card.id];
            consider({ ...state, cards, stats: statsFor(state.requirements, cards), bugs: bugsFor(state.requirements, cards) },
                data.gameId === "bn4" ? 1 / 5 : card.mb / 80);
        }
        // Branch on the missing requirement with the fewest suppliers. This locks
        // card-only moves and abilities before exploring optional filler programs.
        let selected = choices;
        if (missing.length > 0) {
            for (const goal of missing) {
                const providers = choices.filter(c => goal.advances(state, c.state));
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
            if (solve(data.parts, relaxed, grid, problem.spinnableColors, shouldStop, false, options.onSearchWork ? () => options.onSearchWork!("placement") : undefined, true)[Symbol.iterator]().next().done) continue;
            const result = visit(choice.state);
            if (result) return result;
        }
        return null;
    }
    const cards = data.gameId !== "bn3" && modCardMode === "keep" ? problem.modCards ?? [] : [];
    const initial: State = { requirements: [...problem.requirements], cards, added: [],
        occupied: problem.requirements.reduce((sum, req) => sum + minimumCells(req), 0),
        stats: statsFor(problem.requirements, cards), bugs: bugsFor(problem.requirements, cards) };
    const requiresBug = Object.values(rules ?? {}).includes("required");
    const restrictsBugs = data.partMetas.some(part => getPartBugTypes(data.gameId, part.id).some(type => {
        if (data.gameId === "bn4" && type === "player") {
            const conf = getBugRule(rules, "playerConfuse");
            const fwd = getBugRule(rules, "playerMoveForward");
            const bwd = getBugRule(rules, "playerMoveBackward");
            return (conf !== "allowed" && conf !== "allowed_any") ||
                   (fwd !== "allowed" && fwd !== "allowed_any") ||
                   (bwd !== "allowed" && bwd !== "allowed_any");
        }
        if (data.gameId === "bn3" && type === "involuntaryMove") {
            const up = getBugRule(rules, "involuntaryMoveUp");
            const down = getBugRule(rules, "involuntaryMoveDown");
            const conf = getBugRule(rules, "involuntaryMoveConfuse");
            return (up !== "allowed" && up !== "allowed_any") ||
                   (down !== "allowed" && down !== "allowed_any") ||
                   (conf !== "allowed" && conf !== "allowed_any");
        }
        const tolerance = getBugRule(rules, (data.gameId === "bn6" || data.gameId === "bn5") && type === "panel" ? "panelCrack" : normalizeBugType(type));
        return tolerance !== "allowed" && tolerance !== "allowed_any";
    }));
    if (data.gameId === "bn6" && (modCardMode === "auto" || (modCardMode === "keep" && cards.length > 0)) &&
        options.preferBugStop !== false && !options.excludeAutomaticBugStop && !requiresBug && restrictsBugs &&
        !problem.requirements.some(isBugStop)) {
        // Give the common PvP starting point a small scheduling slice,
        // keeping the original core available as the fallback.
        preferredDeadline = Date.now() + 150;
        const candidates = freeReqs.filter(isBugStop).sort((a, b) => partSizes[a.partIndex] - partSizes[b.partIndex]);
        for (const candidate of candidates) {
            if (shouldStop()) break;
            const req: Requirement = { ...candidate, constraint: { ...candidate.constraint, onCommandLine: true, maxBugLevel: 0 } };
            const requirements = [...initial.requirements, req];
            const result = visit({ ...initial, requirements, added: [req.partIndex],
                occupied: initial.occupied + partSizes[req.partIndex], stats: statsFor(requirements, cards),
                bugs: bugsFor(requirements, cards) });
            if (result) return result;
        }
        preferredDeadline = Infinity;
        // Interrupted states were not fully explored; retry them in the fallback.
        visited.clear();
    }
    return visit(initial);
}
