require("./register.cjs");
const assert = require("node:assert/strict");
const { test } = require("node:test");

const { games } = require("../games.ts");
const { parseGameData } = require("../game-data.ts");
const { emptyProblem } = require("../problem.ts");
const { solve, placeAll } = require("../solver.ts");
const {
    analyzeSolutionBugs,
    isSolutionAcceptable,
    isBenignBug,
} = require("../effects.ts");
const {
    getCandidateFillerParts,
    optimizeBuild,
} = require("../optimizer.ts");

function getGameData(gameId) {
    const raw = require(`../data/${gameId}.json`);
    const game = games.find(g => g.id === gameId);
    return parseGameData(raw, game);
}

test("isBenignBug correctly categorizes benign vs lethal bugs", () => {
    assert.equal(isBenignBug("customhp", 1), true);
    assert.equal(isBenignBug("customhp", 2), false);
    assert.equal(isBenignBug("buster", 1), true);
    assert.equal(isBenignBug("emotion", 1), true);

    // Lethal bugs
    assert.equal(isBenignBug("panel", 1), false);
    assert.equal(isBenignBug("movement", 1), false);
    assert.equal(isBenignBug("player", 1), false);
    assert.equal(isBenignBug("battlehp", 1), false);
    assert.equal(isBenignBug("status", 1), false);
});

test("isSolutionAcceptable handles no_bugs with and without BugStop", () => {
    const data = getGameData("bn6");
    const bugStopIndex = data.partMetas.findIndex(p => p.id === 31);
    const custom2Index = data.partMetas.findIndex(p => p.id === 3);

    // Case 1: BugStop placed legally on row 3 (center cmdLine), Custom2 placed on row 1 (violating cmdLine)
    const reqsWithBugStop = [
        { partIndex: bugStopIndex, constraint: { onCommandLine: true, minBugLevel: 0, maxBugLevel: 0, compressed: true } },
        { partIndex: custom2Index, constraint: { onCommandLine: null, minBugLevel: 0, maxBugLevel: Infinity, compressed: true } },
    ];
    const it1 = solve(data.parts, reqsWithBugStop, data.gridSettings, data.colors.map(() => true));
    const sol1 = it1.next().value;
    assert.ok(sol1);
    const occ1 = placeAll(data.parts, reqsWithBugStop, sol1, data.gridSettings);
    const analysis1 = analyzeSolutionBugs("bn6", data.partMetas, reqsWithBugStop, occ1, data.gridSettings, "en");

    assert.equal(analysis1.bugStopActive, true);
    // Because BugStop is active, this is acceptable under no_bugs!
    assert.equal(isSolutionAcceptable(analysis1, { type: "no_bugs" }), true);

    // Case 2: Custom2 placed illegally without BugStop
    const reqsWithoutBugStop = [
        { partIndex: custom2Index, constraint: { onCommandLine: false, minBugLevel: 1, maxBugLevel: 1, compressed: true } },
    ];
    const it2 = solve(data.parts, reqsWithoutBugStop, data.gridSettings, data.colors.map(() => true));
    const sol2 = it2.next().value;
    assert.ok(sol2);
    const occ2 = placeAll(data.parts, reqsWithoutBugStop, sol2, data.gridSettings);
    const analysis2 = analyzeSolutionBugs("bn6", data.partMetas, reqsWithoutBugStop, occ2, data.gridSettings, "en");

    assert.equal(analysis2.bugStopActive, false);
    assert.equal(analysis2.hasBugs, true);
    // Should be rejected under no_bugs
    assert.equal(isSolutionAcceptable(analysis2, { type: "no_bugs" }), false);
});

test("getCandidateFillerParts returns sorted candidate parts", () => {
    const data = getGameData("bn6");
    const candidates = getCandidateFillerParts(data, "max_hp");
    assert.ok(candidates.length > 10);

    // First candidates should be HP+500 variants
    const firstMeta = data.partMetas[candidates[0]];
    assert.match(firstMeta.name, /HP\+500/);
});

