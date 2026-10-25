require("./register.cjs");
const assert = require("node:assert/strict");
const { test } = require("node:test");
const { games } = require("../games.ts");
const { parseGameData } = require("../game-data.ts");
const { emptyProblem, makeGridSettings } = require("../problem.ts");
const { from } = require("../array2d.ts");
const { BUG_SPEC_OPTIONS, analyzeSolutionBugs, computeBuildStats, isSolutionAcceptable } = require("../effects.ts");
const { findFeasibleBuild } = require("../feasible-optimizer.ts");
const { improveBuildLocally } = require("../local-optimizer.ts");
const { removeRedundantAbilityParts, occupiedBuildCells, haveSameBuildEffects } = require("../optimizer.ts");
const { placeAll, meetsPlacementBugConstraints } = require("../solver.ts");

function fixture(ids, height = 1, width = 2) {
    const data = parseGameData(require("../data/bn6.json"), games.find(game => game.id === "bn6"));
    const indices = ids.map(id => data.partMetas.findIndex(part => part.id === id));
    data.partMetas = indices.map((i, n) => ({ ...data.partMetas[i], color: n + 1 }));
    data.parts = indices.map((i, n) => ({ ...data.parts[i], color: n + 1,
        compressedMask: from([true, ...new Array(height * width - 1).fill(false)], height, width),
        uncompressedMask: from([true, ...new Array(height * width - 1).fill(false)], height, width) }));
    data.gridOptions = [{ label: "fixture", settings: { height, width, commandLineRow: 0, hasOob: false } }];
    data.defaultExpansion = 0;
    const problem = emptyProblem(data);
    problem.modCards = ["137-A001"]; // No inherent bug; Attack+1, HP-40.
    return { data, problem, modCardMode: "keep" };
}
function first(options) {
    const deadline = Date.now() + 1000;
    return findFeasibleBuild({ ...options, shouldStop: () => Date.now() >= deadline });
}
function req(partIndex, constraint = {}) {
    return { partIndex, constraint: { onCommandLine: null, compressed: true,
        minBugLevel: 0, maxBugLevel: Infinity, ...constraint } };
}

test("BN6 card mode seeds BugStop before the mandatory Attack NC part", () => {
    const options = { ...fixture([31, 38]), constraints: { minBusterStats: { attack: 5 } } };
    const snapshot = JSON.stringify(options);
    const result = first(options);
    assert.ok(result);
    assert.deepEqual(result.addedPartIndices, [0, 1]);
    assert.ok(result.analysis.bugStopActive);
    assert.ok(result.stats.attack >= 5);
    assert.equal(JSON.stringify(options), snapshot);
    assert.ok(isSolutionAcceptable(result.analysis));
    // Disabling the preference preserves the existing policy-repair fallback.
    const fallback = first({ ...options, preferBugStop: false });
    assert.ok(fallback);
    assert.deepEqual(fallback.addedPartIndices, [1, 0]);
    for (const modCardMode of ["none", "keep"]) {
        const withoutCards = first({ ...options, problem: { ...options.problem, modCards: [] }, modCardMode });
        assert.ok(withoutCards);
        assert.deepEqual(withoutCards.addedPartIndices, [1, 0]);
    }
});

test("BugStop preference falls back when it consumes the space needed for a valid build", () => {
    const options = { ...fixture([31, 2], 1, 1), constraints: { minCustom: 6 } };
    const result = first(options);
    assert.ok(result);
    assert.equal(result.stats.custom, 6);
    assert.deepEqual(result.addedPartIndices, [1]);
    assert.equal(result.analysis.bugStopActive, false);
});

test("required NC bugs and inherent card bugs are never hidden by the BugStop seed", () => {
    const options = fixture([31, 38]);
    const required = first({ ...options, constraints: { minBusterStats: { attack: 5 }, bugRules: { buster: "required" } } });
    assert.ok(required);
    assert.ok(!required.stats.abilities.includes("bugStop"));
    assert.ok(required.analysis.activeBugs.some(bug => bug.bugType === "buster"));
    const cardBug = first({ ...options, problem: { ...options.problem, modCards: ["137-A021"] } });
    assert.equal(cardBug, null, "BugStop cannot neutralize OldStove's card HP bug");
});

