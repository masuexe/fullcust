require("./register.cjs");
const assert = require("node:assert/strict");
const { test } = require("node:test");
const { games } = require("../games.ts");
const { parseGameData } = require("../game-data.ts");
const { emptyProblem, getBusterMinimums, toHashString, fromHashString } = require("../problem.ts");
const { BUG_SPEC_OPTIONS, computeBuildStats } = require("../effects.ts");
const { doesBuildSatisfyConstraints, busterMinimumsPossible } = require("../optimizer.ts");
const { findFeasibleBuild } = require("../feasible-optimizer.ts");
const { searchBuilds } = require("../exhaustive-optimizer.ts");
const { improveBuildLocally } = require("../local-optimizer.ts");
const { from } = require("../array2d.ts");

function options(minBusterStats = {}) {
    const data = parseGameData(require("../data/bn6.json"), games.find(g => g.id === "bn6"));
    return { data, problem: emptyProblem(data), modCardMode: "auto",
        constraints: { minBusterStats, bugRules: Object.fromEntries(BUG_SPEC_OPTIONS.map(b => [b.id, "allowed_any"])) } };
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

test("BN6 attack can exceed five through card effects, while NC and Rapid/Charge stay capped", () => {
    assert.equal(computeBuildStats("bn6", [38]).attack, 5);
    assert.equal(computeBuildStats("bn6", [38], ["137-B013"]).attack, 6); // Needler +1.
    const doubled = computeBuildStats("bn6", [38], ["137-A036"]); // KnightMan ×2.
    assert.equal(doubled.attack, 10);
    assert.equal(doubled.attackMax, true);
    assert.equal(computeBuildStats("bn6", [38], ["137-A036", "137-A019"]).attack, 9);
    assert.equal(computeBuildStats("bn6", [38], ["137-A036", "137-A035"]).attack, 10);
    assert.equal(computeBuildStats("bn6", new Array(8).fill(35), ["137-B028"]).attack, 5,
        "Extra NC Attack+1 copies cannot overflow the NC cap through a neutral card");
    const stats = computeBuildStats("bn6", [39, 40], ["137-C003"]);
    assert.equal(stats.rapid, 5);
    assert.equal(stats.charge, 5);
});

test("numeric Buster minima accept higher values and legacy Lv5 remains compatible", () => {
    const stats = computeBuildStats("bn6", [38, 36, 40], ["137-A036"]);
    const analysis = { activeBugs: [] };
    assert.ok(doesBuildSatisfyConstraints(stats, analysis, { minBusterStats: { attack: 8, rapid: 2, charge: 5 } }));
    assert.ok(!doesBuildSatisfyConstraints(stats, analysis, { minBusterStats: { rapid: 3 } }));
    assert.ok(doesBuildSatisfyConstraints(stats, analysis, { requiredMaxBusterStats: ["attack"] }));
    assert.deepEqual(getBusterMinimums({ requiredMaxBusterStats: ["attack", "charge"], minBusterStats: { attack: 8, rapid: 2 } }),
        { attack: 8, rapid: 2, charge: 5 });
});

test("complete NC search supports incremental minimums below five", () => {
    const opts = options({ attack: 3 });
    opts.modCardMode = "none";
    tiny(opts, 35, 2);
    const result = searchBuilds(opts);
    assert.equal(result.completed, true);
    assert.ok(result.best);
    assert.equal(result.best.stats.attack, 3);
    assert.equal(result.best.addedPartIndices.length, 2);
    opts.constraints.minBusterStats.attack = 4;
    const impossible = searchBuilds(opts);
    assert.equal(impossible.completed, true);
    assert.equal(impossible.best, null);
});

test("first and exhaustive search combine NC and cards for Attack >=10", () => {
    const automatic = options({ attack: 10 });
    const deadline = Date.now() + 3000;
    const autoSeed = findFeasibleBuild({ ...automatic, shouldStop: () => Date.now() >= deadline });
    assert.ok(autoSeed, "Automatic card selection must find an Attack 10 seed");
    assert.equal(autoSeed.stats.attack, 10);
    const opts = options({ attack: 10 });
    opts.modCardMode = "keep";
    opts.problem.modCards = ["137-A036"];
    tiny(opts, 38, 1);
    assert.ok(busterMinimumsPossible(opts));
    const first = findFeasibleBuild({ ...opts, shouldStop: () => false });
    assert.ok(first);
    assert.equal(first.stats.attack, 10);
    const result = searchBuilds(opts);
    assert.equal(result.completed, true);
    assert.equal(result.best.stats.attack, 10);
    opts.problem.modCards.push("137-A019"); // Attack -1 makes the fixed deck's upper bound nine.
    assert.equal(busterMinimumsPossible(opts), false);
    const fixedImpossible = searchBuilds(opts);
    assert.equal(fixedImpossible.completed, true);
    assert.equal(fixedImpossible.best, null);
    opts.modCardMode = "none";
    const noCards = searchBuilds(opts);
    assert.equal(noCards.completed, true);
    assert.equal(noCards.best, null);
    assert.equal(noCards.checkedBuilds, 0);
});

test("local improvements preserve arbitrary Buster minima", () => {
    const opts = options({ attack: 4, rapid: 2, charge: 4 });
    const first = findFeasibleBuild({ ...opts, shouldStop: () => false });
    assert.ok(first);
    const deadline = Date.now() + 300;
    let changes = 0;
    const best = improveBuildLocally({ ...opts, initialBest: first, shouldStop: () => Date.now() >= deadline,
        onImprove: result => {
            assert.ok(doesBuildSatisfyConstraints(result.stats, result.analysis, opts.constraints));
            changes++;
        } });
    assert.ok(changes > 0);
    assert.ok(doesBuildSatisfyConstraints(best.stats, best.analysis, opts.constraints));
});

test("Buster minima round-trip in shared links and reject out-of-range thresholds", () => {
    const opts = options({ attack: 10, rapid: 2, charge: 4 });
    opts.problem.constraints = opts.constraints;
    const saved = toHashString(opts.problem, opts.data);
    assert.deepEqual(fromHashString(saved, opts.data).constraints, opts.constraints);
    for (const invalid of [{ attack: 11 }, { rapid: 6 }, { charge: 0 }, { attack: 2.5 }]) {
        const malformed = JSON.parse(saved);
        malformed.bc.bm = invalid;
        assert.throws(() => fromHashString(JSON.stringify(malformed), opts.data));
    }
    const old = { ...opts.problem, constraints: { requiredMaxBusterStats: ["attack"] } };
    const restored = fromHashString(toHashString(old, opts.data), opts.data);
    assert.deepEqual(getBusterMinimums(restored.constraints), { attack: 5 });
});
