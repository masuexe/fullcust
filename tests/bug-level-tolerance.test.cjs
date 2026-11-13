require("./register.cjs");
const assert = require("node:assert/strict");
const { test } = require("node:test");
const { games } = require("../games.ts");
const { parseGameData } = require("../game-data.ts");
const {
    emptyProblem,
    makeGridSettings,
    toHashString,
    fromHashString,
    getMaxAllowedBugLevel,
    isBugAllowedTolerance,
} = require("../problem.ts");
const {
    analyzeSolutionBugs,
    getEffectiveInBattleBugs,
    isSolutionAcceptable,
} = require("../effects.ts");
const { computeDeckStats } = require("../modcards.ts");
const {
    getOptimizerBugLevels,
    getBugLevelDescription,
    getOptimizerModeConstraints,
} = require("../optimizer-options.ts");
const { optimizeBuild, optimizeModCards } = require("../optimizer.ts");
const { findFeasibleBuild } = require("../feasible-optimizer.ts");
const { searchBuilds } = require("../exhaustive-optimizer.ts");
const { improveBuildLocally } = require("../local-optimizer.ts");
const { placeAll } = require("../solver.ts");

const dataFor = game => parseGameData(require(`../data/${game}.json`), games.find(g => g.id === game));

const reqWith = (partIndex, { onCommandLine = null, compressed = null, minBugLevel = 0, maxBugLevel = Infinity } = {}) => ({
    partIndex,
    constraint: { onCommandLine, compressed, minBugLevel, maxBugLevel },
});

function slimData(base, partIds, colors = null) {
    const allowed = new Set(partIds);
    const keep = [];
    base.partMetas.forEach((meta, idx) => {
        if (allowed.has(meta.id) && (!colors || colors.includes(meta.color))) {
            keep.push(idx);
        }
    });
    return {
        ...base,
        parts: keep.map(i => base.parts[i]),
        partMetas: keep.map(i => base.partMetas[i]),
    };
}

function findPartIndex(data, id, color) {
    const idx = data.partMetas.findIndex(m => m.id === id && (color === undefined || m.color === color));
    assert.ok(idx >= 0, `Expected part ${id} (color=${color}) in ${data.gameId}`);
    return idx;
}

test("BugTolerance helpers and shared-link hash round-trips cover allowed_lv1..allowed_lv6", () => {
    assert.equal(getMaxAllowedBugLevel(undefined), 0);
    assert.equal(getMaxAllowedBugLevel("forbidden"), 0);
    assert.equal(getMaxAllowedBugLevel("allowed"), Infinity);
    assert.equal(getMaxAllowedBugLevel("allowed_any"), Infinity);
    assert.equal(getMaxAllowedBugLevel("required"), Infinity);

    assert.equal(isBugAllowedTolerance(undefined), false);
    assert.equal(isBugAllowedTolerance("forbidden"), false);
    assert.equal(isBugAllowedTolerance("required"), false);
    assert.equal(isBugAllowedTolerance("allowed"), true);
    assert.equal(isBugAllowedTolerance("allowed_any"), true);

    const bn6 = dataFor("bn6");
    const bugRules = {};
    const customRules = {};
    for (let lv = 1; lv <= 6; lv++) {
        const tol = `allowed_lv${lv}`;
        assert.equal(getMaxAllowedBugLevel(tol), lv);
        assert.equal(isBugAllowedTolerance(tol), true);
        bugRules[lv === 1 ? "buster" : lv === 2 ? "custom" : "battleHp"] = tol;
        customRules[`customKey${lv}`] = tol;
    }
    bugRules.battleHp = "allowed_lv6";
    bugRules.status = "allowed_lv2";
    bugRules.panelCrack = "allowed_lv3";
    bugRules.busterCharge = "allowed";

    const problem = {
        ...emptyProblem(bn6),
        bugPolicy: { type: "custom", customRules },
        constraints: { bugRules },
    };
    const restored = fromHashString(toHashString(problem, bn6), bn6);
    assert.deepEqual(restored.constraints.bugRules, bugRules);
    assert.deepEqual(restored.bugPolicy.customRules, customRules);

    for (let lv = 1; lv <= 6; lv++) {
        const tol = `allowed_lv${lv}`;
        const p = { ...emptyProblem(bn6), constraints: { bugRules: { battleHp: tol } } };
        const roundTripped = fromHashString(toHashString(p, bn6), bn6);
        assert.equal(roundTripped.constraints.bugRules.battleHp, tol);
    }
});

