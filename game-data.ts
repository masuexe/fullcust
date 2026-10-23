import { z } from "zod";

import * as array2d from "./array2d";
import { COLORS } from "./colors";
import { StyleColorRules } from "./compatibility";
import type { GridSettings, Part } from "./solver";

const positiveInt = z.number().int().positive();
const mask = z.array(z.union([z.literal(0), z.literal(1)]));
const RawData = z.object({
    colors: z.array(z.string()).min(2),
    gridSettings: z.object({
        height: positiveInt,
        width: positiveInt,
        hasOob: z.boolean(),
        commandLineRow: z.number().int().nonnegative(),
    }),
    parts: z.array(z.object({
        id: positiveInt,
        name: z.string().min(1),
        nameJa: z.string(),
        isSolid: z.boolean(),
        color: positiveInt,
        compressedMask: mask,
        uncompressedMask: mask,
    })),
}).superRefine((data, ctx) => {
    const issue = (message: string, path: (string | number)[]) =>
        ctx.addIssue({ code: z.ZodIssueCode.custom, message, path });
    if (data.colors[0] !== "" || new Set(data.colors).size !== data.colors.length) {
        issue("Colors must start with an empty sentinel and contain no duplicates", ["colors"]);
    }
    data.colors.slice(1).forEach((color, i) => {
        if (!Object.prototype.hasOwnProperty.call(COLORS, color)) {
            issue(`Unknown color: ${color}`, ["colors", i + 1]);
        }
    });
    const { height, width, hasOob, commandLineRow } = data.gridSettings;
    if (commandLineRow >= height || (hasOob && (height < 3 || width < 3))) {
        issue("Invalid grid dimensions or command line", ["gridSettings"]);
    }
    const ids = new Set<string>();
    data.parts.forEach((part, i) => {
        if (part.color >= data.colors.length) {
            issue("Part references a missing color", ["parts", i, "color"]);
        }
        // Original IDs identify a program; colors identify its variants.
        const id = `${part.id}:${part.color}`;
        if (ids.has(id)) issue("Duplicate part ID and color", ["parts", i, "id"]);
        ids.add(id);
        for (const key of ["compressedMask", "uncompressedMask"] as const) {
            if (part[key].length !== height * width || !part[key].includes(1)) {
                issue("Shape must match grid dimensions and contain an occupied cell", ["parts", i, key]);
            }
        }
    });
});

export interface DatasetOptions {
    id: string;
    gridSizes: { height: number; width: number; label: string }[];
    defaultExpansion: number;
    // Frozen v1 URL order; never derive this from the current part order.
    legacyCatalog?: { partIds: string[]; colors: string[] };
    styleColorRules?: StyleColorRules;
}

export interface Data {
    gameId: string;
    colors: string[];
    gridSettings: GridSettings;
    gridOptions: { label: string; settings: GridSettings }[];
    defaultExpansion: number;
    legacyCatalog: DatasetOptions["legacyCatalog"];
    styleColorRules?: StyleColorRules;
    partIds: string[];
    parts: Part[];
    partMetas: z.infer<typeof RawData>["parts"];
}

export function parseGameData(raw: unknown, options: DatasetOptions): Data {
    const data = RawData.parse(raw);
    const styleColorRules = options.styleColorRules
        ? StyleColorRules.parse(options.styleColorRules) : undefined;
    if (styleColorRules) {
        const { baseColors, styles, defaultStyle } = styleColorRules;
        const referencedColors = [...baseColors, ...styles.flatMap(style => style.extraColor ? [style.extraColor] : [])];
        if (referencedColors.some(color => !color || !data.colors.includes(color)) ||
            new Set(styles.map(style => style.id)).size !== styles.length ||
            !styles.some(style => style.id === defaultStyle)) {
            throw new Error(`Invalid Style color rules for ${options.id}`);
        }
    }
    const { height, width } = data.gridSettings;
    const gridOptions = options.gridSizes.map(({ height, width, label }) => {
        const settings = { ...data.gridSettings, height, width };
        if (!Number.isInteger(height) || !Number.isInteger(width) ||
            height < (settings.hasOob ? 3 : 1) || width < (settings.hasOob ? 3 : 1) ||
            settings.commandLineRow >= height ||
            height > data.gridSettings.height || width > data.gridSettings.width) {
            throw new Error(`Invalid grid preset for ${options.id}: ${label}`);
        }
        return { label, settings };
    });
    if (!Number.isInteger(options.defaultExpansion) || !gridOptions[options.defaultExpansion]) {
        throw new Error(`Invalid default grid preset for ${options.id}`);
    }
    return {
        gameId: options.id,
        colors: data.colors,
        gridSettings: data.gridSettings,
        gridOptions,
        defaultExpansion: options.defaultExpansion,
        legacyCatalog: options.legacyCatalog,
        styleColorRules,
        partIds: data.parts.map(part => `${options.id}:${part.id}:${data.colors[part.color]}`),
        partMetas: data.parts,
        parts: data.parts.map(part => ({
            isSolid: part.isSolid,
            color: part.color,
            compressedMask: array2d.from(part.compressedMask.map(Boolean), height, width),
            uncompressedMask: array2d.from(part.uncompressedMask.map(Boolean), height, width),
        })),
    };
}
