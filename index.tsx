import { expandPanelBugRules, PANEL_BUG_TYPES, getBugRule, getDefaultBugRules } from "./panel-effects";
import isEqual from "lodash-es/isEqual";
import React, { ChangeEvent } from "react";
import { createRoot } from "react-dom/client";
import { useInView } from "react-intersection-observer";

import * as array2d from "./array2d";
import AsyncSolver from "./async-solver";
import { GridSettings, Part, placeAll, Requirement, Solution } from "./solver";
import { COLORS, getColorName } from "./colors";
import { colorCompatibility, isPartCompatible } from "./compatibility";
import { Data } from "./game-data";
import { defaultGameId, findGame, games, loadGame } from "./games";
import {
    getInitialLang,
    getPartName,
    Lang,
    setPersistedLang,
    t,
    tBilingual,
} from "./i18n";
import {
    emptyProblem,
    makeGridSettings,
    Problem,
    problemFromHash,
    toHashString,
    BugPolicy,
    BugPolicyType,
    BugTolerance,
    BuildConstraints,
    BusterStat,
    ChipRecoveryMinimum,
    BUSTER_STATS,
    getBusterMinimums,
    BODY_ELEMENTS,
    BodyElement,
    GaugeOption,
} from "./problem";
import { getOptimizerAbilityOptions, getOptimizerBugOptions, getOptimizerModeConstraints } from "./optimizer-options";
import type { OptimizationTarget, ModCardMode, OptimizeResult } from "./optimizer";
import AsyncOptimizer from "./async-optimizer";
import type { SearchActivity } from "./search-activity";
import {
    BUG_SPEC_OPTIONS,
    computeBuildStats,
    computePlacedBuildStats,
    getBusterStatLimits,
    tAbility,
    analyzeSolutionBugs,
    SolutionBugAnalysis,
    tBugCause,
    tBugTitle,
    tBugMechanics,
    CORE_ABILITY_OPTIONS,
    SPECIAL_CS_OPTIONS,
    BLEFT_OPTIONS,
    BBUTTON_OPTIONS,
    CHARGE_ADDITION_OPTIONS,
    BUSTER_ADDITION_OPTIONS,
    BODY_OPTIONS,
    GAUGE_OPTIONS,
    getSpecialCsOptions,
    getBLeftOptions,
    getBButtonOptions,
    FORBIDDEN_BUG_OPTIONS,
} from "./effects";
import {
    BN6_MOD_CARDS,
    computeDeckStats,
    getCardDisplayName,
    getModCard,
    ModCard,
    searchModCards,
} from "./modcards";
import { BuildLibraryModal } from "./build-library-modal";
import { SaveExportModal } from "./save-export-modal";
import { getSavedBuilds, buildDataToProblem } from "./build-data";

const LangContext = React.createContext<{
    lang: Lang;
    setLang: (lang: Lang) => void;
}>({
    lang: "en",
    setLang: () => {},
});

function useLang() {
    return React.useContext(LangContext);
}

type Theme = "light" | "dark";

function getInitialTheme(): Theme {
    try {
        if (typeof window !== "undefined" && window.localStorage) {
            const saved = window.localStorage.getItem("fullcust_theme");
            if (saved === "light" || saved === "dark") return saved;
        }
        if (
            typeof window !== "undefined" &&
            window.matchMedia &&
            window.matchMedia("(prefers-color-scheme: dark)").matches
        ) {
            return "dark";
        }
    } catch {
        // Ignore storage errors
    }
    return "light";
}

function applyTheme(theme: Theme): void {
    try {
        if (typeof document !== "undefined") {
            document.documentElement.setAttribute("data-bs-theme", theme);
        }
        if (typeof window !== "undefined" && window.localStorage) {
            window.localStorage.setItem("fullcust_theme", theme);
        }
    } catch {
        // Ignore storage errors
    }
}

const queryParams = new URLSearchParams(location.search);
const game = queryParams.get("game") || defaultGameId;
const gameDefinition = findGame(game);

function ConstraintDropdown({
    title,
    value,
    onChange,
    disabled = false,
}: {
    title: string;
    value: boolean | null;
    onChange: (value: boolean | null) => void;
    disabled?: boolean;
}) {
    const { lang } = useLang();
    return (
        <div className="form-floating">
            <select
                disabled={disabled}
                value={JSON.stringify(value)}
                className="form-select"
                onChange={(e) => {
                    onChange(JSON.parse(e.target.value));
                }}
            >
                {[
                    [null, t("constraintMaybe", lang)],
                    [false, t("constraintMustNot", lang)],
                    [true, t("constraintMust", lang)],
                ].map(([v, label]) => {
                    return (
                        <option
                            value={JSON.stringify(v)}
                            key={JSON.stringify(v)}
                        >
                            {label}
                        </option>
                    );
                })}
            </select>
            <label>{title}</label>
        </div>
    );
}

function BuildStatsView({
    data,
    problem,
    solution,
}: {
    data: Data;
    problem: Problem;
    solution?: Solution;
}) {
    const { lang } = useLang();
    const baseHp = problem.baseHp ?? 1000;
    const partIds = problem.requirements.map(req => data.partMetas[req.partIndex].id);
    const grid = makeGridSettings(data, problem);
    const stats = solution ? computePlacedBuildStats(data.gameId, data.partMetas, problem.requirements,
        placeAll(data.parts, problem.requirements, solution, grid), grid, problem.modCards, baseHp) :
        computeBuildStats(data.gameId, partIds, problem.modCards, baseHp);

    const hasAnyStats = problem.requirements.length > 0 ||
        (problem.modCards !== undefined && problem.modCards.length > 0) ||
        stats.hp !== 0 || stats.hpPercent !== 0 ||
        stats.attack > 1 || stats.rapid > 1 || stats.charge > 1 ||
        stats.custom > 5 || stats.megaFolder !== 5 || stats.gigaFolder > 1 ||
        stats.abilities.length > 0;
    if (!hasAnyStats && problem.requirements.length === 0) return null;

    return (
        <div className="card mb-3 p-2 bg-body-tertiary">
            <div className="d-flex justify-content-between align-items-center mb-2">
                <span className="fw-semibold small text-muted text-uppercase">
                    📊 {t(solution ? "buildStats" : "buildStatsPlanned", lang)}
                </span>
                {stats.modMbUsed !== undefined && stats.modMbUsed > 0 ? (
                    <span className={`badge ${stats.modMbUsed > 80 ? "bg-danger" : "bg-dark border border-primary text-light"} py-1 px-2`}>
                        🎴 {t("modCards", lang)}: {stats.modMbUsed} / 80 MB
                    </span>
                ) : null}
            </div>

            <div className="d-flex flex-wrap gap-2 small align-items-center">
                <span
                    className={`badge ${stats.finalHp < stats.baseHp ? "bg-danger" : "bg-success"} py-1 px-2 fw-semibold`}
                    title={lang === "zh"
                        ? `初始 HP: ${stats.baseHp} (可在额外设置中修改) | 修正: ${stats.hp >= 0 ? "+" : ""}${stats.hp}${stats.hpPercent !== 0 ? ` (${stats.hpPercent >= 0 ? "+" : ""}${stats.hpPercent}%)` : ""}`
                        : lang === "ja"
                        ? `初期 HP: ${stats.baseHp}（拡張設定で変更可能） | 補正: ${stats.hp >= 0 ? "+" : ""}${stats.hp}${stats.hpPercent !== 0 ? ` (${stats.hpPercent >= 0 ? "+" : ""}${stats.hpPercent}%)` : ""}`
                        : `Base HP: ${stats.baseHp} (configurable in Extra Settings) | Modifier: ${stats.hp >= 0 ? "+" : ""}${stats.hp}${stats.hpPercent !== 0 ? ` (${stats.hpPercent >= 0 ? "+" : ""}${stats.hpPercent}%)` : ""}`}
                >
                    ❤️ {t("finalHp", lang)}: {stats.finalHp}
                    {stats.finalHp !== stats.baseHp ? (
                        <span className="opacity-75 ms-1 fw-normal" style={{ fontSize: "0.85em" }}>
                            ({stats.finalHp >= stats.baseHp ? "+" : ""}{stats.finalHp - stats.baseHp})
                        </span>
                    ) : null}
                </span>
                <span className={`badge ${stats.attackMax ? "bg-warning text-dark fw-bold" : "bg-primary"} py-1 px-2`}>
                    {t("statAttack", lang)}: {stats.attack}{stats.attackMax ? " (MAX)" : ""}
                </span>
                <span className={`badge ${stats.rapidMax ? "bg-warning text-dark fw-bold" : "bg-primary"} py-1 px-2`}>
                    {t("statRapid", lang)}: {stats.rapid}{stats.rapidMax ? " (MAX)" : ""}
                </span>
                <span className={`badge ${stats.chargeMax ? "bg-warning text-dark fw-bold" : "bg-primary"} py-1 px-2`}>
                    {t("statCharge", lang)}: {stats.charge}{stats.chargeMax ? " (MAX)" : ""}
                </span>
                {stats.custom > 5 ? (
                    <span className="badge bg-info text-dark py-1 px-2">
                        {t("statCustom", lang)}: {stats.custom}
                    </span>
                ) : null}
                {stats.megaFolder > 5 ? (
                    <span className="badge bg-secondary py-1 px-2">
                        {t("statMega", lang)}: +{stats.megaFolder - 5}
                    </span>
                ) : stats.megaFolder < 5 ? (
                    <span className="badge bg-secondary py-1 px-2">
                        {t("statMega", lang)}: {stats.megaFolder - 5}
                    </span>
                ) : null}
                {stats.gigaFolder > 1 ? (
                    <span className="badge bg-secondary py-1 px-2">
                        {t("statGiga", lang)}: +{stats.gigaFolder - 1}
                    </span>
                ) : null}

                {/* Mod Card active traits */}
                {stats.modBody ? (
                    <span className="badge bg-info text-dark py-1 px-2 border border-info">
                        🧬 {stats.modBody}Body
                    </span>
                ) : null}
                {stats.modSoul ? (
                    <span className="badge bg-warning text-dark py-1 px-2 border border-warning fw-bold">
                        🌟 {stats.modSoul}
                    </span>
                ) : null}
                {stats.modGauge ? (
                    <span className={`badge ${stats.modGauge === "fast" ? "bg-success" : stats.modGauge === "slow" ? "bg-danger" : "bg-secondary"} py-1 px-2`}>
                        ⏱️ {stats.modGauge === "fast" ? (lang === "zh" ? "快速量表" : lang === "ja" ? "クイックゲージ" : "FastGauge") : stats.modGauge === "slow" ? (lang === "zh" ? "缓慢量表" : lang === "ja" ? "ヘビーゲージ" : "SlowGauge") : "NormalGauge"}
                    </span>
                ) : null}
                {stats.modTripleBuster ? (
                    <span className="badge bg-warning text-dark py-1 px-2 fw-semibold">
                        💥 {lang === "zh" ? "三重子弹" : lang === "ja" ? "トリプルバスター" : "Triple Buster"}
                    </span>
                ) : null}
                {stats.modChipRecovery ? (
                    <span className="badge bg-success py-1 px-2">
                        💊 {lang === "zh" ? `芯片回复 (+${stats.modChipRecovery} HP)` : lang === "ja" ? `チップリカバリー (+${stats.modChipRecovery} HP)` : `Chip Recovery (+${stats.modChipRecovery} HP)`}
                    </span>
                ) : null}
                {stats.modBButton ? (
                    <span className="badge bg-secondary py-1 px-2">
                        [B] {stats.modBButton}
                    </span>
                ) : null}
                {stats.modBPwrAtk ? (
                    <span className="badge bg-secondary py-1 px-2">
                        [B集气] {stats.modBPwrAtk}
                    </span>
                ) : null}
                {stats.modBLeft ? (
                    <span className="badge bg-secondary py-1 px-2">
                        [B+←] {stats.modBLeft}
                    </span>
                ) : null}
                {stats.modChargeAddition ? (
                    <span className="badge bg-info text-dark py-1 px-2">
                        [CS附加] {stats.modChargeAddition}
                    </span>
                ) : null}
                {stats.invalidatedChargeAddition ? (
                    <span className="badge bg-secondary text-decoration-line-through py-1 px-2" title={lang === "zh" ? "已被特殊集气攻击覆盖失效" : "Overridden by Special CS"}>
                        ❌ [CS附加] {stats.invalidatedChargeAddition}
                    </span>
                ) : null}
                {stats.modBusterAddition ? (
                    <span className="badge bg-info text-dark py-1 px-2">
                        [子弹附加] {stats.modBusterAddition}
                    </span>
                ) : null}
                {stats.invalidatedBusterAddition ? (
                    <span className="badge bg-secondary text-decoration-line-through py-1 px-2" title={lang === "zh" ? "已被特殊普通射击覆盖失效" : "Overridden by Special Buster"}>
                        ❌ [子弹附加] {stats.invalidatedBusterAddition}
                    </span>
                ) : null}
                {stats.modBugCount && stats.modBugCount > 0 ? (
                    <span className="badge bg-secondary py-1 px-2" title={t("modCardBugNotice", lang)}>
                        🎴 {stats.modBugCount} {t("modCardBugCount", lang)}
                    </span>
                ) : null}
            </div>

            {stats.abilities.length > 0 ? (
                <div className="d-flex flex-wrap gap-1 mt-2">
                    {stats.abilities.map(ability => (
                        <span key={ability} className="badge bg-dark border border-secondary text-light py-1 px-2">
                            ✨ {tAbility(ability, lang)}
                        </span>
                    ))}
                </div>
            ) : null}

            {stats.disabledAbilitiesFromCards && stats.disabledAbilitiesFromCards.length > 0 ? (
                <div className="d-flex flex-wrap gap-1 mt-1">
                    {stats.disabledAbilitiesFromCards.map(ability => (
                        <span
                            key={ability}
                            className="badge bg-danger-subtle text-danger border border-danger-subtle text-decoration-line-through py-1 px-2"
                            title={t("abilityStrippedNotice", lang)}
                        >
                            ❌ {tAbility(ability, lang)} ({t("abilityStrippedNotice", lang)})
                        </span>
                    ))}
                </div>
            ) : null}
        </div>
    );
}

