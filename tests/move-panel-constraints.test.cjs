require("./register.cjs");
const assert = require("node:assert/strict");
const { test } = require("node:test");
const { computeBuildStats, analyzeSolutionBugs, getEffectiveInBattleBugs } = require("../effects.ts");
const {
    doesBuildSatisfyConstraints,
    getEffectiveMovePanel,
    matchMovePanel,
    isMovePanelAllowed,
    cardSpecConstraintsPossible,
} = require("../optimizer.ts");
const { getOptimizerModeConstraints } = require("../optimizer-options.ts");
const { emptyProblem, toHashString, fromHashString } = require("../problem.ts");
const { findFeasibleBuild } = require("../feasible-optimizer.ts");
const { parseGameData } = require("../game-data.ts");
const { games } = require("../games.ts");

const grid = { width: 5, height: 5, commandLineRow: 2, hasOob: false };

const analysisFor = (gameId, cards, parts = [], placed = new Array(25).fill(null)) =>
    analyzeSolutionBugs(gameId, parts, [], placed, grid, "en", cards);

test("BN6: doesBuildSatisfyConstraints respects allowedMovePanels and crack levels", () => {
    const cleanAnalysis = analysisFor("bn6", []);
    const cleanStats = computeBuildStats("bn6", [], []);

    const spidyAnalysis = analysisFor("bn6", ["137-A016"]);
    const spidyStats = computeBuildStats("bn6", [], ["137-A016"]);

    const coldBearAnalysis = analysisFor("bn6", ["137-A003"]);
    const coldBearStats = computeBuildStats("bn6", [], ["137-A003"]);

    const dustManAnalysis = analysisFor("bn6", ["137-A051"]);
    const dustManStats = computeBuildStats("bn6", [], ["137-A051"]);

    // Effective move panels
    assert.equal(getEffectiveMovePanel(cleanAnalysis, "bn6", cleanStats), "none");
    assert.equal(getEffectiveMovePanel(spidyAnalysis, "bn6", spidyStats), "panelGrass");
    assert.equal(getEffectiveMovePanel(coldBearAnalysis, "bn6", coldBearStats), "panelIce");
    assert.equal(getEffectiveMovePanel(dustManAnalysis, "bn6", dustManStats), "panelCrack1");

    // Empty or undefined constraint allows anything
    assert.ok(doesBuildSatisfyConstraints(cleanStats, cleanAnalysis, undefined, "bn6"));
    assert.ok(doesBuildSatisfyConstraints(spidyStats, spidyAnalysis, {}, "bn6"));
    assert.ok(doesBuildSatisfyConstraints(coldBearStats, coldBearAnalysis, { allowedMovePanels: undefined }, "bn6"));

    // "none" constraint: only clean build passes
    const onlyNone = { allowedMovePanels: ["none"] };
    assert.ok(doesBuildSatisfyConstraints(cleanStats, cleanAnalysis, onlyNone, "bn6"));
    assert.ok(!doesBuildSatisfyConstraints(spidyStats, spidyAnalysis, onlyNone, "bn6"));
    assert.ok(!doesBuildSatisfyConstraints(coldBearStats, coldBearAnalysis, onlyNone, "bn6"));
    assert.ok(!doesBuildSatisfyConstraints(dustManStats, dustManAnalysis, onlyNone, "bn6"));

    // "panelGrass" constraint: only grass passes
    const onlyGrass = { allowedMovePanels: ["panelGrass"] };
    assert.ok(!doesBuildSatisfyConstraints(cleanStats, cleanAnalysis, onlyGrass, "bn6"));
    assert.ok(doesBuildSatisfyConstraints(spidyStats, spidyAnalysis, onlyGrass, "bn6"));
    assert.ok(!doesBuildSatisfyConstraints(coldBearStats, coldBearAnalysis, onlyGrass, "bn6"));

    // "panelIce" constraint: only ice passes
    const onlyIce = { allowedMovePanels: ["panelIce"] };
    assert.ok(doesBuildSatisfyConstraints(coldBearStats, coldBearAnalysis, onlyIce, "bn6"));
    assert.ok(!doesBuildSatisfyConstraints(spidyStats, spidyAnalysis, onlyIce, "bn6"));

    // "panelCrack1" constraint: Lv1 crack passes
    const onlyCrack1 = { allowedMovePanels: ["panelCrack1"] };
    assert.ok(!doesBuildSatisfyConstraints(cleanStats, cleanAnalysis, onlyCrack1, "bn6"));
    assert.ok(doesBuildSatisfyConstraints(dustManStats, dustManAnalysis, onlyCrack1, "bn6"));

    // NC placement bug simulation for AirShoes (part 12) off-command line (level 1 vs level 2)
    const airShoesPart = { id: 12, name: "AirShoes", color: 0, compressedMask: [1], uncompressedMask: [1], isSolid: true };
    const ncLv1Analysis = {
        hasBugs: true,
        bugStopActive: false,
        bugs: [],
        activeBugs: [{ bugType: "panelCrack", level: 1, title: "Panel Break Bug", mechanics: "" }],
        tooManyColors: false,
        distinctColorCount: 1,
    };
    const ncLv2Analysis = {
        hasBugs: true,
        bugStopActive: false,
        bugs: [],
        activeBugs: [{ bugType: "panelCrack", level: 2, title: "Panel Break Bug", mechanics: "" }],
        tooManyColors: false,
        distinctColorCount: 1,
    };
    const ncLv3Analysis = {
        hasBugs: true,
        bugStopActive: false,
        bugs: [],
        activeBugs: [{ bugType: "panelCrack", level: 3, title: "Panel Break Bug", mechanics: "" }],
        tooManyColors: false,
        distinctColorCount: 1,
    };

    assert.equal(getEffectiveMovePanel(ncLv1Analysis, "bn6"), "panelCrack1");
    assert.equal(getEffectiveMovePanel(ncLv2Analysis, "bn6"), "panelCrack2");
    assert.equal(getEffectiveMovePanel(ncLv3Analysis, "bn6"), "panelCrack3");

    // onlyCrack1: Lv1 passes, Lv2 and Lv3 fail
    assert.ok(doesBuildSatisfyConstraints(cleanStats, ncLv1Analysis, onlyCrack1, "bn6"));
    assert.ok(!doesBuildSatisfyConstraints(cleanStats, ncLv2Analysis, onlyCrack1, "bn6"));
    assert.ok(!doesBuildSatisfyConstraints(cleanStats, ncLv3Analysis, onlyCrack1, "bn6"));

    // Multi-select allowed: ["none", "panelCrack1"]
    const noneOrCrack1 = { allowedMovePanels: ["none", "panelCrack1"] };
    assert.ok(doesBuildSatisfyConstraints(cleanStats, cleanAnalysis, noneOrCrack1, "bn6"));
    assert.ok(doesBuildSatisfyConstraints(cleanStats, ncLv1Analysis, noneOrCrack1, "bn6"));
    assert.ok(!doesBuildSatisfyConstraints(cleanStats, ncLv2Analysis, noneOrCrack1, "bn6"));
    assert.ok(!doesBuildSatisfyConstraints(spidyStats, spidyAnalysis, noneOrCrack1, "bn6"));

    // BugStop absorbs NC placement panel bug -> becomes "none"
    const ncWithBugStop = {
        hasBugs: false,
        bugStopActive: true,
        bugs: [{ bugType: "panelCrack", level: 1, title: "Panel Break Bug", mechanics: "" }],
        activeBugs: [],
        tooManyColors: false,
        distinctColorCount: 1,
    };
    assert.equal(getEffectiveMovePanel(ncWithBugStop, "bn6"), "none");
    assert.ok(doesBuildSatisfyConstraints(cleanStats, ncWithBugStop, onlyNone, "bn6"));
});