test("getOptimizerBugLevels and getOptimizerModeConstraints across BN3/BN4/BN5/BN6", () => {
    const bn3 = dataFor("bn3");
    const bn4 = dataFor("bn4");
    const bn5 = dataFor("bn5");
    const bn6 = dataFor("bn6");

    // Pure NC levels
    assert.deepEqual(getOptimizerBugLevels(bn3, false, "battleHp"), [1, 2, 3]);
    assert.deepEqual(getOptimizerBugLevels(bn3, false, "customHp"), [1, 2, 3]);
    assert.deepEqual(getOptimizerBugLevels(bn3, false, "panelSet"), [1, 2]);
    assert.deepEqual(getOptimizerBugLevels(bn4, false, "battleHp"), [1, 2, 3]);
    assert.deepEqual(getOptimizerBugLevels(bn4, false, "buster"), [1, 2, 3]);
    assert.deepEqual(getOptimizerBugLevels(bn4, false, "status"), [1, 2]);
    assert.deepEqual(getOptimizerBugLevels(bn5, false, "battleHp"), [1, 2, 3]);
    assert.deepEqual(getOptimizerBugLevels(bn5, false, "customDamage"), [1, 2, 3]);
    assert.deepEqual(getOptimizerBugLevels(bn6, false, "battleHp"), [1, 2, 3]);
    assert.deepEqual(getOptimizerBugLevels(bn6, false, "buster"), [1, 2, 3]);
    assert.deepEqual(getOptimizerBugLevels(bn6, false, "status"), [1, 2]);
    assert.deepEqual(getOptimizerBugLevels(bn6, false, "panelCrack"), [1, 2, 3]);
    assert.deepEqual(getOptimizerBugLevels(bn6, false, "busterCharge"), []);

    // Mod Card mode levels
    assert.deepEqual(getOptimizerBugLevels(bn3, true, "battleHp"), [1, 2, 3]);
    assert.deepEqual(getOptimizerBugLevels(bn4, true, "battleHp"), [1, 2, 3]);
    assert.deepEqual(getOptimizerBugLevels(bn5, true, "battleHp"), [1, 2, 3, 4]);
    assert.deepEqual(getOptimizerBugLevels(bn6, true, "battleHp"), [1, 2, 3, 4, 5, 6, 7]);
    assert.deepEqual(getOptimizerBugLevels(bn6, true, "customHp"), [1, 3]);
    assert.deepEqual(getOptimizerBugLevels(bn6, true, "busterCharge"), []);

    assert.ok(getBugLevelDescription("bn6", "battleHp", 7, "en")?.includes("10 frames"));
    assert.ok(getBugLevelDescription("bn6", "busterCharge", 1, "en")?.includes("1/8"));

    // Identity preservation (===) in card mode when rules are already valid
    const cardConstraints = {
        bugRules: {
            battleHp: "allowed_lv5",
            customHp: "allowed_lv1",
            buster: "allowed_lv2",
            busterCharge: "allowed",
        },
    };
    assert.equal(getOptimizerModeConstraints(bn6, cardConstraints, true), cardConstraints);

    // Clamping in card mode when allowed_lvN exceeds or falls between discrete levels
    const cardClamped = getOptimizerModeConstraints(bn6, {
        bugRules: {
            customHp: "allowed_lv2", // discrete [1, 3] -> clamps down to allowed_lv1
            buster: "allowed_lv3",   // max level is 3 -> normalizes to "allowed"
        },
    }, true);
    assert.deepEqual(cardClamped.bugRules, {
        customHp: "allowed_lv1",
        buster: "allowed",
    });

    // Pure NC mode strips card-only bugs and normalizes/clamps allowed_lvN
    const ncProjected = getOptimizerModeConstraints(bn6, {
        bugRules: {
            battleHp: "allowed_lv5",  // NC max is 3 -> normalizes to "allowed"
            buster: "allowed_lv2",    // NC max is 3 -> keeps "allowed_lv2"
            busterCharge: "required", // card-only -> stripped
            customHp: "allowed_lv1",  // card-only in BN6 -> stripped
        },
    }, false);
    assert.deepEqual(ncProjected.bugRules, {
        battleHp: "allowed",
        buster: "allowed_lv2",
    });

    // BN3 has no cards even when cardsEnabled=true, so allowed_lv4 normalizes to "allowed"
    const bn3Projected = getOptimizerModeConstraints(bn3, {
        bugRules: { battleHp: "allowed_lv4", customHp: "allowed_lv2" },
    }, true);
    assert.deepEqual(bn3Projected.bugRules, { battleHp: "allowed", customHp: "allowed_lv2" });
});

