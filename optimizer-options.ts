import { expandPanelBugRules, getCardBugType } from "./panel-effects";
import type { Data } from "./game-data";
import { BUG_SPEC_OPTIONS, GAME_BUG_DEFINITIONS, getCoreAbilityOptions, getPartBugTypes, getPartEffect, normalizeBugType, getMovePanelOptions, enforceExclusiveRequiredBugs } from "./effects";
import { getModCards } from "./modcards";
import { BUSTER_STATS, BugTolerance, BuildConstraints, ChipRecoveryMinimum, getMaxAllowedBugLevel } from "./problem";

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

export function getOptimizerChipRecoveryValues(gameId: string): ChipRecoveryMinimum[] {
    if (gameId === "bn5") return [20, 30, 40, 50, 60, 100];
    return [10, 20, 30, 40];
}

export function getOptimizerSoulTimeValues(gameId: string, cardsEnabled: boolean): number[] {
    if (gameId !== "bn5") return [];
    if (!cardsEnabled) return [4, 5, 6, 7];
    return [2, 3, 4, 5, 6, 7, 8, 9];
}

export function getOptimizerBugLevels(data: Data, cardsEnabled: boolean, bugId: string): number[] {
    const gameId = data.gameId;
    const targetId = normalizeBugType(bugId);
    const gameDefs = GAME_BUG_DEFINITIONS[gameId] ?? GAME_BUG_DEFINITIONS.bn6;
    const ncLevels = new Set<number>();
    const cardLevels = new Set<number>();
    const isPanelRefined = gameId === "bn6" || gameId === "bn5";

    const addDefLevels = (defKey: string, into: Set<number>, respectNcMax: boolean) => {
        const def = gameDefs?.[defKey] ?? GAME_BUG_DEFINITIONS.bn6?.[defKey];
        if (def?.levels) {
            const ncMax = respectNcMax ? (def.ncMaxLevel ?? Infinity) : Infinity;
            for (const key of Object.keys(def.levels)) {
                const lv = Number(key);
                if (Number.isInteger(lv) && lv >= 1 && lv <= ncMax) {
                    into.add(lv);
                }
            }
        } else {
            into.add(1);
        }
    };

    const seenNcTypes = new Set<string>();
    for (const part of data.partMetas) {
        for (const rawType of getPartBugTypes(gameId, part.id)) {
            const mapped = isPanelRefined && rawType === "panel" ? "panelCrack" : normalizeBugType(rawType);
            if (mapped === targetId && !seenNcTypes.has(rawType)) {
                seenNcTypes.add(rawType);
                addDefLevels(rawType, ncLevels, true);
            }
        }
    }

    // Color overflow is an NC status bug source in BN4-6 even without a single supplier part.
    if (targetId === "status" && gameDefs?.colorStatus) {
        addDefLevels("colorStatus", ncLevels, true);
    }

    if (usesCards(data, cardsEnabled)) {
        for (const card of getModCards(gameId)) {
            for (const b of card.bugs || []) {
                const cardBugType = normalizeBugType(getCardBugType(card.id, b.type, card.movePanel, b.level));
                if (cardBugType === targetId) {
                    const lv = b.level ?? 1;
                    if (Number.isInteger(lv) && lv >= 1) {
                        cardLevels.add(lv);
                    }
                }
            }
        }
    }

    const combined = new Set<number>([...ncLevels, ...cardLevels]);

    if ((gameId === "bn5" || gameId === "bn6") && targetId === "battleHp" && ncLevels.size > 0 && cardLevels.size > 0) {
        for (const ncLv of ncLevels) {
            for (const cardLv of cardLevels) {
                combined.add(Math.min(7, ncLv + cardLv));
            }
        }
    }

    const sorted = Array.from(combined)
        .filter(lv => Number.isInteger(lv) && lv >= 1)
        .sort((a, b) => a - b);
    return sorted.length > 1 ? sorted : [];
}

export function getBugLevelDescription(
    gameId: string,
    bugId: string,
    level: number,
    lang: "en" | "ja" | "zh",
): string | undefined {
    const gameDefs = GAME_BUG_DEFINITIONS[gameId];
    if (!gameDefs) return undefined;
    const norm = normalizeBugType(bugId);
    const candidates: string[] = [norm];
    if (norm === "panelCrack") candidates.push("panel");
    if (norm === "status") {
        if (gameId === "bn4") candidates.unshift("colorStatus");
        else candidates.push("colorStatus");
    }
    for (const key of candidates) {
        const def = gameDefs[key];
        if (!def) continue;
        if (def.levels) {
            const levelDesc = def.levels[level]?.[lang];
            if (levelDesc) return levelDesc;
        } else if (level === 1) {
            return def.mechanics[lang];
        }
    }
    return undefined;
}

