import { z } from "zod";

import type { Data } from "./game-data";
import type { Requirement } from "./solver";

export interface Problem {
    requirements: Requirement[];
    spinnableColors: boolean[];
    expansionMemories: number;
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
});

export function emptyProblem(data: Data): Problem {
    return {
        requirements: [],
        spinnableColors: data.colors.map(() => true),
        expansionMemories: data.defaultExpansion,
    };
}

// Internally the solver continues to use array indices. Only URLs use stable IDs.
export function fromHashString(s: string, data: Data): Problem | null {
    if (!s) return null;
    const json: unknown = JSON.parse(s);
    const versioned = typeof json === "object" && json !== null && "v" in json;
    const saved = versioned ? SavedProblem.parse(json) : LegacyProblem.parse(json);
    if ("g" in saved && saved.g !== data.gameId) {
        throw new Error("The shared layout belongs to another game.");
    }
    if (!data.gridOptions[saved.x]) throw new Error("Unknown grid preset.");
    const colors = "v" in saved ? saved.s : Object.fromEntries(
        data.legacyCatalog.colors.map((color, i) => [color, saved.s[i]])
    );
    if (!("v" in saved) && saved.s.length !== data.legacyCatalog.colors.length) {
        throw new Error("Invalid legacy spinner settings.");
    }
    if (data.colors.some(color => colors[color] === undefined)) {
        throw new Error("Missing spinner settings.");
    }
    const requirements = saved.r.map(req => {
        const id = "p" in req ? req.p : data.legacyCatalog.partIds[req.i];
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
    return {
        requirements,
        spinnableColors: data.colors.map(color => !!colors[color]),
        expansionMemories: saved.x,
    };
}

export function toHashString(problem: Problem, data: Data): string {
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
    };
    return JSON.stringify(SavedProblem.parse(saved));
}

export function problemFromHash(hash: string, data: Data): Problem {
    return fromHashString(decodeURIComponent(hash.replace(/^#/, "")), data) ?? emptyProblem(data);
}

export function makeGridSettings(data: Data, problem: Problem) {
    return data.gridOptions[problem.expansionMemories].settings;
}
