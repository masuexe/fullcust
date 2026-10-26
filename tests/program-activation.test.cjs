require("./register.cjs");
const assert = require("node:assert/strict");
const { test } = require("node:test");
const { from } = require("../array2d.ts");
const { solve, placeAll } = require("../solver.ts");
const { computePlacedBuildStats, BUG_SPEC_OPTIONS } = require("../effects.ts");
const { getModCards } = require("../modcards.ts");
const { games } = require("../games.ts");
const { parseGameData } = require("../game-data.ts");
const { emptyProblem } = require("../problem.ts");
const { findFeasibleBuild } = require("../feasible-optimizer.ts");
const { searchBuilds } = require("../exhaustive-optimizer.ts");
const { optimizeBuild } = require("../optimizer.ts");

const constraint = { compressed: true, onCommandLine: null, minBugLevel: 0, maxBugLevel: Infinity };
const key = solution => JSON.stringify(solution);
function fixture(ids = [1, 46]) {
    const data = parseGameData(require("../data/bn6.json"), games.find(g => g.id === "bn6"));
    const indices = ids.map(id => data.partMetas.findIndex(p => p.id === id));
    const mask = from([true, false], 2, 1);
    data.parts = indices.map((i, n) => ({ ...data.parts[i], color: n + 1, compressedMask: mask, uncompressedMask: mask }));
    data.partMetas = indices.map((i, n) => ({ ...data.partMetas[i], color: n + 1 }));
    data.gridSettings = { height: 2, width: 1, commandLineRow: 1, hasOob: false };
    data.gridOptions = [{ label: "fixture", settings: data.gridSettings }];
    data.defaultExpansion = 0;
    const problem = emptyProblem(data);
    return { data, problem };
}

test("program-first placement preserves all layouts and explicit off-line constraints", () => {
    const { data } = fixture();
    const requirements = [{ partIndex: 0, constraint }];
    const normal = [...solve(data.parts, requirements, data.gridSettings, [])];
    const preferred = [...solve(data.parts, requirements, data.gridSettings, [], () => false, true, undefined, true)];
    assert.deepEqual(preferred.map(key).sort(), normal.map(key).sort());
    assert.equal(normal[0][0].loc.position.y, 0);
    assert.equal(preferred[0][0].loc.position.y, 1, "Program should touch the command line first");
    const forced = [...solve(data.parts, [{ partIndex: 0, constraint: { ...constraint, onCommandLine: false } }],
        data.gridSettings, [], () => false, true, undefined, true)];
    assert.ok(forced.length > 0);
    assert.ok(forced.every(solution => solution[0].loc.position.y === 0));
});

test("off-line programs lose effects, while Plus parts and patch cards retain effects", () => {
    const grid = { height: 2, width: 2, commandLineRow: 1, hasOob: false };
    const metas = [{ id: 1, isSolid: true }, { id: 46, isSolid: false }, { id: 2, isSolid: true }];
    const requirements = metas.map((_, partIndex) => ({ partIndex, constraint }));
    const off = computePlacedBuildStats("bn6", metas, requirements, [0, 2, 1, null], grid);
    assert.ok(!off.abilities.includes("superArmor"));
    assert.equal(off.custom, 5);
    assert.equal(off.finalHp, 1500, "Plus HP remains active on the line, even though it causes a bug");
    const on = computePlacedBuildStats("bn6", metas, requirements, [1, null, 0, 2], grid);
    assert.ok(on.abilities.includes("superArmor"));
    assert.equal(on.custom, 6);
    const provider = getModCards("bn6").find(card => card.abilities.includes("superArmor"));
    assert.ok(provider);
    const cardStats = computePlacedBuildStats("bn6", metas, requirements, [0, 2, 1, null], grid, [provider.id]);
    assert.ok(cardStats.abilities.includes("superArmor"), "NC activation must not suppress card abilities");
});

test("all search passes reject a required ability supplied only by an off-line program", () => {
    const { data, problem } = fixture();
    problem.requirements = [
        { partIndex: 0, constraint: { ...constraint, onCommandLine: false } },
        { partIndex: 1, constraint: { ...constraint, onCommandLine: true } },
    ];
    const constraints = { requiredAbilities: ["superArmor"],
        bugRules: Object.fromEntries(BUG_SPEC_OPTIONS.map(b => [b.id, "allowed_any"])) };
    const options = { data, problem, constraints, modCardMode: "none" };
    assert.equal(findFeasibleBuild({ ...options, shouldStop: () => false }), null);
    assert.equal(optimizeBuild({ ...options, timeoutMs: 1000 }), null);
    const result = searchBuilds(options);
    assert.equal(result.best, null);
    assert.equal(result.completed, true);
});

test("first solution and exhaustive results activate a requested program even with every bug allowed", () => {
    const { data, problem } = fixture();
    const options = { data, problem, modCardMode: "none", constraints: { requiredAbilities: ["superArmor"],
        bugRules: Object.fromEntries(BUG_SPEC_OPTIONS.map(b => [b.id, "allowed_any"])) } };
    const first = findFeasibleBuild({ ...options, shouldStop: () => false });
    assert.ok(first);
    const updates = [];
    const exhaustive = searchBuilds({ ...options, onProgress: p => { if (p.best) updates.push(p.best); } });
    for (const result of [first, ...updates, exhaustive.best]) {
        assert.ok(result);
        const cells = placeAll(data.parts, result.problem.requirements, result.solution, data.gridSettings);
        const actual = computePlacedBuildStats("bn6", data.partMetas, result.problem.requirements, cells, data.gridSettings);
        assert.ok(actual.abilities.includes("superArmor"));
        assert.deepEqual(result.stats, actual);
    }
});

test("repeated program IDs activate per placement rather than per part ID", () => {
    const grid = { height: 2, width: 2, commandLineRow: 1, hasOob: false };
    const metas = [{ id: 2, isSolid: true }];
    const requirements = [{ partIndex: 0, constraint }, { partIndex: 0, constraint }];
    assert.equal(computePlacedBuildStats("bn6", metas, requirements, [0, null, 1, null], grid).custom, 6);
});

test("an off-line numeric program cannot satisfy a minimum Custom requirement", () => {
    const { data, problem } = fixture([2, 46]);
    problem.requirements = [
        { partIndex: 0, constraint: { ...constraint, onCommandLine: false } },
        { partIndex: 1, constraint: { ...constraint, onCommandLine: true } },
    ];
    const options = { data, problem, modCardMode: "none", constraints: { minCustom: 6,
        bugRules: Object.fromEntries(BUG_SPEC_OPTIONS.map(b => [b.id, "allowed_any"])) } };
    assert.equal(findFeasibleBuild({ ...options, shouldStop: () => false }), null);
    assert.equal(optimizeBuild({ ...options, timeoutMs: 1000 }), null);
    assert.equal(searchBuilds(options).best, null);
});

test("an active BugStop does not activate off-line programs", () => {
    const grid = { height: 2, width: 2, commandLineRow: 1, hasOob: false };
    const metas = [{ id: 1, isSolid: true }, { id: 31, isSolid: true }];
    const requirements = metas.map((_, partIndex) => ({ partIndex, constraint }));
    const stats = computePlacedBuildStats("bn6", metas, requirements, [0, null, 1, null], grid);
    assert.ok(stats.abilities.includes("bugStop"));
    assert.ok(!stats.abilities.includes("superArmor"));
});
