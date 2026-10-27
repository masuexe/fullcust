require("./register.cjs");
const assert = require("node:assert/strict");
const { test } = require("node:test");
const { games } = require("../games.ts");
const { parseGameData } = require("../game-data.ts");
const { GAUGE_VALUES, emptyProblem, makeGridSettings, toHashString, fromHashString } = require("../problem.ts");
const { BUG_SPEC_OPTIONS, analyzeSolutionBugs, computeBuildStats } = require("../effects.ts");
const { getModCards, computeDeckStats } = require("../modcards.ts");
const { gaugeConstraintsPossible, doesBuildSatisfyConstraints, isGaugeAllowed, matchGauge, optimizeBuild, optimizeModCards, orderModCardsForConstraints } = require("../optimizer.ts");
const { findFeasibleBuild } = require("../feasible-optimizer.ts");
const { searchBuilds } = require("../exhaustive-optimizer.ts");

function options(constraints = {}) {
    const data = parseGameData(require("../data/bn6.json"), games.find(g => g.id === "bn6"));
    return {
        data,
        problem: emptyProblem(data),
        modCardMode: "auto",
        constraints: {
            bugRules: Object.fromEntries(BUG_SPEC_OPTIONS.map(b => [b.id, "allowed_any"])),
            ...constraints,
        },
    };
}

function analysisFor(opts, cards = []) {
    const grid = makeGridSettings(opts.data, opts.problem);
    return analyzeSolutionBugs("bn6", opts.data.partMetas, [], new Array(grid.height * grid.width).fill(null), grid, "en", cards);
}

test("isGaugeAllowed handles implicit Normal and all allowedGauges combinations", () => {
    // Default / no constraints allows everything
    assert.ok(isGaugeAllowed(undefined, {}));
    assert.ok(isGaugeAllowed("fast", {}));
    assert.ok(isGaugeAllowed("normal", {}));
    assert.ok(isGaugeAllowed("slow", {}));

    // Not slow: ["fast", "normal"]
    const notSlow = { allowedGauges: ["fast", "normal"] };
    assert.ok(isGaugeAllowed(undefined, notSlow));
    assert.ok(isGaugeAllowed("normal", notSlow));
    assert.ok(isGaugeAllowed("fast", notSlow));
    assert.ok(!isGaugeAllowed("slow", notSlow));

    // Not fast: ["normal", "slow"]
    const notFast = { allowedGauges: ["normal", "slow"] };
    assert.ok(isGaugeAllowed(undefined, notFast));
    assert.ok(isGaugeAllowed("normal", notFast));
    assert.ok(isGaugeAllowed("slow", notFast));
    assert.ok(!isGaugeAllowed("fast", notFast));

    // Fast only: ["fast"]
    const fastOnly = { allowedGauges: ["fast"] };
    assert.ok(!isGaugeAllowed(undefined, fastOnly));
    assert.ok(!isGaugeAllowed("normal", fastOnly));
    assert.ok(isGaugeAllowed("fast", fastOnly));
    assert.ok(!isGaugeAllowed("slow", fastOnly));

    // Slow only: ["slow"]
    const slowOnly = { allowedGauges: ["slow"] };
    assert.ok(!isGaugeAllowed(undefined, slowOnly));
    assert.ok(!isGaugeAllowed("normal", slowOnly));
    assert.ok(!isGaugeAllowed("fast", slowOnly));
    assert.ok(isGaugeAllowed("slow", slowOnly));

    // Normal only: ["normal"]
    const normalOnly = { allowedGauges: ["normal"] };
    assert.ok(isGaugeAllowed(undefined, normalOnly));
    assert.ok(isGaugeAllowed("normal", normalOnly));
    assert.ok(!isGaugeAllowed("fast", normalOnly));
    assert.ok(!isGaugeAllowed("slow", normalOnly));
});

test("doesBuildSatisfyConstraints respects allowedGauges", () => {
    const opts = options({ allowedGauges: ["fast", "normal"] });

    // Normal build (no mod cards)
    const normal = computeBuildStats("bn6", [], [], 1000);
    assert.equal(normal.modGauge, undefined);
    assert.ok(doesBuildSatisfyConstraints(normal, analysisFor(opts), opts.constraints));

    // Fast card: VideoMan (137-A043)
    const fastStats = computeBuildStats("bn6", [], ["137-A043"], 1000);
    assert.equal(fastStats.modGauge, "fast");
    assert.ok(doesBuildSatisfyConstraints(fastStats, analysisFor(opts, ["137-A043"]), opts.constraints));

    // Slow card: Jelly (137-B003)
    const slowStats = computeBuildStats("bn6", [], ["137-B003"], 1000);
    assert.equal(slowStats.modGauge, "slow");
    assert.ok(!doesBuildSatisfyConstraints(slowStats, analysisFor(opts, ["137-B003"]), opts.constraints));
});

test("intermediate gauge speed can be overwritten by subsequent cards", () => {
    const opts = options({ allowedGauges: ["fast", "normal"] });
    // Jelly (137-B003, slow) followed by Zero (137-C008, fast) -> final is fast
    opts.problem.modCards = ["137-B003", "137-C008"];
    opts.modCardMode = "keep";
    opts.data.parts = [];
    opts.data.partMetas = [];

    const valid = searchBuilds(opts);
    assert.equal(valid.completed, true);
    assert.ok(valid.best);
    assert.equal(valid.best.stats.modGauge, "fast");

    // Reversed: Zero (fast) then Jelly (slow) -> final is slow, illegal
    opts.problem.modCards.reverse();
    const invalid = searchBuilds(opts);
    assert.equal(invalid.completed, true);
    assert.equal(invalid.best, null);
    assert.equal(findFeasibleBuild({ ...opts, shouldStop: () => false }), null);
    assert.equal(optimizeBuild(opts), null);
});

