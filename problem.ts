import { z } from "zod";

import type { Data } from "./game-data";
import type { Requirement } from "./solver";

export type BugTolerance = "forbidden" | "allowed" | "required" | "allowed_lv1" | "allowed_any";
export type BugPolicyType = "no_bugs" | "benign_allowed" | "custom";
export const BUSTER_STATS = ["attack", "rapid", "charge"] as const;
export type BusterStat = typeof BUSTER_STATS[number];
export type ChipRecoveryMinimum = 10 | 20 | 30 | 40;
export const BODY_ELEMENTS = ["Normal", "Fire", "Aqua", "Elec", "Wood"] as const;
export type BodyElement = typeof BODY_ELEMENTS[number];

export interface BugPolicy {
    type: BugPolicyType;
    customRules?: Partial<Record<string, BugTolerance>>;
}

export const DEFAULT_BUG_POLICY: BugPolicy = {
    type: "no_bugs",
};

export interface BuildConstraints {
    requiredAbilities?: string[];
    requiredMaxBusterStats?: BusterStat[];
    minBusterStats?: Partial<Record<BusterStat, number>>;
    minCustom?: number;
    minChipRecovery?: ChipRecoveryMinimum;
    requiredSpecialMove?: string;
    requiredBLeft?: string;
    requiredBButton?: string;
    requiredChargeAddition?: string;
    requiredBusterAddition?: string;
    requiredBody?: string;
    allowedBodies?: BodyElement[];
    requiredGauge?: "fast" | "slow" | "normal";
    forbiddenBugs?: string[];
    bugRules?: Record<string, BugTolerance>;
}

/** Old Lv5 requirements remain minimums when cards raise Attack above five. */
export function getBusterMinimums(constraints?: BuildConstraints): Partial<Record<BusterStat, number>> {
    const minimums: Partial<Record<BusterStat, number>> = {};
    for (const stat of BUSTER_STATS) {
        const minimum = Math.max(constraints?.minBusterStats?.[stat] ?? 1,
            constraints?.requiredMaxBusterStats?.includes(stat) ? 5 : 1);
        if (minimum > 1) minimums[stat] = minimum;
    }
    return minimums;
}

export interface Problem {
    requirements: Requirement[];
    spinnableColors: boolean[];
    expansionMemories: number;
    style?: string;
    modTools?: boolean;
    modCards?: string[];
    baseHp?: number;
    bugPolicy?: BugPolicy;
    constraints?: BuildConstraints;
}

const toggle = z.union([z.literal(-1), z.literal(0), z.literal(1)]);
const bit = z.union([z.literal(0), z.literal(1)]);
const nonnegativeInt = z.number().int().nonnegative();
const constraint = z.object({
    c: toggle,
    b: z.number().int().min(-1),
    d: nonnegativeInt,
    z: toggle,
}).refine(value => value.b === -1 || value.d <= value.b, "Invalid bug range");

const LegacyProblem = z.object({
    r: z.array(constraint.and(z.object({ i: nonnegativeInt }))),
    s: z.array(bit),
    x: nonnegativeInt,
});

const SavedProblem = z.object({
    v: z.literal(2),
    g: z.string(),
    r: z.array(constraint.and(z.object({ p: z.string().min(1) }))),
    s: z.record(bit),
    x: nonnegativeInt,
    t: z.string().optional(), // Style type, for games with Style color rules.
    m: bit.optional(), // ModTools enabled.
    c: z.array(z.string()).optional(), // Mod Cards
    hp: z.number().int().positive().optional(), // Initial Base HP (default 1000)
    bp: z.object({
        t: z.union([z.literal("no_bugs"), z.literal("benign_allowed"), z.literal("custom")]),
        r: z.record(z.string()).optional(),
    }).optional(),
    bc: z.object({
        a: z.array(z.string()).optional(),
        bs: z.array(z.enum(["attack", "rapid", "charge"])).optional(),
        bm: z.object({
            attack: z.number().int().min(1).max(10).optional(),
            rapid: z.number().int().min(1).max(5).optional(),
            charge: z.number().int().min(1).max(5).optional(),
        }).optional(),
        cr: z.union([z.literal(10), z.literal(20), z.literal(30), z.literal(40)]).optional(),
        cm: z.number().int().min(5).max(10).optional(),
        cs: z.string().optional(),
        bl: z.string().optional(),
        bb: z.string().optional(),
        ca: z.string().optional(),
        ba: z.string().optional(),
        bd: z.string().optional(),
        ab: z.array(z.enum(BODY_ELEMENTS)).max(5).optional(),
        g: z.enum(["fast", "slow", "normal"]).optional(),
        fb: z.array(z.string()).optional(),
        br: z.record(z.string()).optional(),
    }).optional(),
});

