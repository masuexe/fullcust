require("./register.cjs");
const assert = require("node:assert/strict");
const { test } = require("node:test");
const { games } = require("../games.ts");
const { parseGameData } = require("../game-data.ts");
const { emptyProblem, makeGridSettings } = require("../problem.ts");
const { from } = require("../array2d.ts");
const { BUG_SPEC_OPTIONS, computeBuildStats, analyzeSolutionBugs } = require("../effects.ts");
const { occupiedBuildCells, optimizeBuild, removeRedundantAbilityParts } = require("../optimizer.ts");
const { findFeasibleBuild } = require("../feasible-optimizer.ts");
const { improveBuildLocally } = require("../local-optimizer.ts");
const { searchBuilds } = require("../exhaustive-optimizer.ts");
const { meetsPlacementBugConstraints, placeAll } = require("../solver.ts");

function options() {
    const data = parseGameData(require("../data/bn6.json"), games.find(g => g.id === "bn6"));
    return { data, problem: emptyProblem(data), modCardMode: "none",
        constraints: { bugRules: Object.fromEntries(BUG_SPEC_OPTIONS.map(b => [b.id, "allowed_any"])) } };
}
function req(data, id, constraint = {}) {
    return { partIndex: data.partMetas.findIndex(meta => meta.id === id),
        constraint: { compressed: true, onCommandLine: null, minBugLevel: 0, maxBugLevel: Infinity, ...constraint } };
}
function realSeed(opts, requirements) {
    const deadline = Date.now() + 3000;
    const result = findFeasibleBuild({ ...opts, problem: { ...opts.problem, requirements }, shouldStop: () => Date.now() >= deadline });
    assert.ok(result);
    result.addedPartIndices = requirements.slice(opts.problem.requirements.length).map(r => r.partIndex);
    return result;
}

test("BodyPack removes automatic duplicate armor/shoes/UnderShirt while preserving every final stat", () => {
    const opts = options();
    const requirements = [28, 1, 11, 12, 13, 41].map(id => req(opts.data, id));
    const seed = realSeed(opts, requirements);
    const snapshot = JSON.stringify(seed);
    const cleaned = removeRedundantAbilityParts(opts, seed);
    assert.deepEqual(cleaned.problem.requirements.map(r => opts.data.partMetas[r.partIndex].id), [28, 41]);
    assert.deepEqual(cleaned.stats, seed.stats);
    assert.ok(occupiedBuildCells(opts.data, cleaned) < occupiedBuildCells(opts.data, seed));
    assert.equal(cleaned.solution.length, cleaned.problem.requirements.length);
    assert.deepEqual(cleaned.addedPartIndices, cleaned.problem.requirements.map(r => r.partIndex));
    assert.equal(JSON.stringify(seed), snapshot);
    assert.ok(meetsPlacementBugConstraints(opts.data.parts, cleaned.problem.requirements, cleaned.solution, makeGridSettings(opts.data, cleaned.problem)));
});

test("manually fixed SuprArmr remains protected when an automatic BodyPack is present", () => {
    const opts = options();
    opts.problem.requirements = [req(opts.data, 1, { onCommandLine: true, maxBugLevel: 0 })];
    const seed = realSeed(opts, [...opts.problem.requirements, req(opts.data, 28)]);
    const cleaned = removeRedundantAbilityParts(opts, seed);
    assert.deepEqual(cleaned.problem.requirements.map(r => opts.data.partMetas[r.partIndex].id), [1, 28]);
    assert.deepEqual(cleaned.problem.requirements[0], opts.problem.requirements[0]);
});

