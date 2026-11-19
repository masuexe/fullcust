require("./register.cjs");
const assert = require("node:assert/strict");
const { test } = require("node:test");
const { from } = require("../array2d.ts");
const { games } = require("../games.ts");
const { parseGameData } = require("../game-data.ts");
const { emptyProblem, makeGridSettings } = require("../problem.ts");
const { getDefaultBugRules } = require("../panel-effects.ts");
const {
    BUG_SPEC_OPTIONS,
    analyzeSolutionBugs,
    computeBuildStats,
    computePlacedBuildStats,
    isNonBattleProgram,
    isSolutionAcceptable,
} = require("../effects.ts");
const {
    optimizeBuild,
    removeRedundantAbilityParts,
    solveForDisplay,
} = require("../optimizer.ts");
const { findFeasibleBuild } = require("../feasible-optimizer.ts");
const { searchBuilds } = require("../exhaustive-optimizer.ts");
const { placeAll, solve } = require("../solver.ts");

function gameData(gameId = "bn6") {
    return parseGameData(require(`../data/${gameId}.json`), games.find(g => g.id === gameId));
}

function makeReq(data, id, constraint = {}) {
    return {
        partIndex: data.partMetas.findIndex(m => m.id === id),
        constraint: {
            compressed: true,
            onCommandLine: null,
            minBugLevel: 0,
            maxBugLevel: Infinity,
            ...constraint,
        },
    };
}

function cellsTouchOob(cells, gs, targetIndex) {
    if (!gs.hasOob) return false;
    for (let y = 0; y < gs.height; y++) {
        for (let x = 0; x < gs.width; x++) {
            if (cells[y * gs.width + x] !== targetIndex) continue;
            if (x === 0 || y === 0 || x === gs.width - 1 || y === gs.height - 1) {
                return true;
            }
        }
    }
    return false;
}

function cellsTouchLine(cells, gs, targetIndex) {
    for (let x = 0; x < gs.width; x++) {
        if (cells[gs.commandLineRow * gs.width + x] === targetIndex) return true;
    }
    return false;
}

test("BN6 2230 HP build: optimizeBuild and solveForDisplay keep SuprArmr and Custom1 on-line and in-bounds", () => {
    const data = gameData("bn6");
    const gs = data.gridSettings;
    const bugRules = getDefaultBugRules("bn6");
    const policy = { type: "custom", customRules: bugRules };
    const cards = ["137-B012", "137-B005", "137-B017", "137-C006"];
    const coreReqs = [1, 2, 40, 38].map(id => makeReq(data, id));
    const problem = { ...emptyProblem(data), requirements: coreReqs, modCards: cards, bugPolicy: policy };

    const opt = optimizeBuild({
        data,
        problem,
        policy,
        target: "max_hp",
        modCardMode: "keep",
        constraints: { bugRules },
        timeoutMs: 2000,
    });
    assert.ok(opt, "optimizeBuild must find a valid 2230 HP solution");
    assert.equal(opt.stats.finalHp, 2230);
    assert.equal(opt.stats.custom, 6);
    assert.ok(opt.stats.abilities.includes("superArmor"));
    assert.ok(!opt.analysis.activeBugs.some(b => !b.isModCardBug && (b.bugType === "movement" || b.bugType === "custom")));

    // Simulate shared-link / pre-fix state where SuprArmr and Custom1 have unconstrained onCommandLine/maxBugLevel.
    const unconstrainedReqs = opt.problem.requirements.map(req => ({
        partIndex: req.partIndex,
        constraint: { compressed: true, onCommandLine: null, minBugLevel: 0, maxBugLevel: Infinity },
    }));
    const displayed = [];
    for (const sol of solveForDisplay({
        data,
        requirements: unconstrainedReqs,
        gridSettings: gs,
        spinnableColors: problem.spinnableColors,
        bugPolicy: policy,
        constraints: {
            requiredAbilities: ["superArmor", "airShoes", "underShirt", "rush", "statusGuard", "chipRecovery"],
            minChipRecovery: 40,
            minCustom: 6,
            bugRules,
        },
        modCards: cards,
        baseHp: 1000,
    })) {
        displayed.push(sol);
        if (displayed.length >= 8) break;
    }

    assert.ok(displayed.length >= 2, "solveForDisplay should yield multiple valid layouts");
    for (const sol of displayed) {
        const cells = placeAll(data.parts, unconstrainedReqs, sol, gs);
        const stats = computePlacedBuildStats("bn6", data.partMetas, unconstrainedReqs, cells, gs, cards, 1000);
        const analysis = analyzeSolutionBugs("bn6", data.partMetas, unconstrainedReqs, cells, gs, "en", cards);
        assert.equal(stats.custom, 6);
        assert.ok(stats.abilities.includes("superArmor"));
        assert.ok(cellsTouchLine(cells, gs, 0) && !cellsTouchOob(cells, gs, 0), "SuprArmr must be on-line and in-bounds");
        assert.ok(cellsTouchLine(cells, gs, 1) && !cellsTouchOob(cells, gs, 1), "Custom1 must be on-line and in-bounds");
        const ncBugs = analysis.activeBugs.filter(b => !b.isModCardBug);
        assert.ok(ncBugs.length <= 3, `Expected at most 3 NC bugs, got ${ncBugs.length}`);
        assert.ok(isSolutionAcceptable(analysis, policy, [], bugRules));
    }
});

