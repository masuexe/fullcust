import type { Data } from "./game-data";
import type { Problem } from "./problem";
import type { Placement, Solution } from "./solver";

export interface BuildRequirement {
    id: number;
    color: string;
    compress: boolean;
    onCommandLine?: boolean | null;
    maxBugLevel?: number;
    minBugLevel?: number;
}

export interface BuildPlacement {
    reqIndex: number;
    x: number;
    y: number;
    rotation: number;
    compressed: boolean;
}

export interface FullCustBuild {
    version: 1;
    id: string; // unique UUID or slug
    name: string;
    gameId: "bn3" | "bn4" | "bn5" | "bn6";
    createdAt: string;
    updatedAt: string;
    description?: string;
    baseHp?: number;
    expansionMemories?: number;
    requirements: BuildRequirement[];
    spinnableColors?: string[];
    modCards?: string[];
    style?: string;
    modTools?: boolean;
    solution?: {
        placements: BuildPlacement[];
    };
}

export function generateBuildId(): string {
    return "build_" + Date.now().toString(36) + "_" + Math.random().toString(36).substring(2, 7);
}

/**
 * Converts the current Problem (and optional Solution) to a standalone FullCustBuild object.
 */
export function problemToBuildData(
    problem: Problem,
    data: Data,
    name: string = "My Build",
    solution?: Solution,
    existingId?: string,
    description?: string
): FullCustBuild {
    const now = new Date().toISOString();
    const requirements: BuildRequirement[] = problem.requirements.map(req => {
        const meta = data.partMetas[req.partIndex];
        const part = data.parts[req.partIndex];
        return {
            id: meta.id,
            color: data.colors[part.color] || "",
            compress: req.constraint.compressed === true,
            onCommandLine: req.constraint.onCommandLine,
            maxBugLevel: req.constraint.maxBugLevel === Infinity ? undefined : req.constraint.maxBugLevel,
            minBugLevel: req.constraint.minBugLevel > 0 ? req.constraint.minBugLevel : undefined,
        };
    });

    const spinnableColors = data.colors.filter((color, i) => problem.spinnableColors[i] && color !== "");

    let buildSolution: { placements: BuildPlacement[] } | undefined = undefined;
    if (solution && solution.length === problem.requirements.length) {
        buildSolution = {
            placements: solution.map((p, idx) => ({
                reqIndex: idx,
                x: p.loc.position.x,
                y: p.loc.position.y,
                rotation: p.loc.rotation,
                compressed: p.compressed,
            })),
        };
    }

    return {
        version: 1,
        id: existingId || generateBuildId(),
        name: name.trim() || "Untitled Build",
        gameId: data.gameId as "bn3" | "bn4" | "bn5" | "bn6",
        createdAt: now,
        updatedAt: now,
        description,
        baseHp: problem.baseHp ?? 1000,
        expansionMemories: problem.expansionMemories,
        requirements,
        spinnableColors,
        modCards: problem.modCards ? [...problem.modCards] : [],
        style: problem.style,
        modTools: problem.modTools,
        solution: buildSolution,
    };
}

/**
 * Converts a FullCustBuild object back into a Problem (and optional Solution).
 */
export function buildDataToProblem(
    build: FullCustBuild,
    data: Data
): { problem: Problem; solution?: Solution } {
    if (build.gameId !== data.gameId) {
        throw new Error(`Build belongs to ${build.gameId.toUpperCase()}, but active game is ${data.gameId.toUpperCase()}`);
    }

    const requirements = build.requirements.map(req => {
        const colorIdx = data.colors.indexOf(req.color);
        const partIndex = data.partMetas.findIndex(p => p.id === req.id && (colorIdx === -1 || p.color === colorIdx));
        if (partIndex === -1) {
            throw new Error(`Unknown part ID ${req.id} (${req.color}) in ${data.gameId.toUpperCase()}`);
        }
        return {
            partIndex,
            constraint: {
                onCommandLine: req.onCommandLine === undefined ? null : req.onCommandLine,
                maxBugLevel: req.maxBugLevel === undefined ? Infinity : req.maxBugLevel,
                minBugLevel: req.minBugLevel ?? 0,
                compressed: req.compress ? true : (req.compress === false ? false : null),
            },
        };
    });

    const spinnableColors = data.colors.map(c => {
        if (!build.spinnableColors) return true;
        return build.spinnableColors.includes(c);
    });

    const problem: Problem = {
        requirements,
        spinnableColors,
        expansionMemories: build.expansionMemories ?? data.defaultExpansion,
        baseHp: build.baseHp ?? 1000,
        modCards: build.modCards ? [...build.modCards] : [],
        style: build.style,
        modTools: build.modTools,
    };

    let solution: Solution | undefined = undefined;
    if (build.solution && build.solution.placements.length === requirements.length) {
        solution = build.solution.placements.map(p => ({
            loc: {
                position: { x: p.x, y: p.y },
                rotation: p.rotation,
            },
            compressed: p.compressed,
        }));
    }

    return { problem, solution };
}