function tiny(opts, placements, constraints) {
    const indices = [28, 1].map(id => opts.data.partMetas.findIndex(p => p.id === id));
    opts.data.partMetas = indices.map(i => ({ ...opts.data.partMetas[i] }));
    opts.data.parts = indices.map(i => ({ ...opts.data.parts[i],
        compressedMask: from([true, false, false, false], 2, 2), uncompressedMask: from([true, false, false, false], 2, 2) }));
    opts.data.gridOptions = [{ label: "fixture", settings: { height: 2, width: 2, commandLineRow: 0, hasOob: false } }];
    opts.problem.expansionMemories = 0;
    const requirements = [req(opts.data, 28, constraints?.[0]), req(opts.data, 1, constraints?.[1])];
    const solution = placements.map(([x, y]) => ({ loc: { position: { x, y }, rotation: 0 }, compressed: true }));
    const grid = makeGridSettings(opts.data, opts.problem);
    return { problem: { ...opts.problem, requirements, constraints: opts.constraints }, solution,
        stats: computeBuildStats("bn6", [28, 1], [], 1000),
        analysis: analyzeSolutionBugs("bn6", opts.data.partMetas, requirements,
            placeAll(opts.data.parts, requirements, solution, grid), grid, "en", []),
        addedPartIndices: [0, 1], addedCardIds: [] };
}

test("duplicate armor is retained when it is the source of a required movement bug", () => {
    const opts = options();
    opts.constraints.bugRules = { movement: "required" };
    const seed = tiny(opts, [[0, 0], [0, 1]]);
    opts.data.parts[0].color = opts.data.partMetas[0].color = 1;
    opts.data.parts[1].color = opts.data.partMetas[1].color = 2;
    const grid = makeGridSettings(opts.data, opts.problem);
    seed.analysis = analyzeSolutionBugs("bn6", opts.data.partMetas, seed.problem.requirements,
        placeAll(opts.data.parts, seed.problem.requirements, seed.solution, grid), grid, "en", []);
    assert.ok(seed.analysis.activeBugs.some(b => b.bugType === "movement"));
    const cleaned = removeRedundantAbilityParts(opts, seed);
    assert.equal(cleaned.problem.requirements.length, 2);
});

test("cleanup preserves a retained part's explicit minimum adjacency bug level", () => {
    const opts = options();
    const seed = tiny(opts, [[0, 0], [1, 0]], [{ minBugLevel: 1, onCommandLine: true }]);
    opts.data.parts[0].color = opts.data.partMetas[0].color = 1;
    opts.data.parts[1].color = opts.data.partMetas[1].color = 1;
    opts.problem.requirements = [seed.problem.requirements[0]];
    const grid = makeGridSettings(opts.data, opts.problem);
    assert.ok(meetsPlacementBugConstraints(opts.data.parts, seed.problem.requirements, seed.solution, grid));
    assert.equal(meetsPlacementBugConstraints(opts.data.parts, [seed.problem.requirements[0]], [seed.solution[0]], grid), false);
    const cleaned = removeRedundantAbilityParts(opts, seed);
    assert.equal(cleaned.problem.requirements.length, 2);
});

test("a fixed BodyPack already covers required abilities without injecting extra simple parts", () => {
    const opts = options();
    const indices = [28, 1].map(id => opts.data.partMetas.findIndex(p => p.id === id));
    opts.data.partMetas = indices.map(i => opts.data.partMetas[i]);
    opts.data.parts = indices.map(i => opts.data.parts[i]);
    opts.problem.requirements = [req(opts.data, 28)];
    opts.constraints.requiredAbilities = ["superArmor", "airShoes", "underShirt"];
    const result = optimizeBuild(opts);
    assert.ok(result);
    assert.equal(result.problem.requirements.length, 1);
    assert.deepEqual(result.addedPartIndices, []);
});

test("equal-score cleanup is streamed by local and exhaustive search before more work", () => {
    const opts = options();
    const seed = realSeed(opts, [req(opts.data, 28), req(opts.data, 1)]);
    let stopped = false;
    const best = improveBuildLocally({ ...opts, initialBest: seed, shouldStop: () => stopped,
        onImprove: result => {
            assert.deepEqual(result.stats, seed.stats);
            assert.equal(result.problem.requirements.length, 1);
            stopped = true;
        } });
    assert.ok(stopped);
    assert.equal(best.problem.requirements.length, 1);
    stopped = false;
    const exact = searchBuilds({ ...opts, initialBest: seed, shouldStop: () => stopped,
        onProgress: progress => {
            if (!progress.best) return;
            assert.equal(progress.best.problem.requirements.length, 1);
            stopped = true;
        } });
    assert.equal(exact.completed, false);
    assert.equal(exact.best.problem.requirements.length, 1);
});
