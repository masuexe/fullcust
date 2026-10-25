require("./register.cjs");
const assert = require("node:assert/strict");
const { test } = require("node:test");
const { games } = require("../games.ts");
const { parseGameData } = require("../game-data.ts");
const { emptyProblem, makeGridSettings } = require("../problem.ts");
const { BUG_SPEC_OPTIONS, analyzeSolutionBugs, computeBuildStats, isSolutionAcceptable } = require("../effects.ts");
const { doesBuildSatisfyConstraints, optimizeBuild } = require("../optimizer.ts");
const { findFeasibleBuild } = require("../feasible-optimizer.ts");
const { placeAll } = require("../solver.ts");

function drillArmCase() {
    const data = parseGameData(require("../data/bn6.json"), games.find(g => g.id === "bn6"));
    const problem = emptyProblem(data);
    const constraints = {
        requiredAbilities: ["superArmor", "airShoes", "underShirt", "chipRecovery"],
        requiredSpecialMove: "DrillArm", requiredMaxBusterStats: ["charge"],
        bugRules: Object.fromEntries(BUG_SPEC_OPTIONS.map(bug => [bug.id, "allowed_any"])),
    };
    return { data, problem, constraints, modCardMode: "auto" };
}

test("first-solution search satisfies the reported DrillArm build without HP fillers", () => {
    const options = drillArmCase();
    const before = JSON.stringify(options.problem);
    const deadline = Date.now() + 3000;
    const result = findFeasibleBuild({ ...options, shouldStop: () => Date.now() >= deadline });
    assert.ok(result, "The reported build must produce a feasible seed");
    assert.equal(JSON.stringify(options.problem), before);
    const stats = computeBuildStats(options.data.gameId,
        result.problem.requirements.map(req => options.data.partMetas[req.partIndex].id), result.problem.modCards, 1000);
    const grid = makeGridSettings(options.data, result.problem);
    const analysis = analyzeSolutionBugs(options.data.gameId, options.data.partMetas, result.problem.requirements,
        placeAll(options.data.parts, result.problem.requirements, result.solution, grid), grid, "en", result.problem.modCards);
    assert.ok(doesBuildSatisfyConstraints(stats, analysis, options.constraints));
    assert.ok(isSolutionAcceptable(analysis, result.problem.bugPolicy, [], options.constraints.bugRules));
    assert.equal(stats.charge, 5);
    assert.equal(stats.modBPwrAtk, "DrillArm");
    assert.ok(stats.modChipRecovery > 0);
    assert.ok(stats.modMbUsed <= 80);
    assert.ok(result.problem.requirements.length <= 3, "First solve must focus on mandatory requirements");
    assert.equal(stats.hp, 0, "Optional HP packing belongs to the improvement phase");

    const improved = optimizeBuild({ data: options.data, problem: result.problem, modCardMode: "keep",
        constraints: options.constraints, timeoutMs: 500 });
    assert.ok(improved);
    assert.ok(improved.stats.finalHp > stats.finalHp);
    assert.ok(doesBuildSatisfyConstraints(improved.stats, improved.analysis, options.constraints));
});

test("first-solution search preserves core constraints and honors cancellation", () => {
    const options = drillArmCase();
    options.problem.requirements = [{ partIndex: options.data.partMetas.findIndex(meta => meta.id === 13),
        constraint: { onCommandLine: true, compressed: false, minBugLevel: 0, maxBugLevel: 0 } }];
    const deadline = Date.now() + 3000;
    const result = findFeasibleBuild({ ...options, shouldStop: () => Date.now() >= deadline });
    assert.ok(result);
    assert.deepEqual(result.problem.requirements[0], options.problem.requirements[0]);
    assert.equal(result.solution[0].compressed, false);
    assert.equal(findFeasibleBuild({ ...options, shouldStop: () => true }), null);
    assert.equal(findFeasibleBuild({ ...options, modCardMode: "none", shouldStop: () => false }), null,
        "NC cannot supply a card-only CS or Chip Recovery");
});

test("Chip Recovery minima use the final enabled tier rather than adding card values", () => {
    const cases = [
        [["137-B037"], 10, false],
        [["137-B014"], 20, false],
        [["137-A025"], 30, true],
        [["137-B017"], 40, true],
        [["137-B017", "137-B014"], 20, false],
        [["137-B014", "137-B017"], 40, true],
        [["137-B017", "137-B001"], 0, false],
    ];
    const options = drillArmCase();
    const grid = makeGridSettings(options.data, options.problem);
    for (const [cards, expected, acceptable] of cases) {
        const stats = computeBuildStats("bn6", [], cards, 1000);
        const analysis = analyzeSolutionBugs("bn6", options.data.partMetas, [], new Array(grid.height * grid.width).fill(null), grid, "en", cards);
        assert.equal(stats.modChipRecovery ?? 0, expected);
        assert.equal(doesBuildSatisfyConstraints(stats, analysis, { minChipRecovery: 30 }), acceptable);
    }
    options.constraints.minChipRecovery = 30;
    const deadline = Date.now() + 3000;
    const first = findFeasibleBuild({ ...options, shouldStop: () => Date.now() >= deadline });
    assert.ok(first);
    assert.equal(first.stats.modBPwrAtk, "DrillArm");
    assert.ok(first.stats.modChipRecovery >= 30);
    const impossible = findFeasibleBuild({ ...options, problem: { ...options.problem, modCards: ["137-B014"] },
        modCardMode: "keep", shouldStop: () => Date.now() >= deadline });
    assert.equal(impossible, null, "A fixed 20-HP deck cannot meet the 30-HP requirement");
});