test("solvers enforce allowed_lv2 for NC bugs without unnecessary BugStop and reject/mitigate Lv3+", () => {
    const fullBn6 = dataFor("bn6");
    // Use Attack+1 (id 35, plus, 2 cells, pink=3) and BugStop (id 31, solid, 6 cells, yellow=2)
    const data = slimData(fullBn6, [35, 31], [3, 2]);
    const atkPink = findPartIndex(data, 35, 3);

    // 2 forced command-line violations of Attack+1 -> buster Lv2 (accepted without BugStop under allowed_lv2)
    const problemLv2 = {
        ...emptyProblem(data),
        requirements: [
            reqWith(atkPink, { onCommandLine: true }),
            reqWith(atkPink, { onCommandLine: true }),
        ],
    };
    const constraintsLv2 = { bugRules: { buster: "allowed_lv2" } };

    let cancelExLv2 = false;
    const exLv2 = searchBuilds({
        data,
        problem: problemLv2,
        modCardMode: "none",
        constraints: constraintsLv2,
        shouldStop: () => cancelExLv2,
        onProgress: p => { if (p.best) cancelExLv2 = true; },
    });

    for (const [label, res] of [
        ["optimizeBuild", optimizeBuild({ data, problem: problemLv2, modCardMode: "none", constraints: constraintsLv2, timeoutMs: 500 })],
        ["findFeasibleBuild", findFeasibleBuild({ data, problem: problemLv2, modCardMode: "none", constraints: constraintsLv2, shouldStop: () => false })],
        ["searchBuilds", exLv2.best],
    ]) {
        assert.ok(res, `${label} should accept NC buster Lv2`);
        assert.equal(res.analysis.bugStopActive, false, `${label} should not add unnecessary BugStop`);
        assert.deepEqual(getEffectiveInBattleBugs(res.analysis).map(b => [b.bugType, b.level]), [["buster", 2]]);
    }

    const improved = improveBuildLocally({
        data,
        problem: problemLv2,
        initialBest: findFeasibleBuild({ data, problem: problemLv2, modCardMode: "none", constraints: constraintsLv2, shouldStop: () => false }),
        modCardMode: "none",
        constraints: constraintsLv2,
        shouldStop: () => false,
    });
    assert.equal(improved.analysis.bugStopActive, false);
    assert.deepEqual(getEffectiveInBattleBugs(improved.analysis).map(b => [b.bugType, b.level]), [["buster", 2]]);

    // 3 forced violations without BugStop -> buster Lv3 (rejected by all solvers)
    const pureNoStop = slimData(fullBn6, [27], [4]); // BustPack (8 cells) keeps exhaustive proof fast
    const bustOnly = findPartIndex(pureNoStop, 27, 4);
    const problemLv3NoStop = {
        ...emptyProblem(pureNoStop),
        requirements: [
            reqWith(bustOnly, { onCommandLine: false }),
            reqWith(bustOnly, { onCommandLine: false }),
            reqWith(bustOnly, { onCommandLine: false }),
        ],
    };

    assert.equal(optimizeBuild({ data: pureNoStop, problem: problemLv3NoStop, modCardMode: "none", constraints: constraintsLv2, timeoutMs: 300 }), null);
    assert.equal(findFeasibleBuild({ data: pureNoStop, problem: problemLv3NoStop, modCardMode: "none", constraints: constraintsLv2, shouldStop: () => false }), null);
    const exRejected = searchBuilds({ data: pureNoStop, problem: problemLv3NoStop, modCardMode: "none", constraints: constraintsLv2, shouldStop: () => false });
    assert.ok(exRejected.completed);
    assert.equal(exRejected.best, null);

    // 3 forced Attack+1 violations with BugStop in dataset -> findFeasibleBuild & searchBuilds add BugStop
    const problemLv3 = {
        ...emptyProblem(data),
        requirements: [
            reqWith(atkPink, { onCommandLine: true }),
            reqWith(atkPink, { onCommandLine: true }),
            reqWith(atkPink, { onCommandLine: true }),
        ],
    };
    const feasWithStop = findFeasibleBuild({ data, problem: problemLv3, modCardMode: "none", constraints: constraintsLv2, shouldStop: () => false });
    assert.ok(feasWithStop);
    assert.equal(feasWithStop.analysis.bugStopActive, true);
    assert.deepEqual(getEffectiveInBattleBugs(feasWithStop.analysis), []);

    let cancelExStop = false;
    const exWithStop = searchBuilds({
        data,
        problem: problemLv3,
        modCardMode: "none",
        constraints: constraintsLv2,
        shouldStop: () => cancelExStop,
        onProgress: p => { if (p.best) cancelExStop = true; },
    });
    assert.ok(exWithStop.best);
    assert.equal(exWithStop.best.analysis.bugStopActive, true);
    assert.deepEqual(getEffectiveInBattleBugs(exWithStop.best.analysis), []);
});

