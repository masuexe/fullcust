require("./register.cjs");
const assert = require("node:assert/strict");
const { test } = require("node:test");
const { analyzeSolutionBugs, getPartBugTypes, getEffectiveInBattleBugs, isSolutionAcceptable,
    normalizeBugType, computeBuildStats } = require("../effects.ts");
const { compareBuildStats } = require("../optimizer.ts");

const grid = { width: 7, height: 7, hasOob: true, commandLineRow: 3 };
function analyze(ids, positions, cards = [], game = "bn6") {
    const metas = ids.map((id, i) => ({ id, name: id === 31 ? "BugStop" : `Part ${id}`,
        isSolid: id === 31 || id === 1, color: i + 1 }));
    const reqs = ids.map((_, partIndex) => ({ partIndex }));
    const cells = new Array(49).fill(null);
    positions.forEach(([y, x], i) => { cells[y * 7 + x] = i; });
    return analyzeSolutionBugs(game, metas, reqs, cells, grid, "en", cards);
}

for (const id of [41, 42, 43, 44, 45, 46]) {
    test(`BN6 HP part ${id} produces both bugs for command-line and out-of-bounds violations`, () => {
        assert.deepEqual(getPartBugTypes("bn6", id), ["battleHp", "damageHp"]);
        const clean = analyze([id], [[1, 2]]);
        assert.equal(clean.hasBugs, false);
        for (const [position, cause] of [[[3, 2], "plusOnCommandLine"], [[0, 2], "outOfBounds"]]) {
            const result = analyze([id], [position]);
            assert.deepEqual(result.activeBugs.map(b => [b.bugType, b.level]), [["battleHp", 1], ["damageHp", 1]]);
            assert.equal(result.bugs.length, 2);
            assert.ok(result.bugs.every(b => b.partId === id && b.causes.includes(cause)));
        }
    });
}

test("several HP parts aggregate into two types and do not double Battle HP levels", () => {
    const result = analyze([41, 42, 43, 44], [[3, 1], [3, 2], [3, 3], [3, 4]]);
    assert.deepEqual(result.activeBugs.map(b => [b.bugType, b.level]), [["battleHp", 3], ["damageHp", 1]]);
    assert.ok(result.activeBugs.every(b => b.parts.length === 4));
    assert.match(result.activeBugs[0].mechanics, /30 frames/);
    assert.match(result.activeBugs[1].mechanics, /Lv7/);
});

test("Damage HP has independent tolerance and required rules, while BugStop absorbs both NC bugs", () => {
    const result = analyze([46], [[3, 2]]);
    const allowed = { battleHp: "allowed_any", damageHp: "allowed_any" };
    assert.equal(isSolutionAcceptable(result, { type: "custom" }, [], { battleHp: "allowed_any" }), false);
    assert.equal(isSolutionAcceptable(result, { type: "custom" }, [], { damageHp: "allowed_any" }), false);
    assert.equal(isSolutionAcceptable(result, { type: "custom" }, [], allowed), true);
    assert.equal(isSolutionAcceptable(result, { type: "custom" }, [], { ...allowed, damageHp: "required" }), true);
    assert.equal(isSolutionAcceptable(result, { type: "custom" }, [], { ...allowed, damageHp: "forbidden" }), false);
    const stopped = analyze([46, 31], [[3, 2], [3, 4]]);
    assert.equal(stopped.bugStopActive, true);
    assert.deepEqual(getEffectiveInBattleBugs(stopped), []);
    assert.equal(isSolutionAcceptable(stopped, { type: "no_bugs" }), true);
    assert.equal(isSolutionAcceptable(stopped, { type: "custom" }, [], { ...allowed, damageHp: "required" }), false);
    // SuperArmor changes combat triggers, not the existence of Damage HP Bug.
    assert.ok(analyze([46, 1], [[3, 2], [3, 4]]).activeBugs.some(b => b.bugType === "damageHp"));
});

test("Battle HP and Custom Damage repairs do not silently repair the separate Damage HP bug", () => {
    const battleRepair = analyze([46], [[3, 2]], ["137-A029"]);
    assert.ok(!battleRepair.activeBugs.some(b => b.bugType === "battleHp" && !b.isModCardBug));
    assert.ok(battleRepair.activeBugs.some(b => b.bugType === "damageHp"));
    const customRepair = analyze([46], [[3, 2]], ["137-A019"]);
    assert.ok(customRepair.activeBugs.some(b => b.bugType === "damageHp"));
    assert.notEqual(normalizeBugType("damageHp"), normalizeBugType("damageBattleHp"));
});

test("BN3–5 mappings and HP/Attack ordering remain independent of the BN6 correction", () => {
    for (const [game, id] of [["bn3", 39], ["bn4", 46], ["bn5", 47]]) {
        assert.deepEqual(getPartBugTypes(game, id), ["battleHp"]);
    }
    const hp = computeBuildStats("bn6", [46]);
    const empty = computeBuildStats("bn6", []);
    assert.equal(hp.finalHp, 1500);
    assert.ok(compareBuildStats(hp, empty, "max_hp") > 0);
    assert.ok(compareBuildStats(hp, empty, "max_attack") > 0);
});

test("same-color adjacency alone causes both HP bugs", () => {
    const metas = [41, 46].map(id => ({ id, name: `HP part ${id}`, color: 1, isSolid: false }));
    const cells = new Array(49).fill(null);
    cells[1 * 7 + 2] = 0;
    cells[1 * 7 + 3] = 1;
    const result = analyzeSolutionBugs("bn6", metas, [{ partIndex: 0 }, { partIndex: 1 }], cells, grid, "en");
    assert.deepEqual(result.activeBugs.map(b => [b.bugType, b.level]), [["battleHp", 2], ["damageHp", 1]]);
    assert.ok(result.bugs.every(b => b.causes.length === 1 && b.causes[0] === "adjacentSameColor"));
});