test("BN5: doesBuildSatisfyConstraints handles BN5 unique panel effects", () => {
    // Lark (136-A017) -> panelHoly
    const larkAnalysis = analysisFor("bn5", ["136-A017"]);
    const larkStats = computeBuildStats("bn5", [], ["136-A017"]);
    assert.equal(getEffectiveMovePanel(larkAnalysis, "bn5", larkStats), "panelHoly");

    // ElecMan (136-A029) -> panelSea
    const elecAnalysis = analysisFor("bn5", ["136-A029"]);
    const elecStats = computeBuildStats("bn5", [], ["136-A029"]);
    assert.equal(getEffectiveMovePanel(elecAnalysis, "bn5", elecStats), "panelSea");

    // KillPlant (136-B007) -> panelGrass
    const killAnalysis = analysisFor("bn5", ["136-B007"]);
    const killStats = computeBuildStats("bn5", [], ["136-B007"]);
    assert.equal(getEffectiveMovePanel(killAnalysis, "bn5", killStats), "panelGrass");

    // Coripen (136-B019) -> panelIce
    const coriAnalysis = analysisFor("bn5", ["136-B019"]);
    const coriStats = computeBuildStats("bn5", [], ["136-B019"]);
    assert.equal(getEffectiveMovePanel(coriAnalysis, "bn5", coriStats), "panelIce");

    // Fan (136-B012) -> panelHole
    const fanAnalysis = analysisFor("bn5", ["136-B012"]);
    const fanStats = computeBuildStats("bn5", [], ["136-B012"]);
    assert.equal(getEffectiveMovePanel(fanAnalysis, "bn5", fanStats), "panelHole");

    // Constraints
    assert.ok(doesBuildSatisfyConstraints(larkStats, larkAnalysis, { allowedMovePanels: ["panelHoly"] }, "bn5"));
    assert.ok(!doesBuildSatisfyConstraints(elecStats, elecAnalysis, { allowedMovePanels: ["panelHoly"] }, "bn5"));
    assert.ok(doesBuildSatisfyConstraints(elecStats, elecAnalysis, { allowedMovePanels: ["panelSea"] }, "bn5"));
    assert.ok(doesBuildSatisfyConstraints(fanStats, fanAnalysis, { allowedMovePanels: ["panelHole"] }, "bn5"));

    // BN5 NC AirShoes bug Lv1 vs Lv2
    const bn5NcLv1 = {
        hasBugs: true,
        bugStopActive: false,
        bugs: [],
        activeBugs: [{ bugType: "panel", level: 1, title: "Panel Break Bug", mechanics: "" }],
        tooManyColors: false,
        distinctColorCount: 1,
    };
    const bn5NcLv2 = {
        hasBugs: true,
        bugStopActive: false,
        bugs: [],
        activeBugs: [{ bugType: "panel", level: 2, title: "Panel Break Bug", mechanics: "" }],
        tooManyColors: false,
        distinctColorCount: 1,
    };
    assert.equal(getEffectiveMovePanel(bn5NcLv1, "bn5"), "panelCrack1");
    assert.equal(getEffectiveMovePanel(bn5NcLv2, "bn5"), "panelCrack2");
    assert.ok(doesBuildSatisfyConstraints(larkStats, bn5NcLv1, { allowedMovePanels: ["panelCrack1"] }, "bn5"));
    assert.ok(!doesBuildSatisfyConstraints(larkStats, bn5NcLv2, { allowedMovePanels: ["panelCrack1"] }, "bn5"));
});

