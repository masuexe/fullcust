import React, { useState, useRef, useEffect } from "react";
import { Lang, t } from "./i18n";
import { ConstraintOption } from "./effects";

export interface MultiSelectDropdownProps {
    id?: string;
    options: ConstraintOption[];
    selected: string[];
    onChange: (selected: string[]) => void;
    lang: Lang;
    placeholder?: string;
}

export function MultiSelectDropdown({
    id,
    options,
    selected,
    onChange,
    lang,
    placeholder,
}: MultiSelectDropdownProps): JSX.Element {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const containerRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!isOpen) return;
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        document.addEventListener("keydown", handleKeyDown);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [isOpen]);

    const toggleOption = (optId: string) => {
        if (selected.includes(optId)) {
            onChange(selected.filter(id => id !== optId));
        } else {
            onChange([...selected, optId]);
        }
    };

    const handleClear = (e: React.MouseEvent) => {
        e.stopPropagation();
        onChange([]);
    };

    // Filter options by search query
    const filteredOptions = searchQuery.trim() === ""
        ? options
        : options.filter(opt => {
            const q = searchQuery.toLowerCase();
            const nameMatch = (opt.name[lang] || opt.name.en).toLowerCase().includes(q) ||
                opt.name.en.toLowerCase().includes(q) ||
                opt.name.ja.toLowerCase().includes(q) ||
                opt.name.zh.toLowerCase().includes(q);
            const catMatch = opt.category && (
                opt.category[lang]?.toLowerCase().includes(q) ||
                opt.category.en.toLowerCase().includes(q) ||
                opt.category.zh.toLowerCase().includes(q)
            );
            return nameMatch || catMatch;
        });

    // Compute display label for trigger
    const defaultPlaceholder = placeholder || t("anyOption", lang);
    let displayText = defaultPlaceholder;
    let fullTitle = defaultPlaceholder;

    if (selected.length > 0) {
        const selectedNames = selected.map(id => {
            const found = options.find(o => o.id === id);
            return found ? (found.name[lang] || found.name.en) : id;
        });
        fullTitle = selectedNames.join(", ");
        if (selected.length === 1) {
            displayText = selectedNames[0];
        } else if (selected.length === 2) {
            displayText = selectedNames.join(", ");
        } else {
            displayText = `${selectedNames[0]}, ${selectedNames[1]} (+${selected.length - 2})`;
        }
    }

    // Group filtered options by category (if any option has a category)
    const hasCategories = options.some(opt => !!opt.category);
    const categories: { name: string; items: ConstraintOption[] }[] = [];
    if (hasCategories) {
        const uncategorized: ConstraintOption[] = [];
        const catMap = new Map<string, ConstraintOption[]>();
        for (const opt of filteredOptions) {
            if (opt.category) {
                const catName = opt.category[lang] || opt.category.en;
                if (!catMap.has(catName)) catMap.set(catName, []);
                catMap.get(catName)!.push(opt);
            } else {
                uncategorized.push(opt);
            }
        }
        if (uncategorized.length > 0) {
            categories.push({ name: "", items: uncategorized });
        }
        for (const [name, items] of catMap.entries()) {
            categories.push({ name, items });
        }
    }

    return (
        <div ref={containerRef} className="position-relative w-100">
            <button
                id={id}
                type="button"
                className={`btn btn-sm form-select form-select-sm text-start d-flex align-items-center justify-content-between w-100 ${
                    selected.length > 0 ? "border-primary text-body" : "text-secondary"
                }`}
                onClick={() => {
                    setIsOpen(prev => !prev);
                    if (!isOpen) setSearchQuery("");
                }}
                title={fullTitle}
                aria-expanded={isOpen}
            >
                <span className="text-truncate flex-grow-1 me-1">
                    {selected.length > 0 ? (
                        <span className="fw-medium text-body">{displayText}</span>
                    ) : (
                        displayText
                    )}
                </span>
                <span className="d-flex align-items-center gap-1 flex-shrink-0 ms-1">
                    {selected.length > 0 && (
                        <span
                            role="button"
                            className="badge bg-secondary-subtle text-body border border-secondary-subtle rounded-pill py-0 px-1"
                            style={{ fontSize: "0.68rem" }}
                            onClick={handleClear}
                            title={t("clearAll", lang)}
                        >
                            ✕
                        </span>
                    )}
                </span>
            </button>

            {isOpen && (
                <div
                    className="dropdown-menu show shadow p-2"
                    style={{
                        position: "absolute",
                        top: "100%",
                        left: 0,
                        zIndex: 1060,
                        minWidth: "260px",
                        maxWidth: "380px",
                        width: "100%",
                    }}
                >
                    {/* Search Input (shown when list has more than 5 options) */}
                    {options.length > 5 && (
                        <div className="mb-2">
                            <input
                                type="text"
                                className="form-control form-control-sm"
                                placeholder={t("searchOptions", lang)}
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                autoFocus
                            />
                        </div>
                    )}

                    {/* Quick Info & Clear Button */}
                    <div className="d-flex justify-content-between align-items-center mb-1 pb-1 border-bottom px-1 small text-muted">
                        <span>
                            {selected.length === 0 ? (
                                <span className="badge bg-light text-dark border">{t("anyOption", lang)}</span>
                            ) : (
                                <span className="badge bg-primary text-light">
                                    {selected.length} {t("selectedCount", lang)}
                                </span>
                            )}
                        </span>
                        {selected.length > 0 && (
                            <button
                                type="button"
                                className="btn btn-link btn-sm p-0 text-decoration-none text-danger small"
                                style={{ fontSize: "0.78rem" }}
                                onClick={() => onChange([])}
                            >
                                {t("clearAll", lang)}
                            </button>
                        )}
                    </div>

                    {/* Options List */}
                    <div style={{ maxHeight: "240px", overflowY: "auto" }}>
                        {filteredOptions.length === 0 ? (
                            <div className="text-muted small text-center py-2">
                                {t("noMatchingOptions", lang)}
                            </div>
                        ) : hasCategories ? (
                            categories.map(cat => (
                                <div key={cat.name || "default"}>
                                    {cat.name && (
                                        <div
                                            className="text-uppercase fw-bold text-muted px-2 pt-2 pb-1 border-top"
                                            style={{ fontSize: "0.68rem", letterSpacing: "0.05em" }}
                                        >
                                            {cat.name}
                                        </div>
                                    )}
                                    {cat.items.map(opt => {
                                        const isChecked = selected.includes(opt.id);
                                        return (
                                            <label
                                                key={opt.id}
                                                className={`d-flex align-items-center gap-2 py-1 px-2 rounded cursor-pointer small mb-0 w-100 ${
                                                    isChecked ? "bg-primary-subtle text-primary fw-medium" : "text-body"
                                                }`}
                                                style={{ cursor: "pointer", userSelect: "none" }}
                                            >
                                                <input
                                                    type="checkbox"
                                                    className="form-check-input mt-0 flex-shrink-0"
                                                    checked={isChecked}
                                                    onChange={() => toggleOption(opt.id)}
                                                />
                                                <span className="text-truncate flex-grow-1" title={opt.name[lang] || opt.name.en}>
                                                    {opt.name[lang] || opt.name.en}
                                                </span>
                                            </label>
                                        );
                                    })}
                                </div>
                            ))
                        ) : (
                            filteredOptions.map(opt => {
                                const isChecked = selected.includes(opt.id);
                                return (
                                    <label
                                        key={opt.id}
                                        className={`d-flex align-items-center gap-2 py-1 px-2 rounded cursor-pointer small mb-0 w-100 ${
                                            isChecked ? "bg-primary-subtle text-primary fw-medium" : "text-body"
                                        }`}
                                        style={{ cursor: "pointer", userSelect: "none" }}
                                    >
                                        <input
                                            type="checkbox"
                                            className="form-check-input mt-0 flex-shrink-0"
                                            checked={isChecked}
                                            onChange={() => toggleOption(opt.id)}
                                        />
                                        <span className="text-truncate flex-grow-1" title={opt.name[lang] || opt.name.en}>
                                            {opt.name[lang] || opt.name.en}
                                        </span>
                                    </label>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