export function emptyProblem(data: Data): Problem {
    const hasModCards = data.gameId === "bn4" || data.gameId === "bn5" || data.gameId === "bn6";
    return {
        requirements: [],
        spinnableColors: data.colors.map(() => true),
        expansionMemories: data.defaultExpansion,
        baseHp: 1000,
        bugPolicy: DEFAULT_BUG_POLICY,
        ...(hasModCards ? { modCards: [] } : {}),
        ...(data.styleColorRules ? {
            style: data.styleColorRules.defaultStyle,
            modTools: false,
        } : {}),
    };
}

// Internally the solver continues to use array indices. Only URLs use stable IDs.
export function fromHashString(s: string, data: Data): Problem | null {
    if (!s) return null;
    const json: unknown = JSON.parse(s);
    const versioned = typeof json === "object" && json !== null && "v" in json;
    const saved = versioned ? SavedProblem.parse(json) : LegacyProblem.parse(json);
    if (!versioned && !data.legacyCatalog) {
        throw new Error("This game has no legacy shared layout format.");
    }
    if ("g" in saved && saved.g !== data.gameId) {
        throw new Error("The shared layout belongs to another game.");
    }
    if (!data.gridOptions[saved.x]) throw new Error("Unknown grid preset.");
    const colors = "v" in saved ? saved.s : Object.fromEntries(
        data.legacyCatalog!.colors.map((color, i) => [color, saved.s[i]])
    );
    if (!("v" in saved) && saved.s.length !== data.legacyCatalog!.colors.length) {
        throw new Error("Invalid legacy spinner settings.");
    }
    if (data.colors.some(color => colors[color] === undefined)) {
        throw new Error("Missing spinner settings.");
    }
    const requirements = saved.r.map(req => {
        const id = "p" in req ? req.p : data.legacyCatalog!.partIds[req.i];
        const partIndex = data.partIds.indexOf(id);
        if (partIndex < 0) throw new Error(`Unknown part: ${id ?? "invalid index"}`);
        return {
            partIndex,
            constraint: {
                onCommandLine: req.c === -1 ? null : !!req.c,
                maxBugLevel: req.b === -1 ? Infinity : req.b,
                minBugLevel: req.d,
                compressed: req.z === -1 ? null : !!req.z,
            },
        };
    });
    const style = "t" in saved && saved.t !== undefined
        ? saved.t : data.styleColorRules?.defaultStyle;
    if (data.styleColorRules && !data.styleColorRules.styles.some(option => option.id === style)) {
        throw new Error("Unknown Style.");
    }
    const hasModCards = data.gameId === "bn4" || data.gameId === "bn5" || data.gameId === "bn6";
    // BN5's old "custom" key represented entry damage, not chip-slot loss.
    const restoreBugRules = (rules: Record<string, string>): Record<string, BugTolerance> => {
        if (data.gameId !== "bn5" || rules.custom === undefined) return rules as Record<string, BugTolerance>;
        const { custom, ...rest } = rules;
        return { ...rest, customDamage: rest.customDamage ?? custom } as Record<string, BugTolerance>;
    };
    const bugPolicy: BugPolicy = "bp" in saved && saved.bp ? {
        type: saved.bp.t,
        ...(saved.bp.r ? { customRules: restoreBugRules(saved.bp.r) } : {}),
    } : DEFAULT_BUG_POLICY;

    const constraints: BuildConstraints | undefined = "bc" in saved && saved.bc ? {
        ...(saved.bc.a ? { requiredAbilities: saved.bc.a } : {}),
        ...(saved.bc.bs ? { requiredMaxBusterStats: saved.bc.bs } : {}),
        ...(saved.bc.bm ? { minBusterStats: saved.bc.bm } : {}),
        ...(saved.bc.cr ? { minChipRecovery: saved.bc.cr } : {}),
        ...(saved.bc.cm !== undefined ? { minCustom: saved.bc.cm } : {}),
        ...(saved.bc.cs ? { requiredSpecialMove: saved.bc.cs } : {}),
        ...(saved.bc.bl ? { requiredBLeft: saved.bc.bl } : {}),
        ...(saved.bc.bb ? { requiredBButton: saved.bc.bb } : {}),
        ...(saved.bc.ca ? { requiredChargeAddition: saved.bc.ca } : {}),
        ...(saved.bc.ba ? { requiredBusterAddition: saved.bc.ba } : {}),
        ...(saved.bc.bd ? { requiredBody: saved.bc.bd } : {}),
        ...(saved.bc.ab !== undefined ? { allowedBodies: saved.bc.ab } : {}),
        ...(saved.bc.g ? { requiredGauge: saved.bc.g } : {}),
        ...(saved.bc.fb ? { forbiddenBugs: saved.bc.fb.map(type => data.gameId === "bn5" && type === "custom" ? "customDamage" : type) } : {}),
        ...(saved.bc.br ? { bugRules: restoreBugRules(saved.bc.br) } : {}),
    } : undefined;

    return {
        requirements,
        spinnableColors: data.colors.map(color => !!colors[color]),
        expansionMemories: saved.x,
        baseHp: "hp" in saved && typeof saved.hp === "number" ? saved.hp : 1000,
        bugPolicy,
        ...(constraints ? { constraints } : {}),
        ...(hasModCards ? {
            modCards: "c" in saved && Array.isArray(saved.c) ? saved.c : [],
        } : {}),
        ...(data.styleColorRules ? {
            style,
            modTools: "m" in saved && saved.m === 1,
        } : {}),
    };
}