test("Mod Card selection across solvers allows battleHp Lv2 (137-B030) and rejects Lv4 (137-C002) under allowed_lv2", () => {
    const fullBn6 = dataFor("bn6");
    const data = { ...fullBn6, parts: [], partMetas: [] };
    const constraints = { bugRules: { battleHp: "allowed_lv2", emotion: "allowed" } };

    // Keep mode: 137-B030 (battleHp Lv2) is accepted, 137-C002 (battleHp Lv4) is rejected
    const pB030 = { ...emptyProblem(data), modCards: ["137-B030"] };
    const pC002 = { ...emptyProblem(data), modCards: ["137-C002"] };

    assert.ok(optimizeBuild({ data, problem: pB030, modCardMode: "keep", constraints, timeoutMs: 300 }));
    assert.ok(findFeasibleBuild({ data, problem: pB030, modCardMode: "keep", constraints, shouldStop: () => false }));
    assert.ok(searchBuilds({ data, problem: pB030, modCardMode: "keep", constraints, shouldStop: () => false }).best);

    assert.equal(optimizeBuild({ data, problem: pC002, modCardMode: "keep", constraints, timeoutMs: 300 }), null);
    assert.equal(findFeasibleBuild({ data, problem: pC002, modCardMode: "keep", constraints, shouldStop: () => false }), null);
    assert.equal(searchBuilds({ data, problem: pC002, modCardMode: "keep", constraints, shouldStop: () => false }).best, null);

    // Auto mode: never selects 137-C002 under allowed_lv2
    const autoOpt = optimizeBuild({ data, problem: emptyProblem(data), modCardMode: "auto", constraints, timeoutMs: 500 });
    assert.ok(autoOpt);
    assert.ok(!autoOpt.problem.modCards.includes("137-C002"));
    assert.ok(isSolutionAcceptable(autoOpt.analysis, { type: "custom" }, [], constraints.bugRules));

    const autoCards = optimizeModCards({ gameId: "bn6", constraints });
    assert.ok(!autoCards.includes("137-C002"));

    // Local improvement from empty deck with only 137-B030 and 137-C002 style checks:
    // verify improveBuildLocally picks/keeps acceptable cards and never swaps in 137-C002
    const seed = findFeasibleBuild({ data, problem: pB030, modCardMode: "keep", constraints, shouldStop: () => false });
    let improvedDeadline = Date.now() + 150;
    const improved = improveBuildLocally({
        data,
        problem: emptyProblem(data),
        initialBest: seed,
        modCardMode: "auto",
        constraints,
        shouldStop: () => Date.now() >= improvedDeadline,
    });
    assert.ok(!improved.problem.modCards.includes("137-C002"));
    assert.ok(isSolutionAcceptable(improved.analysis, { type: "custom" }, [], constraints.bugRules));
});

