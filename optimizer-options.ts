import { expandPanelBugRules } from "./panel-effects";
import type { Data } from "./game-data";
import { BUG_SPEC_OPTIONS, GAME_BUG_DEFINITIONS, getCoreAbilityOptions, getPartBugTypes, getPartEffect, normalizeBugType } from "./effects";
import { BUSTER_STATS, BuildConstraints } from "./problem";

function usesCards(data: Data, enabled: boolean): boolean {
    return enabled && data.gameId !== "bn3";
}

function ncAbilities(data: Data): Set<string> {
    return new Set(data.partMetas.flatMap(part => getPartEffect(data.gameId, part.id)?.abilities ?? []));
}

export function getOptimizerAbilityOptions(data: Data, cardsEnabled: boolean) {
    const options = getCoreAbilityOptions(data.gameId);
    if (usesCards(data, cardsEnabled)) return options;
    const abilities = ncAbilities(data);
    return options.filter(option => abilities.has(option.id));
}

export function getOptimizerBugOptions(data: Data, cardsEnabled: boolean) {
    const options = BUG_SPEC_OPTIONS.filter(option => (!option.games || option.games.includes(data.gameId)) && !(data.gameId === "bn6" && option.id === "panel"));
    if (usesCards(data, cardsEnabled)) return options;
    const types = new Set(data.partMetas.flatMap(part => getPartBugTypes(data.gameId, part.id)).map(type => data.gameId === "bn6" && type === "panel" ? "panelCrack" : normalizeBugType(type)));
    // Color overflow is an NC source even though it has no single supplier part.
    if (GAME_BUG_DEFINITIONS[data.gameId]?.colorStatus) types.add(normalizeBugType("colorStatus"));
    return options.filter(option => types.has(option.id));
}

/** UI-only mode projection. Saved drafts can be restored when cards are re-enabled;
 * hidden settings must not enter the worker request, result, or constraint counts.
 */
export function getOptimizerModeConstraints(data: Data, constraints: BuildConstraints, cardsEnabled: boolean): BuildConstraints {
    if (usesCards(data, cardsEnabled)) return constraints;
    const {
        requiredSpecialMove, requiredBLeft, requiredBButton, requiredChargeAddition, requiredBusterAddition,
        allowedBodies, requiredBody, requiredGauge, minChipRecovery,
        requiredAbilities, minBusterStats, bugRules, forbiddenBugs,
        ...rest
    } = constraints;
    const abilities = ncAbilities(data);
    const required = requiredAbilities?.filter(ability => abilities.has(ability));
    const minima = Object.fromEntries(BUSTER_STATS.filter(stat => minBusterStats?.[stat] !== undefined)
        .map(stat => [stat, Math.min(5, minBusterStats![stat]!)]));
    const bugIds = new Set(getOptimizerBugOptions(data, false).map(option => option.id));
    if (data.gameId === "bn6" && bugRules?.panel === "required") bugIds.add("panel");
    const rules = bugRules && Object.fromEntries(Object.entries(expandPanelBugRules(data.gameId, bugRules)).filter(([type]) => bugIds.has(normalizeBugType(type))));
    const forbidden = forbiddenBugs?.filter(type => bugIds.has(normalizeBugType(type)));
    return {
        ...rest,
        ...(required?.length ? { requiredAbilities: required } : {}),
        ...(Object.keys(minima).length ? { minBusterStats: minima } : {}),
        ...(rules && Object.keys(rules).length ? { bugRules: rules } : {}),
        ...(forbidden?.length ? { forbiddenBugs: forbidden } : {}),
    };
}