test("optimizeBuild automatically fills remaining space and maximizes HP with BugStop (BN6)", () => {
    const data = getGameData("bn6");
    const bugStopIndex = data.partMetas.findIndex(p => p.id === 31);
    const superArmorIndex = data.partMetas.findIndex(p => p.id === 1);
    const floatShoesIndex = data.partMetas.findIndex(p => p.id === 11);

    const problem = emptyProblem(data);
    problem.requirements = [
        { partIndex: bugStopIndex, constraint: { onCommandLine: true, minBugLevel: 0, maxBugLevel: 0, compressed: true } },
        { partIndex: superArmorIndex, constraint: { onCommandLine: null, minBugLevel: 0, maxBugLevel: Infinity, compressed: true } },
        { partIndex: floatShoesIndex, constraint: { onCommandLine: null, minBugLevel: 0, maxBugLevel: Infinity, compressed: true } },
    ];
    problem.bugPolicy = { type: "no_bugs" };

    const result = optimizeBuild({
        data,
        problem,
        target: "max_hp",
        timeoutMs: 2000,
    });

    assert.ok(result, "Optimization must produce a valid result");
    assert.ok(result.addedPartIndices.length >= 2, "Must add at least 2 HP parts");
    assert.ok(result.stats.finalHp >= 2000, `Expected final HP >= 2000 with BugStop, got ${result.stats.finalHp}`);
    assert.equal(result.analysis.bugStopActive, true);
    assert.equal(isSolutionAcceptable(result.analysis, { type: "no_bugs" }), true);
});

test("optimizeBuild automatically fills remaining space without BugStop under no_bugs (BN6)", () => {
    const data = getGameData("bn6");
    const superArmorIndex = data.partMetas.findIndex(p => p.id === 1);
    const floatShoesIndex = data.partMetas.findIndex(p => p.id === 11);

    const problem = emptyProblem(data);
    problem.requirements = [
        { partIndex: superArmorIndex, constraint: { onCommandLine: true, minBugLevel: 0, maxBugLevel: 0, compressed: true } },
        { partIndex: floatShoesIndex, constraint: { onCommandLine: true, minBugLevel: 0, maxBugLevel: 0, compressed: true } },
    ];
    problem.bugPolicy = { type: "no_bugs" };

    const result = optimizeBuild({
        data,
        problem,
        target: "max_hp",
        timeoutMs: 2000,
    });

    assert.ok(result, "Optimization must produce a valid result");
    assert.ok(result.addedPartIndices.length >= 1, "Must add at least 1 HP part");
    assert.ok(result.stats.finalHp > 1000, "HP must increase");
    assert.equal(result.analysis.hasBugs, false, "Must have zero bugs");
    assert.equal(isSolutionAcceptable(result.analysis, { type: "no_bugs" }), true);
});

test("optimizeBuild operates on BN5 and respects game constraints", () => {
    const data = getGameData("bn5");
    const superArmorIndex = data.partMetas.findIndex(p => p.id === 1);

    const problem = emptyProblem(data);
    problem.requirements = [
        { partIndex: superArmorIndex, constraint: { onCommandLine: true, minBugLevel: 0, maxBugLevel: 0, compressed: true } },
    ];
    problem.bugPolicy = { type: "no_bugs" };

    const result = optimizeBuild({
        data,
        problem,
        target: "max_hp",
        timeoutMs: 2000,
    });

    assert.ok(result);
    assert.ok(result.addedPartIndices.length >= 1);
    assert.ok(result.stats.finalHp > 1000);
    assert.equal(isSolutionAcceptable(result.analysis, { type: "no_bugs" }), true);
});

test("optimizeBuild operates on BN3 and respects Style color rules", () => {
    const data = getGameData("bn3");
    // Normal style (only white, yellow, pink)
    const problem = emptyProblem(data);
    problem.style = "normal";

    const result = optimizeBuild({
        data,
        problem,
        target: "max_hp",
        timeoutMs: 2000,
    });

    assert.ok(result);
    assert.ok(result.addedPartIndices.length >= 1);
    assert.ok(result.stats.finalHp > 1000);
});
