require("./register.cjs");
const assert = require("node:assert/strict");
const { test } = require("node:test");
const { analyzeSolutionBugs, isSolutionAcceptable } = require("../effects.ts");
const { findFeasibleBuild } = require("../feasible-optimizer.ts");
const { searchBuilds } = require("../exhaustive-optimizer.ts");
const { from } = require("../array2d.ts");
const { games } = require("../games.ts");
const { parseGameData } = require("../game-data.ts");
const { emptyProblem } = require("../problem.ts");

const grid6 = { width: 7, height: 7, commandLineRow: 3, hasOob: true };
const grid5 = { width: 5, height: 5, commandLineRow: 2, hasOob: false };

function colorAnalysis(gameId, count, stop = false) {
    const grid = gameId === "bn6" ? grid6 : grid5;
    const bugStopId = gameId === "bn6" ? 31 : gameId === "bn5" ? 28 : 24;
    const metas = Array.from({ length: count }, (_, i) => ({ id: 99, name: `Part${i}`, isSolid: false, color: i + 1 }));
    const requirements = metas.map((_, partIndex) => ({ partIndex }));
    const cells = new Array(grid.width * grid.height).fill(null);
    for (let i = 0; i < count; i++) {
        if (gameId === "bn6") {
            const row = 1 + Math.floor(i / 5);
            const col = 1 + (i % 5);
            cells[row * 7 + col] = i;
        } else {
            const row = Math.floor(i / 5);
            const col = i % 5;
            cells[row * 5 + col] = i;
        }
    }
    if (stop) {
        metas.push({ id: bugStopId, name: "BugStop", isSolid: true, color: 1 });
        requirements.push({ partIndex: count });
        if (gameId === "bn6") {
            cells[3 * 7] = count;
        } else {
            cells[2 * 5 + 2] = count;
        }
    }
    return analyzeSolutionBugs(gameId, metas, requirements, cells, grid, "en");
}

for (const gameId of ["bn4", "bn5", "bn6"]) {
    test(`${gameId.toUpperCase()} five/six-color layouts are policy-controlled status bugs at levels one/two`, () => {
        for (const count of [5, 6]) {
            const analysis = colorAnalysis(gameId, count);
            assert.equal(analysis.activeBugs.find(b => b.bugType === "colorStatus").level, count - 4);
            assert.ok(isSolutionAcceptable(analysis, { type: "custom", customRules: { status: "required" } }));
            assert.equal(isSolutionAcceptable(analysis), false);
            assert.equal(isSolutionAcceptable(analysis, { type: "custom", customRules: { status: "allowed_lv1" } }), count === 5);
        }
    });

    test(`on-line ${gameId.toUpperCase()} BugStop suppresses NC color bugs`, () => {
        const analysis = colorAnalysis(gameId, 6, true);
        assert.ok(analysis.bugStopActive);
        assert.ok(isSolutionAcceptable(analysis));
        assert.equal(isSolutionAcceptable(analysis, { type: "custom", customRules: { status: "required" } }), false);
    });

    test(`${gameId.toUpperCase()}: first-solution and exhaustive passes do not prune five-color cores before policy checks`, () => {
        const data = parseGameData(require(`../data/${gameId}.json`), games.find(g => g.id === gameId));
        const source = data.partMetas.findIndex(p => !p.isSolid);
        const part = data.parts[source], meta = data.partMetas[source];
        const mask = from([true, ...new Array(11).fill(false)], 2, 6);
        data.parts = Array.from({ length: 5 }, (_, i) => ({ ...part, color: i + 1, compressedMask: mask, uncompressedMask: mask }));
        data.partMetas = Array.from({ length: 5 }, (_, i) => ({ ...meta, color: i + 1 }));
        data.gridOptions = [{ label: "fixture", settings: { height: 2, width: 6, commandLineRow: 1, hasOob: false } }];
        data.defaultExpansion = 0;
        const problem = emptyProblem(data);
        problem.requirements = data.parts.map((_, partIndex) => ({ partIndex,
            constraint: { compressed: true, onCommandLine: false, minBugLevel: 0, maxBugLevel: Infinity } }));
        const options = { data, problem, modCardMode: "none", constraints: { bugRules: { status: "required" } } };
        assert.ok(findFeasibleBuild({ ...options, shouldStop: () => false }));
        let found = false;
        const result = searchBuilds({ ...options, shouldStop: () => found, onProgress: p => { if (p.best) found = true; } });
        assert.ok(result.best);
    });
}
