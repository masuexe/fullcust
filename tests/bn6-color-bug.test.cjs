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
const grid = { width: 7, height: 7, commandLineRow: 3, hasOob: true };
function colorAnalysis(count, stop = false) {
    const metas = Array.from({ length: count }, (_, i) => ({ id: 35, name: "Attack+1", isSolid: false, color: i + 1 }));
    const requirements = metas.map((_, partIndex) => ({ partIndex }));
    const cells = new Array(49).fill(null);
    for (let i = 0; i < count; i++) cells[(1 + Math.floor(i / 5)) * 7 + 1 + i % 5] = i;
    if (stop) {
        metas.push({ id: 31, name: "BugStop", isSolid: true, color: 1 });
        requirements.push({ partIndex: count });
        cells[3 * 7] = count; // On the command line and out of bounds.
        cells[3 * 7 + 1] = 0; // Same-color neighbor; both violations remain suppressible.
    }
    return analyzeSolutionBugs("bn6", metas, requirements, cells, grid, "en");
}

test("BN6 five/six-color layouts are policy-controlled status bugs at levels one/two", () => {
    for (const count of [5, 6]) {
        const analysis = colorAnalysis(count);
        assert.equal(analysis.activeBugs.find(b => b.bugType === "colorStatus").level, count - 4);
        assert.ok(isSolutionAcceptable(analysis, { type: "custom", customRules: { status: "required" } }));
        assert.equal(isSolutionAcceptable(analysis), false);
        assert.equal(isSolutionAcceptable(analysis, { type: "custom", customRules: { status: "allowed_lv1" } }), count === 5);
    }
});

test("on-line BN6 BugStop suppresses NC color bugs even when out of bounds or adjacent to its color", () => {
    const analysis = colorAnalysis(6, true);
    assert.ok(analysis.bugStopActive);
    assert.ok(isSolutionAcceptable(analysis));
    assert.equal(isSolutionAcceptable(analysis, { type: "custom", customRules: { status: "required" } }), false);
});

test("first-solution and exhaustive passes do not prune five-color cores before policy checks", () => {
    const data = parseGameData(require("../data/bn6.json"), games.find(g => g.id === "bn6"));
    const source = data.partMetas.findIndex(p => p.id === 35);
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