test("GBA ROM NC + Mod Card interactions: battleHp stacking, BugStop absorption, and buster overwrite", () => {
    const bn6 = dataFor("bn6");
    const grid = makeGridSettings(bn6, emptyProblem(bn6));

    // 1. NC battleHp Lv2 + Mod Card 137-A021 (battleHp Lv1) -> effective battleHp Lv3
    const hp1 = findPartIndex(bn6, 41, 1); // HP+50 (white, plus)
    const bugStop = findPartIndex(bn6, 31, 2); // BugStop (yellow, solid)
    const ncLv2Reqs = [reqWith(hp1, { onCommandLine: true }), reqWith(hp1, { onCommandLine: true })];
    const cellsLv2 = new Array(49).fill(null);
    cellsLv2[3 * 7 + 1] = 0; // (1, 3) on command line
    cellsLv2[3 * 7 + 3] = 1; // (3, 3) on command line

    const stackedLv3 = analyzeSolutionBugs("bn6", bn6.partMetas, ncLv2Reqs, cellsLv2, grid, "en", ["137-A021"]);
    const effLv3 = getEffectiveInBattleBugs(stackedLv3);
    assert.deepEqual(effLv3.map(b => [b.bugType, b.level]), [["battleHp", 3], ["damageHp", 1]]);
    assert.equal(isSolutionAcceptable(stackedLv3, { type: "custom" }, [], { battleHp: "allowed_lv2", damageHp: "allowed" }), false);
    assert.equal(isSolutionAcceptable(stackedLv3, { type: "custom" }, [], { battleHp: "allowed_lv3", damageHp: "allowed" }), true);

    // With BugStop: BugStop absorbs NC battleHp Lv2 (and NC damageHp), leaving only Mod Card battleHp Lv1
    const withStopReqs = [...ncLv2Reqs, reqWith(bugStop, { onCommandLine: true })];
    const cellsWithStop = [...cellsLv2];
    cellsWithStop[3 * 7 + 5] = 2;
    const absorbed = analyzeSolutionBugs("bn6", bn6.partMetas, withStopReqs, cellsWithStop, grid, "en", ["137-A021"]);
    assert.equal(absorbed.bugStopActive, true);
    assert.deepEqual(getEffectiveInBattleBugs(absorbed).map(b => [b.bugType, b.level, b.isModCardBug]), [["battleHp", 1, true]]);
    assert.equal(isSolutionAcceptable(absorbed, { type: "custom" }, [], { battleHp: "allowed_lv2", damageHp: "forbidden" }), true);

    // Verify solvers enforce this: NC battleHp Lv2 forced + kept card 137-A021
    const slimHpData = slimData(bn6, [41, 31], [1, 2]);
    const slimHp1 = findPartIndex(slimHpData, 41, 1);
    const forcedNcLv2 = {
        ...emptyProblem(slimHpData),
        requirements: [reqWith(slimHp1, { onCommandLine: true }), reqWith(slimHp1, { onCommandLine: true })],
        modCards: ["137-A021"],
    };
    // Without BugStop in dataset, allowed_lv2 rejects NC Lv2 + 137-A021 (Lv3)
    const slimNoStop = slimData(bn6, [41], [1]);
    const slimNoStopHp1 = findPartIndex(slimNoStop, 41, 1);
    const forcedNoStop = {
        ...emptyProblem(slimNoStop),
        requirements: [reqWith(slimNoStopHp1, { onCommandLine: true }), reqWith(slimNoStopHp1, { onCommandLine: true })],
        modCards: ["137-A021"],
    };
    assert.equal(findFeasibleBuild({ data: slimNoStop, problem: forcedNoStop, modCardMode: "keep", constraints: { bugRules: { battleHp: "allowed_lv2", damageHp: "allowed" } }, shouldStop: () => false }), null);
    assert.ok(findFeasibleBuild({ data: slimNoStop, problem: forcedNoStop, modCardMode: "keep", constraints: { bugRules: { battleHp: "allowed_lv3", damageHp: "allowed" } }, shouldStop: () => false }));

    // With BugStop in dataset, findFeasibleBuild automatically adds BugStop and passes with effective battleHp Lv1
    const solvedWithStop = findFeasibleBuild({
        data: slimHpData,
        problem: forcedNcLv2,
        modCardMode: "keep",
        constraints: { bugRules: { battleHp: "allowed_lv2", damageHp: "allowed" } },
        shouldStop: () => false,
    });
    assert.ok(solvedWithStop);
    assert.equal(solvedWithStop.analysis.bugStopActive, true);
    assert.deepEqual(getEffectiveInBattleBugs(solvedWithStop.analysis).map(b => [b.bugType, b.level]), [["battleHp", 1]]);

    const optWithStop = optimizeBuild({
        data: slimHpData,
        problem: solvedWithStop.problem,
        modCardMode: "keep",
        constraints: { bugRules: { battleHp: "allowed_lv2", damageHp: "allowed" } },
        timeoutMs: 500,
    });
    assert.ok(optWithStop);
    assert.equal(optWithStop.analysis.bugStopActive, true);
    assert.deepEqual(getEffectiveInBattleBugs(optWithStop.analysis).map(b => [b.bugType, b.level]), [["battleHp", 1]]);

    // 2. NC battleHp Lv3 + Mod Card 137-C002 (battleHp Lv4) -> stacks to Lv7
    const ncLv3Reqs = [
        reqWith(hp1, { onCommandLine: true }),
        reqWith(hp1, { onCommandLine: true }),
        reqWith(hp1, { onCommandLine: true }),
    ];
    const cellsLv3 = new Array(49).fill(null);
    cellsLv3[3 * 7 + 1] = 0;
    cellsLv3[3 * 7 + 3] = 1;
    cellsLv3[3 * 7 + 5] = 2;
    const stackedLv7 = analyzeSolutionBugs("bn6", bn6.partMetas, ncLv3Reqs, cellsLv3, grid, "en", ["137-C002"]);
    const battleHpLv7 = getEffectiveInBattleBugs(stackedLv7).find(b => b.bugType === "battleHp");
    assert.equal(battleHpLv7?.level, 7);
    assert.equal(isSolutionAcceptable(stackedLv7, { type: "custom" }, [], { battleHp: "allowed_lv6", damageHp: "allowed", emotion: "allowed" }), false);
    assert.equal(isSolutionAcceptable(stackedLv7, { type: "custom" }, [], { battleHp: "allowed", damageHp: "allowed", emotion: "allowed" }), true);

    // 3. NC buster Lv3 + Mod Card 137-A036 (buster Lv1) -> overwrites to effective buster Lv1 (accepted under allowed_lv1)
    const slimBuster = slimData(bn6, [36], [1]);
    const speed1 = findPartIndex(slimBuster, 36, 1);
    const forcedBusterLv3 = {
        ...emptyProblem(slimBuster),
        requirements: [
            reqWith(speed1, { onCommandLine: true }),
            reqWith(speed1, { onCommandLine: true }),
            reqWith(speed1, { onCommandLine: true }),
        ],
        modCards: ["137-A036"],
    };
    const busterOverwriteRules = { buster: "allowed_lv1" };
    let cancelExOverwrite = false;
    const exOverwrite = searchBuilds({
        data: slimBuster,
        problem: forcedBusterLv3,
        modCardMode: "keep",
        constraints: { bugRules: busterOverwriteRules },
        shouldStop: () => cancelExOverwrite,
        onProgress: p => { if (p.best) cancelExOverwrite = true; },
    });
    for (const [label, res] of [
        ["optimizeBuild", optimizeBuild({ data: slimBuster, problem: forcedBusterLv3, modCardMode: "keep", constraints: { bugRules: busterOverwriteRules }, timeoutMs: 500 })],
        ["findFeasibleBuild", findFeasibleBuild({ data: slimBuster, problem: forcedBusterLv3, modCardMode: "keep", constraints: { bugRules: busterOverwriteRules }, shouldStop: () => false })],
        ["searchBuilds", exOverwrite.best],
    ]) {
        assert.ok(res, `${label} should accept NC buster Lv3 overwritten to Lv1 by 137-A036`);
        assert.equal(res.analysis.bugStopActive, false);
        assert.deepEqual(getEffectiveInBattleBugs(res.analysis).map(b => [b.bugType, b.level]), [["buster", 1]]);
    }
});