function SolutionBugStatus({
    analysis,
    lang,
}: {
    analysis: SolutionBugAnalysis;
    lang: Lang;
}) {
    if (!analysis.hasBugs) {
        return <span className="badge bg-success px-2 py-1">✅ {t("noBugs", lang)}</span>;
    }

    const ncActiveBugs = (analysis.activeBugs || []).filter(b => !b.isModCardBug);
    const modActiveBugs = (analysis.activeBugs || []).filter(b => b.isModCardBug);
    const unlistedColorBug = analysis.tooManyColors && !ncActiveBugs.some(b => b.bugType === "colorStatus");
    const ncBugCount = ncActiveBugs.length + (unlistedColorBug ? 1 : 0);
    const modBugCount = modActiveBugs.length;

    const ncMaxLevel = Math.max(0, ...ncActiveBugs.map(b => b.level), unlistedColorBug ? 4 : 0);
    const ncLevelLabel = ncBugCount === 1 && ncMaxLevel > 1 ? ` (Lv${ncMaxLevel})` : "";

    // When NO mod card bugs are involved, keep clean single badge
    if (modBugCount === 0) {
        if (analysis.bugStopActive && !unlistedColorBug) {
            return <span className="badge bg-info text-dark px-2 py-1">🛡️ {t("bugStopActive", lang)}</span>;
        }
        return (
            <span className="badge bg-secondary px-2 py-1">
                ⚙️ {ncBugCount} {t("bugsDetected", lang)}{ncLevelLabel}
            </span>
        );
    }

    // When mod card bugs exist: clearly distinguish NC placement status vs Mod Card status!
    return (
        <div className="d-flex gap-1 align-items-center flex-wrap">
            {ncBugCount === 0 ? (
                <span className="badge bg-success px-2 py-1" title={t("ncNoBugsNotice", lang)}>
                    ✅ {t("ncNoBugs", lang)}
                </span>
            ) : analysis.bugStopActive && !unlistedColorBug ? (
                <span className="badge bg-info text-dark px-2 py-1" title={t("bugStopNeutralizedNotice", lang)}>
                    🛡️ {t("bugStopActive", lang)} (NC)
                </span>
            ) : (
                <span className="badge bg-warning text-dark px-2 py-1">
                    ⚙️ {ncBugCount} {t("ncBugs", lang)}{ncLevelLabel}
                </span>
            )}
            <span className="badge bg-secondary px-2 py-1" title={t("modCardBugNotice", lang)}>
                🎴 {modBugCount} {t("modCardBugCount", lang)}
            </span>
        </div>
    );
}

