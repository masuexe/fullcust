import type { BugTolerance } from "./problem";

export const PANEL_BUG_TYPES = ["panelGrass", "panelIce", "panelCrack"] as const;

/** Preserve the raw source category; classify BN6 card effects for final policy checks. */
export function getCardBugType(cardId: string, type: string, movePanel?: string): string {
    if (!cardId.startsWith("137-") || type !== "panel") return type;
    if (movePanel === "Grass Panel") return "panelGrass";
    if (movePanel === "Ice Panel") return "panelIce";
    return "panelCrack";
}

export function bugMatchesRule(actual: string, rule: string): boolean {
    return actual.toLowerCase() === rule.toLowerCase() ||
        (rule.toLowerCase() === "panel" && PANEL_BUG_TYPES.some(type => type.toLowerCase() === actual.toLowerCase()));
}

export function getBugRule(rules: Partial<Record<string, BugTolerance>> | undefined, type: string, originalType: string = type): BugTolerance {
    return rules?.[type] ?? rules?.[originalType] ?? (PANEL_BUG_TYPES.includes(type as typeof PANEL_BUG_TYPES[number]) ? rules?.panel : undefined) ?? "forbidden";
}

/** Old broad defaults become individual controls; retain a broad required rule as an OR. */
export function expandPanelBugRules(gameId: string, rules: Record<string, BugTolerance>): Record<string, BugTolerance> {
    if (gameId !== "bn6" || !rules.panel || rules.panel === "required") return rules;
    const { panel, ...rest } = rules;
    return { ...Object.fromEntries(PANEL_BUG_TYPES.map(type => [type, panel])), ...rest };
}

export const BN6_DEFAULT_FORBIDDEN_BUGS = [
    "movement",
    "custom",
    "panelCrack",
    "panelIce",
    "support",
] as const;

export function getDefaultBugRules(gameId: string): Record<string, BugTolerance> {
    if (gameId === "bn6") {
        return {
            movement: "forbidden",
            custom: "forbidden",
            panelCrack: "forbidden",
            panelIce: "forbidden",
            support: "forbidden",
            battleHp: "allowed",
            damageHp: "allowed",
            buster: "allowed",
            customHp: "allowed",
            panelGrass: "allowed",
            status: "allowed",
            emotion: "allowed",
            customDamage: "allowed",
            damageConfusion: "allowed",
            encounter: "allowed",
            resultZenny: "allowed",
        };
    }
    if (gameId === "bn5") {
        return {
            resultZenny: "allowed",
        };
    }
    return {};
}