test("solver prefers in-bounds 0-bug placements and keeps Plus parts off the command line first", () => {
    const data = gameData("bn6");
    const gs = data.gridSettings;
    const spinnable = data.colors.map(() => true);

    const armorReq = [makeReq(data, 1, { onCommandLine: true })];
    const armorSol = solve(data.parts, armorReq, gs, spinnable, () => false, true, undefined, true)[Symbol.iterator]().next().value;
    const armorCells = placeAll(data.parts, armorReq, armorSol, gs);
    assert.ok(cellsTouchLine(armorCells, gs, 0));
    assert.equal(cellsTouchOob(armorCells, gs, 0), false, "First SuprArmr solution must stay in-bounds");

    const hpReq = [makeReq(data, 46)];
    const hpSol = solve(data.parts, hpReq, gs, spinnable, () => false, true, undefined, true)[Symbol.iterator]().next().value;
    const hpCells = placeAll(data.parts, hpReq, hpSol, gs);
    assert.equal(cellsTouchLine(hpCells, gs, 0), false, "First HP+500 solution must stay off the command line");
    assert.equal(cellsTouchOob(hpCells, gs, 0), false, "First HP+500 solution must stay in-bounds");

    const hpWhiteReq = makeReq(data, 46);
    const hpPinkReq = {
        partIndex: data.partMetas.findIndex((m, i) => m.id === 46 && i > hpWhiteReq.partIndex),
        constraint: { compressed: true, onCommandLine: null, minBugLevel: 0, maxBugLevel: Infinity },
    };
    const fourReqs = [makeReq(data, 1), makeReq(data, 2), hpWhiteReq, hpPinkReq];
    const firstSol = solve(data.parts, fourReqs, gs, spinnable, () => false, true, undefined, true)[Symbol.iterator]().next().value;
    assert.ok(firstSol);
    const firstCells = placeAll(data.parts, fourReqs, firstSol, gs);
    assert.ok(!cellsTouchLine(firstCells, gs, 2) && !cellsTouchOob(firstCells, gs, 2), "HP+500 (white) must stay off-line & in-bounds");
    assert.ok(!cellsTouchLine(firstCells, gs, 3) && !cellsTouchOob(firstCells, gs, 3), "HP+500 (pink) must stay off-line & in-bounds");
    assert.ok(cellsTouchLine(firstCells, gs, 0), "Solution #1 must put SuprArmr on-line");
    assert.ok(cellsTouchLine(firstCells, gs, 1), "Solution #1 must put Custom1 on-line");
});

