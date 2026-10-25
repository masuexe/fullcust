require("./register.cjs");
const assert = require("node:assert/strict");
const { test } = require("node:test");
const { games } = require("../games.ts");
const { parseGameData } = require("../game-data.ts");
const { emptyProblem } = require("../problem.ts");
const { from } = require("../array2d.ts");
const { searchBuilds, enumerateCardDecks } = require("../exhaustive-optimizer.ts");
const { isSolutionAcceptable, computeBuildStats, analyzeSolutionBugs } = require("../effects.ts");
const { evaluateBuildScore } = require("../optimizer.ts");
const { solve, placeAll } = require("../solver.ts");

function fixture(ids, height = 1, width = 2) {
    const data = parseGameData(require("../data/bn6.json"), games.find(g => g.id === "bn6"));
    const indices = ids.map(id => data.partMetas.findIndex(p => p.id === id));
    data.partMetas = indices.map((i, n) => ({ ...data.partMetas[i], color: n + 1 }));
    data.parts = indices.map((i, n) => ({ ...data.parts[i], color: n + 1,
        compressedMask: from([true, ...new Array(height * width - 1).fill(false)], height, width),
        uncompressedMask: from([true, ...new Array(height * width - 1).fill(false)], height, width),
    }));
    data.gridOptions = [{ label: "fixture", settings: { height, width, commandLineRow: 0, hasOob: false } }];
    data.defaultExpansion = 0;
    return data;
}
function req(partIndex, overrides = {}) {
    return { partIndex, constraint: { compressed: null, onCommandLine: null, minBugLevel: 0, maxBugLevel: Infinity, ...overrides } };
}

test("exact search can satisfy a required bug by adding to an initially invalid build", () => {
    const data = fixture([1, 46]);
    const constraints = { requiredAbilities: ["superArmor"], bugRules: { battleHp: "required" } };
    const result = searchBuilds({ data, problem: emptyProblem(data), constraints, modCardMode: "none" });
    assert.equal(result.completed, true);
    assert.ok(result.best);
    assert.equal(result.best.stats.finalHp, 1500);
    assert.ok(result.best.stats.abilities.includes("superArmor"));
    assert.ok(isSolutionAcceptable(result.best.analysis, { type: "no_bugs" }, [], constraints.bugRules));
});

test("exact search explores alternative ability colors instead of selecting the first variant", () => {
    const data = fixture([13, 1, 1]);
    data.parts[0].color = data.partMetas[0].color = 2;
    const problem = emptyProblem(data);
    problem.requirements = [req(0, { onCommandLine: true, maxBugLevel: 0 })];
    const result = searchBuilds({ data, problem, modCardMode: "none", constraints: { requiredAbilities: ["superArmor"] } });
    assert.equal(result.completed, true);
    assert.ok(result.best);
    assert.deepEqual(result.best.addedPartIndices, [2]);
});

test("adding BugStop can repair an unacceptable intermediate core", () => {
    const data = fixture([46, 31]);
    const problem = emptyProblem(data);
    problem.requirements = [req(0, { minBugLevel: 1 })];
    const result = searchBuilds({ data, problem, modCardMode: "none" });
    assert.equal(result.completed, true);
    assert.ok(result.best?.analysis.bugStopActive);
    assert.deepEqual(result.best.addedPartIndices, [1]);
});

test("minimum adjacency bug constraints are not used to prune incomplete builds", () => {
    const data = fixture([1]);
    const problem = emptyProblem(data);
    problem.requirements = [req(0, { onCommandLine: true, minBugLevel: 1 })];
    const result = searchBuilds({ data, problem, modCardMode: "none", constraints: { bugRules: { movement: "allowed_any" } } });
    assert.equal(result.completed, true);
    assert.ok(result.best);
    assert.deepEqual(result.best.addedPartIndices, [0]);
});

