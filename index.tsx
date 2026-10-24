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
} from "./problem";
import {
    computeBuildStats,
    tAbility,
    analyzeSolutionBugs,
    SolutionBugAnalysis,
    tBugCause,
    tBugTitle,
    tBugMechanics,
} from "./effects";
import {
    BN6_MOD_CARDS,
    computeDeckStats,
    getCardDisplayName,
    getModCard,
    ModCard,
    searchModCards,
} from "./modcards";

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
}: {
    data: Data;
    problem: Problem;
}) {
    const { lang } = useLang();
    const partIds = problem.requirements.map(req => data.partMetas[req.partIndex].id);
    const stats = computeBuildStats(data.gameId, partIds, problem.modCards);

    const hasAnyStats = stats.hp !== 0 || stats.hpPercent !== 0 ||
        stats.attack > 1 || stats.rapid > 1 || stats.charge > 1 ||
        stats.custom > 5 || stats.megaFolder !== 5 || stats.gigaFolder > 1 ||
        stats.abilities.length > 0 || (stats.modMbUsed !== undefined && stats.modMbUsed > 0);
    if (!hasAnyStats && problem.requirements.length === 0) return null;

    return (
        <div className="card mb-3 p-2 bg-body-tertiary">
            <div className="d-flex justify-content-between align-items-center mb-2">
                <span className="fw-semibold small text-muted text-uppercase">
                    📊 {t("buildStats", lang)}
                </span>
                {stats.modMbUsed !== undefined && stats.modMbUsed > 0 ? (
                    <span className={`badge ${stats.modMbUsed > 80 ? "bg-danger" : "bg-dark border border-primary text-light"} py-1 px-2`}>
                        🎴 {t("modCards", lang)}: {stats.modMbUsed} / 80 MB
                    </span>
                ) : null}
            </div>

            <div className="d-flex flex-wrap gap-2 small align-items-center">
                {stats.hp !== 0 || stats.hpPercent !== 0 ? (
                    <span className={`badge ${stats.hp < 0 || stats.hpPercent < 0 ? "bg-danger" : "bg-success"} py-1 px-2`}>
                        HP {stats.hp >= 0 ? "+" : ""}{stats.hp}
                        {stats.hpPercent !== 0 ? ` (${stats.hpPercent >= 0 ? "+" : ""}${stats.hpPercent}%)` : ""}
                    </span>
                ) : null}
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

    const activeModBugs = (analysis.activeBugs || []).filter(b => b.isModCardBug);
    if (analysis.bugStopActive && activeModBugs.length === 0 && !analysis.tooManyColors) {
        return <span className="badge bg-info text-dark px-2 py-1">🛡️ {t("bugStopActive", lang)}</span>;
    }

    if (analysis.bugStopActive && activeModBugs.length > 0) {
        return (
            <div className="d-flex gap-1 align-items-center flex-wrap">
                <span className="badge bg-info text-dark px-2 py-1">🛡️ {t("bugStopActive", lang)}</span>
                <span className="badge bg-secondary px-2 py-1">🎴 {activeModBugs.length} {t("modCardBugs", lang)}</span>
            </div>
        );
    }

    const totalActive = (analysis.activeBugs?.length ?? analysis.bugs.length) + (analysis.tooManyColors ? 1 : 0);
    const maxLevel = Math.max(0, ...(analysis.activeBugs || []).map(b => b.level));
    const levelLabel = totalActive === 1 && maxLevel > 1 ? ` (Lv${maxLevel})` : "";

    return (
        <span className="badge bg-secondary px-2 py-1">
            ⚙️ {totalActive} {t("bugsDetected", lang)}{levelLabel}
        </span>
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

    const totalActive = (analysis.activeBugs?.length ?? analysis.bugs.length) + (analysis.tooManyColors ? 1 : 0);
    const maxLevel = Math.max(0, ...(analysis.activeBugs || []).map(b => b.level));
    const levelLabel = totalActive === 1 && maxLevel > 1 ? ` (Lv${maxLevel})` : "";

    return (
        <div className="mt-2 text-start">
            <button
                type="button"
                className="btn btn-sm btn-outline-secondary w-100 d-flex justify-content-between align-items-center py-1"
                onClick={() => setOpen(prev => !prev)}
            >
                <span className="small">
                    ⚙️ {totalActive} {t("bugsDetected", lang)}{levelLabel}
                    {analysis.bugStopActive ? ` (${t("bugStopActive", lang)})` : ""}
                </span>
                <span className="small">{open ? "▲" : "▼"}</span>
            </button>
            {open ? (
                <div className="p-2 border rounded mt-1 bg-body-tertiary small">
                    {analysis.bugStopActive ? (
                        <div className="alert alert-info py-1 px-2 mb-2 small">
                            🛡️ {t("bugStopNeutralizedNotice", lang)}
                        </div>
                    ) : null}

                    {analysis.repairedBugsNotice && analysis.repairedBugsNotice.length > 0 ? (
                        <div className="alert alert-success py-1 px-2 mb-2 small">
                            ✨ {analysis.repairedBugsNotice.map(r => `${lang === "zh" ? "改造卡修复" : lang === "ja" ? "改造カード修復" : "Card Repair"}: ${r}`).join("、")}
                        </div>
                    ) : null}

                    {analysis.tooManyColors ? (
                        <div className="mb-2 pb-2 border-bottom">
                            <div className="fw-bold">
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

                    {analysis.activeBugs && analysis.activeBugs.length > 0 ? (
                        analysis.activeBugs.map((ab, idx) => (
                            <div key={idx} className={idx < analysis.activeBugs.length - 1 ? "mb-2 pb-2 border-bottom" : ""}>
                                <div className="fw-bold">
                                    ⚙️ {ab.title}
                                </div>
                                <div className="text-muted">
                                    {t("bugOrigin", lang)}: {ab.isModCardBug ? (
                                        <span className="fw-semibold text-primary">{t("cardSource", lang)}: {ab.sourceCardName}</span>
                                    ) : (
                                        ab.parts.map(p => `${p.partName} (${p.causes.map(c => tBugCause(c, lang)).join(", ")})`).join("、")
                                    )}
                                </div>
                                <div className="mt-1">
                                    {t("bugMechanics", lang)}: <span className="fw-semibold text-body">{ab.mechanics}</span>
                                </div>
                            </div>
                        ))
                    ) : (
                        analysis.bugs.map((b, idx) => (
                            <div key={idx} className={idx < analysis.bugs.length - 1 ? "mb-2 pb-2 border-bottom" : ""}>
                                <div className="fw-bold">
                                    ⚙️ {b.bugTitle || tBugTitle(b.bugType, lang)}
                                </div>
                                <div className="text-muted">
                                    {t("bugOrigin", lang)}: <span className="fw-semibold">{b.partName}</span> ({b.causes.map(c => tBugCause(c, lang)).join(", ")})
                                </div>
                                <div className="mt-1">
                                    {t("bugMechanics", lang)}: <span className="fw-semibold text-body">{b.bugMechanics || tBugMechanics(b.bugType, lang)}</span>
                                </div>
                            </div>
                        ))
                    )}
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
    const cardIds = problem.modCards || [];
    const deck = computeDeckStats(cardIds);
    const [selectedCardToAdd, setSelectedCardToAdd] = React.useState<string>("");
    const [searchQuery, setSearchQuery] = React.useState<string>("");
    const [categoryFilter, setCategoryFilter] = React.useState<string>("all");

    const searchResult = React.useMemo(() => {
        return searchModCards(searchQuery, categoryFilter, lang);
    }, [searchQuery, categoryFilter, lang]);

    const activeBuildAbilities = React.useMemo(() => {
        if (!data) return deck.activeAbilities;
        const partIds = problem.requirements
            .map(r => data.partMetas[r.partIndex]?.id)
            .filter((id): id is number => id != null);
        return computeBuildStats(data.gameId, partIds, problem.modCards).abilities;
    }, [data, problem.requirements, problem.modCards, deck.activeAbilities]);

    const handleAddCard = (cid: string) => {
        if (!cid) return;
        onChange({
            ...problem,
            modCards: [...cardIds, cid],
        });
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

    const percentUsed = Math.min(100, Math.round((deck.totalMb / 80) * 100));
    const isOver = deck.totalMb > 80;

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
                        <span className={`badge ${isOver ? "bg-danger" : deck.totalMb > 0 ? "bg-primary" : "bg-secondary"} ms-auto me-2`}>
                            {deck.totalMb} / 80 MB ({cardIds.length})
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
                        {/* MB Capacity Progress Bar */}
                        <div className="mb-2">
                            <div className="d-flex justify-content-between small text-muted mb-1">
                                <span>{t("modCapacity", lang)}</span>
                                <span className={isOver ? "text-danger fw-bold" : "fw-semibold"}>
                                    {deck.totalMb} / 80 MB {isOver ? `(${t("capacityExceeded", lang)})` : `(${80 - deck.totalMb} MB left)`}
                                </span>
                            </div>
                            <div className="progress" style={{ height: "8px" }}>
                                <div
                                    className={`progress-bar ${isOver ? "bg-danger" : percentUsed >= 90 ? "bg-warning" : "bg-success"}`}
                                    role="progressbar"
                                    style={{ width: `${percentUsed}%` }}
                                    aria-valuenow={deck.totalMb}
                                    aria-valuemin={0}
                                    aria-valuemax={80}
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
                                    const card = getModCard(cid);
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
                                                    <span className="fw-bold small">{cardName}</span>
                                                    <span className="badge bg-primary text-light" style={{ fontSize: "0.75rem" }}>
                                                        {card.mb} MB
                                                    </span>
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
                                        <option value="part1">{t("part1Cards", lang)}</option>
                                        <option value="part2">{t("part2Cards", lang)}</option>
                                        <option value="promo">{t("promoCards", lang)}</option>
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
                                                                [{c.mb} MB] #{c.cardNo} {cName} ({c.id}) 🟢 [ON]
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
                                                                [{c.mb} MB] #{c.cardNo} {cName} ({c.id}) 🔴 [OFF]
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
                                                                [{c.mb} MB] #{c.cardNo} {cName} ({c.id})
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
                                                    [{c.mb} MB] #{c.cardNo} {cName} ({c.id})
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
                                const card = getModCard(selectedCardToAdd);
                                if (!card) return null;
                                const conflicts = (card.disabledAbilities || []).filter(a => activeBuildAbilities.includes(a));
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

function PartSelector({
    data,
    problem,
    onChange,
    onNavigateToResults,
}: {
    data: Data;
    problem: Problem;
    onChange: (problem: Problem) => void;
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

            <div className="overflow-auto flex-grow-1 mb-2">
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
                            className="accordion-button collapsed"
                            type="button"
                            data-bs-toggle="collapse"
                            data-bs-target="#extra-settings-body"
                            aria-expanded="false"
                            aria-controls="extra-settings-body"
                        >
                            {t("extraSettings", lang)}
                        </button>
                    </h2>
                    <div
                        id="extra-settings-body"
                        className="accordion-collapse collapse"
                        aria-labelledby="extra-settings-header"
                        data-bs-parent="#extra-settings"
                    >
                        <div className="accordion-body">
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

            {data.gameId === "bn6" ? (
                <ModCardManager problem={problem} onChange={onChange} lang={lang} data={data} />
            ) : null}

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
}: {
    problem: Problem;
    data: Data;
    onNavigateToSetup?: () => void;
}) {
    const { lang } = useLang();
    const gs = makeGridSettings(data, problem);

    const [pending, setPending] = React.useState(false);
    const [done, setDone] = React.useState(false);
    const [solutions, setSolutions] = React.useState<Solution[]>([]);
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
                setSolutions((solutions) => [...solutions, value]);
            }
            setPending(false);
        })();
    }, [inView, done, pending, setDone, setSolutions]);

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

            <BuildStatsView data={data} problem={problem} />
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
                                    <SolutionBugStatus analysis={analysis} lang={lang} />
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

function App() {
    const [theme, setTheme] = React.useState<Theme>(getInitialTheme);
    const toggleTheme = React.useCallback(() => {
        setTheme(prev => {
            const next = prev === "dark" ? "light" : "dark";
            applyTheme(next);
            return next;
        });
    }, []);

    const [lang, setLangState] = React.useState<Lang>(getInitialLang);
    const [mobileTab, setMobileTab] = React.useState<"setup" | "results">("setup");
    const setLang = React.useCallback((newLang: Lang) => {
        setLangState(newLang);
        setPersistedLang(newLang);
    }, []);

    const [data, setData] = React.useState<Data | null>(null);
    const [problem, setProblem] = React.useState<Problem | null>(null);
    const [error, setError] = React.useState<string | null>(null);

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
            <div>
                <div
                    className={`sidebar-panel d-flex flex-column p-2 ${
                        mobileTab === "setup" ? "" : "d-none d-lg-flex"
                    }`}
                >
                    <div className="d-flex justify-content-between align-items-center mb-2">
                        <h1 className="h4 mb-0">
                            fullcust{" "}
                            <small className="text-muted">
                                {t("titleSub", lang)}
                            </small>
                        </h1>
                        <div className="d-flex align-items-center gap-2">
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
                            onChange={(problem) => {
                                setProblem(problem);
                            }}
                            onNavigateToResults={() => setMobileTab("results")}
                        />
                    ) : null}
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
                            key={JSON.stringify(problem)}
                            data={data}
                            problem={problem}
                            onNavigateToSetup={() => setMobileTab("setup")}
                        />
                    ) : null}
                </div>
            </div>
        </LangContext.Provider>
    );
}

createRoot(document.getElementById("main")!).render(<App />);