function normalizeBugRulesForMode(
    data: Data,
    rules: Record<string, BugTolerance> | undefined,
    cardsEnabled: boolean,
): Record<string, BugTolerance> | undefined {
    if (!rules) return rules;
    let changed = false;
    const next: Record<string, BugTolerance> = {};
    for (const [bugType, tol] of Object.entries(rules)) {
        let nextTol = tol;
        if (tol && tol.startsWith("allowed_lv")) {
            const maxLv = getMaxAllowedBugLevel(tol);
            const levels = getOptimizerBugLevels(data, cardsEnabled, bugType);
            if (levels.length === 0 || maxLv >= levels[levels.length - 1]) {
                nextTol = "allowed";
            } else {
                const clamped = [...levels].reverse().find(lv => lv <= maxLv);
                nextTol = clamped !== undefined ? (`allowed_lv${clamped}` as BugTolerance) : "forbidden";
            }
        }
        if (nextTol !== tol) changed = true;
        next[bugType] = nextTol;
    }
    return changed ? next : rules;
}

/** UI-only mode projection. Saved drafts can be restored when cards are re-enabled;
 * hidden settings must not enter the worker request, result, or constraint counts.
 */
export function getOptimizerModeConstraints(data: Data, constraints: BuildConstraints, cardsEnabled: boolean): BuildConstraints {
    if ((data.gameId === "bn3" || data.gameId === "bn4") && (
        constraints.allowedBodies !== undefined ||
        constraints.requiredBody !== undefined ||
        constraints.allowedChargeAdditions !== undefined ||
        constraints.requiredChargeAddition !== undefined ||
        constraints.requireGlitch100ChargeAddition !== undefined
    )) {
        const {
            allowedBodies: _ab,
            requiredBody: _rb,
            allowedChargeAdditions: _aca,
            requiredChargeAddition: _rca,
            requireGlitch100ChargeAddition: _rgc,
            ...restNoBody
        } = constraints;
        constraints = restNoBody;
    }
    if (data.gameId !== "bn5" && constraints.minSoulTime !== undefined) {
        const { minSoulTime: _st, ...restNoSoulTime } = constraints;
        constraints = restNoSoulTime;
    }
    if (usesCards(data, cardsEnabled)) {
        const normalizedRules = normalizeBugRulesForMode(data, constraints.bugRules, true);
        if (normalizedRules !== constraints.bugRules) {
            return { ...constraints, bugRules: normalizedRules };
        }
        return constraints;
    }
    const {
        requiredSpecialMove, allowedSpecialMoves, requiredBLeft, allowedBLefts,
        requiredBButton, allowedBButtons, requiredChargeAddition, allowedChargeAdditions,
        requireGlitch100ChargeAddition,
        allowSupportBugGlitch,
        requiredBusterAddition, allowedBusterAdditions,
        allowedBodies, requiredBody, requiredGauge, allowedGauges, minChipRecovery,
        allowedMovePanels,
        requiredAbilities, minBusterStats, bugRules, forbiddenBugs,
        minSoulTime,
        ...rest
    } = constraints;
    const abilities = ncAbilities(data);
    const required = requiredAbilities?.filter(ability => abilities.has(ability));
    const minima = Object.fromEntries(BUSTER_STATS.filter(stat => minBusterStats?.[stat] !== undefined)
        .map(stat => [stat, Math.min(5, minBusterStats![stat]!)]));
    const bugIds = new Set(getOptimizerBugOptions(data, false).map(option => option.id));
    if ((data.gameId === "bn6" || data.gameId === "bn5" || data.gameId === "bn3") && bugRules?.panel === "required") bugIds.add("panel");
    const expandedRules = bugRules && Object.fromEntries(Object.entries(expandPanelBugRules(data.gameId, bugRules)).filter(([type]) => bugIds.has(normalizeBugType(type))));
    const exclusiveRules = expandedRules && enforceExclusiveRequiredBugs(expandedRules, data.gameId);
    const rules = normalizeBugRulesForMode(data, exclusiveRules, false);
    const expandForbidden = (type: string): string[] => {
        const normalized = normalizeBugType(type);
        // BN3 keeps the battle-start panel bug and the poison-step bug separate.
        // A legacy broad "panel" rule applies to both.
        return data.gameId === "bn3" && normalized === "panel" ? ["panelSet", "poisonWalk"] : [normalized];
    };
    const forbidden = forbiddenBugs?.flatMap(expandForbidden).filter(type => bugIds.has(type));
    const ncValidPanels = new Set(getMovePanelOptions(data.gameId, false).map(o => o.id));
    const ncMovePanels = allowedMovePanels?.filter(p => ncValidPanels.has(p));
    return {
        ...rest,
        ...(data.gameId === "bn5" && minSoulTime !== undefined && minSoulTime > 3 ? { minSoulTime: Math.min(7, minSoulTime) } : {}),
        ...(ncMovePanels && ncMovePanels.length > 0 ? { allowedMovePanels: ncMovePanels } : {}),
        ...(required?.length ? { requiredAbilities: required } : {}),
        ...(Object.keys(minima).length ? { minBusterStats: minima } : {}),
        ...(rules && Object.keys(rules).length ? { bugRules: rules } : {}),
        ...(forbidden?.length ? { forbiddenBugs: forbidden } : {}),
    };
}