test("automatic solid programs require command line unless supplying a required bug", () => {
    const data = gameData("bn6");
    const allAllowed = Object.fromEntries(BUG_SPEC_OPTIONS.map(b => [b.id, "allowed_any"]));

    // 1. optimizeBuild & findFeasibleBuild lock added solid parts on-line when no bug is required.
    const noReqOpts = {
        data,
        problem: emptyProblem(data),
        modCardMode: "none",
        policy: { type: "custom", customRules: allAllowed },
        constraints: { requiredAbilities: ["superArmor"], bugRules: allAllowed },
    };
    const optRes = optimizeBuild({ ...noReqOpts, timeoutMs: 1500 });
    assert.ok(optRes);
    const optArmor = optRes.problem.requirements.find(r => data.partMetas[r.partIndex].id === 1);
    assert.equal(optArmor.constraint.onCommandLine, true);

    const feasRes = findFeasibleBuild({ ...noReqOpts, shouldStop: () => false });
    assert.ok(feasRes);
    const feasArmor = feasRes.problem.requirements.find(r => data.partMetas[r.partIndex].id === 1);
    assert.equal(feasArmor.constraint.onCommandLine, true);

    // 2. searchBuilds locks added solid parts on-line on a 2x1 fixture when no bug is required,
    //    and leaves onCommandLine: null when supplying a required bug (e.g. emotion: "required").
    const tiny = gameData("bn6");
    const indices = [1, 23].map(id => tiny.partMetas.findIndex(p => p.id === id));
    const mask = from([true, false], 2, 1);
    tiny.partMetas = indices.map((i, n) => ({ ...tiny.partMetas[i], color: n + 1 }));
    tiny.parts = indices.map((i, n) => ({ ...tiny.parts[i], color: n + 1, compressedMask: mask, uncompressedMask: mask }));
    tiny.gridOptions = [{ label: "fixture", settings: { height: 2, width: 1, commandLineRow: 1, hasOob: false } }];
    tiny.defaultExpansion = 0;

    let stop = false;
    const exactNoBug = searchBuilds({
        data: tiny,
        problem: emptyProblem(tiny),
        modCardMode: "none",
        policy: { type: "custom", customRules: allAllowed },
        constraints: { requiredAbilities: ["superArmor"], bugRules: allAllowed },
        shouldStop: () => stop,
        onProgress: p => { if (p.best) stop = true; },
    });
    assert.ok(exactNoBug.best);
    assert.equal(exactNoBug.best.problem.requirements[0].constraint.onCommandLine, true);

    const reqEmotionRules = { ...allAllowed, emotion: "required" };
    const feasEmotion = findFeasibleBuild({
        data: tiny,
        problem: emptyProblem(tiny),
        modCardMode: "none",
        policy: { type: "custom", customRules: reqEmotionRules },
        constraints: { bugRules: reqEmotionRules },
        shouldStop: () => false,
    });
    assert.ok(feasEmotion);
    const humorReq = feasEmotion.problem.requirements.find(r => tiny.partMetas[r.partIndex].id === 23);
    assert.equal(humorReq.constraint.onCommandLine, null);
    assert.ok(feasEmotion.analysis.activeBugs.some(b => b.bugType === "emotion"));

    stop = false;
    const exactEmotion = searchBuilds({
        data: tiny,
        problem: emptyProblem(tiny),
        modCardMode: "none",
        policy: { type: "custom", customRules: reqEmotionRules },
        constraints: { bugRules: reqEmotionRules },
        shouldStop: () => stop,
        onProgress: p => { if (p.best) stop = true; },
    });
    assert.ok(exactEmotion.best);
    assert.equal(exactEmotion.best.problem.requirements[0].constraint.onCommandLine, null);
    assert.ok(exactEmotion.best.analysis.activeBugs.some(b => b.bugType === "emotion"));
});

