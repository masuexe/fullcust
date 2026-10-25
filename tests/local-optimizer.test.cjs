require("./register.cjs");
const assert = require("node:assert/strict");
const { test } = require("node:test");
const { games } = require("../games.ts");
const { parseGameData } = require("../game-data.ts");
const { emptyProblem } = require("../problem.ts");
const { BUG_SPEC_OPTIONS, computeBuildStats, isSolutionAcceptable } = require("../effects.ts");
const { computeDeckStats } = require("../modcards.ts");
const { doesBuildSatisfyConstraints, compareBuildStats } = require("../optimizer.ts");
const { findFeasibleBuild } = require("../feasible-optimizer.ts");
const { improveBuildLocally, neighboringDecks } = require("../local-optimizer.ts");

function optionsFor(constraints = {}) {
    const data = parseGameData(require("../data/bn6.json"), games.find(g => g.id === "bn6"));
    return { data, problem: emptyProblem(data), modCardMode: "auto", target: "max_hp",
        constraints: { bugRules: Object.fromEntries(BUG_SPEC_OPTIONS.map(bug => [bug.id, "allowed_any"])), ...constraints } };
}

function assertValid(options, result) {
    const deck = computeDeckStats(result.problem.modCards ?? [], options.data.gameId);
    assert.equal(deck.isOverCapacity, false);
    assert.equal(deck.hasSlotConflict, false);
    assert.ok(doesBuildSatisfyConstraints(result.stats, result.analysis, options.constraints));
    assert.ok(isSolutionAcceptable(result.analysis, result.problem.bugPolicy, [], options.constraints.bugRules));
    assert.deepEqual(result.problem.requirements.slice(0, options.problem.requirements.length), options.problem.requirements);
    assert.deepEqual(result.addedPartIndices, result.problem.requirements.slice(options.problem.requirements.length).map(r => r.partIndex));
    const recomputed = computeBuildStats(options.data.gameId,
        result.problem.requirements.map(req => options.data.partMetas[req.partIndex].id), result.problem.modCards, 1000);
    assert.equal(result.stats.finalHp, recomputed.finalHp);
    assert.equal(result.stats.charge, recomputed.charge);
}

test("local card iterations use remaining MB while preserving the full DrillArm specification", () => {
    const options = optionsFor({ requiredAbilities: ["superArmor", "airShoes", "underShirt", "chipRecovery"],
        requiredSpecialMove: "DrillArm", requiredMaxBusterStats: ["charge"] });
    const first = findFeasibleBuild({ ...options, shouldStop: () => false });
    assert.ok(first);
    assert.equal(first.stats.modMbUsed, 56);
    const original = JSON.stringify([options.problem, first]);
    const deadline = Date.now() + 800;
    const updates = [];
    let previous = first.stats;
    const best = improveBuildLocally({ ...options, initialBest: first,
        shouldStop: () => Date.now() >= deadline,
        onImprove: result => {
            assertValid(options, result);
            assert.ok(compareBuildStats(result.stats, previous, options.target) > 0, "Every published iteration must improve actual build value");
            previous = result.stats;
            updates.push(result);
        } });
    assert.ok(updates.length > 0);
    assert.ok(updates.some(result => result.stats.modMbUsed > 56));
    assert.ok(best.stats.finalHp > first.stats.finalHp);
    assert.equal(best.stats.charge, 5);
    assert.equal(best.stats.modBPwrAtk, "DrillArm");
    assertValid(options, best);
    assert.equal(JSON.stringify([options.problem, first]), original);
});

test("a full deck can improve by replacing a card and can use fewer MB", () => {
    const options = optionsFor({ requiredAbilities: ["superArmor"] });
    options.problem.modCards = ["137-C009", "137-B013"]; // Gregar 70 + Needler 10.
    const first = findFeasibleBuild({ ...options, modCardMode: "keep", shouldStop: () => false });
    assert.ok(first);
    assert.equal(first.stats.modMbUsed, 80);
    let stopped = false;
    const best = improveBuildLocally({ ...options, initialBest: first,
        shouldStop: () => stopped, onImprove: result => { assertValid(options, result); stopped = true; } });
    assert.ok(stopped, "An improving replacement should be published");
    assert.equal(best.problem.modCards.length, 2, "No extra card fits; this must be a replacement");
    assert.ok(best.stats.modMbUsed < 80, "Capacity consumption is not the optimization score");
    assert.ok(best.stats.finalHp > first.stats.finalHp);
    assert.notDeepEqual(best.problem.modCards, first.problem.modCards);
});

test("card loading order is explored when it improves final HP without changing required moves", () => {
    const current = ["137-A050", "137-B014"]; // GrndMan's +25%, then Twins' +100 HP.
    const before = computeBuildStats("bn6", [], current, 1000);
    const reordered = [...neighboringDecks(current, [])].find(cards =>
        cards.join() === "137-B014,137-A050");
    assert.ok(reordered);
    const stats = computeBuildStats("bn6", [], reordered, 1000);
    assert.equal(before.finalHp, 1350);
    assert.equal(stats.finalHp, 1375);
    assert.equal(stats.modBPwrAtk, "DrillArm");
    assert.ok(stats.modChipRecovery > 0);
});

