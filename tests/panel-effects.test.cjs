require("./register.cjs");
const assert = require("node:assert/strict");
const { test } = require("node:test");
const { computeDeckStats } = require("../modcards.ts");
const { analyzeSolutionBugs, computeBuildStats, isSolutionAcceptable } = require("../effects.ts");
const { doesBuildSatisfyConstraints } = require("../optimizer.ts");
const { expandPanelBugRules, getDefaultBugRules, BN6_DEFAULT_FORBIDDEN_BUGS, BN5_DEFAULT_FORBIDDEN_BUGS } = require("../panel-effects.ts");
const { getOptimizerBugOptions } = require("../optimizer-options.ts");
const { parseGameData } = require("../game-data.ts");
const { games } = require("../games.ts");
const { emptyProblem, toHashString, fromHashString } = require("../problem.ts");
const { findFeasibleBuild } = require("../feasible-optimizer.ts");
const { searchBuilds } = require("../exhaustive-optimizer.ts");
const grid = { width: 5, height: 5, commandLineRow: 2, hasOob: false };
const analysis = cards => analyzeSolutionBugs("bn6", [], [], new Array(25).fill(null), grid, "en", cards);
const dataFor = () => parseGameData(require("../data/bn6.json"), games.find(g => g.id === "bn6"));

test("grass, ice, cracking, and movement are independent final requirements", () => {
    for (const [card, type] of [["137-A016", "panelGrass"], ["137-A003", "panelIce"], ["137-A051", "panelCrack"]]) {
        const a = analysis([card]);
        assert.ok(a.activeBugs.some(b => b.bugType === type));
        const rules = { [type]: "required", movement: "forbidden" };
        assert.ok(isSolutionAcceptable(a, { type: "custom" }, [], rules));
        assert.ok(doesBuildSatisfyConstraints(computeBuildStats("bn6", [], [card]), a, { bugRules: rules }));
        for (const other of ["panelGrass", "panelIce", "panelCrack"].filter(t => t !== type)) {
            assert.equal(isSolutionAcceptable(a, { type: "custom" }, [], { [type]: "allowed_any", [other]: "required" }), false);
        }
    }
});

test("a specific required panel effect is an exception to a broad forbidden panel default", () => {
    const rules = { panel: "forbidden", panelGrass: "required" };
    assert.ok(isSolutionAcceptable(analysis(["137-A016"]), { type: "custom" }, [], rules));
    assert.equal(isSolutionAcceptable(analysis(["137-A003"]), { type: "custom" }, [], rules), false);
    assert.ok(isSolutionAcceptable(analysis(["137-A016"]), { type: "custom" }, [], { panel: "required" }));
    assert.deepEqual(expandPanelBugRules("bn6", { panel: "allowed_any", panelIce: "forbidden" }),
        { panelGrass: "allowed_any", panelIce: "forbidden", panelCrack: "allowed_any" });
    assert.deepEqual(expandPanelBugRules("bn5", { panel: "allowed_any", panelIce: "forbidden" }),
        { panelGrass: "allowed_any", panelIce: "forbidden", panelCrack: "allowed_any", panelHoly: "allowed_any", panelSea: "allowed_any", panelHole: "allowed_any" });
});

test("repairs and later panel writes determine the effective terrain without stale movePanel", () => {
    for (const cards of [["137-A016", "137-A017"], ["137-A016", "137-B053"]]) {
        assert.equal(computeDeckStats(cards, "bn6").movePanel, undefined);
        assert.equal(computeBuildStats("bn6", [], cards).modPanelEffect, undefined);
        assert.ok(!analysis(cards).activeBugs.some(b => b.bugType === "panelGrass"));
    }
    assert.equal(computeDeckStats(["137-A016", "137-A003"], "bn6").movePanel, "Ice Panel");
    assert.equal(computeBuildStats("bn6", [], ["137-A016", "137-A003"]).modPanelEffect, "panelIce");
    assert.equal(computeDeckStats(["137-A016", "137-A051"], "bn6").movePanel, undefined);
    assert.equal(computeBuildStats("bn6", [], ["137-A016", "137-A051"]).modPanelEffect, "panelCrack");
    assert.equal(computeBuildStats("bn6", [], ["137-A017", "137-A016"]).modPanelEffect, "panelGrass");
});