test("an existing core BugStop is never duplicated", () => {
    const options = fixture([31, 38]);
    options.problem.requirements = [req(0, { onCommandLine: true, maxBugLevel: 0 })];
    const result = first({ ...options, constraints: { minBusterStats: { attack: 5 } } });
    assert.ok(result);
    assert.deepEqual(result.problem.requirements[0], options.problem.requirements[0]);
    assert.equal(result.problem.requirements.filter(r => r.partIndex === 0).length, 1);
    assert.deepEqual(result.addedPartIndices, [1]);
});

function seed(options, requirements, positions) {
    const grid = makeGridSettings(options.data, options.problem);
    const solution = positions.map(([x, y]) => ({ loc: { position: { x, y }, rotation: 0 }, compressed: true }));
    const stats = computeBuildStats("bn6", requirements.map(r => options.data.partMetas[r.partIndex].id), options.problem.modCards);
    const analysis = analyzeSolutionBugs("bn6", options.data.partMetas, requirements,
        placeAll(options.data.parts, requirements, solution, grid), grid, "en", options.problem.modCards);
    return { problem: { ...options.problem, requirements }, solution, stats, analysis,
        addedPartIndices: requirements.slice(options.problem.requirements.length).map(r => r.partIndex), addedCardIds: [] };
}

test("unused automatic BugStop can be removed, while a manually fixed or required one is preserved", () => {
    const options = fixture([31, 46], 2, 2);
    const initial = seed(options, [req(0, { onCommandLine: true, maxBugLevel: 0 }), req(1)], [[0, 0], [0, 1]]);
    assert.ok(initial.analysis.bugStopActive);
    const cleaned = removeRedundantAbilityParts(options, initial);
    assert.deepEqual(cleaned.problem.requirements.map(r => r.partIndex), [1]);
    assert.ok(haveSameBuildEffects(cleaned.stats, initial.stats));
    assert.equal(cleaned.stats.finalHp, initial.stats.finalHp);
    assert.ok(isSolutionAcceptable(cleaned.analysis));
    assert.equal(removeRedundantAbilityParts({ ...options, constraints: { requiredAbilities: ["bugStop"] } }, initial), initial);
    const fixed = { ...options, problem: { ...options.problem, requirements: [initial.problem.requirements[0]] } };
    assert.equal(removeRedundantAbilityParts(fixed, initial), initial);
});

test("local improvement repacks HP off the command line to remove an unnecessary automatic BugStop", () => {
    const options = fixture([31, 46], 2, 2);
    const initial = seed(options, [req(0, { onCommandLine: true, maxBugLevel: 0 }), req(1)], [[0, 0], [1, 0]]);
    assert.ok(initial.analysis.bugStopActive);
    assert.ok(initial.analysis.bugs.some(b => b.bugType === "damageHp"));
    const original = JSON.stringify(initial);
    const deadline = Date.now() + 500;
    const best = improveBuildLocally({ ...options, initialBest: initial, shouldStop: () => Date.now() >= deadline });
    assert.deepEqual(best.problem.requirements.map(r => r.partIndex), [1]);
    assert.equal(best.stats.finalHp, initial.stats.finalHp);
    assert.ok(!best.stats.abilities.includes("bugStop"));
    assert.ok(occupiedBuildCells(options.data, best) < occupiedBuildCells(options.data, initial));
    assert.ok(isSolutionAcceptable(best.analysis));
    assert.ok(meetsPlacementBugConstraints(options.data.parts, best.problem.requirements, best.solution, makeGridSettings(options.data, best.problem)));
    assert.equal(JSON.stringify(initial), original);
});

test("necessary BugStop is retained when no compliant repacking exists", () => {
    const options = fixture([31, 46]); // Every cell lies on the command line.
    const initial = seed(options, [req(0, { onCommandLine: true, maxBugLevel: 0 }), req(1)], [[0, 0], [1, 0]]);
    const deadline = Date.now() + 500;
    const best = improveBuildLocally({ ...options, initialBest: initial, shouldStop: () => Date.now() >= deadline });
    assert.ok(best.analysis.bugStopActive);
    assert.equal(best.stats.finalHp, initial.stats.finalHp);
    assert.ok(isSolutionAcceptable(best.analysis));
});


test("allowing all bugs bypasses the BugStop preference", () => {
    const options = { ...fixture([31, 38]), constraints: { minBusterStats: { attack: 5 },
        bugRules: Object.fromEntries(BUG_SPEC_OPTIONS.map(opt => [opt.id, "allowed_any"])) } };
    const result = first(options);
    assert.ok(result);
    assert.deepEqual(result.addedPartIndices, [1]);
    assert.ok(!result.stats.abilities.includes("bugStop"));
});