test("zero-score support parts remain available to satisfy required bugs", () => {
    const data = fixture([23], 2, 1);
    const result = searchBuilds({ data, problem: emptyProblem(data), modCardMode: "none",
        constraints: { bugRules: { emotion: "required" } } });
    assert.equal(result.completed, true);
    assert.ok(result.best);
    assert.ok(result.best.addedPartIndices.includes(0));
});

test("exhausted and cancelled searches have distinct outcomes and retain the incumbent", () => {
    const data = fixture([46]);
    const impossible = searchBuilds({ data, problem: emptyProblem(data), modCardMode: "none",
        constraints: { requiredAbilities: ["superArmor"] } });
    assert.equal(impossible.completed, true);
    assert.equal(impossible.best, null);
    let cancelled = false;
    const result = searchBuilds({ data, problem: emptyProblem(data), modCardMode: "none",
        shouldStop: () => cancelled,
        onProgress: progress => { if (progress.best) cancelled = true; } });
    assert.equal(result.completed, false);
    assert.ok(result.best);
});

test("small exhaustive searches match an independent enumeration including repeated copies", () => {
    const data = fixture([1, 46]);
    const problem = emptyProblem(data);
    const grid = data.gridOptions[0].settings;
    for (const policy of [{ type: "no_bugs" }, { type: "custom", customRules: { battleHp: "allowed_any" } }]) {
        for (const target of ["max_hp", "max_buster", "balanced"]) {
            let expected = -Infinity;
            // Every ordered inventory of up to two cells; no heuristic pruning.
            for (const indices of [[], [0], [1], [0, 0], [0, 1], [1, 0], [1, 1]]) {
                const requirements = indices.map(i => req(i));
                for (const solution of solve(data.parts, requirements, grid, problem.spinnableColors, undefined, false)) {
                    const analysis = analyzeSolutionBugs(data.gameId, data.partMetas, requirements,
                        placeAll(data.parts, requirements, solution, grid), grid, "en", []);
                    if (isSolutionAcceptable(analysis, policy)) {
                        expected = Math.max(expected, evaluateBuildScore(computeBuildStats(data.gameId,
                            indices.map(i => data.partMetas[i].id), [], 1000), target));
                    }
                }
            }
            const result = searchBuilds({ data, problem, policy, target, modCardMode: "none" });
            assert.equal(result.completed, true);
            assert.equal(evaluateBuildScore(result.best.stats, target), expected);
        }
    }
});

test("card enumeration preserves both loading orders, capacity, and slot restrictions", () => {
    const cards = [{ id: "a", mb: 30, slot: "0A" }, { id: "b", mb: 40, slot: "0A" }, { id: "c", mb: 60, slot: "0B" }];
    const decks = [...enumerateCardDecks(cards, "bn6")];
    assert.deepEqual(decks, [[], ["a"], ["a", "a"], ["a", "b"], ["b"], ["b", "a"], ["b", "b"], ["c"]]);
    const slots = [...enumerateCardDecks(cards, "bn4")];
    assert.ok(slots.some(ids => ids.join() === "a,c"));
    assert.ok(slots.some(ids => ids.join() === "c,a"));
    assert.ok(!slots.some(ids => ids.includes("a") && ids.includes("b")));
});


test("uncompressed alternatives are searched for automatically added parts", () => {
    const data = fixture([13, 1]);
    data.parts[1].compressedMask = from([true, true], 1, 2);
    const problem = emptyProblem(data);
    problem.requirements = [req(0, { maxBugLevel: 0 })];
    const result = searchBuilds({ data, problem, modCardMode: "none",
        constraints: { requiredAbilities: ["superArmor"] } });
    assert.equal(result.completed, true);
    assert.ok(result.best);
    assert.equal(result.best.solution[1].compressed, false);
});

test("card repairs prevent forbidden local placement bugs from being pruned", () => {
    const data = fixture([1], 2, 1);
    const problem = emptyProblem(data);
    problem.requirements = [req(0, { onCommandLine: false, minBugLevel: 1 })];
    problem.modCards = ["137-A017"]; // BomBoy repairs movement bugs.
    const result = searchBuilds({ data, problem, modCardMode: "keep" });
    assert.equal(result.completed, true);
    assert.ok(result.best);
    assert.ok(isSolutionAcceptable(result.best.analysis, { type: "no_bugs" }));
});