test("first-solution selection actively supplies required grass instead of relying on exhaustive luck", () => {
    const data = dataFor();
    data.partMetas = []; data.parts = [];
    const problem = emptyProblem(data);
    const constraints = { bugRules: { panelGrass: "required", movement: "forbidden" } };
    const deadline = Date.now() + 1000;
    const first = findFeasibleBuild({ data, problem, constraints, modCardMode: "auto", shouldStop: () => Date.now() >= deadline });
    assert.ok(first);
    assert.equal(first.stats.modPanelEffect, "panelGrass");
    assert.ok(first.analysis.activeBugs.some(b => b.bugType === "panelGrass"));
    const restored = fromHashString(toHashString({ ...first.problem, constraints }, data), data);
    assert.deepEqual(restored.constraints.bugRules, constraints.bugRules);
    const exact = searchBuilds({ data, problem: first.problem, constraints, modCardMode: "keep" });
    assert.ok(exact.best);
});

test("BN6 UI exposes individual terrain controls, and pure NC exposes only cracking", () => {
    const data = dataFor();
    const pure = getOptimizerBugOptions(data, false).map(o => o.id);
    const cards = getOptimizerBugOptions(data, true).map(o => o.id);
    assert.ok(pure.includes("panelCrack"));
    assert.ok(!pure.includes("panelGrass"));
    assert.ok(!pure.includes("panelIce"));
    for (const type of ["panelGrass", "panelIce", "panelCrack", "movement"]) assert.ok(cards.includes(type));
    assert.ok(!cards.includes("panel"));
});

test("BN6 defaults only movement, custom, panelCrack, panelIce, and support to forbidden; others are allowed", () => {
    const rules = getDefaultBugRules("bn6");
    const forbidden = BN6_DEFAULT_FORBIDDEN_BUGS;
    for (const bug of forbidden) {
        assert.equal(rules[bug], "forbidden", `expected ${bug} to be forbidden`);
    }
    const expectedAllowed = [
        "battleHp", "damageHp", "buster", "customHp",
        "panelGrass", "status", "emotion", "customDamage",
        "damageConfusion", "encounter", "resultZenny",
    ];
    for (const bug of expectedAllowed) {
        assert.equal(rules[bug], "allowed", `expected ${bug} to be allowed`);
    }
    const data = dataFor();
    const bugOptions = getOptimizerBugOptions(data, true).map(o => o.id);
    for (const optId of bugOptions) {
        assert.ok(rules[optId] !== undefined, `expected rule for option ${optId}`);
    }
    for (const game of ["bn3", "bn4"]) {
        assert.deepEqual(getDefaultBugRules(game), {});
    }
});

test("BN5 defaults movement, panelCrack, panelIce, panelHole, and support to forbidden; allowed bugs include battleHp, buster, status, emotion, customDamage, encounter, resultZenny, panelGrass, panelHoly", () => {
    const rules = getDefaultBugRules("bn5");
    const forbidden = BN5_DEFAULT_FORBIDDEN_BUGS;
    for (const bug of forbidden) {
        assert.equal(rules[bug], "forbidden", `expected ${bug} to be forbidden`);
    }
    const expectedAllowed = [
        "battleHp", "buster", "status", "emotion", "customDamage",
        "encounter", "resultZenny", "panelGrass", "panelHoly",
    ];
    for (const bug of expectedAllowed) {
        assert.equal(rules[bug], "allowed", `expected ${bug} to be allowed`);
    }
});