test("BN4: doesBuildSatisfyConstraints handles BN4 walk abilities and bugs", () => {
    // Metal Panel Walk (134-014)
    const metalStats = computeBuildStats("bn4", [], ["134-014"]);
    const metalAnalysis = analysisFor("bn4", ["134-014"]);
    assert.equal(metalStats.modPanelEffect, "panelMetal");
    assert.equal(getEffectiveMovePanel(metalAnalysis, "bn4", metalStats), "panelMetal");
    assert.ok(doesBuildSatisfyConstraints(metalStats, metalAnalysis, { allowedMovePanels: ["panelMetal"] }, "bn4"));

    // Holy Panel Walk (134-105)
    const holyStats = computeBuildStats("bn4", [], ["134-105"]);
    const holyAnalysis = analysisFor("bn4", ["134-105"]);
    assert.equal(holyStats.modPanelEffect, "panelHoly");
    assert.equal(getEffectiveMovePanel(holyAnalysis, "bn4", holyStats), "panelHoly");
    assert.ok(doesBuildSatisfyConstraints(holyStats, holyAnalysis, { allowedMovePanels: ["panelHoly"] }, "bn4"));

    // Poison Walk (134-091)
    const poisonStats = computeBuildStats("bn4", [], ["134-091"]);
    const poisonAnalysis = analysisFor("bn4", ["134-091"]);
    assert.equal(getEffectiveMovePanel(poisonAnalysis, "bn4", poisonStats), "panelPoison");
    assert.ok(doesBuildSatisfyConstraints(poisonStats, poisonAnalysis, { allowedMovePanels: ["panelPoison"] }, "bn4"));

    // BN4 NC levels: Lv1 -> Crack, Lv2 -> Hole, Lv3 -> Poison
    const bn4Lv1 = { activeBugs: [{ bugType: "panel", level: 1 }] };
    const bn4Lv2 = { activeBugs: [{ bugType: "panel", level: 2 }] };
    const bn4Lv3 = { activeBugs: [{ bugType: "panel", level: 3 }] };
    assert.equal(getEffectiveMovePanel(bn4Lv1, "bn4"), "panelCrack");
    assert.equal(getEffectiveMovePanel(bn4Lv2, "bn4"), "panelHole");
    assert.equal(getEffectiveMovePanel(bn4Lv3, "bn4"), "panelPoison");
    assert.ok(doesBuildSatisfyConstraints(metalStats, bn4Lv1, { allowedMovePanels: ["panelCrack"] }, "bn4"));
    assert.ok(doesBuildSatisfyConstraints(metalStats, bn4Lv2, { allowedMovePanels: ["panelHole"] }, "bn4"));
    assert.ok(doesBuildSatisfyConstraints(metalStats, bn4Lv3, { allowedMovePanels: ["panelPoison"] }, "bn4"));
});

