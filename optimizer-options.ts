import { expandPanelBugRules } from "./panel-effects";
import type { Data } from "./game-data";
import { BUG_SPEC_OPTIONS, GAME_BUG_DEFINITIONS, getCoreAbilityOptions, getPartBugTypes, getPartEffect, normalizeBugType, getMovePanelOptions } from "./effects";
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
    const isPanelRefined = data.gameId === "bn6" || data.gameId === "bn5";
    const options = BUG_SPEC_OPTIONS.filter(option => (!option.games || option.games.includes(data.gameId)) && !(isPanelRefined && option.id === "panel"));
    if (usesCards(data, cardsEnabled)) return options;
    const types = new Set<string>();
    for (const part of data.partMetas) {
        for (const type of getPartBugTypes(data.gameId, part.id)) {
            if (isPanelRefined && type === "panel") {
                types.add("panelCrack");
            } else if (data.gameId === "bn4" && type === "player") {
                types.add("playerConfuse");
                types.add("playerMoveForward");
                types.add("playerMoveBackward");
            } else if (data.gameId === "bn3" && type === "involuntaryMove") {
                types.add("involuntaryMoveUp");
                types.add("involuntaryMoveDown");
                types.add("involuntaryMoveConfuse");
            } else if (data.gameId === "bn3" && type === "charge") {
                types.add("chargeCube");
                types.add("chargeWater");
                types.add("chargeFlower");
            } else if (data.gameId === "bn3" && type === "buster") {
                types.add("busterBlank1");
                types.add("busterBlank2");
                types.add("busterGuard");
            } else {
                types.add(normalizeBugType(type));
            }
        }
    }
    // Color overflow is an NC source even though it has no single supplier part.
    if (GAME_BUG_DEFINITIONS[data.gameId]?.colorStatus) types.add(normalizeBugType("colorStatus"));
    return options.filter(option => types.has(option.id));
}

/**
 * Available values for minimum Custom constraint based on game ID and whether Mod Cards are active.
 *
 * In pure NC mode:
 * - BN6: NC programs are Custom1 (+1), Custom2 (+2), and NumberOpen (10). 9 is physically unreachable.
 *   Default baseline is 5, so values start from 6 up to 10 (omitting 9).
 * - BN5: NC programs can reach 6..10.
 * - BN4: NC programs can reach 6..9.
 * - BN3: NC programs can reach 6..8.
 *
 * In Mod Card mode:
 * - Cards can include negative Custom penalties (e.g. BN6 DiveMan -2, GroundMan -1; BN5 Proto -3).
 *   Megaman's Custom can drop to 2, 3, or 4. Setting >= 5 is a common protection constraint against hand penalties.
 */
export function getOptimizerCustomValues(gameId: string, cardsEnabled: boolean): number[] {
    if (!cardsEnabled) {
        if (gameId === "bn6") return [6, 7, 8, 10];
        if (gameId === "bn5") return [6, 7, 8, 9, 10];
        if (gameId === "bn4") return [6, 7, 8, 9];
        return [6, 7, 8];
    }
    if (gameId === "bn6" || gameId === "bn5") {
        return [3, 4, 5, 6, 7, 8, 9, 10];
    }
    if (gameId === "bn4") {
        return [4, 5, 6, 7, 8, 9, 10];
    }
    return [6, 7, 8];
}

/** UI-only mode projection. Saved drafts can be restored when cards are re-enabled;
 * hidden settings must not enter the worker request, result, or constraint counts.
 */
export function getOptimizerModeConstraints(data: Data, constraints: BuildConstraints, cardsEnabled: boolean): BuildConstraints {
    if (data.gameId === "bn3" || data.gameId === "bn4") {
        const { allowedBodies: _ab, requiredBody: _rb, ...restNoBody } = constraints;
        constraints = restNoBody;
    }
    if (usesCards(data, cardsEnabled)) return constraints;
    const {
        requiredSpecialMove, allowedSpecialMoves, requiredBLeft, allowedBLefts,
        requiredBButton, allowedBButtons, requiredChargeAddition, allowedChargeAdditions,
        requireGlitch100ChargeAddition,
        requiredBusterAddition, allowedBusterAdditions,
        allowedBodies, requiredBody, requiredGauge, allowedGauges, minChipRecovery,
        allowedMovePanels,
        requiredAbilities, minBusterStats, bugRules, forbiddenBugs,
        ...rest
    } = constraints;
    const abilities = ncAbilities(data);
    const required = requiredAbilities?.filter(ability => abilities.has(ability));
    const minima = Object.fromEntries(BUSTER_STATS.filter(stat => minBusterStats?.[stat] !== undefined)
        .map(stat => [stat, Math.min(5, minBusterStats![stat]!)]));
    const bugIds = new Set(getOptimizerBugOptions(data, false).map(option => option.id));
    if ((data.gameId === "bn6" || data.gameId === "bn5") && bugRules?.panel === "required") bugIds.add("panel");
    const rules = bugRules && Object.fromEntries(Object.entries(expandPanelBugRules(data.gameId, bugRules)).filter(([type]) => bugIds.has(normalizeBugType(type))));
    const forbidden = forbiddenBugs?.filter(type => bugIds.has(normalizeBugType(type)));
    const ncValidPanels = new Set(getMovePanelOptions(data.gameId, false).map(o => o.id));
    const ncMovePanels = allowedMovePanels?.filter(p => ncValidPanels.has(p));
    return {
        ...rest,
        ...(ncMovePanels && ncMovePanels.length > 0 ? { allowedMovePanels: ncMovePanels } : {}),
        ...(required?.length ? { requiredAbilities: required } : {}),
        ...(Object.keys(minima).length ? { minBusterStats: minima } : {}),
        ...(rules && Object.keys(rules).length ? { bugRules: rules } : {}),
        ...(forbidden?.length ? { forbiddenBugs: forbidden } : {}),
    };
}
