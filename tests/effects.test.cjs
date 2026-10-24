require("./register.cjs");
const assert = require("node:assert/strict");
const { test } = require("node:test");
const { computeBuildStats, getPartEffect, tAbility, ABILITY_NAMES, BN6_PART_EFFECTS } = require("../effects.ts");

test("BN6 has effects defined for all 46 unique program templates", () => {
    for (let id = 1; id <= 46; id++) {
        const effect = getPartEffect("bn6", id);
        assert(effect !== undefined, `Missing BN6 effect for ID: ${id}`);
    }
});

test("BN6 stat calculation: HP, buster stats, and clamping", () => {
    // Empty build
    const emptyStats = computeBuildStats("bn6", []);
    assert.equal(emptyStats.hp, 0);
    assert.equal(emptyStats.attack, 1);
    assert.equal(emptyStats.rapid, 1);
    assert.equal(emptyStats.charge, 1);
    assert.equal(emptyStats.custom, 5);
    assert.equal(emptyStats.megaFolder, 5);
    assert.equal(emptyStats.gigaFolder, 1);
    assert.deepEqual(emptyStats.abilities, []);

    // Stacking HP parts: HP+500 (46), HP+200 (43)
    const hpStats = computeBuildStats("bn6", [46, 43]);
    assert.equal(hpStats.hp, 700);

    // Attack+1 (35) twice
    const atkStats = computeBuildStats("bn6", [35, 35]);
    assert.equal(atkStats.attack, 3);
    assert.equal(atkStats.attackMax, false);

    // AttckMAX (38)
    const maxStats = computeBuildStats("bn6", [38]);
    assert.equal(maxStats.attack, 5);
    assert.equal(maxStats.attackMax, true);

    // BustPack (27: +3 all) + Attack+1 (35) => 1 + 3 + 1 = 5 (MAX)
    const bustPackStats = computeBuildStats("bn6", [27, 35]);
    assert.equal(bustPackStats.attack, 5);
    assert.equal(bustPackStats.rapid, 4); // 1 + 3
    assert.equal(bustPackStats.charge, 4); // 1 + 3
    assert.equal(bustPackStats.attackMax, true);
    assert.equal(bustPackStats.rapidMax, false);
});

test("BN6 folder and custom window expansion", () => {
    // Custom1 (2), Custom2 (3), MegFldr1 (4), GigFldr1 (6)
    const folderStats = computeBuildStats("bn6", [2, 3, 4, 6]);
    assert.equal(folderStats.custom, 8); // 5 + 1 + 2
    assert.equal(folderStats.megaFolder, 6); // 5 + 1
    assert.equal(folderStats.gigaFolder, 2); // 1 + 1

    // NumbrOpn (15) sets custom to 10
    const numberOpenStats = computeBuildStats("bn6", [15]);
    assert.equal(numberOpenStats.custom, 10);
});

test("BN6 ability collection and deduplication", () => {
    // BodyPack (28) provides superArmor, underShirt, floatShoes, airShoes
    // SuprArmr (1) also provides superArmor
    const comboStats = computeBuildStats("bn6", [28, 1, 31]); // 31 is BugStop
    assert(comboStats.abilities.includes("superArmor"));
    assert(comboStats.abilities.includes("underShirt"));
    assert(comboStats.abilities.includes("floatShoes"));
    assert(comboStats.abilities.includes("airShoes"));
    assert(comboStats.abilities.includes("bugStop"));
    // Ensure no duplicate superArmor
    assert.equal(comboStats.abilities.filter(a => a === "superArmor").length, 1);
});

test("ability translations cover all abilities in en, ja, and zh", () => {
    for (const [key, names] of Object.entries(ABILITY_NAMES)) {
        assert(names.en, `Missing EN for ability ${key}`);
        assert(names.ja, `Missing JA for ability ${key}`);
        assert(names.zh, `Missing ZH for ability ${key}`);
        assert.equal(tAbility(key, "en"), names.en);
        assert.equal(tAbility(key, "ja"), names.ja);
        assert.equal(tAbility(key, "zh"), names.zh);
    }
});
