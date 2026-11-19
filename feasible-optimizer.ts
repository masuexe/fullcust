import { bugMatchesRule, getBugRule, getCardBugType, PANEL_BUG_TYPES } from "./panel-effects";
import { colorCompatibility } from "./compatibility";
import { analyzeSolutionBugs, BuildStats, computeBuildStats, computePlacedBuildStats, getPartEffect, getPartBugTypes, isNonBattleProgram, isSolutionAcceptable, normalizeBugType } from "./effects";
import { computeDeckStats, getModCard, getModCards } from "./modcards";
import { BUSTER_STATS, BugTolerance, getBusterMinimums, getMaxAllowedBugLevel, isBugAllowedTolerance, DEFAULT_BUG_POLICY, makeGridSettings } from "./problem";
import { Requirement, placeAll, solve } from "./solver";
import { buildPreferOffLineReqs, cardSpecConstraintsPossible, busterMinimumsPossible, soulTimeMinimumPossible, doesBuildSatisfyConstraints, matchMovePanel, OptimizeOptions, OptimizeResult, partSuppliesRequiredPanelOrBug, removeRedundantAbilityParts, requirementsUnderPolicy, shouldLockSolidOnCommandLine } from "./optimizer";

/** A goal is judged on the final stats plus the bugs the chosen parts and deck
 * can supply. Bug supply is an approximation used for branching only; the
 * completed build is still validated against the real analysis.
 */