test("toHashString and fromHashString preserve allowedMovePanels in bc.amp", () => {
    const rawBn6 = require("../data/bn6.json");
    const game = games.find(g => g.id === "bn6");
    const data = parseGameData(rawBn6, game);
    const problem = emptyProblem(data);
    problem.constraints = {
        allowedMovePanels: ["none", "panelCrack1", "panelGrass"],
    };

    const hash = toHashString(problem, data);
    const parsed = JSON.parse(hash);
    assert.ok(parsed.bc);
    assert.deepEqual(parsed.bc.amp, ["none", "panelCrack1", "panelGrass"]);

    const restored = fromHashString(hash, data);
    assert.ok(restored.constraints);
    assert.deepEqual(restored.constraints.allowedMovePanels, ["none", "panelCrack1", "panelGrass"]);
});

test("getOptimizerModeConstraints strips allowedMovePanels when cardsEnabled is false", () => {
    const rawBn6 = require("../data/bn6.json");
    const game = games.find(g => g.id === "bn6");
    const data = parseGameData(rawBn6, game);
    const constraints = {
        allowedMovePanels: ["none", "panelCrack1"],
        minCustom: 8,
    };

    const withCards = getOptimizerModeConstraints(data, constraints, true);
    assert.deepEqual(withCards.allowedMovePanels, ["none", "panelCrack1"]);

    const withoutCards = getOptimizerModeConstraints(data, constraints, false);
    assert.equal(withoutCards.allowedMovePanels, undefined);
    assert.equal(withoutCards.minCustom, 8);
});

test("cardSpecConstraintsPossible handles allowedMovePanels empty list", () => {
    assert.equal(cardSpecConstraintsPossible({ allowedMovePanels: [] }), false);
    assert.equal(cardSpecConstraintsPossible({ allowedMovePanels: ["none"] }), true);
    assert.equal(cardSpecConstraintsPossible({ allowedMovePanels: ["panelCrack1"] }), true);
    assert.equal(cardSpecConstraintsPossible(undefined), true);
});

test("findFeasibleBuild finds a build satisfying allowedMovePanels: [panelGrass]", () => {
    const rawBn6 = require("../data/bn6.json");
    const game = games.find(g => g.id === "bn6");
    const data = parseGameData(rawBn6, game);
    data.partMetas = [];
    data.parts = [];
    const problem = emptyProblem(data);
    const constraints = { allowedMovePanels: ["panelGrass"] };
    const deadline = Date.now() + 1000;
    const result = findFeasibleBuild({
        data,
        problem,
        constraints,
        policy: { type: "custom", customRules: { panelGrass: "allowed" } },
        modCardMode: "auto",
        shouldStop: () => Date.now() >= deadline,
    });
    assert.ok(result);
    assert.equal(result.stats.modPanelEffect, "panelGrass");
    assert.ok(doesBuildSatisfyConstraints(result.stats, result.analysis, constraints, "bn6"));
});