function SolutionBugDetails({
    analysis,
    lang,
}: {
    analysis: SolutionBugAnalysis;
    lang: Lang;
}) {
    const [open, setOpen] = React.useState(false);
    if (!analysis.hasBugs) return null;

    const ncActiveBugs = (analysis.activeBugs || []).filter(b => !b.isModCardBug);
    const modActiveBugs = (analysis.activeBugs || []).filter(b => b.isModCardBug);
    const unlistedColorBug = analysis.tooManyColors && !ncActiveBugs.some(b => b.bugType === "colorStatus");
    const ncBugCount = ncActiveBugs.length + (unlistedColorBug ? 1 : 0);
    const modBugCount = modActiveBugs.length;

    const ncMaxLevel = Math.max(0, ...ncActiveBugs.map(b => b.level), unlistedColorBug ? 4 : 0);
    const ncLevelLabel = ncBugCount === 1 && ncMaxLevel > 1 ? ` (Lv${ncMaxLevel})` : "";

    const buttonSummary = (() => {
        if (modBugCount > 0) {
            if (ncBugCount === 0) {
                return `🎴 ${modBugCount} ${t("modCardBugCount", lang)} (${t("ncNoBugs", lang)})`;
            }
            return `⚙️ ${ncBugCount} ${t("ncBugs", lang)} + 🎴 ${modBugCount} ${t("modCardBugCount", lang)}`;
        }
        return `⚙️ ${ncBugCount} ${t("bugsDetected", lang)}${ncLevelLabel}${analysis.bugStopActive ? ` (${t("bugStopActive", lang)})` : ""}`;
    })();

    return (
        <div className="mt-2 text-start">
            <button
                type="button"
                className="btn btn-sm btn-outline-secondary w-100 d-flex justify-content-between align-items-center py-1"
                onClick={() => setOpen(prev => !prev)}
            >
                <span className="small">{buttonSummary}</span>
                <span className="small">{open ? "▲" : "▼"}</span>
            </button>
            {open ? (
                <div className="p-2 border rounded mt-1 bg-body-tertiary small">
                    {/* Section 1: NaviCust Placement */}
                    <div className="mb-2">
                        <div className="fw-bold d-flex align-items-center gap-1 mb-1">
                            <span>🧩</span>
                            <span>{t("ncBugDetailsHeader", lang)}</span>
                        </div>

                        {ncBugCount === 0 ? (
                            <div className="text-success small mb-1">
                                ✅ {t("ncNoBugsNotice", lang)}
                            </div>
                        ) : null}

                        {analysis.bugStopActive ? (
                            <div className="alert alert-info py-1 px-2 mb-1 small">
                                🛡️ {t("bugStopNeutralizedNotice", lang)}
                            </div>
                        ) : null}

                        {unlistedColorBug ? (
                            <div className="mb-2 pb-1 border-bottom">
                                <div className="fw-semibold text-danger">
                                    🎨 {analysis.colorBugTitle || tBugTitle("colorStatus", lang)}
                                </div>
                                <div className="text-muted">
                                    {t("bugOrigin", lang)}: {tBugCause("tooManyColors", lang)} ({analysis.distinctColorCount}/4)
                                </div>
                                <div className="mt-1">
                                    {t("bugMechanics", lang)}: <span className="fw-semibold text-body">{analysis.colorBugMechanics || tBugMechanics("colorStatus", lang)}</span>
                                </div>
                            </div>
                        ) : null}

                        {ncActiveBugs.map((ab, idx) => (
                            <div key={idx} className={idx < ncActiveBugs.length - 1 ? "mb-2 pb-1 border-bottom" : ""}>
                                <div className="fw-semibold">
                                    ⚙️ {ab.title}
                                </div>
                                <div className="text-muted">
                                    {t("bugOrigin", lang)}: {ab.bugType === "colorStatus" ? `${tBugCause("tooManyColors", lang)} (${analysis.distinctColorCount}/4)` : ab.parts.map(p => `${p.partName} (${p.causes.map(c => tBugCause(c, lang)).join(", ")})`).join("、")}
                                </div>
                                <div className="mt-1">
                                    {t("bugMechanics", lang)}: <span className="fw-semibold text-body">{ab.mechanics}</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Section 2: Mod Card Bugs (if any) */}
                    {modBugCount > 0 ? (
                        <div className="pt-2 border-top mb-1">
                            <div className="fw-bold d-flex align-items-center gap-1 mb-1">
                                <span>🎴</span>
                                <span>{t("modCardBugsHeader", lang)}</span>
                            </div>
                            <div className="text-muted mb-2" style={{ fontSize: "0.75rem" }}>
                                {t("modCardBugNotice", lang)}
                            </div>
                            {modActiveBugs.map((mb, idx) => (
                                <div key={idx} className={idx < modActiveBugs.length - 1 ? "mb-2 pb-1 border-bottom" : ""}>
                                    <div className="fw-semibold text-primary">
                                        🎴 {mb.title}
                                    </div>
                                    <div className="text-muted">
                                        {t("bugOrigin", lang)}: <span className="fw-semibold text-body">{t("cardSource", lang)}: {mb.sourceCardName}</span>
                                    </div>
                                    <div className="mt-1">
                                        {t("bugMechanics", lang)}: <span className="fw-semibold text-body">{mb.mechanics}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : null}

                    {/* Section 3: Mod Card Repairs (if any) */}
                    {analysis.repairedBugsNotice && analysis.repairedBugsNotice.length > 0 ? (
                        <div className="pt-2 border-top mt-1">
                            <div className="alert alert-success py-1 px-2 mb-0 small">
                                ✨ {analysis.repairedBugsNotice.map(r => `${t("modCardRepairsHeader", lang)}: ${r}`).join("、")}
                            </div>
                        </div>
                    ) : null}
                </div>
            ) : null}
        </div>
    );
}

function ModCardManager({
    problem,
    onChange,
    lang,
    data,
}: {
    problem: Problem;
    onChange: (problem: Problem) => void;
    lang: Lang;
    data?: Data;
}) {
    const gameId = data?.gameId || "bn6";
    const isBn4 = gameId === "bn4";
    const cardIds = problem.modCards || [];
    const deck = computeDeckStats(cardIds, gameId);
    const [selectedCardToAdd, setSelectedCardToAdd] = React.useState<string>("");
    const [searchQuery, setSearchQuery] = React.useState<string>("");
    const [categoryFilter, setCategoryFilter] = React.useState<string>("all");

    const searchResult = React.useMemo(() => {
        return searchModCards(searchQuery, categoryFilter, lang, gameId);
    }, [searchQuery, categoryFilter, lang, gameId]);

    const activeBuildAbilities = React.useMemo(() => {
        if (!data) return deck.activeAbilities;
        const partIds = problem.requirements
            .map(r => data.partMetas[r.partIndex]?.id)
            .filter((id): id is number => id != null);
        return computeBuildStats(data.gameId, partIds, problem.modCards, problem.baseHp ?? 1000).abilities;
    }, [data, problem.requirements, problem.modCards, problem.baseHp, deck.activeAbilities]);

    const handleAddCard = (cid: string) => {
        if (!cid) return;
        const newCard = getModCard(cid, gameId);
        if (isBn4 && newCard?.slot) {
            const filtered = cardIds.filter(id => {
                const existing = getModCard(id, gameId);
                return !existing || existing.slot !== newCard.slot;
            });
            onChange({
                ...problem,
                modCards: [...filtered, cid],
            });
        } else {
            onChange({
                ...problem,
                modCards: [...cardIds, cid],
            });
        }
        setSelectedCardToAdd("");
    };

    const handleRemoveCard = (index: number) => {
        const next = [...cardIds];
        next.splice(index, 1);
        onChange({
            ...problem,
            modCards: next,
        });
    };

    const handleMoveUp = (index: number) => {
        if (index <= 0) return;
        const next = [...cardIds];
        const temp = next[index - 1];
        next[index - 1] = next[index];
        next[index] = temp;
        onChange({
            ...problem,
            modCards: next,
        });
    };

    const handleMoveDown = (index: number) => {
        if (index >= cardIds.length - 1) return;
        const next = [...cardIds];
        const temp = next[index + 1];
        next[index + 1] = next[index];
        next[index] = temp;
        onChange({
            ...problem,
            modCards: next,
        });
    };

    const handleClearAll = () => {
        onChange({
            ...problem,
            modCards: [],
        });
    };

    const isOver = isBn4 ? (deck.hasSlotConflict || cardIds.length > 5) : deck.totalMb > 80;
    const percentUsed = isBn4 ? Math.min(100, Math.round((cardIds.length / 5) * 100)) : Math.min(100, Math.round((deck.totalMb / 80) * 100));
    const cardPrefix = (c: ModCard) => (isBn4 ? `[${c.slot || "Slot"}]` : `[${c.mb} MB]`);

    return (
        <div className="accordion mb-2" id="modcards-section">
            <div className="accordion-item">
                <h2 className="accordion-header" id="modcards-header">
                    <button
                        className="accordion-button collapsed py-2"
                        type="button"
                        data-bs-toggle="collapse"
                        data-bs-target="#modcards-body"
                        aria-expanded="false"
                        aria-controls="modcards-body"
                    >
                        <span className="me-2">🎴</span>
                        <span className="fw-semibold me-2">{t("modCards", lang)}</span>
                        <span className={`badge ${isOver ? "bg-danger" : cardIds.length > 0 ? "bg-primary" : "bg-secondary"} ms-auto me-2`}>
                            {isBn4 ? `${cardIds.length} / 5 ${t("slots", lang)}` : `${deck.totalMb} / 80 MB (${cardIds.length})`}
                        </span>
                    </button>
                </h2>
                <div
                    id="modcards-body"
                    className="accordion-collapse collapse"
                    aria-labelledby="modcards-header"
                    data-bs-parent="#modcards-section"
                >
                    <div className="accordion-body p-2">
                        {/* Capacity Progress Bar */}
                        <div className="mb-2">
                            {isBn4 ? (
                                <div className="d-flex justify-content-between small text-muted mb-1">
                                    <span>{t("bn4SlotLimit", lang)}</span>
                                    <span className={isOver ? "text-danger fw-bold" : "fw-semibold"}>
                                        {cardIds.length} / 5 {t("slots", lang)}
                                    </span>
                                </div>
                            ) : (
                                <div className="d-flex justify-content-between small text-muted mb-1">
                                    <span>{t("modCapacity", lang)}</span>
                                    <span className={isOver ? "text-danger fw-bold" : "fw-semibold"}>
                                        {deck.totalMb} / 80 MB {isOver ? `(${t("capacityExceeded", lang)})` : `(${80 - deck.totalMb} MB left)`}
                                    </span>
                                </div>
                            )}
                            <div className="progress" style={{ height: "8px" }}>
                                <div
                                    className={`progress-bar ${isOver ? "bg-danger" : percentUsed >= 90 ? "bg-warning" : "bg-success"}`}
                                    role="progressbar"
                                    style={{ width: `${percentUsed}%` }}
                                    aria-valuenow={isBn4 ? cardIds.length : deck.totalMb}
                                    aria-valuemin={0}
                                    aria-valuemax={isBn4 ? 5 : 80}
                                />
                            </div>
                        </div>

                        {/* Order Hint */}
                        <div className="alert alert-secondary py-1 px-2 mb-2 small text-muted" style={{ fontSize: "0.8rem" }}>
                            ℹ️ {t("cardOrderHint", lang)}
                        </div>

                        {/* Equipped Cards List */}
                        {cardIds.length === 0 ? (
                            <div className="text-center text-muted py-2 small border rounded mb-2 bg-body-tertiary">
                                {t("noCardsEquipped", lang)}
                            </div>
                        ) : (
                            <div className="list-group mb-2">
                                {cardIds.map((cid, idx) => {
                                    const card = getModCard(cid, gameId);
                                    if (!card) return null;
                                    const cardName = getCardDisplayName(card, lang);

                                    return (
                                        <div
                                            key={`${cid}-${idx}`}
                                            className="list-group-item list-group-item-action p-2 d-flex flex-column gap-1"
                                        >
                                            <div className="d-flex justify-content-between align-items-center">
                                                <div className="d-flex align-items-center gap-1 flex-wrap">
                                                    <span className="badge bg-secondary" style={{ fontSize: "0.75rem" }}>
                                                        #{card.cardNo}
                                                    </span>
                                                    {card.slot ? (
                                                        <span className="badge bg-warning text-dark fw-bold" style={{ fontSize: "0.75rem" }}>
                                                            {card.slot}
                                                        </span>
                                                    ) : null}
                                                    <span className="fw-bold small">{cardName}</span>
                                                    {card.mb > 0 ? (
                                                        <span className="badge bg-primary text-light" style={{ fontSize: "0.75rem" }}>
                                                            {card.mb} MB
                                                        </span>
                                                    ) : null}
                                                    <span className="text-muted small" style={{ fontSize: "0.75rem" }}>
                                                        [{card.id}]
                                                    </span>
                                                </div>
                                                <div className="btn-group btn-group-sm">
                                                    <button
                                                        type="button"
                                                        className="btn btn-outline-secondary py-0 px-1"
                                                        disabled={idx === 0}
                                                        onClick={() => handleMoveUp(idx)}
                                                        title={t("moveUp", lang)}
                                                    >
                                                        ▲
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="btn btn-outline-secondary py-0 px-1"
                                                        disabled={idx === cardIds.length - 1}
                                                        onClick={() => handleMoveDown(idx)}
                                                        title={t("moveDown", lang)}
                                                    >
                                                        ▼
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="btn btn-outline-danger py-0 px-1"
                                                        onClick={() => handleRemoveCard(idx)}
                                                        title={t("removeCard", lang)}
                                                    >
                                                        ✕
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Pos & Neg items */}
                                            <div className="d-flex flex-wrap gap-1" style={{ fontSize: "0.75rem" }}>
                                                {card.posRaw.map((p, pidx) => (
                                                    <span key={pidx} className="badge bg-success-subtle text-success-emphasis border border-success-subtle py-0 px-1">
                                                        +{p}
                                                    </span>
                                                ))}
                                                {card.negRaw.map((n, nidx) => (
                                                    <span key={nidx} className="badge bg-danger-subtle text-danger-emphasis border border-danger-subtle py-0 px-1">
                                                        {n}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* Invalidation Notices */}
                        {deck.invalidatedChargeAddition ? (
                            <div className="alert alert-warning py-1 px-2 mb-2 small" style={{ fontSize: "0.78rem" }}>
                                ⚠️ {lang === "zh"
                                    ? `集气射击附加效果 [${deck.invalidatedChargeAddition}] 已被特殊集气攻击 [${deck.bPwrAtk}] 覆盖，实战中无法触发！`
                                    : lang === "ja"
                                    ? `CS付加効果 [${deck.invalidatedChargeAddition}] は特殊チャージ攻撃 [${deck.bPwrAtk}] により上書きされ、実戦で発動しません！`
                                    : `ChargeShot Addition [${deck.invalidatedChargeAddition}] is overridden by Special CS [${deck.bPwrAtk}] and has no effect!`}
                            </div>
                        ) : null}
                        {deck.invalidatedBusterAddition ? (
                            <div className="alert alert-warning py-1 px-2 mb-2 small" style={{ fontSize: "0.78rem" }}>
                                ⚠️ {lang === "zh"
                                    ? `洛克炮附加效果 [${deck.invalidatedBusterAddition}] 已被特殊普通攻击 [${deck.bButton}] 覆盖，实战中无法触发！`
                                    : lang === "ja"
                                    ? `バスター付加効果 [${deck.invalidatedBusterAddition}] は特殊通常攻撃 [${deck.bButton}] により上書きされ、実戦で発動しません！`
                                    : `Buster Addition [${deck.invalidatedBusterAddition}] is overridden by [${deck.bButton}] and has no effect!`}
                            </div>
                        ) : null}
                        {deck.disabledAbilities && deck.disabledAbilities.length > 0 ? (
                            <div className="alert alert-danger py-1 px-2 mb-2 small" style={{ fontSize: "0.78rem" }}>
                                ⚠️ {lang === "zh"
                                    ? `卡组包含负面关闭能力：[${deck.disabledAbilities.map(a => tAbility(a, lang)).join(", ")}]，若压盘安装了对应程序将被剥夺失效！`
                                    : lang === "ja"
                                    ? `カード構成にアビリティ無効化効果が含まれています：[${deck.disabledAbilities.map(a => tAbility(a, lang)).join(", ")}]。該当ナビカスプログラムは無効化されます！`
                                    : `Deck disables abilities: [${deck.disabledAbilities.map(a => tAbility(a, lang)).join(", ")}]. Any matching NaviCust programs will be stripped!`}
                            </div>
                        ) : null}

                        {/* Clear all button */}
                        {cardIds.length > 0 ? (
                            <div className="d-flex justify-content-end mb-2">
                                <button
                                    type="button"
                                    className="btn btn-sm btn-outline-danger py-0 px-2 small"
                                    onClick={handleClearAll}
                                >
                                    {t("clearAllCards", lang)}
                                </button>
                            </div>
                        ) : null}

                        {/* Add Card Controls */}
                        <div className="p-2 border rounded bg-body-tertiary">
                            <div className="fw-semibold small mb-1">{t("addModCard", lang)}</div>
                            <div className="row g-1 mb-1">
                                <div className="col-sm-5">
                                    <select
                                        className="form-select form-select-sm"
                                        value={categoryFilter}
                                        onChange={e => setCategoryFilter(e.target.value)}
                                    >
                                        <option value="all">{t("allCardCategories", lang)}</option>
                                        {isBn4 ? (
                                            <>
                                                <optgroup label={t("slot", lang)}>
                                                    <option value="slot0A">{t("slot0A", lang)}</option>
                                                    <option value="slot0B">{t("slot0B", lang)}</option>
                                                    <option value="slot0C">{t("slot0C", lang)}</option>
                                                    <option value="slot0D">{t("slot0D", lang)}</option>
                                                    <option value="slot0E">{t("slot0E", lang)}</option>
                                                    <option value="slot0F">{t("slot0F", lang)}</option>
                                                </optgroup>
                                                <optgroup label={t("cardCategory", lang)}>
                                                    <option value="part1">{t("part1Cards", lang)}</option>
                                                    <option value="part2">{t("part2Cards", lang)}</option>
                                                    <option value="part3">{t("part3Cards", lang)}</option>
                                                    <option value="part4">{t("part4Cards", lang)}</option>
                                                    <option value="souls">{t("soulUnisons", lang)}</option>
                                                    <option value="promo">{t("promoCards", lang)}</option>
                                                </optgroup>
                                            </>
                                        ) : (
                                            <>
                                                <option value="part1">{t("part1Cards", lang)}</option>
                                                <option value="part2">{t("part2Cards", lang)}</option>
                                                <option value="promo">{t("promoCards", lang)}</option>
                                            </>
                                        )}
                                    </select>
                                </div>
                                <div className="col-sm-7">
                                    <input
                                        type="text"
                                        className="form-control form-control-sm"
                                        placeholder={t("searchCards", lang)}
                                        value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                    />
                                </div>
                            </div>

                            {/* Quick filter chips */}
                            <div className="d-flex flex-wrap gap-1 mb-2">
                                {[
                                    { label: t("quickFilterSuperArmor", lang), q: lang === "zh" ? "超级装甲" : lang === "ja" ? "スーパーアーマー" : "SuperArmor" },
                                    { label: t("quickFilterAirShoes", lang), q: lang === "zh" ? "飞行鞋" : lang === "ja" ? "エアシューズ" : "AirShoes" },
                                    { label: t("quickFilterFloatShoes", lang), q: lang === "zh" ? "浮空鞋" : lang === "ja" ? "フロートシューズ" : "FloatShoes" },
                                    { label: t("quickFilterUnderShirt", lang), q: lang === "zh" ? "危机守护" : lang === "ja" ? "アンダーシャツ" : "UnderShirt" },
                                ].map(chip => (
                                    <button
                                        key={chip.q}
                                        type="button"
                                        className={`btn btn-xs py-0 px-2 rounded-pill ${searchQuery === chip.q ? "btn-primary" : "btn-outline-secondary"}`}
                                        style={{ fontSize: "0.72rem" }}
                                        onClick={() => setSearchQuery(prev => prev === chip.q ? "" : chip.q)}
                                    >
                                        {chip.label}
                                    </button>
                                ))}
                                {searchQuery ? (
                                    <button
                                        type="button"
                                        className="btn btn-xs btn-link py-0 px-1 text-muted text-decoration-none"
                                        style={{ fontSize: "0.72rem" }}
                                        onClick={() => setSearchQuery("")}
                                    >
                                        ✕ {lang === "zh" ? "清除" : lang === "ja" ? "クリア" : "Clear"}
                                    </button>
                                ) : null}
                            </div>

                            <div className="input-group input-group-sm">
                                <select
                                    className="form-select form-select-sm"
                                    value={selectedCardToAdd}
                                    onChange={e => setSelectedCardToAdd(e.target.value)}
                                >
                                    <option value="">-- {t("addModCard", lang)} ({searchResult.allCards.length}) --</option>
                                    {searchResult.matchedAbility ? (
                                        <>
                                            {searchResult.grantingCards.length > 0 ? (
                                                <optgroup label={`${t("grantAbilityGroup", lang)}: ${searchResult.matchedAbility.name} (${searchResult.grantingCards.length})`}>
                                                    {searchResult.grantingCards.map(c => {
                                                        const cName = getCardDisplayName(c, lang);
                                                        return (
                                                            <option key={c.id} value={c.id}>
                                                                {cardPrefix(c)} #{c.cardNo} {cName} ({c.id}) 🟢 [ON]
                                                            </option>
                                                        );
                                                    })}
                                                </optgroup>
                                            ) : null}
                                            {searchResult.removingCards.length > 0 ? (
                                                <optgroup label={`${t("removeAbilityGroup", lang)}: ${searchResult.matchedAbility.name} (${searchResult.removingCards.length})`}>
                                                    {searchResult.removingCards.map(c => {
                                                        const cName = getCardDisplayName(c, lang);
                                                        return (
                                                            <option key={c.id} value={c.id}>
                                                                {cardPrefix(c)} #{c.cardNo} {cName} ({c.id}) 🔴 [OFF]
                                                            </option>
                                                        );
                                                    })}
                                                </optgroup>
                                            ) : null}
                                            {searchResult.otherCards.length > 0 ? (
                                                <optgroup label={`${t("otherMatchingCards", lang)} (${searchResult.otherCards.length})`}>
                                                    {searchResult.otherCards.map(c => {
                                                        const cName = getCardDisplayName(c, lang);
                                                        return (
                                                            <option key={c.id} value={c.id}>
                                                                {cardPrefix(c)} #{c.cardNo} {cName} ({c.id})
                                                            </option>
                                                        );
                                                    })}
                                                </optgroup>
                                            ) : null}
                                        </>
                                    ) : (
                                        searchResult.allCards.map(c => {
                                            const cName = getCardDisplayName(c, lang);
                                            return (
                                                <option key={c.id} value={c.id}>
                                                    {cardPrefix(c)} #{c.cardNo} {cName} ({c.id})
                                                </option>
                                            );
                                        })
                                    )}
                                </select>
                                <button
                                    type="button"
                                    className="btn btn-primary"
                                    disabled={!selectedCardToAdd}
                                    onClick={() => handleAddCard(selectedCardToAdd)}
                                >
                                    {t("addModCard", lang)}
                                </button>
                            </div>

                            {/* Card Details Preview and Overwrite Warnings */}
                            {selectedCardToAdd ? (() => {
                                const card = getModCard(selectedCardToAdd, gameId);
                                if (!card) return null;
                                const conflicts = (card.disabledAbilities || []).filter(a => activeBuildAbilities.includes(a));
                                const existingSameSlotCard = isBn4 && card.slot
                                    ? cardIds.map(id => getModCard(id, gameId)).find(c => c && c.slot === card.slot)
                                    : null;
                                return (
                                    <div className="mt-2 p-2 bg-body rounded border">
                                        <div className="d-flex flex-wrap gap-1" style={{ fontSize: "0.75rem" }}>
                                            {card.posRaw.map((p, pidx) => (
                                                <span key={pidx} className="badge bg-success-subtle text-success-emphasis border border-success-subtle py-0 px-1">
                                                    +{p}
                                                </span>
                                            ))}
                                            {card.negRaw.map((n, nidx) => (
                                                <span key={nidx} className="badge bg-danger-subtle text-danger-emphasis border border-danger-subtle py-0 px-1">
                                                    {n}
                                                </span>
                                            ))}
                                        </div>
                                        {existingSameSlotCard ? (
                                            <div className="alert alert-info py-1 px-2 mt-2 mb-0 small" style={{ fontSize: "0.75rem" }}>
                                                ℹ️ {lang === "zh"
                                                    ? `装备此卡将替换已装备的 ${existingSameSlotCard.slot} 卡片：${getCardDisplayName(existingSameSlotCard, lang)}`
                                                    : lang === "ja"
                                                    ? `このカードを装備すると、装備中の ${existingSameSlotCard.slot} カード「${getCardDisplayName(existingSameSlotCard, lang)}」と入れ替わります`
                                                    : `Equipping this card will replace equipped ${existingSameSlotCard.slot} card: ${getCardDisplayName(existingSameSlotCard, lang)}`}
                                            </div>
                                        ) : null}
                                        {conflicts.length > 0 ? (
                                            <div className="alert alert-warning py-1 px-2 mt-2 mb-0 small" style={{ fontSize: "0.75rem" }}>
                                                ⚠️ {t("removesEquippedAbilityWarning", lang)}: <strong>{conflicts.map(c => tAbility(c, lang)).join("、")}</strong>
                                            </div>
                                        ) : null}
                                    </div>
                                );
                            })() : null}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function AutoOptimizerPanel({
    data,
    problem,
    onChange,
    lang,
    onNavigateToResults,
}: {
    data: Data;
    problem: Problem;
    onChange: (problem: Problem, solution?: Solution) => void;
    lang: Lang;
    onNavigateToResults?: () => void;
}) {
    const hasModCards = data.gameId !== "bn3";
    const userAlreadyHasCards = Boolean(problem.modCards && problem.modCards.length > 0);
    const [modCardMode, setModCardMode] = React.useState<ModCardMode>(
        userAlreadyHasCards ? "keep" : "none"
    );
    const [target, setTarget] = React.useState<OptimizationTarget>("max_hp");
    const [reqAbilities, setReqAbilities] = React.useState<string[]>(() => [...new Set([
        ...(problem.constraints?.requiredAbilities ?? []),
        ...(problem.constraints?.minChipRecovery ? ["chipRecovery"] : []),
    ])]);
    const [minChipRecovery, setMinChipRecovery] = React.useState<ChipRecoveryMinimum>(
        problem.constraints?.minChipRecovery ?? 10
    );
    const [minBusterStats, setMinBusterStats] = React.useState<Partial<Record<BusterStat, number>>>(
        () => getBusterMinimums(problem.constraints)
    );
    const [minCustom, setMinCustom] = React.useState(problem.constraints?.minCustom ?? 0);
    const [reqSpecialMove, setReqSpecialMove] = React.useState<string>(
        problem.constraints?.requiredSpecialMove ?? ""
    );
    const [reqBLeft, setReqBLeft] = React.useState<string>(
        problem.constraints?.requiredBLeft ?? ""
    );
    const [reqBButton, setReqBButton] = React.useState<string>(
        problem.constraints?.requiredBButton ?? ""
    );
    const [reqChargeAddition, setReqChargeAddition] = React.useState<string>(
        problem.constraints?.requiredChargeAddition ?? ""
    );
    const [reqBusterAddition, setReqBusterAddition] = React.useState<string>(
        problem.constraints?.requiredBusterAddition ?? ""
    );
    const [allowedBodies, setAllowedBodies] = React.useState<BodyElement[]>(() => BODY_ELEMENTS.filter(body =>
        (problem.constraints?.allowedBodies === undefined || problem.constraints.allowedBodies.includes(body)) &&
        (!problem.constraints?.requiredBody || problem.constraints.requiredBody.toLowerCase() === body.toLowerCase())
    ));
    const [reqGauge, setReqGauge] = React.useState<string>(
        problem.constraints?.requiredGauge ?? ""
    );
    const [bugRules, setBugRules] = React.useState<Record<string, BugTolerance>>(() => {
        const initial = problem.constraints?.bugRules ?? (problem.bugPolicy?.customRules as Record<string, BugTolerance>);
        if (initial && Object.keys(initial).length > 0) {
            return expandPanelBugRules(data.gameId, initial);
        }
        return getDefaultBugRules(data.gameId);
    });

    const cardsEnabled = hasModCards && modCardMode !== "none";
    const abilityOptions = getOptimizerAbilityOptions(data, cardsEnabled);
    const bugOptions = [...getOptimizerBugOptions(data, cardsEnabled),
        ...(data.gameId === "bn6" && bugRules.panel === "required" ? BUG_SPEC_OPTIONS.filter(option => option.id === "panel") : [])];
    const constraints = getOptimizerModeConstraints(data, {
        ...(reqAbilities.length > 0 ? { requiredAbilities: reqAbilities } : {}),
        ...(reqAbilities.includes("chipRecovery") ? { minChipRecovery } : {}),
        ...(Object.keys(minBusterStats).length > 0 ? { minBusterStats } : {}),
        ...(minCustom > 0 ? { minCustom } : {}),
        ...(reqSpecialMove ? { requiredSpecialMove: reqSpecialMove } : {}),
        ...(reqBLeft ? { requiredBLeft: reqBLeft } : {}),
        ...(reqBButton ? { requiredBButton: reqBButton } : {}),
        ...(reqChargeAddition ? { requiredChargeAddition: reqChargeAddition } : {}),
        ...(reqBusterAddition ? { requiredBusterAddition: reqBusterAddition } : {}),
        ...(allowedBodies.length !== BODY_ELEMENTS.length ? { allowedBodies } : {}),
        ...(reqGauge ? { requiredGauge: reqGauge as GaugeOption } : {}),
        ...(Object.keys(bugRules).length > 0 ? { bugRules } : {}),
    }, cardsEnabled);
    const effectiveBugRules = constraints.bugRules ?? {};
    const effectiveMinBusterStats = constraints.minBusterStats ?? {};
    const defaultBugRules = getDefaultBugRules(data.gameId);
    const numConfiguredBugs = Object.entries(effectiveBugRules).filter(([id, tol]) => {
        const def = defaultBugRules[id] ?? "forbidden";
        return tol !== def;
    }).length;
    const activeConstraintCount =
        (constraints.requiredAbilities?.length ?? 0) + Object.values(effectiveMinBusterStats).filter(value => value > 1).length +
        (minCustom > 0 ? 1 : 0) +
        (constraints.requiredSpecialMove ? 1 : 0) +
        (constraints.requiredBLeft ? 1 : 0) +
        (constraints.requiredBButton ? 1 : 0) +
        (constraints.requiredChargeAddition ? 1 : 0) +
        (constraints.requiredBusterAddition ? 1 : 0) +
        (constraints.allowedBodies ? 1 : 0) +
        (constraints.requiredGauge ? 1 : 0) +
        numConfiguredBugs;
    const [isConstraintsOpen, setIsConstraintsOpen] = React.useState(activeConstraintCount > 0);
    const [isOptimizing, setIsOptimizing] = React.useState(false);
    const [statusMessage, setStatusMessage] = React.useState<{
        type: "success" | "error";
        text: string;
        details?: string[];
        cardDetails?: string[];
    } | null>(null);

    const toggleAbility = (abId: string) => {
        setReqAbilities(prev =>
            prev.includes(abId) ? prev.filter(x => x !== abId) : [...prev, abId]
        );
    };

    const handleSetBugTolerance = (bugId: string, tol: BugTolerance) => {
        setBugRules(prev => ({
            ...prev,
            [bugId]: tol,
        }));
    };

    const handleResetAllBugs = () => {
        setBugRules(Object.fromEntries(bugOptions.map(opt => [opt.id, "forbidden"])));
    };

    const handleResetDefaultBugs = () => {
        setBugRules(getDefaultBugRules(data.gameId));
    };

    const numRequiredBugs = Object.values(effectiveBugRules).filter(v => v === "required").length;
    const numAllowedBugs = Object.values(effectiveBugRules).filter(v => v === "allowed" || v === "allowed_any" || v === "allowed_lv1").length;

    const optimizerRef = React.useRef<AsyncOptimizer | null>(null);
    const bestRef = React.useRef<OptimizeResult | null>(null);
    const previewDataRef = React.useRef(data);
    const [preview, setPreview] = React.useState<OptimizeResult | null>(null);
    const [searchActivity, setSearchActivity] = React.useState<SearchActivity | null>(null);
    const searchStartedRef = React.useRef(0);
    const [elapsedSeconds, setElapsedSeconds] = React.useState(0);
    React.useEffect(() => {
        if (!isOptimizing) return;
        const timer = window.setInterval(() => setElapsedSeconds(Math.floor((Date.now() - searchStartedRef.current) / 1000)), 1000);
        return () => window.clearInterval(timer);
    }, [isOptimizing]);

    React.useEffect(() => () => optimizerRef.current?.stop(), []);

    React.useEffect(() => {
        if (bestRef.current?.problem === problem && previewDataRef.current === data) return;
        setPreview(null);
        bestRef.current = null;
        if (optimizerRef.current) {
            optimizerRef.current.stop();
            optimizerRef.current = null;
            setIsOptimizing(false);
            setStatusMessage({ type: "error", text: t("optInputsChanged", lang) });
        }
    }, [data, problem]);

    const handleStop = () => {
        optimizerRef.current?.stop();
        optimizerRef.current = null;
        setIsOptimizing(false);
        const best = bestRef.current;
        setStatusMessage({ type: best ? "success" : "error",
            text: t(best ? "optStoppedWithResult" : "optStoppedNoResult", lang) });
        if (best) onChange(best.problem, best.solution);
    };

    const handleOptimize = () => {
        optimizerRef.current?.stop();
        bestRef.current = null;
        previewDataRef.current = data;
        setPreview(null);
        setSearchActivity(null);
        searchStartedRef.current = Date.now();
        setElapsedSeconds(0);
        setIsOptimizing(true);
        setStatusMessage(null);

        const policy: BugPolicy = {
            type: Object.keys(effectiveBugRules).length > 0 ? "custom" : "no_bugs",
            customRules: effectiveBugRules,
        };
        try {
            const worker = new AsyncOptimizer({ data, problem, policy, target,
                modCardMode: hasModCards ? modCardMode : "none", constraints }, message => {
                if (optimizerRef.current !== worker) return;
                if (message.type === "error") {
                    optimizerRef.current = null;
                    setIsOptimizing(false);
                    setStatusMessage({ type: "error", text: message.message });
                    if (bestRef.current) onChange(bestRef.current.problem, bestRef.current.solution);
                    return;
                }
                setSearchActivity(message.activity);
                if (message.best) {
                    bestRef.current = message.best;
                    setPreview(message.best);
                }
                if (message.type === "done") {
                    optimizerRef.current = null;
                    setIsOptimizing(false);
                    setStatusMessage({ type: message.best ? "success" : "error",
                        text: t(message.best ? "optSearchComplete" : "optNoSolution", lang) });
                    if (message.best) onChange(message.best.problem, message.best.solution);
                }
            });
            optimizerRef.current = worker;
        } catch (error) {
            setIsOptimizing(false);
            setStatusMessage({ type: "error", text: error instanceof Error ? error.message : String(error) });
        }
    };

    return (
        <div className="accordion mb-2" id="auto-optimizer-section">
            <div className="accordion-item">
                <h2 className="accordion-header" id="auto-optimizer-header">
                    <button
                        className="accordion-button collapsed py-2"
                        type="button"
                        data-bs-toggle="collapse"
                        data-bs-target="#auto-optimizer-body"
                        aria-expanded="false"
                        aria-controls="auto-optimizer-body"
                    >
                        <span className="me-2">✨</span>
                        <span className="fw-semibold me-2">{t("autoOptimizeTitle", lang)}</span>
                        <span className="badge bg-primary text-light me-2">AI Auto-Fill</span>
                        {statusMessage && (
                            <span className={`badge ${statusMessage.type === "success" ? "bg-success" : "bg-warning"} ms-auto me-2`}>
                                {statusMessage.type === "success" ? "✓" : "!"}
                            </span>
                        )}
                    </button>
                </h2>
                <div
                    id="auto-optimizer-body"
                    className="accordion-collapse collapse"
                    aria-labelledby="auto-optimizer-header"
                    data-bs-parent="#auto-optimizer-section"
                >
                    <div className="accordion-body p-2">
                        <p className="text-muted small mb-2" style={{ fontSize: "0.78rem" }}>
                            {t("autoOptimizeDesc", lang)}
                        </p>

                        <fieldset disabled={isOptimizing}>
                        {/* 1. Optimization Goal / Target Selector (Placed at top for instant access) */}
                        <div className="mb-2">
                            <label className="form-label small fw-semibold mb-1">{t("optTarget", lang)}:</label>
                            <div className="btn-group btn-group-sm w-100" role="group">
                                <button
                                    type="button"
                                    className={`btn ${target === "max_hp" ? "btn-primary" : "btn-outline-secondary"}`}
                                    onClick={() => setTarget("max_hp")}
                                >
                                    {t("targetMaxHp", lang)}
                                </button>
                                <button
                                    type="button"
                                    className={`btn ${target === "max_attack" ? "btn-primary" : "btn-outline-secondary"}`}
                                    onClick={() => setTarget("max_attack")}
                                >
                                    {t("targetMaxAttack", lang)}
                                </button>
                            </div>
                            <div className="form-text small">{t("optTargetDesc", lang)}</div>
                        </div>

                        {/* 2. Mod Card Format Selector (Compact) */}
                        {hasModCards && (
                            <div className="mb-2">
                                <label className="form-label small fw-semibold mb-1">{t("optModCardModeTitle", lang)}:</label>
                                <div className="d-flex flex-column gap-1">
                                    <div className="form-check mb-0">
                                        <input
                                            className="form-check-input"
                                            type="radio"
                                            name="optModCardMode"
                                            id="optModCardNone"
                                            checked={modCardMode === "none"}
                                            onChange={() => setModCardMode("none")}
                                        />
                                        <label className="form-check-label small" htmlFor="optModCardNone">
                                            <span className="fw-semibold">{t("optModCardNone", lang)}</span>
                                        </label>
                                    </div>
                                    <div className="form-check mb-0">
                                        <input
                                            className="form-check-input"
                                            type="radio"
                                            name="optModCardMode"
                                            id="optModCardAuto"
                                            checked={modCardMode === "auto"}
                                            onChange={() => setModCardMode("auto")}
                                        />
                                        <label className="form-check-label small" htmlFor="optModCardAuto">
                                            <span className="fw-semibold">{t("optModCardAuto", lang)}</span>
                                        </label>
                                    </div>
                                    {userAlreadyHasCards && (
                                        <div className="form-check mb-0">
                                            <input
                                                className="form-check-input"
                                                type="radio"
                                                name="optModCardMode"
                                                id="optModCardKeep"
                                                checked={modCardMode === "keep"}
                                                onChange={() => setModCardMode("keep")}
                                            />
                                            <label className="form-check-label small" htmlFor="optModCardKeep">
                                                <span className="fw-semibold">{t("optModCardKeep", lang)}</span>
                                            </label>
                                        </div>
                                    )}
                                </div>
                                <div className="text-muted mt-1" style={{ fontSize: "0.74rem" }}>
                                    {modCardMode === "none" && t("optModCardNoneDesc", lang)}
                                    {modCardMode === "auto" && t("optModCardAutoDesc", lang)}
                                    {modCardMode === "keep" && t("optModCardKeepDesc", lang)}
                                </div>
                            </div>
                        )}

                        {/* 3. Declarative Build Constraints (Collapsible Card with Active Badge) */}
                        <div className="card mb-2 border-secondary-subtle bg-body-tertiary">
                            <div
                                className="card-header py-1 px-2 d-flex align-items-center justify-content-between"
                                style={{ cursor: "pointer", userSelect: "none" }}
                                onClick={() => setIsConstraintsOpen(prev => !prev)}
                                role="button"
                                aria-expanded={isConstraintsOpen}
                            >
                                <div className="d-flex align-items-center gap-1">
                                    <span>🎯</span>
                                    <span className="small fw-semibold">{t("buildConstraintsTitle", lang)}</span>
                                </div>
                                <div className="d-flex align-items-center gap-1">
                                    {activeConstraintCount > 0 && (
                                        <span className="badge bg-primary text-light" style={{ fontSize: "0.72rem" }}>
                                            {activeConstraintCount}
                                        </span>
                                    )}
                                    <span className="text-muted small" style={{ fontSize: "0.75rem" }}>
                                        {isConstraintsOpen ? "▲" : "▼"}
                                    </span>
                                </div>
                            </div>
                            {isConstraintsOpen && (
                                <div className="card-body p-2 border-top border-secondary-subtle">
                                    <div className="text-muted small mb-2" style={{ fontSize: "0.76rem" }}>
                                        {t("buildConstraintsDesc", lang)}
                                    </div>

                                    <div className="mb-3">
                                        <label htmlFor="optimizer-custom-min" className="form-label small fw-semibold mb-1">
                                            {t("minCustomTitle", lang)}
                                        </label>
                                        <select id="optimizer-custom-min" className="form-select form-select-sm"
                                            value={minCustom} onChange={event => setMinCustom(Number(event.target.value))}>
                                            <option value={0}>{t("anyOption", lang)}</option>
                                            {[5, 6, 7, 8, 9, 10].map(value => (
                                                <option key={value} value={value}>≥ {value}</option>
                                            ))}
                                        </select>
                                        <div className="small text-muted mt-1">{t("minCustomDesc", lang)}</div>
                                    </div>

                                    <div className="mb-3">
                                        <div className="form-label small fw-semibold mb-1">{t("minBusterStatsTitle", lang)}</div>
                                        <div className="row g-2">
                                            {BUSTER_STATS.map(stat => (
                                                <label key={stat} className="col-4 small">
                                                    <span className="d-block mb-1">{t(stat === "attack" ? "statAttack" : stat === "rapid" ? "statRapid" : "statCharge", lang)}</span>
                                                    <select className="form-select form-select-sm" value={effectiveMinBusterStats[stat] ?? 0}
                                                        onChange={event => {
                                                            const value = Number(event.target.value);
                                                            setMinBusterStats(prev => {
                                                                const next = { ...prev };
                                                                if (value === 0) delete next[stat];
                                                                else next[stat] = value;
                                                                return next;
                                                            });
                                                        }}>
                                                        <option value={0}>{t("anyOption", lang)}</option>
                                                        {Array.from({ length: cardsEnabled ? getBusterStatLimits(data.gameId)[stat] : 5 }, (_, index) => index + 1).map(value => (
                                                            <option key={value} value={value}>≥ {value}</option>
                                                        ))}
                                                    </select>
                                                </label>
                                            ))}
                                        </div>
                                        <div className="small text-muted mt-1">{t("minBusterStatsDesc", lang)}</div>
                                    </div>

                                    {/* Required Abilities */}
                                    <div className="mb-2">
                                        <label className="form-label small fw-semibold mb-1 d-block">
                                            {t("reqAbilitiesTitle", lang)}:
                                        </label>
                                        <div className="d-flex flex-wrap gap-1">
                                            {abilityOptions.map(opt => {
                                                const active = reqAbilities.includes(opt.id);
                                                return (
                                                    <button
                                                        key={opt.id}
                                                        type="button"
                                                        className={`btn btn-sm py-0 px-2 ${active ? "btn-primary" : "btn-outline-secondary"}`}
                                                        style={{ fontSize: "0.78rem", borderRadius: "12px" }}
                                                        onClick={() => toggleAbility(opt.id)}
                                                    >
                                                        {active ? "✓ " : "+ "}{opt.name[lang] || opt.name.en}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        {cardsEnabled && reqAbilities.includes("chipRecovery") ? (
                                            <div className="mt-2">
                                                <label htmlFor="optimizer-chip-recovery-min" className="form-label small fw-semibold mb-1">
                                                    {t("minChipRecoveryTitle", lang)}
                                                </label>
                                                <select id="optimizer-chip-recovery-min" className="form-select form-select-sm"
                                                    value={minChipRecovery}
                                                    onChange={event => setMinChipRecovery(Number(event.target.value) as ChipRecoveryMinimum)}>
                                                    {([10, 20, 30, 40] as const).map(value => (
                                                        <option key={value} value={value}>≥ {value} HP</option>
                                                    ))}
                                                </select>
                                                <div className="small text-muted mt-1">{t("minChipRecoveryDesc", lang)}</div>
                                            </div>
                                        ) : null}
                                    </div>

                                    {/* Mod Card Specific Battle Specs & Controls */}
                                    {cardsEnabled && (
                                        <div className="pt-2 border-top border-secondary-subtle">
                                            {/* Row 1: Special CS & B+Left */}
                                            <div className="row g-2 mb-2">
                                                <div className="col-12 col-md-6">
                                                    <label className="form-label small fw-semibold mb-1">
                                                        {t("reqSpecialMoveTitle", lang)}:
                                                    </label>
                                                    <select
                                                        className="form-select form-select-sm"
                                                        value={reqSpecialMove}
                                                        onChange={e => setReqSpecialMove(e.target.value)}
                                                    >
                                                        <option value="">{t("anyOption", lang)}</option>
                                                        {getSpecialCsOptions(data.gameId).map(opt => (
                                                            <option key={opt.id} value={opt.id}>
                                                                {opt.name[lang] || opt.name.en}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div className="col-12 col-md-6">
                                                    <label className="form-label small fw-semibold mb-1">
                                                        {t("reqBLeftTitle", lang)}:
                                                    </label>
                                                    <select
                                                        className="form-select form-select-sm"
                                                        value={reqBLeft}
                                                        onChange={e => setReqBLeft(e.target.value)}
                                                    >
                                                        <option value="">{t("anyOption", lang)}</option>
                                                        {getBLeftOptions(data.gameId).map(opt => (
                                                            <option key={opt.id} value={opt.id}>
                                                                {opt.name[lang] || opt.name.en}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>

                                            {/* Row 2: B-Button Override & Gauge Speed */}
                                            <div className="row g-2 mb-2">
                                                <div className="col-12 col-md-6">
                                                    <label className="form-label small fw-semibold mb-1">
                                                        {t("reqBButtonTitle", lang)}:
                                                    </label>
                                                    <select
                                                        className="form-select form-select-sm"
                                                        value={reqBButton}
                                                        onChange={e => setReqBButton(e.target.value)}
                                                    >
                                                        <option value="">{t("anyOption", lang)}</option>
                                                        {getBButtonOptions(data.gameId).map(opt => (
                                                            <option key={opt.id} value={opt.id}>
                                                                {opt.name[lang] || opt.name.en}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div className="col-12 col-md-6">
                                                    <label className="form-label small fw-semibold mb-1">
                                                        {t("reqGaugeTitle", lang)}:
                                                    </label>
                                                    <select
                                                        className="form-select form-select-sm"
                                                        value={reqGauge}
                                                        onChange={e => setReqGauge(e.target.value)}
                                                    >
                                                        <option value="">{t("anyOption", lang)}</option>
                                                        {GAUGE_OPTIONS.map(opt => (
                                                            <option key={opt.id} value={opt.id}>
                                                                {opt.name[lang] || opt.name.en}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>

                                            {/* Row 3: CS Addition & Buster Addition */}
                                            <div className="row g-2 mb-2">
                                                <div className="col-12 col-md-6">
                                                    <label className="form-label small fw-semibold mb-1">
                                                        {t("reqChargeAdditionTitle", lang)}:
                                                    </label>
                                                    <select
                                                        className="form-select form-select-sm"
                                                        value={reqChargeAddition}
                                                        onChange={e => setReqChargeAddition(e.target.value)}
                                                    >
                                                        <option value="">{t("anyOption", lang)}</option>
                                                        {CHARGE_ADDITION_OPTIONS.map(opt => (
                                                            <option key={opt.id} value={opt.id}>
                                                                {opt.name[lang] || opt.name.en}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div className="col-12 col-md-6">
                                                    <label className="form-label small fw-semibold mb-1">
                                                        {t("reqBusterAdditionTitle", lang)}:
                                                    </label>
                                                    <select
                                                        className="form-select form-select-sm"
                                                        value={reqBusterAddition}
                                                        onChange={e => setReqBusterAddition(e.target.value)}
                                                    >
                                                        <option value="">{t("anyOption", lang)}</option>
                                                        {BUSTER_ADDITION_OPTIONS.map(opt => (
                                                            <option key={opt.id} value={opt.id}>
                                                                {opt.name[lang] || opt.name.en}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>


                                        </div>
                                    )}

                                    {cardsEnabled && (
                                        <div className="row g-2 mb-2">
                                            <div className="col-12">
                                                <div className="form-label small fw-semibold mb-1">{t("allowedBodiesTitle", lang)}</div>
                                                <div className="d-flex flex-wrap gap-3" role="group" aria-label={t("allowedBodiesTitle", lang)}>
                                                    {BODY_OPTIONS.map(opt => {
                                                        const body = opt.id as BodyElement;
                                                        return (
                                                            <label key={body} className="form-check small mb-0">
                                                                <input type="checkbox" className="form-check-input"
                                                                    checked={allowedBodies.includes(body)}
                                                                    onChange={() => setAllowedBodies(prev => prev.includes(body)
                                                                        ? prev.filter(value => value !== body) : [...prev, body])} />
                                                                <span className="form-check-label">{opt.name[lang] || opt.name.en}</span>
                                                            </label>
                                                        );
                                                    })}
                                                </div>
                                                <div className="small text-muted mt-1">{t("allowedBodiesDesc", lang)}</div>
                                                {allowedBodies.length === 0 ? (
                                                    <div className="small text-danger mt-1" role="alert">{t("allowedBodiesEmpty", lang)}</div>
                                                ) : null}
                                            </div>
                                        </div>
                                    )}

                                    {/* Unified Bug Rules & Requirements */}
                                    <div className="mb-2 pt-2 border-top border-secondary-subtle">
                                        <div className="d-flex align-items-center justify-content-between mb-1">
                                            <div className="d-flex align-items-center gap-1">
                                                <span className="small fw-semibold">{t("bugRulesTitle", lang)}</span>
                                                {numRequiredBugs > 0 ? (
                                                    <span className="badge bg-primary-subtle text-primary border border-primary-subtle" style={{ fontSize: "0.72rem" }}>
                                                        ★ {numRequiredBugs} {t("bugRuleRequired", lang).replace("★ ", "")}
                                                    </span>
                                                ) : numAllowedBugs > 0 ? (
                                                    <span className="badge bg-warning-subtle text-warning border border-warning-subtle" style={{ fontSize: "0.72rem" }}>
                                                        ○ {numAllowedBugs} {t("bugRuleAllowed", lang).replace("○ ", "")}
                                                    </span>
                                                ) : (
                                                    <span className="badge bg-success-subtle text-success border border-success-subtle" style={{ fontSize: "0.72rem" }}>
                                                        {t("bugRuleStatusPure", lang)}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="d-flex align-items-center gap-2">
                                                <button
                                                    type="button"
                                                    className="btn btn-sm btn-link p-0 text-decoration-none text-muted"
                                                    style={{ fontSize: "0.72rem" }}
                                                    onClick={handleResetDefaultBugs}
                                                    title={t("resetBugRulesDefault", lang)}
                                                >
                                                    {t("resetBugRulesDefault", lang)}
                                                </button>
                                                <button
                                                    type="button"
                                                    className="btn btn-sm btn-link p-0 text-decoration-none text-muted"
                                                    style={{ fontSize: "0.72rem" }}
                                                    onClick={handleResetAllBugs}
                                                    title={t("resetAllBugsForbidden", lang)}
                                                >
                                                    {t("resetAllBugsForbidden", lang)}
                                                </button>
                                            </div>
                                        </div>
                                        <div className="text-muted small mb-2" style={{ fontSize: "0.74rem" }}>
                                            {t("bugRulesDesc", lang)}
                                        </div>

                                        <div className="d-flex flex-column gap-1">
                                            {bugOptions.map(opt => {
                                                const inherited = getBugRule(bugRules, opt.id);
                                                const currentTol: BugTolerance = bugRules[opt.id] ?? (inherited === "required" ? "allowed_any" : inherited);
                                                return (
                                                    <div
                                                        key={opt.id}
                                                        className="d-flex align-items-center justify-content-between py-1 px-1 rounded bg-body"
                                                        style={{ fontSize: "0.78rem" }}
                                                    >
                                                        <div className="d-flex flex-column" style={{ maxWidth: "58%" }}>
                                                            <span className="fw-semibold text-truncate">{opt.name[lang] || opt.name.en}</span>
                                                            <span className="text-muted text-truncate" style={{ fontSize: "0.70rem" }}>
                                                                {opt.desc[lang] || opt.desc.en}
                                                            </span>
                                                        </div>
                                                        <div className="btn-group btn-group-sm" role="group">
                                                            <button
                                                                type="button"
                                                                className={`btn py-0 px-2 ${currentTol === "forbidden" ? "btn-danger text-light" : "btn-outline-secondary"}`}
                                                                style={{ fontSize: "0.72rem" }}
                                                                onClick={() => handleSetBugTolerance(opt.id, "forbidden")}
                                                                title={t("bugRuleForbidden", lang)}
                                                            >
                                                                {t("bugRuleForbidden", lang)}
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className={`btn py-0 px-2 ${currentTol === "allowed" || currentTol === "allowed_any" ? "btn-warning text-dark" : "btn-outline-secondary"}`}
                                                                style={{ fontSize: "0.72rem" }}
                                                                onClick={() => handleSetBugTolerance(opt.id, "allowed")}
                                                                title={t("bugRuleAllowed", lang)}
                                                            >
                                                                {t("bugRuleAllowed", lang)}
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className={`btn py-0 px-2 ${currentTol === "required" ? "btn-primary text-light" : "btn-outline-secondary"}`}
                                                                style={{ fontSize: "0.72rem" }}
                                                                onClick={() => handleSetBugTolerance(opt.id, "required")}
                                                                title={t("bugRuleRequired", lang)}
                                                            >
                                                                {t("bugRuleRequired", lang)}
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        </fieldset>
                        {/* 5. Sticky Action Button */}
                        <div className="sticky-bottom bg-body pt-2 pb-1 border-top mt-2" style={{ zIndex: 2 }}>
                            <button
                                type="button"
                                className="btn btn-primary w-100 py-2 fw-semibold d-flex justify-content-center align-items-center gap-2 shadow-sm"
                                disabled={!isOptimizing && cardsEnabled && allowedBodies.length === 0}
                                onClick={isOptimizing ? handleStop : handleOptimize}
                            >
                                {isOptimizing ? (
                                    <>
                                        <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                                        <span>{t("optStopSearch", lang)}</span>
                                    </>
                                ) : (
                                    <span>{t("autoOptimizeBtn", lang)}</span>
                                )}
                            </button>
                        </div>

                        {isOptimizing ? (
                            <div className="small text-muted mt-2" role="status" aria-live="polite">
                                {t(preview ? "optSearchingBetter" : "optSearchingFeasible", lang)}
                                <div>{t(({ library: "optStageLibrary", feasible: "optStageFeasible", improve: "optStageImprove", local: "optStageLocal", exhaustive: "optStageExhaustive" } as const)[searchActivity?.stage ?? "feasible"], lang)}</div>
                                <div>{t("optElapsed", lang)}: {elapsedSeconds}s · {t("optCandidateChecks", lang)}: {(searchActivity?.candidateChecks ?? 0).toLocaleString()} · {t("optPlacementAttempts", lang)}: {(searchActivity?.placementAttempts ?? 0).toLocaleString()}</div>
                            </div>
                        ) : null}
                        {preview && previewDataRef.current === data ? (
                            <div className="border rounded p-2 mt-2">
                                <div className="fw-semibold small mb-2">{t("optCurrentBest", lang)} · HP: {preview.stats.finalHp}</div>
                                <div className="small text-muted mb-2">
                                    {t("statAttack", lang)}: {preview.stats.attack} · {t("statRapid", lang)}: {preview.stats.rapid} · {t("statCharge", lang)}: {preview.stats.charge}
                                    {" · "}{t("statCustom", lang)}: {preview.stats.custom}
                                </div>
                                <div className="small text-muted mb-2">
                                    {t("reqBodyTitle", lang)}: {BODY_OPTIONS.find(opt => opt.id === (preview.stats.modBody ?? "Normal"))?.name[lang] ?? preview.stats.modBody ?? "Normal"}
                                </div>
                                {preview.stats.modChipRecovery ? (
                                    <div className="small text-muted mb-2">{tAbility("chipRecovery", lang)}: {preview.stats.modChipRecovery} HP</div>
                                ) : null}
                                <div className="d-flex justify-content-center overflow-auto">
                                    <Navicust
                                        key={JSON.stringify([preview.problem.requirements, preview.solution])}
                                        parts={data.parts} colors={data.colors}
                                        requirements={preview.problem.requirements}
                                        gridSettings={makeGridSettings(data, preview.problem)}
                                        cells={placeAll(data.parts, preview.problem.requirements, preview.solution, makeGridSettings(data, preview.problem))}
                                    />
                                </div>
                                <SolutionBugStatus analysis={preview.analysis} lang={lang} />
                                {preview.problem.modCards && preview.problem.modCards.length > 0 ? (
                                    <div className="small text-muted mt-2">
                                        {t("optAddedModCards", lang)}: {preview.problem.modCards.map(id => {
                                            const card = getModCard(id, data.gameId);
                                            return card ? getCardDisplayName(card, lang) : id;
                                        }).join(", ")}
                                    </div>
                                ) : null}
                            </div>
                        ) : null}

                        {/* 6. Status notice */}
                        {statusMessage ? (
                            <div className={`alert alert-${statusMessage.type === "success" ? "success" : "warning"} py-2 px-3 mt-2 mb-0 small`}>
                                <div className="fw-semibold">{statusMessage.text}</div>
                                {statusMessage.cardDetails && statusMessage.cardDetails.length > 0 ? (
                                    <div className="text-muted mt-1" style={{ fontSize: "0.78rem" }}>
                                        {t("optAddedModCards", lang)}: {statusMessage.cardDetails.join(", ")}
                                    </div>
                                ) : null}
                                {statusMessage.details && statusMessage.details.length > 0 ? (
                                    <div className="text-muted mt-1" style={{ fontSize: "0.78rem" }}>
                                        {t("optAddedParts", lang)}: {statusMessage.details.join(", ")}
                                    </div>
                                ) : null}
                            </div>
                        ) : null}
                    </div>
                </div>
            </div>
        </div>
    );
}

function PartSelector({
    data,
    problem,
    onChange,
    onNavigateToResults,
}: {
    data: Data;
    problem: Problem;
    onChange: (problem: Problem, solution?: Solution) => void;
    onNavigateToResults?: () => void;
}) {
    const { lang } = useLang();
    const compatibility = colorCompatibility(data, problem);
    return (
        <>
            {data.styleColorRules ? (
                <div className="mb-2">
                    <label htmlFor="style" className="form-label">{t("style", lang)}</label>
                    <select id="style" className="form-select mb-2"
                        value={problem.style}
                        onChange={event => onChange({ ...problem, style: event.target.value })}>
                        {data.styleColorRules.styles.map(style => (
                            <option key={style.id} value={style.id}>{tBilingual(style.label, lang)}</option>
                        ))}
                    </select>
                    <div className="form-check">
                        <input id="mod-tools" type="checkbox" className="form-check-input"
                            checked={problem.modTools ?? false}
                            onChange={event => onChange({ ...problem, modTools: event.target.checked })} />
                        <label htmlFor="mod-tools" className="form-check-label">
                            {t("modTools", lang)}
                        </label>
                    </div>
                    <div className="small text-muted mt-1">
                        {t("compatibleColors", lang)}: {compatibility.allowedColors.map(c => getColorName(c, lang)).join(", ")}
                    </div>
                    {compatibility.offColorParts.length > 0 ? (
                        compatibility.error ? (
                            <div className="small text-danger mt-1 fw-bold" role="status">
                                {t("incompatibleParts", lang)}: {[...new Set(compatibility.offColorParts.map(req => getPartName(data.partMetas[req.partIndex], lang)))].join(", ")}
                            </div>
                        ) : (
                            <div className="small mt-1" role="status">
                                {t("requiresErrorCode", lang)}: {[...new Set(compatibility.offColorParts.map(req => getPartName(data.partMetas[req.partIndex], lang)))].join(", ")}
                            </div>
                        )
                    ) : null}
                    <div className="small text-muted mt-1">
                        {t("bn3CompressionWarning", lang)}
                    </div>
                </div>
            ) : null}
            <div className="form mb-2">
                <div className="col">
                    <select
                        className="form-select"
                        id="part-select"
                        disabled={data == null}
                        value={""}
                        onChange={(e) => {
                            const partIndex = parseInt(e.target.value, 10);
                            const part = data!.parts[partIndex];

                            onChange({
                                ...problem,
                                requirements: [
                                    {
                                        partIndex,
                                        constraint: {
                                            minBugLevel: 0,
                                            maxBugLevel: Infinity,
                                            compressed: !isEqual(
                                                part.compressedMask,
                                                part.uncompressedMask
                                            )
                                                ? true
                                                : false,
                                            onCommandLine: part.isSolid
                                                ? true
                                                : null,
                                        },
                                    },
                                    ...problem.requirements,
                                ],
                            });
                        }}
                    >
                        <option value="" disabled>
                            {t("pickPart", lang)}
                        </option>
                        {data != null
                            ? data.partMetas.map((part, i) => {
                                  const incompatible = !isPartCompatible(data, problem, i);
                                  return (
                                      <option value={i} key={i}>
                                          {getPartName(part, lang)}
                                          {incompatible
                                              ? t("incompatibleDropdownSuffix", lang)
                                              : ""}
                                      </option>
                                  );
                              })
                            : null}
                    </select>
                </div>
            </div>

            <div className="flex-grow-1 mb-2">
                <ol className="list-group">
                    {problem.requirements.map((requirement, i) => {
                        const partMeta = data!.partMetas[requirement.partIndex];
                        const incompatible = !isPartCompatible(data, problem, requirement.partIndex);

                        return (
                            <li
                                className={`list-group-item ${
                                    incompatible
                                        ? compatibility.error
                                            ? "list-group-item-danger border-danger"
                                            : "list-group-item-warning border-warning"
                                        : ""
                                }`}
                                key={i}
                            >
                                <div className="mb-2 d-flex align-items-center">
                                    <div className="flex-grow-1">
                                        {i + 1}. {getPartName(partMeta, lang)}
                                        {incompatible && (
                                            compatibility.error ? (
                                                <span
                                                    className="badge bg-danger ms-2"
                                                    title={t("incompatibleBadgeTitle", lang)}
                                                >
                                                    {t("incompatibleWithStyle", lang)}
                                                </span>
                                            ) : (
                                                <span
                                                    className="badge bg-warning text-dark ms-2"
                                                    title={t("requiresErrorCodeBadgeTitle", lang)}
                                                >
                                                    {t("requiresErrorCodeBadge", lang)}
                                                </span>
                                            )
                                        )}
                                    </div>
                                    <button
                                        type="button"
                                        className="btn btn-close btn-sm align-self-end"
                                        onClick={((i: number) => {
                                            onChange({
                                                ...problem,
                                                requirements:
                                                    problem.requirements.filter(
                                                        (_, j) => i != j
                                                    ),
                                            });
                                        }).bind(null, i)}
                                    />
                                </div>
                                <div className="row g-2">
                                    <div className="col-xl">
                                        <ConstraintDropdown
                                            value={
                                                requirement.constraint
                                                    .onCommandLine
                                            }
                                            title={t("onCommandLine", lang)}
                                            onChange={((
                                                i: number,
                                                v: boolean | null
                                            ) => {
                                                onChange({
                                                    ...problem,
                                                    requirements:
                                                        problem.requirements.map(
                                                            (r, j) =>
                                                                i == j
                                                                    ? {
                                                                          ...r,
                                                                          constraint:
                                                                              {
                                                                                  ...r.constraint,
                                                                                  onCommandLine:
                                                                                      v,
                                                                              },
                                                                      }
                                                                    : r
                                                        ),
                                                });
                                            }).bind(null, i)}
                                        />
                                    </div>
                                    <div className="col-xl">
                                        <div className="input-group">
                                            <div className="form-floating">
                                                <input
                                                    type="number"
                                                    value={
                                                        requirement.constraint
                                                            .minBugLevel
                                                    }
                                                    className="form-control"
                                                    onChange={((
                                                        i: number,
                                                        e: ChangeEvent<HTMLInputElement>
                                                    ) => {
                                                        onChange({
                                                            ...problem,
                                                            requirements:
                                                                problem.requirements.map(
                                                                    (r, j) => {
                                                                        if (
                                                                            i !=
                                                                            j
                                                                        ) {
                                                                            return r;
                                                                        }
                                                                        let v =
                                                                            e
                                                                                .target
                                                                                .value !=
                                                                            ""
                                                                                ? parseInt(
                                                                                      e
                                                                                          .target
                                                                                          .value,
                                                                                      10
                                                                                  )
                                                                                : 0;
                                                                        if (
                                                                            v <
                                                                            0
                                                                        ) {
                                                                            v = 0;
                                                                        }
                                                                        return {
                                                                            ...r,
                                                                            constraint:
                                                                                {
                                                                                    ...r.constraint,
                                                                                    minBugLevel:
                                                                                        v,
                                                                                    maxBugLevel:
                                                                                        Math.max(
                                                                                            r
                                                                                                .constraint
                                                                                                .maxBugLevel,
                                                                                            v
                                                                                        ),
                                                                                },
                                                                        };
                                                                    }
                                                                ),
                                                        });
                                                    }).bind(null, i)}
                                                />
                                                <label>
                                                    {t("minBugs", lang)}
                                                </label>
                                            </div>
                                            <div className="form-floating">
                                                <input
                                                    type="number"
                                                    value={
                                                        requirement.constraint
                                                            .maxBugLevel
                                                    }
                                                    className="form-control"
                                                    onChange={((
                                                        i: number,
                                                        e: ChangeEvent<HTMLInputElement>
                                                    ) => {
                                                        onChange({
                                                            ...problem,
                                                            requirements:
                                                                problem.requirements.map(
                                                                    (r, j) => {
                                                                        if (
                                                                            i !=
                                                                            j
                                                                        ) {
                                                                            return r;
                                                                        }

                                                                        let v =
                                                                            e
                                                                                .target
                                                                                .value !=
                                                                            ""
                                                                                ? parseInt(
                                                                                      e
                                                                                          .target
                                                                                          .value,
                                                                                      10
                                                                                  )
                                                                                : Infinity;
                                                                        if (
                                                                            v <
                                                                            0
                                                                        ) {
                                                                            v =
                                                                                Infinity;
                                                                        }

                                                                        return {
                                                                            ...r,
                                                                            constraint:
                                                                                {
                                                                                    ...r.constraint,
                                                                                    minBugLevel:
                                                                                        Math.min(
                                                                                            v,
                                                                                            r
                                                                                                .constraint
                                                                                                .minBugLevel
                                                                                        ),
                                                                                    maxBugLevel:
                                                                                        v,
                                                                                },
                                                                        };
                                                                    }
                                                                ),
                                                        });
                                                    }).bind(null, i)}
                                                />
                                                <label>
                                                    {t("maxBugs", lang)}
                                                </label>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="col-xl">
                                        <ConstraintDropdown
                                            value={
                                                requirement.constraint
                                                    .compressed
                                            }
                                            title={t("compress", lang)}
                                            disabled={isEqual(
                                                partMeta.compressedMask,
                                                partMeta.uncompressedMask
                                            )}
                                            onChange={((
                                                i: number,
                                                v: boolean | null
                                            ) => {
                                                onChange({
                                                    ...problem,
                                                    requirements:
                                                        problem.requirements.map(
                                                            (r, j) =>
                                                                i == j
                                                                    ? {
                                                                          ...r,
                                                                          constraint:
                                                                              {
                                                                                  ...r.constraint,
                                                                                  compressed:
                                                                                      v,
                                                                              },
                                                                      }
                                                                    : r
                                                        ),
                                                });
                                            }).bind(null, i)}
                                        />
                                    </div>
                                </div>
                            </li>
                        );
                    })}
                </ol>
            </div>

            <div className="accordion mb-2" id="extra-settings">
                <div className="accordion-item">
                    <h2 className="accordion-header" id="extra-settings-header">
                        <button
                            className="accordion-button collapsed py-2"
                            type="button"
                            data-bs-toggle="collapse"
                            data-bs-target="#extra-settings-body"
                            aria-expanded="false"
                            aria-controls="extra-settings-body"
                        >
                            <span className="me-2">⚙️</span>
                            <span className="fw-semibold me-2">{t("extraSettings", lang)}</span>
                        </button>
                    </h2>
                    <div
                        id="extra-settings-body"
                        className="accordion-collapse collapse"
                        aria-labelledby="extra-settings-header"
                        data-bs-parent="#extra-settings"
                    >
                        <div className="accordion-body p-2">
                            <div className="row mb-2">
                                <label
                                    htmlFor="expansion-memories"
                                    className="col-sm-4 col-form-label"
                                >
                                    {t("expansionMemory", lang)}
                                </label>
                                <div className="col-sm-8">
                                    <select
                                        className="form-select form-select-small"
                                        id="expansion-memories"
                                        value={problem.expansionMemories}
                                        onChange={(e) => {
                                            onChange({
                                                ...problem,
                                                expansionMemories: parseInt(
                                                    e.target.value,
                                                    10
                                                ),
                                            });
                                        }}
                                    >
                                        {data.gridOptions.map((option, i) => (
                                            <option value={i} key={i}>{option.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="row mb-2">
                                <label
                                    htmlFor="base-hp"
                                    className="col-sm-4 col-form-label"
                                >
                                    {t("baseHp", lang)}
                                </label>
                                <div className="col-sm-8">
                                    <div className="input-group input-group-sm">
                                        <input
                                            type="number"
                                            className="form-control"
                                            id="base-hp"
                                            min="1"
                                            max="9999"
                                            step="20"
                                            value={problem.baseHp ?? 1000}
                                            onChange={(e) => {
                                                const v = parseInt(e.target.value, 10);
                                                onChange({
                                                    ...problem,
                                                    baseHp: isNaN(v) ? 1000 : Math.max(1, v),
                                                });
                                            }}
                                        />
                                        <button
                                            type="button"
                                            className="btn btn-outline-secondary"
                                            onClick={() => onChange({ ...problem, baseHp: 1000 })}
                                            title={t("resetBaseHp", lang)}
                                        >
                                            1000
                                        </button>
                                        <button
                                            type="button"
                                            className="btn btn-outline-secondary"
                                            onClick={() => onChange({ ...problem, baseHp: 100 })}
                                            title="100 HP"
                                        >
                                            100
                                        </button>
                                    </div>
                                    <div className="form-text small text-muted" style={{ fontSize: "0.75rem" }}>
                                        {t("baseHpHelp", lang)}
                                    </div>
                                </div>
                            </div>

                            <div className="mb-2">
                                {data.colors.map((color, i) => {
                                    if (i == 0) {
                                        return null;
                                    }

                                    return (
                                        <div
                                            className="form-check form-check-inline"
                                            key={i}
                                        >
                                            <input
                                                type="checkbox"
                                                className="form-check-input"
                                                id={`spinnable-${color}`}
                                                onChange={((
                                                    i: number,
                                                    e: ChangeEvent<HTMLInputElement>
                                                ) => {
                                                    onChange({
                                                        ...problem,
                                                        spinnableColors:
                                                            problem.spinnableColors.map(
                                                                (v, j) =>
                                                                    i == j
                                                                        ? e
                                                                              .target
                                                                              .checked
                                                                        : v
                                                            ),
                                                    });
                                                }).bind(null, i)}
                                                checked={
                                                    problem.spinnableColors[i]
                                                }
                                            />
                                            <label
                                                htmlFor={`spinnable-${color}`}
                                                className="form-check-label px-2 rounded"
                                                style={{
                                                    backgroundColor:
                                                        COLORS[
                                                            color as keyof typeof COLORS
                                                        ].solid,
                                                    color: ["white", "yellow", "pink", "green"].includes(color)
                                                        ? "#000"
                                                        : "#fff",
                                                }}
                                            >
                                                {lang === "ja"
                                                    ? `${t("spin", lang)}${COLORS[color as keyof typeof COLORS].nameJa}`
                                                    : lang === "zh"
                                                    ? `${COLORS[color as keyof typeof COLORS].nameZh}${t("spin", lang)}`
                                                    : `${t("spin", lang)} ${COLORS[color as keyof typeof COLORS].name}`}
                                            </label>
                                        </div>
                                    ); // TODO: Spinnables
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {data.gameId === "bn4" || data.gameId === "bn5" || data.gameId === "bn6" ? (
                <ModCardManager problem={problem} onChange={onChange} lang={lang} data={data} />
            ) : null}

            <AutoOptimizerPanel
                data={data}
                problem={problem}
                onChange={onChange}
                lang={lang}
                onNavigateToResults={onNavigateToResults}
            />

            <BuildStatsView data={data} problem={problem} />

            <div className="row">
                <div className="col d-flex justify-content-end">
                    <button
                        type="reset"
                        id="reset"
                        className="btn btn-danger"
                        onClick={() => {
                            onChange(emptyProblem(data));
                        }}
                    >
                        <span>{t("reset", lang)}</span>
                    </button>
                </div>
            </div>

            {onNavigateToResults ? (
                <div className="d-lg-none mt-3">
                    <button
                        type="button"
                        className="btn btn-primary w-100 py-2 fw-semibold"
                        onClick={onNavigateToResults}
                    >
                        {t("viewSolutions", lang)} ➔
                    </button>
                </div>
            ) : null}
        </>
    );
}

const CELL_SIZE = 96;

const BG_FILL_COLOR = "#202020";
const BORDER_STROKE_COLOR = "#000000";

function drawGridNumbers(
    ctx: CanvasRenderingContext2D,
    cells: (number | null)[],
    gridSettings: GridSettings
) {
    const borderWidth = CELL_SIZE / 12;

    ctx.font = `${borderWidth * 5}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    for (let y = 0; y < gridSettings.height; ++y) {
        for (let x = 0; x < gridSettings.width; ++x) {
            const cell = cells[y * gridSettings.width + x];
            if (cell == null) {
                continue;
            }

            const px = x * CELL_SIZE + borderWidth / 2;
            const py = y * CELL_SIZE + borderWidth / 2;

            ctx.fillStyle = BORDER_STROKE_COLOR;
            ctx.fillText(
                (cell + 1).toString(),
                px + CELL_SIZE / 2,
                py + CELL_SIZE / 2
            );
        }
    }
}

function drawGridView(
    ctx: CanvasRenderingContext2D,
    parts: Part[],
    colors: string[],
    requirements: Requirement[],
    cells: (number | null)[],
    gridSettings: GridSettings
) {
    const borderWidth = CELL_SIZE / 12;

    ctx.lineWidth = borderWidth;

    // First pass: draw background.
    ctx.strokeStyle = BORDER_STROKE_COLOR;
    ctx.fillStyle = BG_FILL_COLOR;
    for (let y = 0; y < gridSettings.height; ++y) {
        for (let x = 0; x < gridSettings.width; ++x) {
            const px = x * CELL_SIZE + borderWidth / 2;
            const py = y * CELL_SIZE + borderWidth / 2;

            if (
                gridSettings.hasOob &&
                ((x == 0 && y == 0) ||
                    (x == 0 && y == gridSettings.height - 1) ||
                    (x == gridSettings.width - 1 && y == 0) ||
                    (x == gridSettings.width - 1 &&
                        y == gridSettings.height - 1))
            ) {
                continue;
            }

            ctx.fillRect(px, py, CELL_SIZE, CELL_SIZE);

            // top
            ctx.strokeRect(px, py, CELL_SIZE, 1);

            // bottom
            ctx.strokeRect(px, py + CELL_SIZE, CELL_SIZE, 1);

            // left
            ctx.strokeRect(px, py, 1, CELL_SIZE);

            // right
            ctx.strokeRect(px + CELL_SIZE, py, 1, CELL_SIZE);
        }
    }

    // Second pass: draw squares.
    for (let y = 0; y < gridSettings.height; ++y) {
        for (let x = 0; x < gridSettings.width; ++x) {
            const cell = cells[y * gridSettings.width + x];
            if (cell == null) {
                continue;
            }

            const requirement = requirements[cell];
            const part = parts[requirement.partIndex];
            const color = COLORS[colors[part.color] as keyof typeof COLORS];

            const px = x * CELL_SIZE + borderWidth / 2;
            const py = y * CELL_SIZE + borderWidth / 2;

            ctx.fillStyle = color.solid;
            ctx.strokeStyle = color.plus;

            ctx.fillRect(px, py, CELL_SIZE, CELL_SIZE);

            ctx.strokeRect(px, py, CELL_SIZE, 1);
            ctx.strokeRect(px, py + CELL_SIZE, CELL_SIZE, 1);
            ctx.strokeRect(px, py, 1, CELL_SIZE);
            ctx.strokeRect(px + CELL_SIZE, py, 1, CELL_SIZE);
            if (!part.isSolid) {
                ctx.strokeRect(px, py + CELL_SIZE / 2, CELL_SIZE, 1);
                ctx.strokeRect(px + CELL_SIZE / 2, py, 1, CELL_SIZE);
            }
        }
    }

    // Third pass: draw borders.
    ctx.strokeStyle = BORDER_STROKE_COLOR;

    for (let y = 0; y < gridSettings.height; ++y) {
        for (let x = 0; x < gridSettings.width; ++x) {
            const cell = cells[y * gridSettings.width + x];
            if (cell == null) {
                continue;
            }

            const px = x * CELL_SIZE + borderWidth / 2;
            const py = y * CELL_SIZE + borderWidth / 2;

            // top
            if (y == 0 || cells[(y - 1) * gridSettings.width + x] != cell) {
                ctx.strokeRect(px, py, CELL_SIZE, 1);
            }

            // bottom
            if (
                y == gridSettings.height - 1 ||
                cells[(y + 1) * gridSettings.width + x] != cell
            ) {
                ctx.strokeRect(px, py + CELL_SIZE, CELL_SIZE, 1);
            }

            // left
            if (x == 0 || cells[y * gridSettings.width + (x - 1)] != cell) {
                ctx.strokeRect(px, py, 1, CELL_SIZE);
            }

            // right
            if (
                x == gridSettings.width - 1 ||
                cells[y * gridSettings.width + (x + 1)] != cell
            ) {
                ctx.strokeRect(px + CELL_SIZE, py, 1, CELL_SIZE);
            }
        }
    }

    // Fourth pass: draw command line.
    const commandLinePy =
        gridSettings.commandLineRow * CELL_SIZE + borderWidth / 2;
    ctx.strokeRect(
        0,
        commandLinePy + (CELL_SIZE * 1.0) / 4.0,
        gridSettings.width * CELL_SIZE + borderWidth,
        1
    );
    ctx.strokeRect(
        0,
        commandLinePy + (CELL_SIZE * 3.0) / 4.0,
        gridSettings.width * CELL_SIZE + borderWidth,
        1
    );

    // Fifth pass: draw out of bounds overlay.
    if (gridSettings.hasOob) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
        ctx.beginPath();
        ctx.rect(
            CELL_SIZE,
            0,
            (gridSettings.width - 2) * CELL_SIZE + borderWidth,
            CELL_SIZE + borderWidth * 2 - borderWidth
        );
        ctx.rect(
            CELL_SIZE,
            gridSettings.height * CELL_SIZE - CELL_SIZE,
            (gridSettings.width - 2) * CELL_SIZE + borderWidth,
            CELL_SIZE + borderWidth * 2 - borderWidth
        );
        ctx.rect(
            gridSettings.width * CELL_SIZE - CELL_SIZE,
            CELL_SIZE,
            CELL_SIZE + borderWidth * 2 - borderWidth,
            (gridSettings.height - 2) * CELL_SIZE + borderWidth
        );
        ctx.rect(
            0,
            CELL_SIZE,
            CELL_SIZE + borderWidth * 2 - borderWidth,
            (gridSettings.height - 2) * CELL_SIZE + borderWidth
        );
        ctx.closePath();
        ctx.fill();
    }
}

function Navicust({
    parts,
    colors,
    requirements,
    cells,
    gridSettings,
}: {
    parts: Part[];
    colors: string[];
    requirements: Requirement[];
    cells: (number | null)[];
    gridSettings: GridSettings;
}) {
    const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
    const numbersCanvasRef = React.useRef<HTMLCanvasElement | null>(null);
    React.useEffect(() => {
        drawGridView(
            canvasRef.current!.getContext("2d")!,
            parts,
            colors,
            requirements,
            cells,
            gridSettings
        );
        drawGridNumbers(
            numbersCanvasRef.current!.getContext("2d")!,
            cells,
            gridSettings
        );
    }, []);

    const borderWidth = CELL_SIZE / 12;

    const width = gridSettings.width * CELL_SIZE + borderWidth;
    const height = gridSettings.height * CELL_SIZE + borderWidth;

    return (
        <div
            style={{
                display: "flex",
                justifyContent: "center",
                width: "100%",
                overflow: "hidden",
            }}
        >
            <div
                style={{
                    position: "relative",
                    width: "100%",
                    maxWidth: width / 2,
                    aspectRatio: `${width} / ${height}`,
                }}
            >
                <canvas
                    ref={canvasRef}
                    width={width}
                    height={height}
                    style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        height: "100%",
                        display: "block",
                    }}
                />
                <canvas
                    ref={numbersCanvasRef}
                    width={width}
                    height={height}
                    style={{
                        pointerEvents: "none",
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        height: "100%",
                        display: "block",
                    }}
                />
            </div>
        </div>
    );
}

const NavicustPlaceholder = React.forwardRef(
    (
        { gridSettings }: { gridSettings: GridSettings },
        ref: React.Ref<HTMLDivElement>
    ) => {
        const borderWidth = CELL_SIZE / 12;
        const width = gridSettings.width * CELL_SIZE + borderWidth;
        const height = gridSettings.height * CELL_SIZE + borderWidth;

        return (
            <div
                ref={ref}
                className="d-flex justify-content-center align-items-center"
                style={{
                    width: "100%",
                    maxWidth: width / 2,
                    aspectRatio: `${width} / ${height}`,
                    margin: "0 auto",
                }}
            >
                <div className="spinner-border" />
            </div>
        );
    }
);

function Results({
    problem,
    data,
    onNavigateToSetup,
    onExportSav,
    onSolutionFound,
    initialSolution,
}: {
    problem: Problem;
    data: Data;
    onNavigateToSetup?: () => void;
    onExportSav?: (solution: Solution, index: number) => void;
    onSolutionFound?: (solution: Solution) => void;
    initialSolution?: Solution;
}) {
    const { lang } = useLang();
    const gs = makeGridSettings(data, problem);

    const [pending, setPending] = React.useState(false);
    const [done, setDone] = React.useState(false);
    const [solutions, setSolutions] = React.useState<Solution[]>(initialSolution ? [initialSolution] : []);
    const solverRef = React.useRef<AsyncSolver | null>(null);

    const { ref, inView } = useInView({});

    React.useEffect(() => {
        if (problem.requirements.length == 0) {
            setDone(true);
            return;
        }

        const solver = new AsyncSolver(
            data.parts,
            problem.requirements,
            gs,
            problem.spinnableColors
        );

        solverRef.current = solver;

        return () => {
            solver.terminate();
        };
    }, [problem, data, setSolutions, setDone]);

    React.useEffect(() => {
        (async () => {
            if (solverRef.current == null || done || pending || !inView) {
                return;
            }
            setPending(true);
            let { done: nextDone, value } = await solverRef.current.next();
            if (nextDone) {
                setDone(true);
            } else {
                setSolutions((solutions) => {
                    if (solutions.length === 0 && onSolutionFound) {
                        onSolutionFound(value);
                    }
                    return [...solutions, value];
                });
            }
            setPending(false);
        })();
    }, [inView, done, pending, setDone, setSolutions, onSolutionFound]);

    return (
        <div>
            {onNavigateToSetup ? (
                <div className="d-lg-none mb-3">
                    <button
                        type="button"
                        className="btn btn-outline-secondary btn-sm"
                        onClick={onNavigateToSetup}
                    >
                        ← {t("backToSetup", lang)}
                    </button>
                </div>
            ) : null}

            <div
                style={{
                    display: "grid",
                    gridTemplateColumns:
                        "repeat(auto-fit, minmax(min(100%, 360px), 1fr))",
                    gap: "1.25rem",
                }}
            >
                {solutions.length > 0 ? (
                    solutions.map((solution, i) => {
                        const cells = placeAll(
                            data.parts,
                            problem.requirements,
                            solution as Solution,
                            gs
                        );
                        const analysis = analyzeSolutionBugs(
                            data.gameId,
                            data.partMetas,
                            problem.requirements,
                            cells,
                            gs,
                            lang,
                            problem.modCards
                        );

                        return (
                            <div
                                className="card shadow-sm p-3 bg-body-tertiary"
                                style={{ overflow: "hidden" }}
                                key={i}
                            >
                                <div className="d-flex justify-content-between align-items-center mb-2">
                                    <span className="fw-bold small text-muted text-uppercase">
                                        {t("solution", lang)} #{i + 1}
                                    </span>
                                    <div className="d-flex align-items-center gap-2">
                                        <SolutionBugStatus analysis={analysis} lang={lang} />
                                        {onExportSav ? (
                                            <button
                                                type="button"
                                                className="btn btn-sm btn-outline-success py-0 px-2 fw-semibold"
                                                onClick={() => onExportSav(solution as Solution, i)}
                                                title={t("exportSav", lang)}
                                                style={{ fontSize: "0.8rem", height: "24px" }}
                                            >
                                                {t("exportSav", lang)}
                                            </button>
                                        ) : null}
                                    </div>
                                </div>
                                <div style={{ display: "flex", justifyContent: "center" }}>
                                    <Navicust
                                        parts={data.parts}
                                        colors={data.colors}
                                        requirements={problem.requirements}
                                        gridSettings={gs}
                                        cells={cells}
                                    />
                                </div>
                                <BuildStatsView data={data} problem={problem} solution={solution} />
                                <SolutionBugDetails analysis={analysis} lang={lang} />
                            </div>
                        );
                    })
                ) : done ? (
                    problem.requirements.length > 0 ? (
                        <div key="no-results" className="alert alert-danger">
                            {t("noSolutions", lang)}
                        </div>
                    ) : (
                        <div key="no-requirements" className="alert alert-info">
                            {t("selectPartsToSolve", lang)}
                        </div>
                    )
                ) : null}
                {done ? null : <NavicustPlaceholder ref={ref} gridSettings={gs} />}
            </div>
        </div>
    );
}

function MobileNav({
    tab,
    setTab,
    hasError,
}: {
    tab: "setup" | "results";
    setTab: (tab: "setup" | "results") => void;
    hasError?: boolean;
}) {
    const { lang } = useLang();
    return (
        <div className="d-lg-none mb-2">
            <ul className="nav nav-pills nav-fill bg-body-tertiary p-1 rounded border">
                <li className="nav-item">
                    <button
                        type="button"
                        className={`nav-link py-1 ${tab === "setup" ? "active" : ""}`}
                        onClick={() => setTab("setup")}
                    >
                        ⚙️ {t("tabSetup", lang)}
                    </button>
                </li>
                <li className="nav-item">
                    <button
                        type="button"
                        className={`nav-link py-1 ${tab === "results" ? "active" : ""}`}
                        onClick={() => setTab("results")}
                    >
                        🧩 {t("tabSolutions", lang)}
                        {hasError ? (
                            <span className="badge bg-danger ms-1">!</span>
                        ) : null}
                    </button>
                </li>
            </ul>
        </div>
    );
}

const DEFAULT_SIDEBAR_WIDTH = 40;
const MIN_SIDEBAR_WIDTH_PX = 300;
const MIN_MAIN_WIDTH_PX = 420;

function getInitialSidebarWidth(): number {
    try {
        const saved = localStorage.getItem("fullcust_sidebar_width");
        if (saved) {
            const val = parseFloat(saved);
            if (!isNaN(val) && val >= 15 && val <= 85) return val;
        }
    } catch (e) {}
    return DEFAULT_SIDEBAR_WIDTH;
}

function App() {
    const [theme, setTheme] = React.useState<Theme>(getInitialTheme);
    const toggleTheme = React.useCallback(() => {
        setTheme(prev => {
            const next = prev === "dark" ? "light" : "dark";
            applyTheme(next);
            return next;
        });
    }, []);

    const [sidebarWidth, setSidebarWidth] = React.useState<number>(getInitialSidebarWidth);
    const [isDraggingSplitter, setIsDraggingSplitter] = React.useState(false);

    React.useEffect(() => {
        document.documentElement.style.setProperty("--sidebar-width", `${sidebarWidth}%`);
    }, [sidebarWidth]);

    const resetSidebarWidth = React.useCallback(() => {
        setSidebarWidth(DEFAULT_SIDEBAR_WIDTH);
        try {
            localStorage.setItem("fullcust_sidebar_width", DEFAULT_SIDEBAR_WIDTH.toString());
            document.documentElement.style.setProperty("--sidebar-width", `${DEFAULT_SIDEBAR_WIDTH}%`);
        } catch (e) {}
    }, []);

    const handleDrag = React.useCallback((clientX: number) => {
        const windowWidth = window.innerWidth;
        if (windowWidth < 992) return;

        const minPct = Math.max(15, (MIN_SIDEBAR_WIDTH_PX / windowWidth) * 100);
        const maxPct = Math.min(85, ((windowWidth - MIN_MAIN_WIDTH_PX) / windowWidth) * 100);

        const rawPct = (clientX / windowWidth) * 100;
        const clampedPct = Math.max(minPct, Math.min(maxPct, rawPct));

        setSidebarWidth(clampedPct);
        document.documentElement.style.setProperty("--sidebar-width", `${clampedPct}%`);
    }, []);

    const startResizing = React.useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        setIsDraggingSplitter(true);
        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none";

        const onMouseMove = (moveEvent: MouseEvent) => {
            handleDrag(moveEvent.clientX);
        };

        const onMouseUp = () => {
            setIsDraggingSplitter(false);
            document.body.style.cursor = "";
            document.body.style.userSelect = "";
            window.removeEventListener("mousemove", onMouseMove);
            window.removeEventListener("mouseup", onMouseUp);

            setSidebarWidth(current => {
                try {
                    localStorage.setItem("fullcust_sidebar_width", current.toFixed(2));
                } catch (err) {}
                return current;
            });
        };

        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);
    }, [handleDrag]);

    const startTouchResizing = React.useCallback((e: React.TouchEvent) => {
        if (e.touches.length !== 1) return;
        setIsDraggingSplitter(true);

        const onTouchMove = (moveEvent: TouchEvent) => {
            if (moveEvent.touches.length === 1) {
                handleDrag(moveEvent.touches[0].clientX);
            }
        };

        const onTouchEnd = () => {
            setIsDraggingSplitter(false);
            window.removeEventListener("touchmove", onTouchMove);
            window.removeEventListener("touchend", onTouchEnd);

            setSidebarWidth(current => {
                try {
                    localStorage.setItem("fullcust_sidebar_width", current.toFixed(2));
                } catch (err) {}
                return current;
            });
        };

        window.addEventListener("touchmove", onTouchMove);
        window.addEventListener("touchend", onTouchEnd);
    }, [handleDrag]);

    const [lang, setLangState] = React.useState<Lang>(getInitialLang);
    const [mobileTab, setMobileTab] = React.useState<"setup" | "results">("setup");
    const setLang = React.useCallback((newLang: Lang) => {
        setLangState(newLang);
        setPersistedLang(newLang);
    }, []);

    const [data, setData] = React.useState<Data | null>(null);
    const [problem, setProblem] = React.useState<Problem | null>(null);
    const [error, setError] = React.useState<string | null>(null);

    const [isBuildLibraryOpen, setIsBuildLibraryOpen] = React.useState(false);
    const [exportSavTarget, setExportSavTarget] = React.useState<{ solution: Solution; index: number } | null>(null);
    const [optimizedLayout, setOptimizedLayout] = React.useState<{ problem: Problem; solution: Solution } | null>(null);
    const [latestSolution, setLatestSolution] = React.useState<Solution | undefined>(undefined);

    React.useEffect(() => {
        let cancelled = false;
        if (!gameDefinition) {
            setError(`Unknown game: ${game}`);
            return;
        }
        loadGame(gameDefinition).then(loaded => {
            if (!cancelled) setData(loaded);
        }).catch(reason => {
            if (!cancelled) {
                console.error(reason);
                setError("Unable to load game data. Please reload the page.・データを読み込めません。再読み込みしてください。・无法加载游戏数据，请刷新页面。");
            }
        });
        return () => { cancelled = true; };
    }, []);

    React.useEffect(() => {
        if (!data) return;
        const loadBuildId = queryParams.get("loadBuild");
        if (loadBuildId) {
            const allSaved = getSavedBuilds();
            const found = allSaved.find(b => b.id === loadBuildId);
            if (found && found.gameId === data.gameId) {
                try {
                    const { problem: loadedProblem } = buildDataToProblem(found, data);
                    setProblem(loadedProblem);
                    const nextUrl = new URL(window.location.href);
                    nextUrl.searchParams.delete("loadBuild");
                    window.history.replaceState({}, "", nextUrl.toString());
                } catch (e) {
                    console.error("Failed to load build from param:", e);
                }
            }
        }
    }, [data]);

    React.useEffect(() => {
        if (!data) return;
        const onHashChange = () => {
            try {
                const restored = problemFromHash(window.location.hash, data);
                setProblem(previous =>
                    previous && toHashString(previous, data) === toHashString(restored, data)
                        ? previous : restored
                );
                setError(null);
            } catch (reason) {
                console.error(reason);
                setProblem(null);
                setError("This shared layout is invalid or unavailable for this game.・共有データが無効、またはこのゲームに対応していません。・此分享配置无效或不适用于当前游戏。");
            }
        };
        onHashChange();
        window.addEventListener("hashchange", onHashChange);
        return () => window.removeEventListener("hashchange", onHashChange);
    }, [data]);

    React.useEffect(() => {
        if (!data || !problem) return;
        window.location.hash = toHashString(problem, data);
    }, [data, problem]);

    const compatibility = data && problem ? colorCompatibility(data, problem) : null;
    const compatibilityError = compatibility ? compatibility.error : null;

    return (
        <LangContext.Provider value={{ lang, setLang }}>
            <div style={{ "--sidebar-width": `${sidebarWidth}%` } as React.CSSProperties}>
                <div
                    className={`sidebar-panel d-flex flex-column p-2 ${
                        mobileTab === "setup" ? "" : "d-none d-lg-flex"
                    }`}
                >
                    <div className="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
                        <h1 className="h4 mb-0">
                            fullcust{" "}
                            <small className="text-muted">
                                {t("titleSub", lang)}
                            </small>
                        </h1>
                        <div className="d-flex align-items-center gap-2">
                            <button
                                type="button"
                                className="btn btn-outline-primary btn-sm d-flex align-items-center gap-1"
                                onClick={() => setIsBuildLibraryOpen(true)}
                                title={t("buildLibrary", lang)}
                            >
                                <span>📁</span>
                                <span className="d-none d-sm-inline">{t("buildLibrary", lang)}</span>
                            </button>
                            <button
                                type="button"
                                className="btn btn-outline-secondary btn-sm"
                                onClick={toggleTheme}
                                title={theme === "dark" ? t("themeSwitchToLight", lang) : t("themeSwitchToDark", lang)}
                                aria-label={theme === "dark" ? t("themeSwitchToLight", lang) : t("themeSwitchToDark", lang)}
                            >
                                {theme === "dark" ? "☀️" : "🌙"}
                            </button>
                            <div className="btn-group btn-group-sm" role="group" aria-label="Language selector">
                                <button
                                    type="button"
                                    className={`btn ${lang === "en" ? "btn-primary" : "btn-outline-secondary"}`}
                                    onClick={() => setLang("en")}
                                >
                                    EN
                                </button>
                                <button
                                    type="button"
                                    className={`btn ${lang === "ja" ? "btn-primary" : "btn-outline-secondary"}`}
                                    onClick={() => setLang("ja")}
                                >
                                    日本語
                                </button>
                                <button
                                    type="button"
                                    className={`btn ${lang === "zh" ? "btn-primary" : "btn-outline-secondary"}`}
                                    onClick={() => setLang("zh")}
                                >
                                    中文
                                </button>
                            </div>
                        </div>
                    </div>
                    <MobileNav
                        tab={mobileTab}
                        setTab={setMobileTab}
                        hasError={Boolean(compatibilityError)}
                    />
                    <ul id="games-nav" className="nav nav-pills mb-2 flex-wrap">
                        {games.map(({ id: key, label }) => (
                            <li className="nav-item" key={key}>
                                <a
                                    className={`nav-link ${
                                        game == key ? "active" : ""
                                    }`}
                                    href={`?game=${key}`}
                                >
                                    {tBilingual(label, lang)}
                                </a>
                            </li>
                        ))}
                    </ul>
                    {error ? (
                        <div className="alert alert-danger" role="alert">
                            {tBilingual(error, lang)}
                            {data ? (
                                <button className="btn btn-sm btn-outline-danger d-block mt-2"
                                    onClick={() => {
                                        setError(null);
                                        setProblem(emptyProblem(data));
                                    }}>
                                    {t("startNewLayout", lang)}
                                </button>
                            ) : null}
                        </div>
                    ) : null}
                    {data != null && problem != null ? (
                        <PartSelector
                            data={data}
                            problem={problem}
                            onChange={(problem, solution) => {
                                setOptimizedLayout(solution ? { problem, solution } : null);
                                setLatestSolution(solution);
                                setProblem(problem);
                            }}
                            onNavigateToResults={() => setMobileTab("results")}
                        />
                    ) : null}
                </div>
                <div
                    className={`split-resizer ${isDraggingSplitter ? "is-dragging" : ""}`}
                    onMouseDown={startResizing}
                    onTouchStart={startTouchResizing}
                    onDoubleClick={resetSidebarWidth}
                    title={
                        lang === "zh"
                            ? "拖动调整左右视窗宽度（双击恢复默认40%）"
                            : lang === "ja"
                            ? "左右パネル幅をドラッグで調整（ダブルクリックで40%に戻す）"
                            : "Drag to resize panels (Double-click to reset to 40%)"
                    }
                    role="separator"
                    aria-orientation="vertical"
                    aria-label="Panel resize handle"
                >
                    <div className="split-resizer-handle" />
                </div>
                <div
                    className={`main-panel container-fluid my-2 ${
                        mobileTab === "results" ? "" : "d-none d-lg-block"
                    }`}
                >
                    <MobileNav
                        tab={mobileTab}
                        setTab={setMobileTab}
                        hasError={Boolean(compatibilityError)}
                    />
                    {compatibilityError ? (
                        <div className="alert alert-warning" role="alert">
                            <div>{tBilingual(compatibilityError, lang)}</div>
                            {compatibility && compatibility.offColorParts.length > 0 ? (
                                <div className="mt-2 fw-semibold">
                                    {t("incompatibleParts", lang)}: {[...new Set(compatibility.offColorParts.map(req => getPartName(data!.partMetas[req.partIndex], lang)))].join(", ")}
                                </div>
                            ) : null}
                        </div>
                    ) : data != null && problem != null ? (
                        <Results
                            key={JSON.stringify([problem, optimizedLayout?.problem === problem ? optimizedLayout.solution : null])}
                            initialSolution={optimizedLayout?.problem === problem ? optimizedLayout.solution : undefined}
                            data={data}
                            problem={problem}
                            onNavigateToSetup={() => setMobileTab("setup")}
                            onExportSav={(solution, index) => setExportSavTarget({ solution, index })}
                            onSolutionFound={(solution) => setLatestSolution(solution)}
                        />
                    ) : null}
                    <footer className="mt-4 pt-3 pb-4 border-top text-center text-muted small">
                        <div className="d-flex flex-wrap justify-content-center align-items-center gap-3 mb-1">
                            <a
                                href="https://github.com/masuexe/fullcust"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-decoration-none text-muted"
                            >
                                fullcust GitHub
                            </a>
                            <span>•</span>
                            <span>
                                {t("saveCreditTitle", lang)}{" "}
                                <a
                                    href="https://github.com/ore4545"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-decoration-none fw-semibold"
                                >
                                    ore4545
                                </a>{" "}
                                &amp;{" "}
                                <a
                                    href="https://github.com/tangobattle/tango"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-decoration-none fw-semibold"
                                >
                                    Tango (N1GP)
                                </a>
                            </span>
                        </div>
                        <div className="opacity-75" style={{ fontSize: "0.75rem" }}>
                            Mega Man Battle Network / Rockman EXE © Capcom. This is a non-commercial fan tool.
                        </div>
                    </footer>
                </div>
                {data && problem ? (
                    <BuildLibraryModal
                        isOpen={isBuildLibraryOpen}
                        onClose={() => setIsBuildLibraryOpen(false)}
                        data={data}
                        problem={problem}
                        solution={latestSolution}
                        onLoadProblem={(p) => setProblem(p)}
                        lang={lang}
                    />
                ) : null}
                {data && problem && exportSavTarget ? (
                    <SaveExportModal
                        isOpen={Boolean(exportSavTarget)}
                        onClose={() => setExportSavTarget(null)}
                        data={data}
                        problem={problem}
                        solution={exportSavTarget.solution}
                        solutionIndex={exportSavTarget.index}
                        lang={lang}
                    />
                ) : null}
            </div>
        </LangContext.Provider>
    );
}

createRoot(document.getElementById("main")!).render(<App />);