interface GoalState {
    stats: BuildStats;
    bugs: Set<string>;
    colorCount: number;
    hasBugStop: boolean;
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
    if (!cardSpecConstraintsPossible(constraints) || !busterMinimumsPossible(options) || !soulTimeMinimumPossible(options)) return null;
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
                const normalized = normalizeBugType(key);
                if (bugMatchesRule(normalizeBugType(type), normalized)) supplied.add(normalized);
            }
        }
        return supplied;
    };
    // A required bug with no choosable supplier here cannot be directed by this
    // pass. Leave it to the final validation instead of turning it into a dead end.
    const supplierCards = modCardMode === "auto" && data.gameId !== "bn3" ? getModCards(data.gameId) : [];
    const hasSupplier = (key: string) => {
        const normalized = normalizeBugType(key);
        if (data.partMetas.some(part => getPartBugTypes(data.gameId, part.id)
            .some(type => bugMatchesRule(normalizePartBug(type), normalized)))) return true;
        return supplierCards.some(card => (card.bugs ?? []).some(bug =>
            bugMatchesRule(normalizeBugType(getCardBugType(card.id, bug.type, card.movePanel, bug.level)), normalized)));
    };
    const nonBattleBugSuppliers = new Set<string>();
    for (let i = 0; i < data.partMetas.length; i++) {
        if (!isNonBattleProgram(data.gameId, data.partMetas[i].id, constraints?.requiredAbilities)) continue;
        for (const type of getPartBugTypes(data.gameId, data.partMetas[i].id)) {
            nonBattleBugSuppliers.add(normalizePartBug(type));
        }
    }
    const goals: Goal[] = [];
    const bugGoals = new Set<Goal>();
    const addGoal = (satisfied: Goal["satisfied"], advances?: Goal["advances"], isBugGoal = false) => {
        const goal: Goal = { satisfied, advances: advances ?? ((_before, after) => satisfied(after)) };
        goals.push(goal);
        if (isBugGoal) bugGoals.add(goal);
    };
    for (const ability of constraints?.requiredAbilities ?? []) addGoal(state => state.stats.abilities.includes(ability));
    // A required bug must actually appear. Panel bugs can come from cards (final
    // panel effect) or from a buggy NaviCust program; BN4-6 status bugs can also
    // come from 5+ distinct NC colors when BugStop is absent.
    let addedColorStatusGoal = false;
    for (const key of requiredBugKeys) {
        const normalized = normalizeBugType(key);
        if (data.gameId !== "bn3" && (normalized === "status" || normalized === "colorStatus")) {
            if (!addedColorStatusGoal) {
                addedColorStatusGoal = true;
                addGoal(
                    state => state.bugs.has("status") || (!state.hasBugStop && state.colorCount >= 5),
                    (before, after) => (!before.bugs.has("status") && after.bugs.has("status")) ||
                        (!after.hasBugStop && after.colorCount > before.colorCount),
                    true
                );
            }
            continue;
        }
        if (!hasSupplier(key)) continue;
        addGoal(state => state.bugs.has(normalized) ||
            (PANEL_BUG_TYPES.includes(normalized as typeof PANEL_BUG_TYPES[number]) && state.stats.modPanelEffect === normalized),
            (before, after) => (after.bugs.has(normalized) && !before.bugs.has(normalized)) ||
                (!before.stats.modPanelEffect && after.stats.modPanelEffect === normalized),
            true);
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
    if (constraints?.minSoulTime !== undefined && data.gameId === "bn5") {
        addGoal(
            state => (state.stats.soulTime ?? 3) >= constraints.minSoulTime!,
            (before, after) => (after.stats.soulTime ?? 3) > (before.stats.soulTime ?? 3)
        );
    }
    const { requiredAbilities: _abilities, requiredMaxBusterStats: _buster,
        minBusterStats: _minimums,
        minCustom: _minCustom,
        minSoulTime: _minSoulTime,
        bugRules: _rules, forbiddenBugs: _forbidden,
        allowedMovePanels: _panels,
        ...cardConstraints } = constraints ?? {};
    for (const [key, value] of Object.entries(cardConstraints)) {
        if (value !== undefined) addGoal(state => doesBuildSatisfyConstraints(state.stats, emptyAnalysis, { [key]: value }));
    }
    const freeReqs: Requirement[] = data.parts.map((_, partIndex) => ({ partIndex,
        constraint: {
            onCommandLine: shouldLockSolidOnCommandLine(
                data,
                partIndex,
                rules,
                constraints?.allowSupportBugGlitch,
                constraints?.allowedMovePanels,
                constraints?.requiredAbilities
            ) ? true : null,
            compressed: null,
            minBugLevel: 0,
            maxBugLevel: Infinity,
        } }));
    const minimumCells = (req: Requirement) => {
        const part = data.parts[req.partIndex];
        const c = part.compressedMask.filter(Boolean).length;
        const u = part.uncompressedMask.filter(Boolean).length;
        return req.constraint.compressed === null ? Math.min(c, u) : req.constraint.compressed ? c : u;
    };
    const isBugStop = (req: Requirement) => Boolean(getPartEffect(data.gameId, data.partMetas[req.partIndex].id)?.abilities?.includes("bugStop"));
    const partSizes = freeReqs.map(minimumCells);
    const visited = new Set<string>();
    const colorCountFor = (requirements: Requirement[]) =>
        new Set(requirements.map(r => data.parts[r.partIndex].color)).size;
    const hasBugStopFor = (requirements: Requirement[]) => requirements.some(isBugStop);
    const statsFor = (requirements: Requirement[], cards: string[]) => computeBuildStats(data.gameId,
        requirements.map(r => data.partMetas[r.partIndex].id), cards, problem.baseHp ?? 1000);
    const bugsFor = (requirements: Requirement[], cards: string[]): Set<string> => {
        const supplied = cardBugs(cards);
        for (const key of requiredBugKeys) {
            const normalized = normalizeBugType(key);
            if (requirements.some((req, idx) =>
                (idx < problem.requirements.length ? req.constraint.maxBugLevel > 0 : req.constraint.minBugLevel >= 1) &&
                providesRequiredBug(req.partIndex) &&
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
        colorCount: number;
        hasBugStop: boolean;
    }
    function visit(state: State): OptimizeResult | null {
        if (shouldStop() || state.occupied > capacity) return null;
        const deck = computeDeckStats(state.cards, data.gameId);
        if (deck.isOverCapacity || deck.hasSlotConflict) return null;
        if (colorCompatibility(data, { ...problem, requirements: state.requirements }).error) return null;
        if (data.gameId !== "bn3" && state.colorCount > 6) return null;
        const key = JSON.stringify([[...state.added].sort((a, b) => a - b), state.cards]);
        if (visited.has(key)) return null;
        visited.add(key);
        options.onSearchWork?.("candidate");
        const missing = goals.filter(goal => !goal.satisfied(state));
        if (missing.length === 0) {
            const reqs = requirementsUnderPolicy(data, state.requirements, policy,
                constraints?.forbiddenBugs ?? [], constraints?.bugRules, state.cards, constraints?.allowSupportBugGlitch);
            const preferOffLine = buildPreferOffLineReqs(data, reqs, constraints?.requiredAbilities);
            for (const solution of solve(data.parts, reqs, grid, problem.spinnableColors, shouldStop, true, options.onSearchWork ? () => options.onSearchWork!("placement") : undefined, true, preferOffLine)) {
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
        interface Choice {
            state: State;
            gain: number;
            cost: number;
            nonBattleDirectBug: boolean;
            nonBattleColorFiller: boolean;
        }
        const choices: Choice[] = [];
        const currentCovered = goals.filter(g => g.satisfied(state)).length;
        const consider = (next: State, cost: number, nonBattleDirectBug: boolean, nonBattleColorFiller: boolean) => {
            const nextDeck = computeDeckStats(next.cards, data.gameId);
            if (nextDeck.isOverCapacity || nextDeck.hasSlotConflict) return;
            if (!missing.some(g => g.advances(state, next)) && missing.length > 0) return;
            choices.push({
                state: next,
                cost,
                gain: goals.filter(g => g.satisfied(next)).length - currentCovered,
                nonBattleDirectBug,
                nonBattleColorFiller,
            });
        };
        for (const req of freeReqs) {
            if (shouldStop()) return null;
            if (options.excludeAutomaticBugStop && isBugStop(req)) continue;
            const occupied = state.occupied + partSizes[req.partIndex];
            if (occupied > capacity) continue;
            if (missing.length === 0 && !getPartEffect(data.gameId, data.partMetas[req.partIndex].id)?.abilities?.includes("bugStop")) continue;
            const isNonBattle = isNonBattleProgram(
                data.gameId,
                data.partMetas[req.partIndex].id,
                constraints?.requiredAbilities
            );
            // Force minBugLevel: 1 only when this part is needed for a still-missing
            // required bug, preferring non-battle parts over combat parts while
            // non-bug goals remain.
            const missingBugSupply = getPartBugTypes(data.gameId, data.partMetas[req.partIndex].id)
                .map(normalizePartBug)
                .filter(type => requiredBugKeys.some(key => {
                    const normKey = normalizeBugType(key);
                    return bugMatchesRule(type, normKey) && !state.bugs.has(normKey);
                }));
            const hasNonBugGoalsLeft = missing.some(goal => !bugGoals.has(goal));
            const shouldForceBug = missingBugSupply.length > 0 && req.constraint.minBugLevel < 1 && (
                isNonBattle ||
                !hasNonBugGoalsLeft ||
                missingBugSupply.some(type => !nonBattleBugSuppliers.has(type))
            );
            const constraint = shouldForceBug
                ? { ...req.constraint, minBugLevel: 1 }
                : req.constraint;
            const requirements = [...state.requirements, { ...req, constraint }];
            const nextColorCount = colorCountFor(requirements);
            const nextHasBugStop = state.hasBugStop || isBugStop(req);
            const nonBattleDirectBug = !isBugStop(req) &&
                isNonBattle &&
                partSuppliesRequiredPanelOrBug(data, req.partIndex, rules, constraints?.allowedMovePanels);
            const addsColorForRequiredStatus = data.gameId !== "bn3" &&
                (rules?.status === "required" || rules?.colorStatus === "required") &&
                !state.bugs.has("status") &&
                !nextHasBugStop &&
                state.colorCount < 5 &&
                nextColorCount > state.colorCount;
            consider({
                requirements,
                cards: state.cards,
                added: [...state.added, req.partIndex],
                occupied,
                stats: statsFor(requirements, state.cards),
                bugs: bugsFor(requirements, state.cards),
                colorCount: nextColorCount,
                hasBugStop: nextHasBugStop,
            }, partSizes[req.partIndex] / capacity, nonBattleDirectBug, addsColorForRequiredStatus && isNonBattle);
        }
        for (const card of availableCards) {
            if (shouldStop()) return null;
            if (missing.length === 0 && card.repairs.length === 0) continue;
            const cards = [...state.cards, card.id];
            consider({
                ...state,
                cards,
                stats: statsFor(state.requirements, cards),
                bugs: bugsFor(state.requirements, cards),
            }, data.gameId === "bn4" ? 1 / 5 : card.mb / 80, false, false);
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
        selected.sort((a, b) =>
            b.gain - a.gain ||
            Number(b.nonBattleDirectBug) - Number(a.nonBattleDirectBug) ||
            a.cost - b.cost ||
            Number(b.nonBattleColorFiller) - Number(a.nonBattleColorFiller));
        for (const choice of selected) {
            if (shouldStop()) return null;
            // Only geometric impossibility is safe for intermediate states;
            // a later neighbor may still satisfy an explicit minimum bug level.
            const relaxed = choice.state.requirements.map(r => ({ ...r, constraint: { ...r.constraint, minBugLevel: 0 } }));
            const preferOffLineRelaxed = buildPreferOffLineReqs(data, relaxed, constraints?.requiredAbilities);
            if (solve(data.parts, relaxed, grid, problem.spinnableColors, shouldStop, false, options.onSearchWork ? () => options.onSearchWork!("placement") : undefined, true, preferOffLineRelaxed)[Symbol.iterator]().next().done) continue;
            const result = visit(choice.state);
            if (result) return result;
        }
        return null;
    }
    const cards = data.gameId !== "bn3" && modCardMode === "keep" ? problem.modCards ?? [] : [];
    const initial: State = { requirements: [...problem.requirements], cards, added: [],
        occupied: problem.requirements.reduce((sum, req) => sum + minimumCells(req), 0),
        stats: statsFor(problem.requirements, cards), bugs: bugsFor(problem.requirements, cards),
        colorCount: colorCountFor(problem.requirements), hasBugStop: hasBugStopFor(problem.requirements) };
    const requiresBug = Object.values(rules ?? {}).includes("required");
    const isRestrictedTolerance = (tol?: BugTolerance) =>
        !isBugAllowedTolerance(tol) || getMaxAllowedBugLevel(tol) < Infinity;
    const restrictsBugs = data.partMetas.some(part => getPartBugTypes(data.gameId, part.id).some(type => {
        if (data.gameId === "bn4" && type === "player") {
            return isRestrictedTolerance(getBugRule(rules, "playerConfuse")) ||
                   isRestrictedTolerance(getBugRule(rules, "playerMoveForward")) ||
                   isRestrictedTolerance(getBugRule(rules, "playerMoveBackward"));
        }
        if (data.gameId === "bn3" && type === "involuntaryMove") {
            return isRestrictedTolerance(getBugRule(rules, "involuntaryMoveUp")) ||
                   isRestrictedTolerance(getBugRule(rules, "involuntaryMoveDown")) ||
                   isRestrictedTolerance(getBugRule(rules, "involuntaryMoveConfuse"));
        }
        const tolerance = getBugRule(rules, (data.gameId === "bn6" || data.gameId === "bn5") && type === "panel" ? "panelCrack" : normalizeBugType(type));
        return isRestrictedTolerance(tolerance);
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
                bugs: bugsFor(requirements, cards), colorCount: colorCountFor(requirements), hasBugStop: true });
            if (result) return result;
        }
        preferredDeadline = Infinity;
        // Interrupted states were not fully explored; retry them in the fallback.
        visited.clear();
    }
    return visit(initial);
}
