export type Lang = "en" | "ja";

export const translations = {
    titleSub: {
        en: "navicust autolayout",
        ja: "ナビカスタマイザー自動配置",
    },
    style: {
        en: "Style",
        ja: "スタイル",
    },
    modTools: {
        en: "ModTools: allow one incompatible part",
        ja: "改造ツール：非対応パーツ1個まで",
    },
    compatibleColors: {
        en: "Compatible colors",
        ja: "対応色",
    },
    incompatibleParts: {
        en: "Incompatible parts",
        ja: "使用不可パーツ",
    },
    requiresErrorCode: {
        en: "Requires an Error Code",
        ja: "エラーコードが必要",
    },
    bn3CompressionWarning: {
        en: "BN3 compression is permanent in-game; choose the state you own.",
        ja: "ゲーム内の圧縮は元に戻せません。",
    },
    pickPart: {
        en: "Pick a part",
        ja: "パートを選択",
    },
    incompatibleWithStyle: {
        en: "Incompatible with Style",
        ja: "このスタイルでは使用不可",
    },
    incompatibleDropdownSuffix: {
        en: " ⚠️ (Incompatible with Style)",
        ja: " ⚠️ (このスタイルでは使用不可)",
    },
    incompatibleBadgeTitle: {
        en: "Incompatible with the selected Style",
        ja: "このスタイルでは使えない色です",
    },
    requiresErrorCodeBadgeTitle: {
        en: "Requires ModTools Error Code",
        ja: "改造ツールのエラーコードが必要です",
    },
    requiresErrorCodeBadge: {
        en: "Requires Error Code",
        ja: "要エラーコード",
    },
    onCommandLine: {
        en: "on command line",
        ja: "コマンドライン上",
    },
    minBugs: {
        en: "min bugs",
        ja: "最小バグ数",
    },
    maxBugs: {
        en: "max bugs",
        ja: "最大バグ数",
    },
    compress: {
        en: "compress",
        ja: "圧縮",
    },
    extraSettings: {
        en: "Extra settings",
        ja: "追加設定",
    },
    expansionMemory: {
        en: "Expansion memory",
        ja: "拡張メモリ",
    },
    spin: {
        en: "spin",
        ja: "スピン",
    },
    reset: {
        en: "Reset",
        ja: "リセット",
    },
    noSolutions: {
        en: "No solutions found",
        ja: "解決が発見されなかった",
    },
    selectPartsToSolve: {
        en: "Select parts from the left to start solving",
        ja: "解決を開始するために、左面からパートを選択ください",
    },
    loadGameError: {
        en: "Unable to load game data. Please reload the page.",
        ja: "データを読み込めません。再読み込みしてください。",
    },
    sharedLayoutError: {
        en: "This shared layout is invalid or unavailable for this game.",
        ja: "共有データが無効、またはこのゲームに対応していません。",
    },
    startNewLayout: {
        en: "Start a new layout",
        ja: "新規作成",
    },
    unknownGame: {
        en: "Unknown game",
        ja: "不明なゲーム",
    },
    constraintMaybe: {
        en: "🤷 maybe",
        ja: "🤷 任意",
    },
    constraintMustNot: {
        en: "❌ must not",
        ja: "❌ 不要",
    },
    constraintMust: {
        en: "✅ must",
        ja: "✅ 必要",
    },
    tabSetup: {
        en: "Setup",
        ja: "設定",
    },
    tabSolutions: {
        en: "Solutions",
        ja: "配置結果",
    },
    viewSolutions: {
        en: "View Solutions",
        ja: "配置結果を見る",
    },
    backToSetup: {
        en: "Back to Setup",
        ja: "設定に戻る",
    },
} as const;

export function t(key: keyof typeof translations, lang: Lang): string {
    return translations[key][lang];
}

export function getInitialLang(): Lang {
    try {
        if (typeof window !== "undefined" && window.localStorage) {
            const saved = window.localStorage.getItem("fullcust_lang");
            if (saved === "en" || saved === "ja") return saved;
        }
        if (typeof navigator !== "undefined" && navigator.language?.toLowerCase().startsWith("ja")) {
            return "ja";
        }
    } catch {
        // Ignore potential security/storage errors
    }
    return "en";
}

export function setPersistedLang(lang: Lang): void {
    try {
        if (typeof window !== "undefined" && window.localStorage) {
            window.localStorage.setItem("fullcust_lang", lang);
        }
    } catch {
        // Ignore potential storage errors
    }
}

export function tBilingual(text: string, lang: Lang): string {
    if (!text || !text.includes("・")) return text;
    const parts = text.split("・");
    return (lang === "ja" ? parts[1] : parts[0]) || text;
}

export function getPartName(part: { name: string; nameJa?: string }, lang: Lang): string {
    if (lang === "ja" && part.nameJa) {
        return part.nameJa;
    }
    return part.name;
}
