import type { BugTolerance } from "./problem";

export const PANEL_BUG_TYPES = [
    "panelGrass",
    "panelIce",
    "panelCrack",
    "panelHoly",
    "panelSea",
    "panelHole",
    "panelMetal",
    "panelPoison",
] as const;

export const BN6_PANEL_BUG_TYPES = ["panelGrass", "panelIce", "panelCrack"] as const;

export const BN5_PANEL_BUG_TYPES = [
    "panelGrass",
    "panelIce",
    "panelCrack",
    "panelHoly",
    "panelSea",
    "panelHole",
] as const;

export const BN3_PANEL_BUG_TYPES = ["panelSet", "poisonWalk"] as const;

export const BN4_PLAYER_BUG_TYPES = [
    "playerConfuse",
    "playerMoveForward",
    "playerMoveBackward",
] as const;

export const BN3_INVOLUNTARY_MOVE_BUG_TYPES = [
    "involuntaryMoveUp",
    "involuntaryMoveDown",
    "involuntaryMoveConfuse",
] as const;

export const BN3_CHARGE_BUG_TYPES = [
    "chargeCube",
    "chargeWater",
    "chargeFlower",
] as const;

export const BN3_BUSTER_BUG_TYPES = [
    "busterBlank1",
    "busterBlank2",
    "busterGuard",
] as const;

/** Preserve the raw source category; classify card effects for final policy checks. */
export function getCardBugType(cardId: string, type: string, movePanel?: string, level?: number | null): string {
    if (cardId.startsWith("134-") && type === "player") {
        if (level === 1) return "playerConfuse";
        if (level === 3) return "playerMoveBackward";
        return "playerMoveForward";
    }
    if (type !== "panel") return type;
    if (cardId.startsWith("137-")) {
        if (movePanel === "Grass Panel") return "panelGrass";
        if (movePanel === "Ice Panel") return "panelIce";
        return "panelCrack";
    }
    if (cardId.startsWith("136-")) {
        if (cardId === "136-A017" || movePanel === "Holy Panel") return "panelHoly";
        if (cardId === "136-A029") return "panelSea";
        if (cardId === "136-B007") return "panelGrass";
        if (cardId === "136-B019" || cardId === "136-B025") return "panelIce";
        if (cardId === "136-B012" || cardId === "136-B016" || cardId === "136-B039") return "panelHole";
        return "panelCrack";
    }
    if (cardId.startsWith("134-")) {
        if (cardId === "134-091" || cardId === "134-095") return "panelPoison";
        if (movePanel === "Metal Panel") return "panelMetal";
        if (movePanel === "Cracked Panel") return "panelCrack";
        if (movePanel === "Hole Panel") return "panelHole";
        if (movePanel === "Holy Panel") return "panelHoly";
        return "panelCrack";
    }
    return type;
}

export function bugMatchesRule(actual: string, rule: string): boolean {
    const act = actual.toLowerCase();
    const rul = rule.toLowerCase();
    return act === rul ||
        (rul === "panel" && (PANEL_BUG_TYPES.some(type => type.toLowerCase() === act) ||
            BN3_PANEL_BUG_TYPES.some(type => type.toLowerCase() === act))) ||
        (rul === "player" && BN4_PLAYER_BUG_TYPES.some(type => type.toLowerCase() === act)) ||
        ((rul === "involuntarymove" || rul === "movement") && BN3_INVOLUNTARY_MOVE_BUG_TYPES.some(type => type.toLowerCase() === act)) ||
        (rul === "charge" && BN3_CHARGE_BUG_TYPES.some(type => type.toLowerCase() === act)) ||
        (rul === "buster" && BN3_BUSTER_BUG_TYPES.some(type => type.toLowerCase() === act)) ||
        (rul === "busterblank" && (act === "busterblank1" || act === "busterblank2"));
}

export function getBugRule(rules: Partial<Record<string, BugTolerance>> | undefined, type: string, originalType: string = type): BugTolerance {
    return rules?.[type] ?? rules?.[originalType] ??
        (PANEL_BUG_TYPES.includes(type as typeof PANEL_BUG_TYPES[number]) ? rules?.panel : undefined) ??
        (BN3_PANEL_BUG_TYPES.includes(type as typeof BN3_PANEL_BUG_TYPES[number]) ? rules?.panel : undefined) ??
        (BN4_PLAYER_BUG_TYPES.includes(type as typeof BN4_PLAYER_BUG_TYPES[number]) ? rules?.player : undefined) ??
        (BN3_INVOLUNTARY_MOVE_BUG_TYPES.includes(type as typeof BN3_INVOLUNTARY_MOVE_BUG_TYPES[number]) ? (rules?.involuntaryMove ?? rules?.movement) : undefined) ??
        (BN3_CHARGE_BUG_TYPES.includes(type as typeof BN3_CHARGE_BUG_TYPES[number]) ? rules?.charge : undefined) ??
        (BN3_BUSTER_BUG_TYPES.includes(type as typeof BN3_BUSTER_BUG_TYPES[number]) ? (rules?.busterBlank ?? rules?.buster) : undefined) ??
        "forbidden";
}

/** Old broad defaults become individual controls; retain a broad required rule as an OR. */
export function expandPanelBugRules(gameId: string, rules: Record<string, BugTolerance>): Record<string, BugTolerance> {
    if (gameId === "bn3" && rules.panel && rules.panel !== "required") {
        const { panel, ...rest } = rules;
        return { ...Object.fromEntries(BN3_PANEL_BUG_TYPES.map(type => [type, panel])), ...rest };
    }
    if ((gameId !== "bn6" && gameId !== "bn5") || !rules.panel || rules.panel === "required") return rules;
    const panelTypes = gameId === "bn5" ? BN5_PANEL_BUG_TYPES : BN6_PANEL_BUG_TYPES;
    const { panel, ...rest } = rules;
    return { ...Object.fromEntries(panelTypes.map(type => [type, panel])), ...rest };
}

export const BN6_DEFAULT_FORBIDDEN_BUGS = [
    "movement",
    "custom",
    "panelCrack",
    "panelIce",
    "support",
] as const;

export const BN5_DEFAULT_FORBIDDEN_BUGS = [
    "movement",
    "panelCrack",
    "panelIce",
    "panelHole",
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
            movement: "forbidden",
            panelCrack: "forbidden",
            panelIce: "forbidden",
            panelHole: "forbidden",
            support: "forbidden",
            battleHp: "allowed",
            buster: "allowed",
            status: "allowed",
            emotion: "allowed",
            customDamage: "allowed",
            encounter: "allowed",
            resultZenny: "allowed",
            panelGrass: "allowed",
            panelHoly: "allowed",
        };
    }
    return {};
}