test("removeRedundantAbilityParts removes inactive off-line numeric Solid programs while keeping active and BN3 unmodeled ones", () => {
    const data = gameData("bn6");
    const gs = { height: 2, width: 2, commandLineRow: 1, hasOob: false };
    const indices = [1, 2].map(id => data.partMetas.findIndex(p => p.id === id));
    const mask = from([true, false, false, false], 2, 2);
    data.partMetas = indices.map((i, n) => ({ ...data.partMetas[i], color: n + 1 }));
    data.parts = indices.map((i, n) => ({ ...data.parts[i], color: n + 1, compressedMask: mask, uncompressedMask: mask }));
    data.gridOptions = [{ label: "fixture", settings: gs }];
    data.defaultExpansion = 0;

    const allAllowed = Object.fromEntries(BUG_SPEC_OPTIONS.map(b => [b.id, "allowed_any"]));
    const problem = emptyProblem(data);
    const opts = { data, problem, modCardMode: "none", constraints: { bugRules: allAllowed }, policy: { type: "custom", customRules: allAllowed } };

    // SuprArmr on-line (row 1), automatic Custom1 off-line (row 0) -> Custom1 gives +0 custom and only adds a bug.
    const requirements = [
        { partIndex: 0, constraint: { compressed: true, onCommandLine: true, minBugLevel: 0, maxBugLevel: Infinity } },
        { partIndex: 1, constraint: { compressed: true, onCommandLine: null, minBugLevel: 0, maxBugLevel: Infinity } },
    ];
    const solution = [
        { loc: { position: { x: 0, y: 1 }, rotation: 0 }, compressed: true },
        { loc: { position: { x: 0, y: 0 }, rotation: 0 }, compressed: true },
    ];
    const cells = placeAll(data.parts, requirements, solution, gs);
    const seedOffLine = {
        problem: { ...problem, requirements },
        solution,
        stats: computePlacedBuildStats("bn6", data.partMetas, requirements, cells, gs, [], 1000),
        analysis: analyzeSolutionBugs("bn6", data.partMetas, requirements, cells, gs, "en", []),
        addedPartIndices: [0, 1],
        addedCardIds: [],
    };
    const cleanedOffLine = removeRedundantAbilityParts(opts, seedOffLine);
    assert.deepEqual(cleanedOffLine.problem.requirements.map(r => data.partMetas[r.partIndex].id), [1]);
    assert.deepEqual(cleanedOffLine.stats, seedOffLine.stats);
    assert.equal(cleanedOffLine.analysis.activeBugs.length, 0);

    // When Custom1 is on-line (custom === 6), it contributes +1 Custom and must be retained.
    const solutionOnLine = [
        { loc: { position: { x: 0, y: 1 }, rotation: 0 }, compressed: true },
        { loc: { position: { x: 1, y: 1 }, rotation: 0 }, compressed: true },
    ];
    const cellsOnLine = placeAll(data.parts, requirements, solutionOnLine, gs);
    const seedOnLine = {
        ...seedOffLine,
        solution: solutionOnLine,
        stats: computePlacedBuildStats("bn6", data.partMetas, requirements, cellsOnLine, gs, [], 1000),
        analysis: analyzeSolutionBugs("bn6", data.partMetas, requirements, cellsOnLine, gs, "en", []),
    };
    const cleanedOnLine = removeRedundantAbilityParts(opts, seedOnLine);
    assert.deepEqual(cleanedOnLine.problem.requirements.map(r => data.partMetas[r.partIndex].id), [1, 2]);
    assert.equal(cleanedOnLine.stats.custom, 6);

    // BN3 unmodeled solid program (SetHoly id=9) on the command line must NOT be stripped.
    const bn3 = gameData("bn3");
    const holyIdx = bn3.partMetas.findIndex(p => p.id === 9);
    bn3.partMetas = [{ ...bn3.partMetas[holyIdx], color: 1 }];
    bn3.parts = [{ ...bn3.parts[holyIdx], color: 1, compressedMask: mask, uncompressedMask: mask }];
    bn3.gridOptions = [{ label: "fixture", settings: gs }];
    bn3.defaultExpansion = 0;
    const bn3Problem = emptyProblem(bn3);
    const bn3Reqs = [{ partIndex: 0, constraint: { compressed: true, onCommandLine: null, minBugLevel: 0, maxBugLevel: Infinity } }];
    const bn3Sol = [{ loc: { position: { x: 0, y: 1 }, rotation: 0 }, compressed: true }];
    const bn3Cells = placeAll(bn3.parts, bn3Reqs, bn3Sol, gs);
    const bn3Seed = {
        problem: { ...bn3Problem, requirements: bn3Reqs },
        solution: bn3Sol,
        stats: computePlacedBuildStats("bn3", bn3.partMetas, bn3Reqs, bn3Cells, gs, [], 1000),
        analysis: analyzeSolutionBugs("bn3", bn3.partMetas, bn3Reqs, bn3Cells, gs, "en", []),
        addedPartIndices: [0],
        addedCardIds: [],
    };
    const bn3Cleaned = removeRedundantAbilityParts(
        { data: bn3, problem: bn3Problem, modCardMode: "none", constraints: { bugRules: { panelSet: "allowed" } }, policy: { type: "custom", customRules: { panelSet: "allowed" } } },
        bn3Seed
    );
    assert.deepEqual(bn3Cleaned.problem.requirements.map(r => bn3.partMetas[r.partIndex].id), [9]);
});

test("solveForDisplay remains resilient when a user manually deletes a part required by saved constraints", () => {
    const data = gameData("bn6");
    const bugRules = getDefaultBugRules("bn6");
    const policy = { type: "custom", customRules: bugRules };
    const reqsWithoutCustom = [makeReq(data, 1, { onCommandLine: null }), makeReq(data, 46)];
    const solutions = [...solveForDisplay({
        data,
        requirements: reqsWithoutCustom,
        gridSettings: data.gridSettings,
        spinnableColors: data.colors.map(() => true),
        bugPolicy: policy,
        constraints: {
            requiredAbilities: ["superArmor"],
            minCustom: 6,
            bugRules,
        },
        baseHp: 1000,
    })];

    assert.ok(solutions.length > 0, "Should still display valid layouts after manual Custom1 removal");
    for (const sol of solutions.slice(0, 10)) {
        const cells = placeAll(data.parts, reqsWithoutCustom, sol, data.gridSettings);
        const stats = computePlacedBuildStats("bn6", data.partMetas, reqsWithoutCustom, cells, data.gridSettings, [], 1000);
        const analysis = analyzeSolutionBugs("bn6", data.partMetas, reqsWithoutCustom, cells, data.gridSettings, "en", []);
        assert.ok(stats.abilities.includes("superArmor"), "Surviving SuprArmr must remain active on command line");
        assert.ok(isSolutionAcceptable(analysis, policy, [], bugRules));
    }
});