test("BN6 TopMan (137-B043) busterCharge rules, NC buster repair, solver selection, and card interactions", () => {
    const bn6 = dataFor("bn6");
    const slimBuster = slimData(bn6, [36], [1]);
    const speed1 = findPartIndex(slimBuster, 36, 1);

    // 1. Allowed when buster is forbidden and busterCharge is allowed; repairs NC buster without BugStop
    const repairProblem = {
        ...emptyProblem(slimBuster),
        requirements: [
            reqWith(speed1, { onCommandLine: true }),
            reqWith(speed1, { onCommandLine: true }),
        ],
        modCards: ["137-B043"],
    };
    const allowTopMan = { bugRules: { buster: "forbidden", busterCharge: "allowed", damageHp: "allowed" } };
    const optAllowed = optimizeBuild({ data: slimBuster, problem: repairProblem, modCardMode: "keep", constraints: allowTopMan, timeoutMs: 500 });
    assert.ok(optAllowed);
    assert.equal(optAllowed.analysis.bugStopActive, false);
    assert.deepEqual(
        getEffectiveInBattleBugs(optAllowed.analysis).map(b => [b.bugType, b.level]).sort(),
        [["busterCharge", 1], ["damageHp", 1]]
    );

    // 2. Rejected when busterCharge is forbidden (even if buster is allowed)
    const forbidTopMan = { bugRules: { buster: "allowed", busterCharge: "forbidden", damageHp: "allowed" } };
    assert.equal(optimizeBuild({ data: slimBuster, problem: repairProblem, modCardMode: "keep", constraints: forbidTopMan, timeoutMs: 300 }), null);
    assert.equal(findFeasibleBuild({ data: slimBuster, problem: repairProblem, modCardMode: "keep", constraints: forbidTopMan, shouldStop: () => false }), null);
    assert.equal(searchBuilds({ data: slimBuster, problem: repairProblem, modCardMode: "keep", constraints: forbidTopMan, shouldStop: () => false }).best, null);

    // 3. Selectable when busterCharge is required and buster is forbidden (across targets and solvers)
    const noParts = { ...bn6, parts: [], partMetas: [] };
    const reqTopMan = { bugRules: { buster: "forbidden", busterCharge: "required", damageHp: "allowed" } };
    for (const target of ["max_hp", "max_attack"]) {
        const picked = optimizeModCards({ gameId: "bn6", target, constraints: reqTopMan });
        assert.ok(picked.includes("137-B043"), `optimizeModCards (${target}) should select 137-B043`);
        const optReq = optimizeBuild({ data: noParts, problem: emptyProblem(noParts), target, modCardMode: "auto", constraints: reqTopMan, timeoutMs: 500 });
        assert.ok(optReq, `optimizeBuild (${target}) should satisfy required busterCharge`);
        assert.ok(optReq.problem.modCards.includes("137-B043"));
        assert.ok(getEffectiveInBattleBugs(optReq.analysis).some(b => b.bugType === "busterCharge" && b.level === 1));
    }
    const feasReq = findFeasibleBuild({ data: noParts, problem: emptyProblem(noParts), modCardMode: "auto", constraints: reqTopMan, shouldStop: () => false });
    assert.ok(feasReq);
    assert.ok(feasReq.problem.modCards.includes("137-B043"));
    assert.ok(getEffectiveInBattleBugs(feasReq.analysis).some(b => b.bugType === "busterCharge" && b.level === 1));

    // 4. ["137-B043", "137-A022"] clears busterCharge (only damageHp remains; 0 buster/busterCharge bugs)
    const grid = makeGridSettings(noParts, emptyProblem(noParts));
    const clearedAnalysis = analyzeSolutionBugs("bn6", [], [], new Array(49).fill(null), grid, "en", ["137-B043", "137-A022"]);
    assert.deepEqual(
        getEffectiveInBattleBugs(clearedAnalysis).map(b => [b.bugType, b.level]),
        [["damageHp", 1]]
    );
    const clearedDeck = computeDeckStats(["137-B043", "137-A022"], "bn6");
    assert.equal(clearedDeck.activeBugs.filter(e => e.bug.type === "buster").length, 0);

    // 5. ["137-B043", "137-A036"] overwrites busterCharge with buster Lv1
    const overwrittenAnalysis = analyzeSolutionBugs("bn6", [], [], new Array(49).fill(null), grid, "en", ["137-B043", "137-A036"]);
    assert.deepEqual(
        getEffectiveInBattleBugs(overwrittenAnalysis).map(b => [b.bugType, b.level]).sort(),
        [["buster", 1], ["damageHp", 1]]
    );
});
