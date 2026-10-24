import React from "react";
import type { Data } from "./game-data";
import type { Problem } from "./problem";
import type { Solution } from "./solver";
import type { Lang } from "./i18n";
import { t, tBilingual, getPartName } from "./i18n";
import {
    COMMUNITY_PRESETS,
    FullCustBuild,
    buildDataToProblem,
    deleteBuildFromStorage,
    downloadBuildAsJson,
    copyBuildToClipboard,
    getSavedBuilds,
    parseBuildJson,
    problemToBuildData,
    saveBuildToStorage,
} from "./build-data";

export interface BuildLibraryModalProps {
    isOpen: boolean;
    onClose: () => void;
    data: Data;
    problem: Problem;
    solution?: Solution;
    onLoadProblem: (problem: Problem) => void;
    lang: Lang;
}

export function BuildLibraryModal({
    isOpen,
    onClose,
    data,
    problem,
    solution,
    onLoadProblem,
    lang,
}: BuildLibraryModalProps) {
    const [activeTab, setActiveTab] = React.useState<"presets" | "saved" | "importExport">("presets");
    const [savedBuilds, setSavedBuilds] = React.useState<FullCustBuild[]>([]);
    const [saveName, setSaveName] = React.useState<string>("");
    const [saveSuccessMsg, setSaveSuccessMsg] = React.useState<string | null>(null);

    // Import / Export state
    const [importText, setImportText] = React.useState<string>("");
    const [importError, setImportError] = React.useState<string | null>(null);
    const [importSuccess, setImportSuccess] = React.useState<string | null>(null);
    const [copied, setCopied] = React.useState<boolean>(false);

    // Load saved builds on open
    React.useEffect(() => {
        if (isOpen) {
            setSavedBuilds(getSavedBuilds());
            setSaveName(
                lang === "zh"
                    ? `${data.gameId.toUpperCase()} 构筑 - ${new Date().toLocaleDateString()}`
                    : lang === "ja"
                    ? `${data.gameId.toUpperCase()} ビルド - ${new Date().toLocaleDateString()}`
                    : `My ${data.gameId.toUpperCase()} Build - ${new Date().toLocaleDateString()}`
            );
            setImportError(null);
            setImportSuccess(null);
            setSaveSuccessMsg(null);
            setCopied(false);
        }
    }, [isOpen, data.gameId, lang]);

    // Close on Escape
    React.useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const currentPresets = COMMUNITY_PRESETS.filter(p => p.gameId === data.gameId);

    const handleSaveCurrentBuild = () => {
        const name = saveName.trim() || `Build (${data.gameId.toUpperCase()})`;
        const newBuild = problemToBuildData(problem, data, name, solution);
        saveBuildToStorage(newBuild);
        setSavedBuilds(getSavedBuilds());
        setSaveSuccessMsg(t("buildSaved", lang));
        setTimeout(() => setSaveSuccessMsg(null), 3000);
    };

    const handleDeleteBuild = (id: string) => {
        deleteBuildFromStorage(id);
        setSavedBuilds(getSavedBuilds());
    };

    const handleLoadPreset = (preset: FullCustBuild) => {
        try {
            const { problem: loadedProblem } = buildDataToProblem(preset, data);
            onLoadProblem(loadedProblem);
            onClose();
        } catch (err: any) {
            setImportError(err.message);
        }
    };

    const handleLoadSavedBuild = (build: FullCustBuild) => {
        if (build.gameId === data.gameId) {
            try {
                const { problem: loadedProblem } = buildDataToProblem(build, data);
                onLoadProblem(loadedProblem);
                onClose();
            } catch (err: any) {
                setImportError(err.message);
            }
        } else {
            // Cross-game switch
            window.location.href = `?game=${build.gameId}&loadBuild=${encodeURIComponent(build.id)}`;
        }
    };

    const handleCopyJson = async () => {
        try {
            const b = problemToBuildData(problem, data, saveName.trim() || "FullCust Build", solution);
            await copyBuildToClipboard(b);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            setImportError("Clipboard access failed");
        }
    };

    const handleExportJson = () => {
        const b = problemToBuildData(problem, data, saveName.trim() || "FullCust Build", solution);
        downloadBuildAsJson(b);
    };

    const handleExecuteImport = (rawText: string) => {
        setImportError(null);
        setImportSuccess(null);
        try {
            const parsed = parseBuildJson(rawText);
            if (parsed.gameId === data.gameId) {
                const { problem: loadedProblem } = buildDataToProblem(parsed, data);
                onLoadProblem(loadedProblem);
                setImportSuccess(t("importSuccess", lang));
                setTimeout(() => {
                    onClose();
                }, 800);
            } else {
                // Different game: save to storage and navigate
                saveBuildToStorage(parsed);
                setImportSuccess(`${t("importSuccess", lang)} (Switching to ${parsed.gameId.toUpperCase()}...)`);
                setTimeout(() => {
                    window.location.href = `?game=${parsed.gameId}&loadBuild=${encodeURIComponent(parsed.id)}`;
                }, 800);
            }
        } catch (err: any) {
            setImportError(err.message || t("importError", lang));
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            const content = event.target?.result as string;
            if (content) {
                setImportText(content);
                handleExecuteImport(content);
            }
        };
        reader.readAsText(file);
    };

    return (
        <div
            className="modal show d-block"
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            style={{ backgroundColor: "rgba(0, 0, 0, 0.6)", zIndex: 1050 }}
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div className="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable" role="document">
                <div className="modal-content shadow-lg border">
                    {/* Header */}
                    <div className="modal-header py-2 px-3">
                        <h5 className="modal-title d-flex align-items-center gap-2">
                            <span>📁</span>
                            <span>{t("buildLibrary", lang)}</span>
                        </h5>
                        <button
                            type="button"
                            className="btn-close"
                            aria-label={t("close", lang)}
                            onClick={onClose}
                        />
                    </div>

                    {/* Navigation Tabs */}
                    <div className="px-3 pt-2 bg-body-tertiary border-bottom">
                        <ul className="nav nav-tabs border-bottom-0">
                            <li className="nav-item">
                                <button
                                    type="button"
                                    className={`nav-link py-2 px-3 fw-semibold ${activeTab === "presets" ? "active" : ""}`}
                                    onClick={() => setActiveTab("presets")}
                                >
                                    🌟 {t("communityPresets", lang)}
                                </button>
                            </li>
                            <li className="nav-item">
                                <button
                                    type="button"
                                    className={`nav-link py-2 px-3 fw-semibold ${activeTab === "saved" ? "active" : ""}`}
                                    onClick={() => setActiveTab("saved")}
                                >
                                    💾 {t("mySavedBuilds", lang)}{" "}
                                    {savedBuilds.length > 0 ? (
                                        <span className="badge bg-secondary ms-1">{savedBuilds.length}</span>
                                    ) : null}
                                </button>
                            </li>
                            <li className="nav-item">
                                <button
                                    type="button"
                                    className={`nav-link py-2 px-3 fw-semibold ${activeTab === "importExport" ? "active" : ""}`}
                                    onClick={() => setActiveTab("importExport")}
                                >
                                    🔄 {t("importBuild", lang)} / {t("exportJson", lang)}
                                </button>
                            </li>
                        </ul>
                    </div>

                    {/* Modal Body */}
                    <div className="modal-body p-3">
                        {/* Tab 1: Community Presets */}
                        {activeTab === "presets" ? (
                            <div>
                                <div className="text-muted small mb-3">
                                    {lang === "zh"
                                        ? `当前精选 ${data.gameId.toUpperCase()} 经典竞技与天梯构筑，一键载入即可求解拼装：`
                                        : lang === "ja"
                                        ? `${data.gameId.toUpperCase()} のおすすめ構成です。クリックですぐに配置計算を開始できます：`
                                        : `Curated meta and tournament setups for ${data.gameId.toUpperCase()}. Click to load and solve immediately:`}
                                </div>
                                <div className="d-flex flex-column gap-3">
                                    {currentPresets.map((preset) => (
                                        <div
                                            key={preset.id}
                                            className="card p-3 border shadow-sm hover-shadow transition-all"
                                        >
                                            <div className="d-flex justify-content-between align-items-start mb-2">
                                                <div>
                                                    <h6 className="fw-bold mb-1">{preset.name}</h6>
                                                    {preset.description ? (
                                                        <div className="small text-muted">{preset.description}</div>
                                                    ) : null}
                                                </div>
                                                <button
                                                    type="button"
                                                    className="btn btn-sm btn-primary px-3 fw-semibold text-nowrap"
                                                    onClick={() => handleLoadPreset(preset)}
                                                >
                                                    {t("loadBuild", lang)}
                                                </button>
                                            </div>

                                            <div className="d-flex flex-wrap gap-2 align-items-center">
                                                <span className="badge bg-success py-1 px-2">
                                                    ❤️ {preset.baseHp ?? 1000} HP
                                                </span>
                                                <span className="badge bg-secondary py-1 px-2">
                                                    🧩 {preset.requirements.length} {lang === "zh" ? "部件" : lang === "ja" ? "プログラム" : "parts"}
                                                </span>
                                                {preset.modCards && preset.modCards.length > 0 ? (
                                                    <span className="badge bg-info text-dark py-1 px-2">
                                                        🎴 {preset.modCards.length} {lang === "zh" ? "张改造卡" : lang === "ja" ? "枚の改造カード" : "Mod Cards"}
                                                    </span>
                                                ) : null}
                                                {preset.style ? (
                                                    <span className="badge bg-warning text-dark py-1 px-2 text-uppercase fw-bold">
                                                        🥋 {preset.style}
                                                    </span>
                                                ) : null}
                                            </div>
                                        </div>
                                    ))}
                                    {currentPresets.length === 0 ? (
                                        <div className="text-muted text-center py-4">
                                            {t("noSavedBuilds", lang)}
                                        </div>
                                    ) : null}
                                </div>
                            </div>
                        ) : null}

                        {/* Tab 2: My Saved Builds */}
                        {activeTab === "saved" ? (
                            <div>
                                {/* Save Current Form */}
                                <div className="card bg-body-tertiary p-3 mb-3 border">
                                    <div className="fw-semibold small text-muted text-uppercase mb-2">
                                        💾 {t("saveBuild", lang)}
                                    </div>
                                    <div className="input-group input-group-sm mb-2">
                                        <input
                                            type="text"
                                            className="form-control"
                                            placeholder={t("buildName", lang)}
                                            value={saveName}
                                            onChange={(e) => setSaveName(e.target.value)}
                                        />
                                        <button
                                            type="button"
                                            className="btn btn-primary fw-semibold px-3"
                                            onClick={handleSaveCurrentBuild}
                                        >
                                            {t("saveBuild", lang)}
                                        </button>
                                    </div>
                                    {saveSuccessMsg ? (
                                        <div className="alert alert-success py-1 px-2 small mb-0">
                                            ✅ {saveSuccessMsg}
                                        </div>
                                    ) : null}
                                </div>

                                {/* List of Saved Builds */}
                                <div className="d-flex flex-column gap-2">
                                    {savedBuilds.length > 0 ? (
                                        savedBuilds.map((build) => {
                                            const isCurrentGame = build.gameId === data.gameId;
                                            return (
                                                <div
                                                    key={build.id}
                                                    className="card p-3 border shadow-sm"
                                                >
                                                    <div className="d-flex justify-content-between align-items-start mb-2">
                                                        <div>
                                                            <div className="d-flex align-items-center gap-2 mb-1">
                                                                <span className={`badge ${isCurrentGame ? "bg-primary" : "bg-dark text-light border"} fw-bold`}>
                                                                    {build.gameId.toUpperCase()}
                                                                </span>
                                                                <span className="fw-bold">{build.name}</span>
                                                            </div>
                                                            <div className="small text-muted">
                                                                {new Date(build.updatedAt).toLocaleString()}
                                                            </div>
                                                        </div>
                                                        <div className="d-flex align-items-center gap-2">
                                                            <button
                                                                type="button"
                                                                className={`btn btn-sm ${isCurrentGame ? "btn-primary" : "btn-outline-primary"} fw-semibold`}
                                                                onClick={() => handleLoadSavedBuild(build)}
                                                                title={isCurrentGame ? t("loadBuild", lang) : `Switch to ${build.gameId.toUpperCase()}`}
                                                            >
                                                                {isCurrentGame ? t("loadBuild", lang) : `Go to ${build.gameId.toUpperCase()}`}
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className="btn btn-sm btn-outline-secondary"
                                                                onClick={() => downloadBuildAsJson(build)}
                                                                title={t("exportJson", lang)}
                                                            >
                                                                📥
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className="btn btn-sm btn-outline-danger"
                                                                onClick={() => handleDeleteBuild(build.id)}
                                                                title={t("deleteBuild", lang)}
                                                            >
                                                                🗑️
                                                            </button>
                                                        </div>
                                                    </div>

                                                    <div className="d-flex flex-wrap gap-2 align-items-center small">
                                                        <span className="badge bg-success py-1 px-2">
                                                            ❤️ {build.baseHp ?? 1000} HP
                                                        </span>
                                                        <span className="badge bg-secondary py-1 px-2">
                                                            🧩 {build.requirements.length} {lang === "zh" ? "部件" : lang === "ja" ? "プログラム" : "parts"}
                                                        </span>
                                                        {build.modCards && build.modCards.length > 0 ? (
                                                            <span className="badge bg-info text-dark py-1 px-2">
                                                                🎴 {build.modCards.length} {lang === "zh" ? "改造卡" : lang === "ja" ? "改造カード" : "Mod Cards"}
                                                            </span>
                                                        ) : null}
                                                        {build.solution ? (
                                                            <span className="badge bg-success-subtle text-success border border-success py-1 px-2">
                                                                ✓ {lang === "zh" ? "包含拼放结果" : lang === "ja" ? "配置済" : "With Solution"}
                                                            </span>
                                                        ) : null}
                                                    </div>
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <div className="text-muted text-center py-4">
                                            {t("noSavedBuilds", lang)}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : null}

                        {/* Tab 3: Import & Export */}
                        {activeTab === "importExport" ? (
                            <div>
                                {/* Export Section */}
                                <div className="card bg-body-tertiary p-3 mb-3 border">
                                    <h6 className="fw-bold mb-2">📤 {t("exportJson", lang)}</h6>
                                    <p className="small text-muted mb-2">
                                        {lang === "zh"
                                            ? "导出当前配置为标准 .fullcust.json 格式文件或直接复制 JSON 代码，可跨设备分享或归档。"
                                            : lang === "ja"
                                            ? "現在の構成を標準 .fullcust.json ファイルまたは JSON テキストとして書き出します。"
                                            : "Export your current setup as a .fullcust.json file or copy the raw JSON to share across devices."}
                                    </p>
                                    {solution ? (
                                        <div className="small text-success mb-2">
                                            ✓ {t("exportBuildWithSolutionNotice", lang)}
                                        </div>
                                    ) : null}
                                    <div className="d-flex flex-wrap gap-2">
                                        <button
                                            type="button"
                                            className="btn btn-outline-primary btn-sm fw-semibold"
                                            onClick={handleExportJson}
                                        >
                                            💾 {t("exportJson", lang)}
                                        </button>
                                        <button
                                            type="button"
                                            className="btn btn-outline-secondary btn-sm fw-semibold"
                                            onClick={handleCopyJson}
                                        >
                                            📋 {copied ? t("copied", lang) : t("copyJson", lang)}
                                        </button>
                                    </div>
                                </div>

                                {/* Import Section */}
                                <div className="card p-3 border">
                                    <h6 className="fw-bold mb-2">📥 {t("importBuild", lang)}</h6>

                                    {/* File selector */}
                                    <div className="mb-3">
                                        <label className="form-label small fw-semibold text-muted">
                                            {t("uploadFile", lang)}
                                        </label>
                                        <input
                                            type="file"
                                            className="form-control form-control-sm"
                                            accept=".json,.fullcust.json"
                                            onChange={handleFileUpload}
                                        />
                                    </div>

                                    {/* Textarea */}
                                    <div className="mb-3">
                                        <label className="form-label small fw-semibold text-muted">
                                            {t("pasteJsonOrLink", lang)}
                                        </label>
                                        <textarea
                                            className="form-control font-monospace small"
                                            rows={5}
                                            placeholder='{"version": 1, "gameId": "bn6", ...}'
                                            value={importText}
                                            onChange={(e) => setImportText(e.target.value)}
                                        />
                                    </div>

                                    {importError ? (
                                        <div className="alert alert-danger py-2 small mb-3">
                                            ❌ {importError}
                                        </div>
                                    ) : null}

                                    {importSuccess ? (
                                        <div className="alert alert-success py-2 small mb-3">
                                            ✅ {importSuccess}
                                        </div>
                                    ) : null}

                                    <button
                                        type="button"
                                        className="btn btn-primary btn-sm fw-semibold"
                                        onClick={() => handleExecuteImport(importText)}
                                        disabled={!importText.trim()}
                                    >
                                        📥 {t("importBuild", lang)}
                                    </button>
                                </div>
                            </div>
                        ) : null}
                    </div>

                    {/* Footer */}
                    <div className="modal-footer py-2 px-3">
                        <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={onClose}
                        >
                            {t("close", lang)}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