test("keep/none modes preserve cards and explicit core constraints during local NC improvement", () => {
    for (const mode of ["keep", "none"]) {
        const options = optionsFor();
        options.modCardMode = mode;
        options.problem.modCards = mode === "keep" ? ["137-A050", "137-B014"] : [];
        options.problem.requirements = [{ partIndex: options.data.partMetas.findIndex(p => p.id === 13),
            constraint: { compressed: false, onCommandLine: true, minBugLevel: 0, maxBugLevel: 0 } }];
        const first = findFeasibleBuild({ ...options, shouldStop: () => false });
        assert.ok(first);
        const deadline = Date.now() + 200;
        const best = improveBuildLocally({ ...options, initialBest: first, shouldStop: () => Date.now() >= deadline,
            onImprove: result => {
                assertValid(options, result);
                assert.deepEqual(result.problem.modCards, options.problem.modCards);
                assert.equal(result.solution[0].compressed, false);
            } });
        assert.deepEqual(best.problem.modCards, options.problem.modCards);
        assert.equal(best.solution[0].compressed, false);
        assert.equal(improveBuildLocally({ ...options, initialBest: first, shouldStop: () => true }), first);
    }
});

test("NC is repacked when card bonuses make an automatic MAX part redundant", () => {
    const { from } = require("../array2d.ts");
    const options = optionsFor({ requiredMaxBusterStats: ["charge"] });
    options.modCardMode = "keep";
    const indices = [40, 46].map(id => options.data.partMetas.findIndex(p => p.id === id));
    options.data.partMetas = indices.map(i => options.data.partMetas[i]);
    options.data.parts = indices.map(i => ({ ...options.data.parts[i],
        compressedMask: from([true], 1, 1), uncompressedMask: from([true], 1, 1) }));
    options.data.gridOptions = [{ label: "fixture", settings: { height: 1, width: 1, hasOob: false, commandLineRow: 0 } }];
    options.problem.expansionMemories = 0;
    options.problem.modCards = ["137-B003"]; // Jelly already grants Charge +4.
    const first = findFeasibleBuild({ ...options, problem: { ...options.problem,
        requirements: [{ partIndex: 0, constraint: { compressed: true, onCommandLine: null, minBugLevel: 0, maxBugLevel: Infinity } }] },
        shouldStop: () => false });
    assert.ok(first);
    first.addedPartIndices = [0];
    const deadline = Date.now() + 300;
    const best = improveBuildLocally({ ...options, initialBest: first, shouldStop: () => Date.now() >= deadline });
    assert.ok(best.stats.finalHp > first.stats.finalHp);
    assert.equal(best.stats.charge, 5);
    assert.deepEqual(best.problem.modCards, options.problem.modCards);
    assert.deepEqual(best.problem.requirements.map(req => req.partIndex), [1], "HP replaces the redundant automatic ChargeMAX");
    assertValid(options, best);
});

test("local card changes never downgrade recovery below the requested 30 HP", () => {
    const options = optionsFor({ requiredAbilities: ["superArmor", "airShoes", "underShirt", "chipRecovery"],
        requiredSpecialMove: "DrillArm", requiredMaxBusterStats: ["charge"], minChipRecovery: 30 });
    const first = findFeasibleBuild({ ...options, shouldStop: () => false });
    assert.ok(first);
    const deadline = Date.now() + 400;
    let changes = 0;
    const best = improveBuildLocally({ ...options, initialBest: first, shouldStop: () => Date.now() >= deadline,
        onImprove: result => {
            assertValid(options, result);
            assert.ok(result.stats.modChipRecovery >= 30);
            changes++;
        } });
    assert.ok(changes > 0);
    assert.ok(best.stats.modChipRecovery >= 30);
});

test("a single automatic part can be removed and replaced after a temporary HP loss", () => {
    const { from } = require("../array2d.ts");
    const options = optionsFor();
    options.modCardMode = "none";
    const indices = [1, 36, 41, 46].map(id => options.data.partMetas.findIndex(p => p.id === id));
    options.data.partMetas = indices.map((i, n) => ({ ...options.data.partMetas[i], color: n + 1 }));
    options.data.parts = indices.map((i, n) => ({ ...options.data.parts[i], color: n + 1,
        compressedMask: from(n < 2 ? [true, false, false, false] : [true, true, false, false], 1, 4),
        uncompressedMask: from(n < 2 ? [true, false, false, false] : [true, true, false, false], 1, 4) }));
    options.data.gridOptions = [{ label: "fixture", settings: { height: 1, width: 4, hasOob: false, commandLineRow: 0 } }];
    options.problem.expansionMemories = 0;
    const req = partIndex => ({ partIndex, constraint: { compressed: true, onCommandLine: null, minBugLevel: 0, maxBugLevel: Infinity } });
    options.problem.requirements = [{ ...req(0), constraint: { ...req(0).constraint, onCommandLine: true, maxBugLevel: 0 } }];
    const first = findFeasibleBuild({ ...options,
        problem: { ...options.problem, requirements: [...options.problem.requirements, req(1), req(2)] }, shouldStop: () => false });
    assert.ok(first);
    first.addedPartIndices = [1, 2];
    assert.equal(first.stats.finalHp, 1050);
    const deadline = Date.now() + 400;
    const best = improveBuildLocally({ ...options, initialBest: first, shouldStop: () => Date.now() >= deadline,
        onImprove: result => {
            assertValid(options, result);
            assert.ok(result.stats.finalHp > 1050, "The temporary HP loss must never be published");
        } });
    assert.equal(best.stats.finalHp, 1500);
    assert.deepEqual(best.problem.requirements.map(r => r.partIndex), [0, 1, 3],
        "Remove only automatic HP+50, preserving the core and unrelated Rapid+1 before adding HP+500");
    assert.equal(best.stats.rapid, first.stats.rapid);
    assert.deepEqual(first.problem.requirements.map(r => r.partIndex), [0, 1, 2], "The previous result is immutable");
});
