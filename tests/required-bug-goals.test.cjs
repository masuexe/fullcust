require("./register.cjs");
const assert = require("node:assert/strict");
const { test } = require("node:test");
const { games } = require("../games.ts");
const { parseGameData } = require("../game-data.ts");
const { emptyProblem, DEFAULT_BUG_POLICY } = require("../problem.ts");
const { analyzeSolutionBugs, isSolutionAcceptable, getEffectiveInBattleBugs } = require("../effects.ts");
const { doesBuildSatisfyConstraints } = require("../optimizer.ts");
const { findFeasibleBuild } = require("../feasible-optimizer.ts");
const { getOptimizerBugOptions } = require("../optimizer-options.ts");

const dataFor = game => parseGameData(require(`../data/${game}.json`), games.find(g => g.id === game));
const bugIdsFor = (data, cards = true) => getOptimizerBugOptions(data, cards).map(option => option.id);
const rulesWith = (data, values = {}) => ({ ...Object.fromEntries(bugIdsFor(data).map(id => [id, "allowed_any"])), ...values });

const cfg = { type: "custom", customRules: undefined };
const policyWith = rules => ({ ...cfg, customRules: rules });
const allowedStats = {
    finalHp: 1000, hp: 1000, attack: 1, rapid: 1, charge: 1, custom: 5,
    abilities: [], modChipRecovery: 0,
};
const fakeAnalysis = (activeBugs, overrides = {}) => ({
    hasBugs: activeBugs.length > 0, bugStopActive: false, isSupportBugGlitchActive: false,
    bugs: [], activeBugs, tooManyColors: false, distinctColorCount: 1, modCardBugs: [],
    repairedBugsNotice: undefined, ...overrides,
});
const supportBug = { bugType: "support", level: 1, title: "support", mechanics: "", parts: [], isModCardBug: true };

test("support-bug glitch is applied by both validity gates", () => {
    const rules = { support: "forbidden" };
    const glitched = fakeAnalysis([supportBug], { isSupportBugGlitchActive: true });
    const plain = fakeAnalysis([supportBug]);

    // The glitch neutralizes the support bug, so the two gates must agree.
    assert.equal(isSolutionAcceptable(glitched, policyWith(rules), [], rules, true), true);
    assert.equal(isSolutionAcceptable(plain, policyWith(rules), [], rules, true), false);
    assert.equal(doesBuildSatisfyConstraints(allowedStats, glitched, { bugRules: rules, allowSupportBugGlitch: true }, "bn5"), true);
    assert.equal(doesBuildSatisfyConstraints(allowedStats, plain, { bugRules: rules, allowSupportBugGlitch: true }, "bn5"), false);

    // A required support bug cannot be satisfied while the glitch removes it.
    const required = { support: "required" };
    assert.equal(isSolutionAcceptable(glitched, policyWith(required), [], required, true), false);
    assert.equal(isSolutionAcceptable(plain, policyWith(required), [], required, true), true);
    assert.equal(doesBuildSatisfyConstraints(allowedStats, glitched, { bugRules: required, allowSupportBugGlitch: true }, "bn5"), false);
    assert.equal(doesBuildSatisfyConstraints(allowedStats, plain, { bugRules: required, allowSupportBugGlitch: true }, "bn5"), true);
    assert.deepEqual(getEffectiveInBattleBugs(glitched, true), []);
});

const EXE5_CONSTRAINTS = data => ({
    requiredAbilities: ["superArmor", "airShoes", "underShirt", "chipRecovery"],
    minChipRecovery: 50,
    minBusterStats: { charge: 5 },
    minCustom: 6,
    allowedSpecialMoves: ["DrillArm"],
    allowedBLefts: ["Shield", "CurseShield"],
    allowSupportBugGlitch: true,
    allowedGauges: ["normal", "slow"],
    bugRules: rulesWith(data, { movement: "forbidden", damageBlind: "forbidden", support: "required" }),
});

test("BN5 first-solution pass can construct a required non-panel bug", () => {
    const data = dataFor("bn5");
    const constraints = EXE5_CONSTRAINTS(data);
    const deadline = Date.now() + 20000;
    const result = findFeasibleBuild({
        data, problem: emptyProblem(data), constraints,
        policy: policyWith(constraints.bugRules), modCardMode: "auto", target: "max_hp",
        shouldStop: () => Date.now() >= deadline,
    });
    assert.ok(result, "a valid build exists and the first-solution pass must find it");
    const bugs = effectiveBugTypes(result.analysis, constraints.allowSupportBugGlitch);
    assert.ok(bugs.includes("support"), "the required support bug is present");
    assert.ok(!bugs.includes("movement") && !bugs.includes("damageBlind"), "forbidden bugs stay absent");
    assert.ok(doesBuildSatisfyConstraints(result.stats, result.analysis, constraints, "bn5"));
    assert.ok(isSolutionAcceptable(result.analysis, policyWith(constraints.bugRules), [], constraints.bugRules,
        constraints.allowSupportBugGlitch));
    // Every requested specification survives the cleanup step.
    assert.ok(result.stats.abilities.includes("superArmor"));
    assert.ok(result.stats.abilities.includes("airShoes"));
    assert.ok(result.stats.abilities.includes("underShirt"));
    assert.ok(result.stats.abilities.includes("chipRecovery"));
    assert.ok(result.stats.charge >= 5 && result.stats.custom >= 6);
    assert.ok((result.stats.modChipRecovery ?? 0) >= 50);
    assert.equal(result.stats.modBPwrAtk, "DrillArm");
    assert.ok(["Shield", "CurseShield"].includes(result.stats.modBLeft));
});

test("a build that needs a required support bug is rejected once the glitch removes it", () => {
    const data = dataFor("bn5");
    const constraints = EXE5_CONSTRAINTS(data);
    const deadline = Date.now() + 20000;
    const found = findFeasibleBuild({
        data, problem: emptyProblem(data), constraints,
        policy: policyWith(constraints.bugRules), modCardMode: "auto", target: "max_hp",
        shouldStop: () => Date.now() >= deadline,
    });
    assert.ok(found);
    const grid = require("../problem.ts").makeGridSettings(data, found.problem);
    const occupied = require("../solver.ts").placeAll(data.parts, found.problem.requirements, found.solution, grid);
    // Erball (136-A006) plus a bugged Rush or Beat program activates the glitch.
    const withErball = [...(found.problem.modCards ?? []), "136-A006"];
    const glitched = analyzeSolutionBugs(data.gameId, data.partMetas, found.problem.requirements, occupied, grid, "en", withErball);
    assert.equal(glitched.isSupportBugGlitchActive, true);
    assert.ok(!effectiveBugTypes(glitched, true).includes("support"));
    assert.equal(isSolutionAcceptable(glitched, policyWith(constraints.bugRules), [], constraints.bugRules, true), false);
});

function effectiveBugTypes(analysis, allowSupportBugGlitch) {
    return getEffectiveInBattleBugs(analysis, allowSupportBugGlitch).map(bug => bug.bugType);
}