/**
 * Downloads a build as a JSON file.
 */
export function downloadBuildAsJson(build: FullCustBuild): void {
    const filename = `${build.gameId}_${build.name.replace(/[^a-zA-Z0-9_\u4e00-\u9fa5-]/g, "_")}.fullcust.json`;
    const jsonStr = JSON.stringify(build, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * Copies the build JSON to the user's clipboard.
 */
export async function copyBuildToClipboard(build: FullCustBuild): Promise<void> {
    const jsonStr = JSON.stringify(build, null, 2);
    await navigator.clipboard.writeText(jsonStr);
}

/**
 * Parses and validates an arbitrary string into a FullCustBuild.
 */
export function parseBuildJson(jsonStr: string): FullCustBuild {
    let obj: unknown;
    try {
        obj = JSON.parse(jsonStr);
    } catch {
        throw new Error("Invalid JSON format");
    }

    if (!obj || typeof obj !== "object") {
        throw new Error("Build data must be an object");
    }

    const o = obj as Record<string, unknown>;
    if (o.version !== 1) {
        throw new Error("Unsupported build version (expected version 1)");
    }
    if (!["bn3", "bn4", "bn5", "bn6"].includes(o.gameId as string)) {
        throw new Error("Invalid or missing gameId in build data");
    }
    if (!Array.isArray(o.requirements)) {
        throw new Error("Invalid or missing requirements list");
    }

    return obj as FullCustBuild;
}

// LocalStorage Persistence Keys
const LOCAL_STORAGE_KEY = "fullcust_saved_builds_v1";

export function getSavedBuilds(): FullCustBuild[] {
    try {
        const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
            return parsed;
        }
        return [];
    } catch {
        return [];
    }
}

export function saveBuildToStorage(build: FullCustBuild): void {
    const builds = getSavedBuilds();
    const existingIndex = builds.findIndex(b => b.id === build.id);
    if (existingIndex >= 0) {
        builds[existingIndex] = { ...build, updatedAt: new Date().toISOString() };
    } else {
        builds.unshift({ ...build, updatedAt: new Date().toISOString() });
    }
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(builds));
}

export function deleteBuildFromStorage(id: string): void {
    const builds = getSavedBuilds().filter(b => b.id !== id);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(builds));
}

