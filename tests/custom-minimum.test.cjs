require("./register.cjs");
const assert = require("node:assert/strict");
const { test } = require("node:test");
const { games } = require("../games.ts");
const { parseGameData } = require("../game-data.ts");
const { emptyProblem, toHashString, fromHashString } = require("../problem.ts");
const { BUG_SPEC_OPTIONS, computeBuildStats } = require("../effects.ts");
const { doesBuildSatisfyConstraints } = require("../optimizer.ts");
const { findFeasibleBuild } = require("../feasible-optimizer.ts");
const { searchBuilds } = require("../exhaustive-optimizer.ts");
const { improveBuildLocally } = require("../local-optimizer.ts");
const { from } = require("../array2d.ts");

function options(minCustom) {
    const data = parseGameData(require("../data/bn6.json"), games.find(g => g.id === "bn6"));
    return { data, problem: emptyProblem(data), modCardMode: "auto",
        constraints: { minCustom, bugRules: Object.fromEntries(BUG_SPEC_OPTIONS.map(b => [b.id, "allowed_any"])) } };
}
function tiny(opts, id, width) {
    const index = opts.data.partMetas.findIndex(meta => meta.id === id);
    opts.data.partMetas = [opts.data.partMetas[index]];
    opts.data.parts = [{ ...opts.data.parts[index],
        compressedMask: from([true, ...new Array(width - 1).fill(false)], 1, width),
        uncompressedMask: from([true, ...new Array(width - 1).fill(false)], 1, width) }];
    opts.data.gridOptions = [{ label: "fixture", settings: { height: 1, width, commandLineRow: 0, hasOob: false } }];
    opts.problem.expansionMemories = 0;
}

test("Custom starts at five and includes NC bonuses, card bonuses and penalties", () => {
    const analysis = { activeBugs: [] };
    assert.equal(computeBuildStats("bn6", []).custom, 5);
    assert.equal(computeBuildStats("bn6", [2]).custom, 6);
    assert.equal(computeBuildStats("bn6", [3, 3]).custom, 9);
    assert.equal(computeBuildStats("bn6", [], ["137-A031"]).custom, 8); // NumberMan +3.
    const reduced = computeBuildStats("bn6", [], ["137-A050"]); // GrndMan -1.
    assert.equal(reduced.custom, 4);
    assert.equal(doesBuildSatisfyConstraints(reduced, analysis, { minCustom: 5 }), false);
    assert.equal(computeBuildStats("bn6", [2], ["137-A050"]).custom, 5);
    const ten = computeBuildStats("bn6", [3, 3, 3]);
    assert.equal(ten.custom, 10);
    assert.ok(doesBuildSatisfyConstraints(ten, analysis, { minCustom: 8 }));
    assert.equal(computeBuildStats("bn6", [15]).custom, 10);
});

test("NC-only minimum eight can be reached incrementally from five", () => {
    const opts = options(8);
    opts.modCardMode = "none";
    tiny(opts, 2, 3); // Only Custom+1 is available.
    const first = findFeasibleBuild({ ...opts, shouldStop: () => false });
    assert.ok(first);
    assert.equal(first.stats.custom, 8);
    assert.equal(first.addedPartIndices.length, 3);
    const exact = searchBuilds(opts);
    assert.equal(exact.completed, true);
    assert.equal(exact.best.stats.custom, 8);
    opts.constraints.minCustom = 9;
    const impossible = searchBuilds(opts);
    assert.equal(impossible.completed, true);
    assert.equal(impossible.best, null);
});

test("NumberOpen and card-supplied Custom both satisfy the numerical minimum", () => {
    const opts = options(10);
    opts.modCardMode = "none";
    tiny(opts, 15, 1);
    const result = searchBuilds(opts);
    assert.equal(result.completed, true);
    assert.equal(result.best.stats.custom, 10);
    const cards = options(8);
    cards.modCardMode = "keep";
    cards.problem.modCards = ["137-A031"];
    const first = findFeasibleBuild({ ...cards, shouldStop: () => false });
    assert.ok(first);
    assert.equal(first.stats.custom, 8);
    assert.equal(first.problem.requirements.length, 0);
});

test("a minimum of five requires compensation for a fixed negative Custom card", () => {
    const opts = options(5);
    opts.modCardMode = "keep";
    opts.problem.modCards = ["137-A050"];
    tiny(opts, 2, 1);
    const first = findFeasibleBuild({ ...opts, shouldStop: () => false });
    assert.ok(first);
    assert.equal(first.stats.custom, 5);
    assert.equal(first.problem.requirements.length, 1);
    const exact = searchBuilds(opts);
    assert.equal(exact.completed, true);
    assert.equal(exact.best.stats.custom, 5);
});

test("local improvements retain the selected minimum Custom count", () => {
    const opts = options(8);
    const first = findFeasibleBuild({ ...opts, shouldStop: () => false });
    assert.ok(first);
    const deadline = Date.now() + 300;
    let changes = 0;
    const best = improveBuildLocally({ ...opts, initialBest: first, shouldStop: () => Date.now() >= deadline,
        onImprove: result => {
            assert.ok(result.stats.custom >= 8);
            assert.ok(doesBuildSatisfyConstraints(result.stats, result.analysis, opts.constraints));
            changes++;
        } });
    assert.ok(changes > 0);
    assert.ok(best.stats.custom >= 8);
});

test("minimum Custom counts round-trip in shared links and validate the 5..10 range", () => {
    const opts = options(8);
    for (const minCustom of [5, 6, 7, 8, 9, 10]) {
        const problem = { ...opts.problem, constraints: { minCustom } };
        const saved = toHashString(problem, opts.data);
        assert.deepEqual(fromHashString(saved, opts.data).constraints, problem.constraints);
        if (minCustom === 8) {
            for (const invalid of [4, 11, 7.5, "8"]) {
                const malformed = JSON.parse(saved);
                malformed.bc.cm = invalid;
                assert.throws(() => fromHashString(JSON.stringify(malformed), opts.data));
            }
        }
    }
    const restored = fromHashString(toHashString(opts.problem, opts.data), opts.data);
    assert.equal(restored.constraints?.minCustom, undefined);
});