test("orderModCardsForConstraints orders allowed gauge cards after forbidden ones", () => {
    const constraints = { allowedGauges: ["fast", "normal"] };
    // Start with Zero (fast) then Jelly (slow)
    const ordered = orderModCardsForConstraints(["137-C008", "137-B003"], "bn6", constraints);
    // The allowed gauge card (Zero) should be sorted to the end
    assert.deepEqual(ordered, ["137-B003", "137-C008"]);
    const deck = computeDeckStats(ordered, "bn6");
    assert.equal(deck.gauge, "fast");
    assert.ok(isGaugeAllowed(deck.gauge, constraints));
});

test("automatic card optimization respects allowedGauges allow-list", () => {
    const opts = options();

    // Not slow: ["fast", "normal"]
    for (let i = 0; i < 3; i++) {
        const constraints = { ...opts.constraints, allowedGauges: ["fast", "normal"] };
        const ids = optimizeModCards({ gameId: "bn6", constraints, policy: { type: "custom", customRules: constraints.bugRules } });
        const deck = computeDeckStats(ids, "bn6");
        assert.ok(!deck.isOverCapacity);
        assert.notEqual(deck.gauge, "slow");
        assert.ok(isGaugeAllowed(deck.gauge, constraints));
    }

    // Not fast: ["normal", "slow"]
    for (let i = 0; i < 3; i++) {
        const constraints = { ...opts.constraints, allowedGauges: ["normal", "slow"] };
        const ids = optimizeModCards({ gameId: "bn6", constraints, policy: { type: "custom", customRules: constraints.bugRules } });
        const deck = computeDeckStats(ids, "bn6");
        assert.ok(!deck.isOverCapacity);
        assert.notEqual(deck.gauge, "fast");
        assert.ok(isGaugeAllowed(deck.gauge, constraints));
    }

    // Fast only: ["fast"]
    {
        const constraints = { ...opts.constraints, allowedGauges: ["fast"] };
        const ids = optimizeModCards({ gameId: "bn6", constraints, policy: { type: "custom", customRules: constraints.bugRules } });
        const deck = computeDeckStats(ids, "bn6");
        assert.ok(!deck.isOverCapacity);
        assert.equal(deck.gauge, "fast");
        assert.ok(isGaugeAllowed(deck.gauge, constraints));
    }
});

test("empty or contradictory gauge constraints are detected early", () => {
    assert.equal(gaugeConstraintsPossible({ allowedGauges: [] }), false);
    assert.equal(gaugeConstraintsPossible({ allowedGauges: ["fast"], requiredGauge: "slow" }), false);
    assert.equal(gaugeConstraintsPossible({ allowedGauges: ["fast", "normal"], requiredGauge: "slow" }), false);
    assert.equal(gaugeConstraintsPossible({ allowedGauges: ["fast", "normal"], requiredGauge: "fast" }), true);

    const impossible = options({ allowedGauges: [] });
    assert.equal(gaugeConstraintsPossible(impossible.constraints), false);
    assert.equal(findFeasibleBuild({ ...impossible, shouldStop: () => false }), null);
    assert.equal(optimizeBuild(impossible), null);
    const result = searchBuilds(impossible);
    assert.equal(result.completed, true);
    assert.equal(result.best, null);
    assert.equal(result.checkedBuilds, 0);
});

test("allowedGauges survives URL hash serialization and round-trips", () => {
    const opts = options();

    // Partial allow-lists are saved in hash
    for (const gauges of [["fast", "normal"], ["normal", "slow"], ["fast"], ["slow"], []]) {
        const problem = { ...opts.problem, constraints: { allowedGauges: gauges } };
        const saved = toHashString(problem, opts.data);
        const restored = fromHashString(saved, opts.data);
        assert.deepEqual(restored.constraints.allowedGauges, gauges);
    }

    // All 3 allowed is the default and omitted from hash to keep links compact
    const allGaugesProblem = { ...opts.problem, constraints: { allowedGauges: ["fast", "normal", "slow"] } };
    const allSaved = toHashString(allGaugesProblem, opts.data);
    const parsedJson = JSON.parse(allSaved);
    assert.equal(parsedJson.bc?.ag, undefined);
    const allRestored = fromHashString(allSaved, opts.data);
    assert.equal(allRestored.constraints.allowedGauges, undefined);

    // Invalid gauge name in hash throws/rejects
    const invalid = JSON.parse(allSaved);
    invalid.bc = { ag: ["ultra_fast"] };
    assert.throws(() => fromHashString(JSON.stringify(invalid), opts.data));

    // Legacy requiredGauge persists and works alongside allowedGauges
    const legacy = { ...opts.problem, constraints: { requiredGauge: "not_slow" } };
    const legacySaved = toHashString(legacy, opts.data);
    const legacyRestored = fromHashString(legacySaved, opts.data);
    assert.equal(legacyRestored.constraints.requiredGauge, "not_slow");
    assert.equal(legacyRestored.constraints.allowedGauges, undefined);
    assert.ok(isGaugeAllowed("fast", legacyRestored.constraints));
    assert.ok(isGaugeAllowed(undefined, legacyRestored.constraints));
    assert.ok(!isGaugeAllowed("slow", legacyRestored.constraints));
});
