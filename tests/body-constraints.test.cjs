require("./register.cjs");
const assert = require("node:assert/strict");
const { test } = require("node:test");
const { games } = require("../games.ts");
const { parseGameData } = require("../game-data.ts");
const { BODY_ELEMENTS, emptyProblem, makeGridSettings, toHashString, fromHashString } = require("../problem.ts");
const { BUG_SPEC_OPTIONS, analyzeSolutionBugs, computeBuildStats } = require("../effects.ts");
const { getModCards, computeDeckStats } = require("../modcards.ts");
const { bodyConstraintsPossible, doesBuildSatisfyConstraints, isBodyAllowed, matchBody, optimizeBuild, optimizeModCards } = require("../optimizer.ts");
const { findFeasibleBuild } = require("../feasible-optimizer.ts");
const { searchBuilds } = require("../exhaustive-optimizer.ts");
const { improveBuildLocally } = require("../local-optimizer.ts");

const allowed = ["Normal", "Fire", "Elec"];
function options(constraints = {}) {
    const data = parseGameData(require("../data/bn6.json"), games.find(g => g.id === "bn6"));
    return { data, problem: emptyProblem(data), modCardMode: "auto",
        constraints: { allowedBodies: [...allowed], bugRules: Object.fromEntries(BUG_SPEC_OPTIONS.map(b => [b.id, "allowed_any"])), ...constraints } };
}
function analysisFor(opts, cards = []) {
    const grid = makeGridSettings(opts.data, opts.problem);
    return analyzeSolutionBugs("bn6", opts.data.partMetas, [], new Array(grid.height * grid.width).fill(null), grid, "en", cards);
}

test("a body allowance accepts any selected final body, including implicit Normal", () => {
    const opts = options();
    for (const body of BODY_ELEMENTS) {
        const card = getModCards("bn6").find(c => c.body === body);
        assert.ok(card);
        const stats = computeBuildStats("bn6", [], [card.id], 1000);
        assert.equal(doesBuildSatisfyConstraints(stats, analysisFor(opts, [card.id]), opts.constraints), allowed.includes(body));
    }
    const normal = computeBuildStats("bn6", [], [], 1000);
    assert.equal(normal.modBody, undefined);
    assert.ok(doesBuildSatisfyConstraints(normal, analysisFor(opts), opts.constraints));
    assert.ok(matchBody(undefined, "Normal"));
    assert.ok(!matchBody(undefined, "Wood"));
    assert.ok(!isBodyAllowed(undefined, { allowedBodies: ["Fire", "Elec"] }));
});

test("a forbidden intermediate body can be overwritten by a later allowed body", () => {
    const opts = options();
    // Spidy sets Wood; Volcano sets Fire. Final card order determines legality.
    opts.problem.modCards = ["137-A016", "137-A013"];
    opts.modCardMode = "keep";
    // No NC programs are necessary, making exhaustion small and deterministic.
    opts.data.parts = [];
    opts.data.partMetas = [];
    const valid = searchBuilds(opts);
    assert.equal(valid.completed, true);
    assert.ok(valid.best);
    assert.equal(valid.best.stats.modBody, "Fire");
    opts.problem.modCards.reverse();
    const invalid = searchBuilds(opts);
    assert.equal(invalid.completed, true);
    assert.equal(invalid.best, null);
    assert.equal(findFeasibleBuild({ ...opts, shouldStop: () => false }), null);
    assert.equal(optimizeBuild(opts), null);
});

test("first-solution search can pick either allowed non-Normal element without fixing one in advance", () => {
    const opts = options({ allowedBodies: ["Fire", "Elec"] });
    const deadline = Date.now() + 3000;
    const first = findFeasibleBuild({ ...opts, shouldStop: () => Date.now() >= deadline });
    assert.ok(first);
    assert.ok(["Fire", "Elec"].includes(first.stats.modBody));
    const normalOnly = findFeasibleBuild({ ...options({ allowedBodies: ["Normal"] }), modCardMode: "none", shouldStop: () => false });
    assert.ok(normalOnly);
    assert.equal(normalOnly.problem.modCards.length, 0, "No body card is needed for Normal");
});