export function toHashString(problem: Problem, data: Data): string {
    const hasModCards = data.gameId === "bn4" || data.gameId === "bn5" || data.gameId === "bn6";
    const saved: z.infer<typeof SavedProblem> = {
        v: 2,
        g: data.gameId,
        r: problem.requirements.map(req => ({
            p: data.partIds[req.partIndex],
            c: req.constraint.onCommandLine === null ? -1 : req.constraint.onCommandLine ? 1 : 0,
            b: req.constraint.maxBugLevel === Infinity ? -1 : req.constraint.maxBugLevel,
            d: req.constraint.minBugLevel,
            z: req.constraint.compressed === null ? -1 : req.constraint.compressed ? 1 : 0,
        })),
        s: Object.fromEntries(data.colors.map((color, i) => [color, problem.spinnableColors[i] ? 1 as const : 0 as const])),
        x: problem.expansionMemories,
        ...(data.styleColorRules ? { t: problem.style, m: problem.modTools ? 1 as const : 0 as const } : {}),
        ...(hasModCards && problem.modCards && problem.modCards.length > 0 ? { c: problem.modCards } : {}),
        ...(problem.baseHp !== undefined && problem.baseHp !== 1000 ? { hp: problem.baseHp } : {}),
        ...(problem.bugPolicy && problem.bugPolicy.type !== "no_bugs" ? {
            bp: {
                t: problem.bugPolicy.type,
                ...(problem.bugPolicy.customRules ? { r: problem.bugPolicy.customRules as Record<string, string> } : {}),
            },
        } : {}),
        ...(problem.constraints && (
            problem.constraints.requiredAbilities?.length ||
            problem.constraints.requiredMaxBusterStats?.length ||
            (problem.constraints.minBusterStats && Object.keys(problem.constraints.minBusterStats).length > 0) ||
            problem.constraints.minChipRecovery ||
            problem.constraints.minCustom !== undefined ||
            problem.constraints.requiredSpecialMove ||
            problem.constraints.requiredBLeft ||
            problem.constraints.requiredBButton ||
            problem.constraints.requiredChargeAddition ||
            problem.constraints.requiredBusterAddition ||
            problem.constraints.requiredBody ||
            problem.constraints.allowedBodies !== undefined ||
            problem.constraints.requiredGauge ||
            problem.constraints.forbiddenBugs?.length ||
            (problem.constraints.bugRules && Object.keys(problem.constraints.bugRules).length > 0)
        ) ? {
            bc: {
                ...(problem.constraints.requiredAbilities?.length ? { a: problem.constraints.requiredAbilities } : {}),
                ...(problem.constraints.requiredMaxBusterStats?.length ? { bs: problem.constraints.requiredMaxBusterStats } : {}),
                ...(problem.constraints.minBusterStats && Object.keys(problem.constraints.minBusterStats).length > 0 ? { bm: problem.constraints.minBusterStats } : {}),
                ...(problem.constraints.minChipRecovery ? { cr: problem.constraints.minChipRecovery } : {}),
                ...(problem.constraints.minCustom !== undefined ? { cm: problem.constraints.minCustom } : {}),
                ...(problem.constraints.requiredSpecialMove ? { cs: problem.constraints.requiredSpecialMove } : {}),
                ...(problem.constraints.requiredBLeft ? { bl: problem.constraints.requiredBLeft } : {}),
                ...(problem.constraints.requiredBButton ? { bb: problem.constraints.requiredBButton } : {}),
                ...(problem.constraints.requiredChargeAddition ? { ca: problem.constraints.requiredChargeAddition } : {}),
                ...(problem.constraints.requiredBusterAddition ? { ba: problem.constraints.requiredBusterAddition } : {}),
                ...(problem.constraints.requiredBody ? { bd: problem.constraints.requiredBody } : {}),
                ...(problem.constraints.allowedBodies !== undefined ? { ab: problem.constraints.allowedBodies } : {}),
                ...(problem.constraints.requiredGauge ? { g: problem.constraints.requiredGauge } : {}),
                ...(problem.constraints.forbiddenBugs?.length ? { fb: problem.constraints.forbiddenBugs } : {}),
                ...(problem.constraints.bugRules && Object.keys(problem.constraints.bugRules).length > 0 ? { br: problem.constraints.bugRules } : {}),
            },
        } : {}),
    };
    return JSON.stringify(SavedProblem.parse(saved));
}

export function problemFromHash(hash: string, data: Data): Problem {
    return fromHashString(decodeURIComponent(hash.replace(/^#/, "")), data) ?? emptyProblem(data);
}

export function makeGridSettings(data: Data, problem: Problem) {
    return data.gridOptions[problem.expansionMemories].settings;
}