// ==========================================
// Community Presets (经典的社区精选构筑)
// ==========================================
export const COMMUNITY_PRESETS: FullCustBuild[] = [
    // ---------------- BN6 PRESET 1 ----------------
    {
        version: 1,
        id: "preset_bn6_gregar_standard",
        name: "Gregar Standard Meta (1000 HP)",
        description: "BN6 经典的格雷加泛用构筑：超级装甲、飞行鞋、改装、UnderShirt、以及 HP+500 搭配",
        gameId: "bn6",
        createdAt: "2026-10-24T00:00:00Z",
        updatedAt: "2026-10-24T00:00:00Z",
        baseHp: 1000,
        expansionMemories: 5,
        requirements: [
            { id: 1, color: "red", compress: true },    // SuprArmr
            { id: 2, color: "blue", compress: true },   // Custom1
            { id: 4, color: "green", compress: true },  // MegFldr1
            { id: 7, color: "blue", compress: true },   // FstBarr
            { id: 11, color: "pink", compress: true },  // FlotShoe
            { id: 12, color: "white", compress: true }, // AirShoes
            { id: 13, color: "white", compress: true }, // UnderSht
            { id: 46, color: "white", compress: true }, // HP+500 (white)
            { id: 44, color: "white", compress: true }, // HP+300 (white)
            { id: 32, color: "yellow", compress: true },// Rush
            { id: 33, color: "blue", compress: true },  // Beat
        ],
        spinnableColors: ["white", "yellow", "pink", "red", "blue", "green"],
        modCards: [
            "137-A010", // Metrid
            "137-A025", // DethPnx
        ],
    },
    // ---------------- BN6 PRESET 2 ----------------
    {
        version: 1,
        id: "preset_bn6_falzar_bugstop",
        name: "Falzar BugStop & Pack (法萨尔BugStop包)",
        description: "携带 BugStop、BodyPack、BustPack 的高机动无脑输出构筑",
        gameId: "bn6",
        createdAt: "2026-10-24T00:00:00Z",
        updatedAt: "2026-10-24T00:00:00Z",
        baseHp: 1000,
        expansionMemories: 5,
        requirements: [
            { id: 27, color: "red", compress: true },    // BustPack
            { id: 28, color: "pink", compress: true },   // BodyPack
            { id: 31, color: "yellow", compress: true }, // BugStop
            { id: 2, color: "blue", compress: true },    // Custom1
            { id: 4, color: "green", compress: true },   // MegFldr1
            { id: 7, color: "blue", compress: true },    // FstBarr
            { id: 32, color: "yellow", compress: true }, // Rush
            { id: 33, color: "blue", compress: true },   // Beat
        ],
        spinnableColors: ["white", "yellow", "pink", "red", "blue", "green"],
        modCards: [
            "137-A001", // Canodumb
            "137-A002", // Ammonicl
        ],
    },
    // ---------------- BN5 PRESET 1 ----------------
    {
        version: 1,
        id: "preset_bn5_protoman_standard",
        name: "ProtoMan Team Standard (布鲁斯队泛用标配)",
        description: "EXE5 经典超级装甲与定制槽扩展组合",
        gameId: "bn5",
        createdAt: "2026-10-24T00:00:00Z",
        updatedAt: "2026-10-24T00:00:00Z",
        baseHp: 1000,
        expansionMemories: 2,
        requirements: [
            { id: 1, color: "red", compress: true },    // SprArmr
            { id: 2, color: "blue", compress: true },   // Custom1
            { id: 3, color: "blue", compress: true },   // Custom2
            { id: 4, color: "green", compress: true },  // MegFldr1
            { id: 11, color: "blue", compress: true },  // FlotShoe
            { id: 12, color: "yellow", compress: true },// AirShoes
            { id: 13, color: "white", compress: true }, // UnderSht
            { id: 47, color: "white", compress: true }, // HP+500
        ],
        spinnableColors: ["white", "pink", "yellow", "red", "blue", "green"],
        modCards: [
            "136-A001", // Mettaur
            "136-A003", // Tuby
        ],
    },
    // ---------------- BN4 PRESET 1 ----------------
    {
        version: 1,
        id: "preset_bn4_redsun_custom",
        name: "Red Sun Speed & HP (红日速度生命流)",
        description: "EXE4 包含超级装甲、Custom、HP 与 Mod卡组合",
        gameId: "bn4",
        createdAt: "2026-10-24T00:00:00Z",
        updatedAt: "2026-10-24T00:00:00Z",
        baseHp: 1000,
        expansionMemories: 2,
        requirements: [
            { id: 1, color: "red", compress: true },    // SprArmr
            { id: 2, color: "blue", compress: true },   // Custom1
            { id: 3, color: "yellow", compress: true }, // Custom2
            { id: 4, color: "pink", compress: true },   // MegFldr1
            { id: 11, color: "green", compress: true }, // FlotShoe (green in BN4)
            { id: 13, color: "white", compress: true }, // UnderSht (id 13 in BN4)
            { id: 46, color: "white", compress: true }, // HP+500
        ],
        spinnableColors: ["white", "pink", "yellow", "red", "blue"],
        modCards: [
            "134-001", // HP Boost +100 (slot 0A)
            "134-003", // HP Boost +150 (slot 0B)
            "134-002", // HP Boost +100 (slot 0C)
        ],
    },
    // ---------------- BN3 PRESET 1 ----------------
    {
        version: 1,
        id: "preset_bn3_custom_style",
        name: "Custom Style High-Folder (改装形态高轮转)",
        description: "EXE3 Custom Style 强力配装：Custom1+2, FstGauge, SetHoly",
        gameId: "bn3",
        createdAt: "2026-10-24T00:00:00Z",
        updatedAt: "2026-10-24T00:00:00Z",
        baseHp: 1000,
        expansionMemories: 2,
        style: "custom",
        modTools: false,
        requirements: [
            { id: 10, color: "blue", compress: true },   // Custom1
            { id: 11, color: "blue", compress: true },   // Custom2
            { id: 12, color: "green", compress: true },  // MegFldr1
            { id: 30, color: "white", compress: true },  // UnderSht
            { id: 31, color: "pink", compress: true },   // FstGauge (pink in BN3)
            { id: 9, color: "green", compress: true },   // SetHoly
            { id: 39, color: "yellow", compress: true }, // HP+500 (yellow in BN3)
        ],
        spinnableColors: ["white", "pink", "yellow", "blue"],
    },
];