test("automatic card optimization respects the allow-list and actual Normal setters", () => {
    const opts = options();
    for (const bodies of [allowed, ["Fire", "Elec"], ["Normal"]]) {
        const constraints = { ...opts.constraints, allowedBodies: bodies };
        const ids = optimizeModCards({ gameId: "bn6", constraints, policy: { type: "custom", customRules: constraints.bugRules } });
        const deck = computeDeckStats(ids, "bn6");
        assert.ok(!deck.isOverCapacity);
        assert.ok(isBodyAllowed(deck.body, constraints));
    }
    const ids = optimizeModCards({ gameId: "bn6", existingCardIds: ["137-A016"],
        constraints: { requiredBody: "Normal" }, policy: { type: "custom", customRules: opts.constraints.bugRules } });
    const deck = computeDeckStats(ids, "bn6");
    assert.ok(!deck.isOverCapacity);
    assert.equal(deck.body, "Normal", "A neutral card must not be mistaken for a Normal-body reset");
});

test("no allowed body and contradictory legacy requirements are proven impossible without deck enumeration", () => {
    for (const bodyConstraints of [{ allowedBodies: [] }, { requiredBody: "Wood", allowedBodies: allowed }]) {
        const opts = options(bodyConstraints);
        assert.equal(bodyConstraintsPossible(opts.constraints), false);
        assert.equal(findFeasibleBuild({ ...opts, shouldStop: () => false }), null);
        assert.equal(optimizeBuild(opts), null);
        const result = searchBuilds(opts);
        assert.equal(result.completed, true);
        assert.equal(result.best, null);
        assert.equal(result.checkedBuilds, 0);
    }
    assert.ok(bodyConstraintsPossible({ requiredBody: "Fire", allowedBodies: allowed }));
});

test("local improvements retain all requested battle specs and allowed bodies", () => {
    const opts = options({ requiredAbilities: ["superArmor", "airShoes", "underShirt", "chipRecovery"],
        requiredSpecialMove: "DrillArm", requiredMaxBusterStats: ["charge"], minChipRecovery: 30 });
    const first = findFeasibleBuild({ ...opts, shouldStop: () => false });
    assert.ok(first);
    const deadline = Date.now() + 300;
    let improvements = 0;
    const best = improveBuildLocally({ ...opts, initialBest: first, shouldStop: () => Date.now() >= deadline,
        onImprove: result => {
            assert.ok(allowed.includes(result.stats.modBody ?? "Normal"));
            assert.ok(doesBuildSatisfyConstraints(result.stats, result.analysis, opts.constraints));
            improvements++;
        } });
    assert.ok(improvements > 0);
    assert.ok(allowed.includes(best.stats.modBody ?? "Normal"));
});

test("body allowance lists survive shared links alongside legacy scalar body requirements", () => {
    const opts = options();
    for (const bodies of [allowed, ["Normal"], []]) {
        const problem = { ...opts.problem, constraints: { allowedBodies: bodies } };
        const saved = toHashString(problem, opts.data);
        assert.deepEqual(fromHashString(saved, opts.data).constraints, problem.constraints);
        const invalid = JSON.parse(saved);
        invalid.bc.ab = ["Ice"];
        assert.throws(() => fromHashString(JSON.stringify(invalid), opts.data));
    }
    const old = { ...opts.problem, constraints: { requiredBody: "Wood" } };
    const restored = fromHashString(toHashString(old, opts.data), opts.data);
    assert.equal(restored.constraints.requiredBody, "Wood");
    assert.equal(restored.constraints.allowedBodies, undefined);
    assert.ok(isBodyAllowed("Wood", restored.constraints));
    assert.ok(!isBodyAllowed("Fire", restored.constraints));
});

test("BN4 ignores body constraints in solver, mode constraints, and build satisfaction", () => {
    const { getOptimizerModeConstraints } = require("../optimizer-options.ts");
    const bn4Data = parseGameData(require("../data/bn4.json"), games.find(g => g.id === "bn4"));
    const rawConstraints = { allowedBodies: ["Fire", "Elec"], requiredBody: "Wood" };
    const filtered = getOptimizerModeConstraints(bn4Data, rawConstraints, "auto");
    assert.equal(filtered.allowedBodies, undefined);
    assert.equal(filtered.requiredBody, undefined);

    assert.equal(isBodyAllowed(undefined, { allowedBodies: ["Fire"] }, "bn4"), true);
    assert.equal(isBodyAllowed("Normal", { allowedBodies: ["Wood"] }, "bn4"), true);

    const stats = computeBuildStats("bn4", [], [], 1000);
    const analysis = analyzeSolutionBugs("bn4", [], [], new Array(25).fill(null), { width: 5, height: 5, commandLineRow: 2, hasOob: false }, "en", []);
    assert.equal(doesBuildSatisfyConstraints(stats, analysis, { allowedBodies: ["Fire"] }, "bn4"), true);
});

