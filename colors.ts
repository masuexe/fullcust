import type { Lang } from "./i18n";

export const COLORS = {
    red: {
        name: "red",
        nameJa: "レッド",
        nameZh: "红色",
        solid: "#de1000",
        plus: "#bd0000",
    },
    pink: {
        name: "pink",
        nameJa: "ピンク",
        nameZh: "粉色",
        solid: "#de8cc6",
        plus: "#bd6ba5",
    },
    yellow: {
        name: "yellow",
        nameJa: "イエロー",
        nameZh: "黄色",
        solid: "#dede00",
        plus: "#bdbd00",
    },
    green: {
        name: "green",
        nameJa: "グリーン",
        nameZh: "绿色",
        solid: "#18c600",
        plus: "#00a500",
    },
    blue: {
        name: "blue",
        nameJa: "ブルー",
        nameZh: "蓝色",
        solid: "#2984de",
        plus: "#0860b8",
    },
    white: {
        name: "white",
        nameJa: "ホワイト",
        nameZh: "白色",
        solid: "#dedede",
        plus: "#bdbdbd",
    },
    orange: {
        name: "orange",
        nameJa: "オレンジ",
        nameZh: "橙色",
        solid: "#de7b00",
        plus: "#bd5a00",
    },
    purple: {
        name: "purple",
        nameJa: "パープル",
        nameZh: "紫色",
        solid: "#9400ce",
        plus: "#7300ad",
    },
    gray: {
        name: "gray",
        nameJa: "グレー",
        nameZh: "灰色",
        solid: "#848484",
        plus: "#636363",
    },
};

export function getColorName(color: string, lang: Lang): string {
    const c = COLORS[color as keyof typeof COLORS];
    if (!c) return color;
    if (lang === "ja") return c.nameJa;
    if (lang === "zh") return c.nameZh;
    return c.name;
}
