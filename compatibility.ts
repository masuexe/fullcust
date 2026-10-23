import { z } from "zod";

import type { Data } from "./game-data";
import type { Problem } from "./problem";

export const StyleColorRules = z.object({
    baseColors: z.array(z.string()).min(1),
    styles: z.array(z.object({
        id: z.string().min(1),
        label: z.string().min(1),
        extraColor: z.string().nullable(),
    })).min(1),
    defaultStyle: z.string(),
    maxModToolsParts: z.number().int().nonnegative(),
});

export type StyleColorRules = z.infer<typeof StyleColorRules>;

export function compatibleColors(data: Data, problem: Problem): string[] {
    const rules = data.styleColorRules;
    if (!rules) return data.colors.slice(1);
    const style = rules.styles.find(style => style.id === (problem.style ?? rules.defaultStyle));
    return [...rules.baseColors, ...(style?.extraColor ? [style.extraColor] : [])];
}

export function isPartCompatible(data: Data, problem: Problem, partIndex: number): boolean {
    if (!data.styleColorRules) return true;
    const part = data.parts[partIndex];
    if (!part) return false;
    const allowed = compatibleColors(data, problem);
    return allowed.includes(data.colors[part.color]);
}

export function colorCompatibility(data: Data, problem: Problem) {
    const rules = data.styleColorRules;
    const allowed = compatibleColors(data, problem);
    const offColorParts = rules ? problem.requirements.filter(req =>
        !allowed.includes(data.colors[data.parts[req.partIndex].color])
    ) : [];
    const budget = rules && problem.modTools ? rules.maxModToolsParts : 0;
    return {
        allowedColors: allowed,
        offColorParts,
        // Color compatibility depends only on the chosen parts and settings,
        // so reject impossible selections before starting the placement worker.
        error: offColorParts.length > budget
            ? problem.modTools
                ? "ModTools can fix only one incompatible part. Change Style or remove incompatible parts.・改造ツールで修正できる非対応パーツは1個までです。・改造工具最多只能修正1个非对应程序。请更换型态或移除不可用程序。"
                : "These parts are incompatible with the selected Style. Change Style or enable ModTools.・このスタイルでは使えない色があります。スタイルを変えるか改造ツールを有効にしてください。・所选程序包含当前型态无法使用的颜色。请更换型态或启用改造工具。"
            : null,
    };
}