test("isNonBattleProgram classifies PvP-useless solid programs across BN3-6", () => {
    // BN6: Humor (23), Poem (24), SlipRunr (25), encounter/drop parts (16..22), AutoHeal (26 when unrequested)
    for (const id of [16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26]) {
        assert.equal(isNonBattleProgram("bn6", id), true, `BN6 part ${id} should be non-battle by default`);
    }
    assert.equal(isNonBattleProgram("bn6", 26, ["autoHeal"]), false, "BN6 AutoHeal is combat when autoHeal is required");
    for (const id of [1, 2, 8, 28, 31, 32, 46]) {
        assert.equal(isNonBattleProgram("bn6", id), false, `BN6 part ${id} must not be classified as non-battle`);
    }

    // BN5: Humor (21), Chivalry/Poem (22), AutoRun/SlipRunr (23), AutoHeal (24), SoulClen (29)
    for (const id of [21, 22, 23, 24, 29]) {
        assert.equal(isNonBattleProgram("bn5", id), true, `BN5 part ${id} should be non-battle by default`);
    }
    assert.equal(isNonBattleProgram("bn5", 24, ["autoHeal"]), false, "BN5 AutoHeal is combat when autoHeal is required");

    // BN4: Humor (20), SoulClen (25)
    for (const id of [20, 25]) {
        assert.equal(isNonBattleProgram("bn4", id), true, `BN4 part ${id} should be non-battle`);
    }

    // BN3: SneakRun..Collect (23..28), Humor (45), story parts Press (20), EngyChng (21), Alpha (22), BlckMind (46)
    for (const id of [20, 21, 22, 23, 24, 25, 26, 27, 28, 45, 46]) {
        assert.equal(isNonBattleProgram("bn3", id), true, `BN3 part ${id} should be non-battle`);
    }
    assert.equal(isNonBattleProgram("bn3", 9), false, "BN3 SetHoly (9) is an unmodeled combat part");
});

test("non-battle programs prefer off-line in-bounds bug triggering and fall back on-line when bug is forbidden", () => {
    const data = gameData("bn6");
    const gs = data.gridSettings;
    const spinnable = data.colors.map(() => true);
    const poemReqs = [makeReq(data, 24, { onCommandLine: null })];

    // 1. Pure manual mode (no bugPolicy / constraints): Poem places off-line + in-bounds to trigger emotion Lv1.
    const manualFirst = solveForDisplay({
        data,
        requirements: poemReqs,
        gridSettings: gs,
        spinnableColors: spinnable,
    })[Symbol.iterator]().next().value;
    assert.ok(manualFirst, "Manual solveForDisplay must yield a solution for Poem");
    const manualCells = placeAll(data.parts, poemReqs, manualFirst, gs);
    assert.equal(cellsTouchLine(manualCells, gs, 0), false, "Manual Poem should prefer off-line");
    assert.equal(cellsTouchOob(manualCells, gs, 0), false, "Manual Poem should stay in-bounds");
    const manualAnalysis = analyzeSolutionBugs("bn6", data.partMetas, poemReqs, manualCells, gs, "en", []);
    assert.ok(manualAnalysis.activeBugs.some(b => b.bugType === "emotion" && b.level === 1));

    // 2. Default BN6 rules (emotion: "allowed"): Poem places off-line + in-bounds.
    const defaultRules = getDefaultBugRules("bn6");
    const allowedFirst = solveForDisplay({
        data,
        requirements: poemReqs,
        gridSettings: gs,
        spinnableColors: spinnable,
        bugPolicy: { type: "custom", customRules: defaultRules },
        constraints: { bugRules: defaultRules },
    })[Symbol.iterator]().next().value;
    assert.ok(allowedFirst, "Default rules solveForDisplay must yield a solution for Poem");
    const allowedCells = placeAll(data.parts, poemReqs, allowedFirst, gs);
    assert.equal(cellsTouchLine(allowedCells, gs, 0), false, "Allowed-emotion Poem should prefer off-line");
    assert.equal(cellsTouchOob(allowedCells, gs, 0), false, "Allowed-emotion Poem should stay in-bounds");
    const allowedAnalysis = analyzeSolutionBugs("bn6", data.partMetas, poemReqs, allowedCells, gs, "en", []);
    assert.ok(allowedAnalysis.activeBugs.some(b => b.bugType === "emotion" && b.level === 1));

    // 3. Forbidden emotion: Poem falls back onto command line + in-bounds with 0 emotion bug.
    const forbiddenRules = { ...defaultRules, emotion: "forbidden" };
    const forbiddenFirst = solveForDisplay({
        data,
        requirements: poemReqs,
        gridSettings: gs,
        spinnableColors: spinnable,
        bugPolicy: { type: "custom", customRules: forbiddenRules },
        constraints: { bugRules: forbiddenRules },
    })[Symbol.iterator]().next().value;
    assert.ok(forbiddenFirst, "Forbidden-emotion solveForDisplay must yield an on-line solution for Poem");
    const forbiddenCells = placeAll(data.parts, poemReqs, forbiddenFirst, gs);
    assert.equal(cellsTouchLine(forbiddenCells, gs, 0), true, "Forbidden-emotion Poem must fall back on-line");
    assert.equal(cellsTouchOob(forbiddenCells, gs, 0), false, "Forbidden-emotion Poem must stay in-bounds");
    const forbiddenAnalysis = analyzeSolutionBugs("bn6", data.partMetas, poemReqs, forbiddenCells, gs, "en", []);
    assert.equal(forbiddenAnalysis.activeBugs.some(b => b.bugType === "emotion"), false);

    // 4. Pre-selected Poem in optimizeBuild under default BN6 rules stays off-line triggering emotion while maximizing HP.
    const problem = { ...emptyProblem(data), requirements: poemReqs, bugPolicy: { type: "custom", customRules: defaultRules } };
    const opt = optimizeBuild({
        data,
        problem,
        policy: { type: "custom", customRules: defaultRules },
        target: "max_hp",
        modCardMode: "none",
        constraints: { bugRules: defaultRules },
        timeoutMs: 1500,
    });
    assert.ok(opt, "optimizeBuild with pre-selected Poem must succeed");
    const optCells = placeAll(data.parts, opt.problem.requirements, opt.solution, gs);
    assert.equal(cellsTouchLine(optCells, gs, 0), false, "Pre-selected Poem in optimizeBuild should stay off-line");
    assert.ok(opt.analysis.activeBugs.some(b => b.bugType === "emotion" && b.level === 1));
    assert.ok(opt.stats.finalHp > 1000, "optimizeBuild should still fill remaining grid with HP");
});