test("required Buster stats stay at Lv5 while the HP objective optimizes the remaining space", () => {
    const data = fixture([38, 46]);
    const problem = emptyProblem(data);
    const bugRules = { buster: "allowed_any", battleHp: "allowed_any" };
    const unconstrained = searchBuilds({ data, problem, modCardMode: "none", target: "max_hp", constraints: { bugRules } });
    assert.equal(unconstrained.best.stats.finalHp, 2000);
    assert.equal(unconstrained.best.stats.attack, 1);
    const result = searchBuilds({ data, problem, modCardMode: "none", target: "max_hp",
        constraints: { bugRules, requiredMaxBusterStats: ["attack"] } });
    assert.equal(result.completed, true);
    assert.ok(result.best);
    assert.equal(result.best.stats.attack, 5);
    assert.equal(result.best.stats.finalHp, 1500);
    assert.equal(result.best.stats.rapid, 1, "Unchecked attributes are unrestricted");
});

test("multiple Buster stats can be required and can be built from incremental bonuses", () => {
    const data = fixture([35], 1, 4);
    const incremental = searchBuilds({ data, problem: emptyProblem(data), modCardMode: "none",
        constraints: { requiredMaxBusterStats: ["attack"], bugRules: { buster: "allowed_any" } } });
    assert.equal(incremental.completed, true);
    assert.equal(incremental.best.stats.attack, 5);
    assert.equal(incremental.best.addedPartIndices.length, 4);
    const all = fixture([38, 39, 40], 1, 3);
    const result = searchBuilds({ data: all, problem: emptyProblem(all), modCardMode: "none",
        constraints: { requiredMaxBusterStats: ["attack", "rapid", "charge"], bugRules: { buster: "allowed_any" } } });
    assert.equal(result.completed, true);
    assert.ok(result.best);
    assert.deepEqual([result.best.stats.attack, result.best.stats.rapid, result.best.stats.charge], [5, 5, 5]);
});

test("max Buster requirements use final card effects, including penalties to MAX parts", () => {
    const data = fixture([38], 1, 1);
    const problem = emptyProblem(data);
    problem.modCards = ["137-A019"]; // Flashy: Attack -1. AttackMAX then yields Lv4.
    const result = searchBuilds({ data, problem, modCardMode: "keep",
        constraints: { requiredMaxBusterStats: ["attack"], bugRules: { buster: "allowed_any" } } });
    assert.equal(result.completed, true);
    assert.equal(result.best, null);
    problem.modCards = ["137-C003"]; // S.Batlr's Custom: +4 to each Buster stat.
    data.parts = [];
    data.partMetas = []; // Isolate card-only fulfillment; optional AttackMAX now raises Attack above five.
    const cardsOnly = searchBuilds({ data, problem, modCardMode: "keep",
        constraints: { requiredMaxBusterStats: ["attack", "rapid", "charge"] } });
    assert.equal(cardsOnly.completed, true);
    assert.ok(cardsOnly.best);
    assert.deepEqual([cardsOnly.best.stats.attack, cardsOnly.best.stats.rapid, cardsOnly.best.stats.charge], [5, 5, 5]);
    assert.deepEqual(cardsOnly.best.addedPartIndices, [], "Cards can fulfill the stats without NC additions");
});

test("a MAX requirement in one attribute does not require the other two", () => {
    const data = fixture([40, 46]);
    const result = searchBuilds({ data, problem: emptyProblem(data), modCardMode: "none",
        constraints: { requiredMaxBusterStats: ["charge"], bugRules: { buster: "allowed_any", battleHp: "allowed_any" } } });
    assert.equal(result.completed, true);
    assert.deepEqual([result.best.stats.attack, result.best.stats.rapid, result.best.stats.charge], [1, 1, 5]);
    assert.equal(result.best.stats.finalHp, 1500);
});
