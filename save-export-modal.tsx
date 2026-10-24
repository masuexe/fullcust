import React from "react";
import type { Data } from "./game-data";
import type { Problem } from "./problem";
import type { Solution } from "./solver";
import type { Lang } from "./i18n";
import { t } from "./i18n";
import {
    SAVE_EDITIONS,
    SaveEdition,
    buildGbaSave,
    downloadSaveFile,
    fetchSaveTemplate,
} from "./save-exporter";

export interface SaveExportModalProps {
    isOpen: boolean;
    onClose: () => void;
    data: Data;
    problem: Problem;
    solution: Solution;
    solutionIndex?: number;
    lang: Lang;
}

export function SaveExportModal({
    isOpen,
    onClose,
    data,
    problem,
    solution,
    solutionIndex,
    lang,
}: SaveExportModalProps) {
    const availableEditions = React.useMemo(() => {
        return SAVE_EDITIONS.filter(e => e.gameId === data.gameId);
    }, [data.gameId]);

    const [selectedEditionId, setSelectedEditionId] = React.useState<string>(
        availableEditions[0]?.id || ""
    );
    const [isExporting, setIsExporting] = React.useState<boolean>(false);
    const [error, setError] = React.useState<string | null>(null);
    const [success, setSuccess] = React.useState<boolean>(false);

    // Keep edition selected when game changes or modal opens
    React.useEffect(() => {
        if (isOpen && availableEditions.length > 0) {
            if (!availableEditions.some(e => e.id === selectedEditionId)) {
                setSelectedEditionId(availableEditions[0].id);
            }
            setError(null);
            setSuccess(false);
            setIsExporting(false);
        }
    }, [isOpen, availableEditions, selectedEditionId]);

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

    const selectedEdition = availableEditions.find(e => e.id === selectedEditionId) || availableEditions[0];
    const hasModCards = (problem.modCards?.length || 0) > 0;
    const isUsEdition = selectedEdition?.romType === "US";

    const getEditionTitle = (e: SaveEdition): string => {
        if (lang === "zh") return e.nameZh;
        if (lang === "ja") return e.nameJa;
        return e.nameEn;
    };

    const handleDownload = async () => {
        if (!selectedEdition) return;
        try {
            setIsExporting(true);
            setError(null);
            const templateBytes = await fetchSaveTemplate(selectedEdition);
            const sramBytes = buildGbaSave({
                edition: selectedEdition,
                templateBytes,
                problem,
                solution,
                data,
            });
            downloadSaveFile(sramBytes, selectedEdition.defaultFilename);
            setSuccess(true);
            setTimeout(() => setSuccess(false), 4000);
        } catch (err: any) {
            console.error(err);
            setError(err.message || "Failed to generate .sav file");
        } finally {
            setIsExporting(false);
        }
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
            <div className="modal-dialog modal-dialog-centered modal-lg" role="document">
                <div className="modal-content shadow-lg border">
                    {/* Header */}
                    <div className="modal-header py-2 px-3">
                        <h5 className="modal-title d-flex align-items-center gap-2">
                            <span>💾</span>
                            <span>
                                {t("exportSav", lang)}
                                {solutionIndex !== undefined ? ` - ${t("solution", lang)} #${solutionIndex + 1}` : ""}
                            </span>
                        </h5>
                        <button
                            type="button"
                            className="btn-close"
                            aria-label={t("close", lang)}
                            onClick={onClose}
                        />
                    </div>

                    {/* Body */}
                    <div className="modal-body p-3">
                        {/* Description */}
                        <div className="alert alert-info py-2 px-3 small mb-3">
                            <div className="fw-semibold mb-1">🎮 {t("exportSavDesc", lang)}</div>
                            <div className="opacity-75">
                                {lang === "zh"
                                    ? "直接输出经过 CRC 校验与 XOR 掩码加密的 64KB 标准 GBA SRAM 存档，支持 mGBA、RetroArch、MiSTer 以及 EZ-Flash、EverDrive 等各类烧录卡。"
                                    : lang === "ja"
                                    ? "CRC チェックサムと XOR マスク処理済みの 64KB 標準 GBA SRAM ファイルを生成します。mGBA や実機マジコン（EZ-Flash等）ですぐにプレイ可能です。"
                                    : "Generates a fully verified 64KB GBA SRAM save with proper CRC checksums and XOR masking, directly playable on mGBA, flash carts, and hardware."}
                            </div>
                        </div>

                        {/* Layout Summary */}
                        <div className="d-flex flex-wrap gap-2 align-items-center mb-3 p-2 bg-body-tertiary rounded border">
                            <span className="badge bg-primary py-1 px-2 fw-bold">
                                {data.gameId.toUpperCase()}
                            </span>
                            <span className="badge bg-success py-1 px-2">
                                ❤️ {problem.baseHp ?? 1000} HP
                            </span>
                            <span className="badge bg-secondary py-1 px-2">
                                🧩 {problem.requirements.length} {lang === "zh" ? "部件已拼装" : lang === "ja" ? "個のプログラム配置" : "parts placed"}
                            </span>
                            {hasModCards ? (
                                <span className="badge bg-info text-dark py-1 px-2">
                                    🎴 {problem.modCards!.length} {lang === "zh" ? "张改造卡已注入" : lang === "ja" ? "枚の改造カード注入" : "Mod Cards injected"}
                                </span>
                            ) : null}
                        </div>

                        {/* Edition Selector */}
                        <div className="mb-3">
                            <label className="form-label fw-semibold small text-muted text-uppercase">
                                {t("selectEdition", lang)}
                            </label>
                            <select
                                className="form-select"
                                value={selectedEditionId}
                                onChange={(e) => setSelectedEditionId(e.target.value)}
                            >
                                {availableEditions.map((edition) => (
                                    <option key={edition.id} value={edition.id}>
                                        {getEditionTitle(edition)} ({edition.romType}) — [{edition.defaultFilename}]
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Mod Card Region Notice */}
                        {hasModCards && isUsEdition ? (
                            <div className="alert alert-warning py-2 px-3 small mb-3">
                                <div className="fw-semibold">⚠️ {t("modCardRegionNotice", lang)}</div>
                            </div>
                        ) : null}

                        {/* Credits to ore4545 and Tango */}
                        <div className="card bg-body-tertiary border p-3 mb-3">
                            <div className="d-flex align-items-center mb-1">
                                <span className="me-2 text-warning fs-5">⭐</span>
                                <span className="fw-bold">{t("saveCreditTitle", lang)}</span>
                            </div>
                            <p className="small text-muted mb-2">
                                {t("saveCreditBody", lang)}
                            </p>
                            <div className="d-flex flex-wrap gap-2">
                                <a
                                    href="https://github.com/ore4545"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1"
                                >
                                    <span>👤</span>
                                    <span>ore4545 (GitHub)</span>
                                </a>
                                <a
                                    href="https://github.com/tangobattle/tango"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1"
                                >
                                    <span>⚔️</span>
                                    <span>Tango (N1GP)</span>
                                </a>
                            </div>
                        </div>

                        {/* Status Feedback */}
                        {error ? (
                            <div className="alert alert-danger py-2 small mb-3">
                                ❌ {error}
                            </div>
                        ) : null}

                        {success ? (
                            <div className="alert alert-success py-2 small mb-3">
                                ✅ {lang === "zh" ? "存档生成并开始下载！" : lang === "ja" ? "セーブファイルを生成しダウンロードを開始しました！" : "Save file generated and downloading!"}
                            </div>
                        ) : null}
                    </div>

                    {/* Footer */}
                    <div className="modal-footer py-2 px-3 d-flex justify-content-between">
                        <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={onClose}
                        >
                            {t("close", lang)}
                        </button>
                        <button
                            type="button"
                            className="btn btn-success fw-bold d-flex align-items-center gap-2 px-3"
                            onClick={handleDownload}
                            disabled={isExporting}
                        >
                            {isExporting ? (
                                <>
                                    <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
                                    <span>{lang === "zh" ? "生成中..." : lang === "ja" ? "生成中..." : "Generating..."}</span>
                                </>
                            ) : (
                                <>
                                    <span>💾</span>
                                    <span>{t("downloadSavBtn", lang)}</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