test("required NC bugs prioritize smallest non-battle parts off-line and in-bounds", () => {
    // 1. BN5 movement: "required" + SuperArmor + UnderShirt -> 1-cell AutoRun (id=23) off-line
    const bn5 = gameData("bn5");
    const bn5Rules = { ...getDefaultBugRules("bn5"), movement: "required" };
    const bn5Policy = { type: "custom", customRules: bn5Rules };
    const bn5Opts = {
        data: bn5,
        problem: emptyProblem(bn5),
        modCardMode: "none",
        policy: bn5Policy,
        constraints: { requiredAbilities: ["superArmor", "underShirt"], bugRules: bn5Rules },
    };
    const bn5Feas = findFeasibleBuild({ ...bn5Opts, shouldStop: () => false });
    const bn5Opt = optimizeBuild({ ...bn5Opts, timeoutMs: 2500 });
    for (const [label, res] of [["findFeasibleBuild", bn5Feas], ["optimizeBuild", bn5Opt]]) {
        assert.ok(res, `BN5 movement:required ${label} must succeed`);
        assert.ok(res.stats.abilities.includes("superArmor"));
        assert.ok(res.stats.abilities.includes("underShirt"));
        assert.ok(res.analysis.activeBugs.some(b => b.bugType === "movement"));
        const autoRunIdx = res.problem.requirements.findIndex(r => bn5.partMetas[r.partIndex].id === 23);
        assert.notEqual(autoRunIdx, -1, "Should select 1-cell AutoRun (id=23) for BN5 movement bug");
        const cells = placeAll(bn5.parts, res.problem.requirements, res.solution, bn5.gridSettings);
        assert.equal(cellsTouchOob(cells, bn5.gridSettings, autoRunIdx), false);
        if (label === "findFeasibleBuild") {
            assert.equal(cellsTouchLine(cells, bn5.gridSettings, autoRunIdx), false);
        }
    }

    // 2. BN6 emotion: "required" -> Humor (23) or Poem (24) off-line + in-bounds
    const bn6 = gameData("bn6");
    const emotionRules = { ...getDefaultBugRules("bn6"), emotion: "required" };
    const emotionOpts = {
        data: bn6,
        problem: emptyProblem(bn6),
        modCardMode: "none",
        policy: { type: "custom", customRules: emotionRules },
        constraints: { bugRules: emotionRules },
    };
    for (const [label, res] of [
        ["findFeasibleBuild", findFeasibleBuild({ ...emotionOpts, shouldStop: () => false })],
        ["optimizeBuild", optimizeBuild({ ...emotionOpts, timeoutMs: 2000 })],
    ]) {
        assert.ok(res, `BN6 emotion:required ${label} must succeed`);
        assert.ok(res.analysis.activeBugs.some(b => b.bugType === "emotion"));
        const idx = res.problem.requirements.findIndex(r => [23, 24].includes(bn6.partMetas[r.partIndex].id));
        assert.notEqual(idx, -1, "Should select Humor (23) or Poem (24) for emotion bug");
        const cells = placeAll(bn6.parts, res.problem.requirements, res.solution, bn6.gridSettings);
        assert.equal(cellsTouchLine(cells, bn6.gridSettings, idx), false);
        if (label === "findFeasibleBuild") {
            assert.equal(cellsTouchOob(cells, bn6.gridSettings, idx), false);
        }
    }

    // 3. BN6 panelCrack: "required" -> 2-cell SlipRunr (25) off-line + in-bounds
    const crackRules = { ...getDefaultBugRules("bn6"), panelCrack: "required" };
    const crackOpts = {
        data: bn6,
        problem: emptyProblem(bn6),
        modCardMode: "none",
        policy: { type: "custom", customRules: crackRules },
        constraints: { bugRules: crackRules },
    };
    for (const res of [
        findFeasibleBuild({ ...crackOpts, shouldStop: () => false }),
        optimizeBuild({ ...crackOpts, timeoutMs: 2000 }),
    ]) {
        assert.ok(res, "BN6 panelCrack:required build must succeed");
        assert.ok(res.analysis.activeBugs.some(b => b.bugType === "panelCrack"));
        const slipIdx = res.problem.requirements.findIndex(r => bn6.partMetas[r.partIndex].id === 25);
        assert.notEqual(slipIdx, -1, "Should select 2-cell SlipRunr (25) for panelCrack bug");
        const cells = placeAll(bn6.parts, res.problem.requirements, res.solution, bn6.gridSettings);
        assert.equal(cellsTouchLine(cells, bn6.gridSettings, slipIdx), false);
        assert.equal(cellsTouchOob(cells, bn6.gridSettings, slipIdx), false);
    }
});

