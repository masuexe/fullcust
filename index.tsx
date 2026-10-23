import isEqual from "lodash-es/isEqual";
import React, { ChangeEvent } from "react";
import { createRoot } from "react-dom/client";
import { useInView } from "react-intersection-observer";

import * as array2d from "./array2d";
import AsyncSolver from "./async-solver";
import { GridSettings, Part, placeAll, Requirement, Solution } from "./solver";
import { COLORS } from "./colors";
import { colorCompatibility } from "./compatibility";
import { Data } from "./game-data";
import { defaultGameId, findGame, games, loadGame } from "./games";
import {
    emptyProblem,
    makeGridSettings,
    Problem,
    problemFromHash,
    toHashString,
} from "./problem";

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
                    [null, "🤷 maybe・任意"],
                    [false, "❌ must not・不要"],
                    [true, "✅ must・必要"],
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

function PartSelector({
    data,
    problem,
    onChange,
}: {
    data: Data;
    problem: Problem;
    onChange: (problem: Problem) => void;
}) {
    const compatibility = colorCompatibility(data, problem);
    return (
        <>
            {data.styleColorRules ? (
                <div className="mb-2">
                    <label htmlFor="style" className="form-label">Style・スタイル</label>
                    <select id="style" className="form-select mb-2"
                        value={problem.style}
                        onChange={event => onChange({ ...problem, style: event.target.value })}>
                        {data.styleColorRules.styles.map(style => (
                            <option key={style.id} value={style.id}>{style.label}</option>
                        ))}
                    </select>
                    <div className="form-check">
                        <input id="mod-tools" type="checkbox" className="form-check-input"
                            checked={problem.modTools ?? false}
                            onChange={event => onChange({ ...problem, modTools: event.target.checked })} />
                        <label htmlFor="mod-tools" className="form-check-label">
                            ModTools: allow one incompatible part・改造ツール：非対応パーツ1個まで
                        </label>
                    </div>
                    <div className="small text-muted mt-1">
                        Compatible colors・対応色: {compatibility.allowedColors.join(", ")}
                    </div>
                    {compatibility.offColorParts.length > 0 && !compatibility.error ? (
                        <div className="small mt-1" role="status">
                            Requires an Error Code・エラーコードが必要: {compatibility.offColorParts.map(req => data.partMetas[req.partIndex].name).join(", ")}
                        </div>
                    ) : null}
                    <div className="small text-muted mt-1">
                        BN3 compression is permanent in-game; choose the state you own.・ゲーム内の圧縮は元に戻せません。
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
                            Pick a part・パートを選択
                        </option>
                        {data != null
                            ? data.partMetas.map((part, i) => (
                                  <option value={i} key={i}>
                                      {part.name}・{part.nameJa}
                                  </option>
                              ))
                            : null}
                    </select>
                </div>
            </div>

            <div className="overflow-auto flex-grow-1 mb-2">
                <ol className="list-group">
                    {problem.requirements.map((requirement, i) => {
                        const partMeta = data!.partMetas[requirement.partIndex];

                        return (
                            <li className="list-group-item" key={i}>
                                <div className="mb-2 d-flex align-items-center">
                                    <div className="flex-grow-1">
                                        {i + 1}. {partMeta.name}・
                                        {partMeta.nameJa}
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
                                            title="on command line・コマンドライン上"
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
                                                    min bugs・最小バグ数
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
                                                    max bugs・最大バグ数
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
                                            title="compress・圧縮"
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
                            Extra settings・追加設定
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
                                    Expansion memory・拡張メモリ
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
                                                }}
                                            >
                                                spin{" "}
                                                {
                                                    COLORS[
                                                        color as keyof typeof COLORS
                                                    ].name
                                                }
                                                ・スピン
                                                {
                                                    COLORS[
                                                        color as keyof typeof COLORS
                                                    ].nameJa
                                                }
                                            </label>
                                        </div>
                                    ); // TODO: Spinnables
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

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
                        <span>Reset・リセット</span>
                    </button>
                </div>
            </div>
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
        <div style={{ display: "flex", justifyContent: "center" }}>
            <div
                style={{
                    position: "relative",
                    width: width / 2,
                    height: height / 2,
                }}
            >
                <canvas
                    ref={canvasRef}
                    width={width}
                    height={height}
                    style={{
                        width: "100%",
                        height: "100%",
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

        return (
            <div
                ref={ref}
                className="d-flex justify-content-center align-items-center"
                style={{
                    width: (gridSettings.width * CELL_SIZE + borderWidth) / 2,
                    height: (gridSettings.height * CELL_SIZE + borderWidth) / 2,
                }}
            >
                <div className="spinner-border" />
            </div>
        );
    }
);

function Results({ problem, data }: { problem: Problem; data: Data }) {
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
        <div
            style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(350px, 1fr))",
                gap: "1rem",
            }}
        >
            {solutions.length > 0 ? (
                solutions.map((solution, i) => (
                    <div style={{ textAlign: "center" }} key={i}>
                        <Navicust
                            parts={data.parts}
                            colors={data.colors}
                            requirements={problem.requirements}
                            gridSettings={gs}
                            cells={placeAll(
                                data.parts,
                                problem.requirements,
                                solution as Solution,
                                gs
                            )}
                        />
                    </div>
                ))
            ) : done ? (
                problem.requirements.length > 0 ? (
                    <div key="no-results" className="alert alert-danger">
                        No solutions found・解決が発見されなかった
                    </div>
                ) : (
                    <div key="no-requirements" className="alert alert-info">
                        Select parts from the left to start
                        solving・解決を開始するために、左面からパートを選択ください
                    </div>
                )
            ) : null}
            {done ? null : <NavicustPlaceholder ref={ref} gridSettings={gs} />}
        </div>
    );
}

function App() {
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
                setError("Unable to load game data. Please reload the page.・データを読み込めません。再読み込みしてください。");
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
                setError("This shared layout is invalid or unavailable for this game.・共有データが無効、またはこのゲームに対応していません。");
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

    const compatibilityError = data && problem ? colorCompatibility(data, problem).error : null;

    return (
        <div>
            <div
                className="h-100 position-fixed d-flex flex-column p-2 border-end"
                style={{ width: "40%", top: 0 }}
            >
                <h1 className="h4">
                    fullcust{" "}
                    <small className="text-muted">
                        navicust autolayout・ナビカスタマイザー自動配置
                    </small>
                </h1>
                <ul id="games-nav" className="nav nav-pills mb-2">
                    {games.map(({ id: key, label }) => (
                        <li className="nav-item" key={key}>
                            <a
                                className={`nav-link ${
                                    game == key ? "active" : ""
                                }`}
                                href={`?game=${key}`}
                            >
                                {label}
                            </a>
                        </li>
                    ))}
                </ul>
                {error ? (
                    <div className="alert alert-danger" role="alert">
                        {error}
                        {data ? (
                            <button className="btn btn-sm btn-outline-danger d-block mt-2"
                                onClick={() => {
                                    setError(null);
                                    setProblem(emptyProblem(data));
                                }}>
                                Start a new layout・新規作成
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
                    />
                ) : null}
            </div>
            <div
                className="container-fluid my-2"
                style={{ marginLeft: "40%", width: "60%" }}
            >
                {compatibilityError ? (
                    <div className="alert alert-warning" role="alert">{compatibilityError}</div>
                ) : data != null && problem != null ? (
                    <Results
                        key={JSON.stringify(problem)}
                        data={data}
                        problem={problem}
                    />
                ) : null}
            </div>
        </div>
    );
}

createRoot(document.getElementById("main")!).render(<App />);