test("5-color overflow (status: required) works in pure NC mode for BN5 and BN6", () => {
    // BN5: movement & custom forbidden, status required
    const bn5 = gameData("bn5");
    const bn5Rules = { ...getDefaultBugRules("bn5"), status: "required" };
    const bn5Opts = {
        data: bn5,
        problem: emptyProblem(bn5),
        modCardMode: "none",
        policy: { type: "custom", customRules: bn5Rules },
        constraints: { bugRules: bn5Rules },
    };
    for (const res of [
        findFeasibleBuild({ ...bn5Opts, shouldStop: () => false }),
        optimizeBuild({ ...bn5Opts, timeoutMs: 2500 }),
    ]) {
        assert.ok(res, "BN5 status:required NC-only build must succeed");
        assert.ok(res.analysis.distinctColorCount >= 5, `Expected >=5 colors, got ${res.analysis.distinctColorCount}`);
        assert.ok(res.analysis.activeBugs.some(b => b.bugType === "colorStatus"));
        assert.equal(res.analysis.activeBugs.some(b => b.bugType === "movement" || b.bugType === "custom"), false);
        const autoRunIdx = res.problem.requirements.findIndex(r => bn5.partMetas[r.partIndex].id === 23);
        if (autoRunIdx !== -1) {
            const cells = placeAll(bn5.parts, res.problem.requirements, res.solution, bn5.gridSettings);
            assert.equal(cellsTouchLine(cells, bn5.gridSettings, autoRunIdx), true, "AutoRun used as color filler must be on-line when movement is forbidden");
            assert.equal(cellsTouchOob(cells, bn5.gridSettings, autoRunIdx), false);
        }
    }

    // BN6: status required in NC-only mode
    const bn6 = gameData("bn6");
    const bn6Rules = { ...getDefaultBugRules("bn6"), status: "required" };
    const bn6Opts = {
        data: bn6,
        problem: emptyProblem(bn6),
        modCardMode: "none",
        policy: { type: "custom", customRules: bn6Rules },
        constraints: { bugRules: bn6Rules },
    };
    for (const res of [
        findFeasibleBuild({ ...bn6Opts, shouldStop: () => false }),
        optimizeBuild({ ...bn6Opts, timeoutMs: 2500 }),
    ]) {
        assert.ok(res, "BN6 status:required NC-only build must succeed");
        assert.ok(res.analysis.distinctColorCount >= 5, `Expected >=5 colors, got ${res.analysis.distinctColorCount}`);
        assert.ok(res.analysis.activeBugs.some(b => b.bugType === "colorStatus"));
        const cleaned = removeRedundantAbilityParts(bn6Opts, res);
        assert.ok(cleaned.analysis.distinctColorCount >= 5, "removeRedundantAbilityParts must preserve 5th color");
    }
});

test("removeRedundantAbilityParts strips unneeded automatic non-battle parts unless needed for bug or 5-color status", () => {
    const data = gameData("bn6");
    const gs = { height: 2, width: 5, commandLineRow: 1, hasOob: false };
    // 5 parts with 5 distinct colors (1..5): SuprArmr (1), Custom1 (2), AirShoes (12), UnderSht (13), Humor (23)
    const ids = [1, 2, 12, 13, 23];
    const indices = ids.map(id => data.partMetas.findIndex(p => p.id === id));
    const mask = from([true, false, false, false], 2, 2);
    data.partMetas = indices.map((i, n) => ({ ...data.partMetas[i], color: n + 1 }));
    data.parts = indices.map((i, n) => ({ ...data.parts[i], color: n + 1, compressedMask: mask, uncompressedMask: mask }));
    data.gridOptions = [{ label: "fixture", settings: gs }];
    data.defaultExpansion = 0;

    const allAllowed = Object.fromEntries(BUG_SPEC_OPTIONS.map(b => [b.id, "allowed_any"]));
    const problem = {
        ...emptyProblem(data),
        requirements: [0, 1, 2, 3].map(partIndex => ({
            partIndex,
            constraint: { compressed: true, onCommandLine: true, minBugLevel: 0, maxBugLevel: Infinity },
        })),
    };
    const requirements = [
        ...problem.requirements,
        { partIndex: 4, constraint: { compressed: true, onCommandLine: null, minBugLevel: 0, maxBugLevel: Infinity } },
    ];
    const solOnLine = [0, 1, 2, 3, 4].map(x => ({ loc: { position: { x, y: 1 }, rotation: 0 }, compressed: true }));
    const solOffLine = [
        ...[0, 1, 2, 3].map(x => ({ loc: { position: { x, y: 1 }, rotation: 0 }, compressed: true })),
        { loc: { position: { x: 0, y: 0 }, rotation: 0 }, compressed: true },
    ];

    const buildSeed = (solution) => {
        const cells = placeAll(data.parts, requirements, solution, gs);
        return {
            problem: { ...problem, requirements },
            solution,
            stats: computePlacedBuildStats("bn6", data.partMetas, requirements, cells, gs, [], 1000),
            analysis: analyzeSolutionBugs("bn6", data.partMetas, requirements, cells, gs, "en", []),
            addedPartIndices: [4],
            addedCardIds: [],
        };
    };

    // 1. Unneeded Humor (both on-line and off-line) when emotion is only "allowed" and status is not required -> stripped
    const allowedOpts = {
        data,
        problem,
        modCardMode: "none",
        constraints: { bugRules: allAllowed },
        policy: { type: "custom", customRules: allAllowed },
    };
    assert.deepEqual(
        removeRedundantAbilityParts(allowedOpts, buildSeed(solOnLine)).problem.requirements.map(r => data.partMetas[r.partIndex].id),
        [1, 2, 12, 13]
    );
    assert.deepEqual(
        removeRedundantAbilityParts(allowedOpts, buildSeed(solOffLine)).problem.requirements.map(r => data.partMetas[r.partIndex].id),
        [1, 2, 12, 13]
    );

    // 2. Humor off-line when emotion: "required" -> retained
    const emotionRules = { ...allAllowed, emotion: "required" };
    const emotionCleaned = removeRedundantAbilityParts(
        { data, problem, modCardMode: "none", constraints: { bugRules: emotionRules }, policy: { type: "custom", customRules: emotionRules } },
        buildSeed(solOffLine)
    );
    assert.deepEqual(emotionCleaned.problem.requirements.map(r => data.partMetas[r.partIndex].id), ids);

    // 3. Humor on-line (0 placement bug) supplying 5th distinct color when status: "required" -> retained
    const statusRules = { ...allAllowed, status: "required" };
    const statusCleaned = removeRedundantAbilityParts(
        { data, problem, modCardMode: "none", constraints: { bugRules: statusRules }, policy: { type: "custom", customRules: statusRules } },
        buildSeed(solOnLine)
    );
    assert.deepEqual(statusCleaned.problem.requirements.map(r => data.partMetas[r.partIndex].id), ids);
    assert.equal(statusCleaned.analysis.distinctColorCount, 5);
});
