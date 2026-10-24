require("./register.cjs");
const assert = require("node:assert/strict");
const { test } = require("node:test");
const {
    computeBuildStats,
    getPartEffect,
    tAbility,
    ABILITY_NAMES,
    analyzeSolutionBugs,
    tBugCause,
    tBugTitle,
    tBugMechanics,
    BUG_DEFINITIONS,
    CAUSE_DESCRIPTIONS,
    BN6_PART_BUG_TYPES,
} = require("../effects.ts");

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

test("BN6 all 46 parts map to an objective bug type", () => {
    for (let id = 1; id <= 46; id++) {
        const bugType = BN6_PART_BUG_TYPES[id];
        assert(bugType, `Missing bug type for ID: ${id}`);
        assert(BUG_DEFINITIONS[bugType], `Missing bug definition for type: ${bugType}`);
    }
});

test("bug definitions and cause descriptions cover en, ja, and zh", () => {
    for (const [type, def] of Object.entries(BUG_DEFINITIONS)) {
        assert(def.title.en && def.title.ja && def.title.zh, `Missing title for bug: ${type}`);
        assert(def.mechanics.en && def.mechanics.ja && def.mechanics.zh, `Missing mechanics for bug: ${type}`);
        assert.equal(tBugTitle(type, "en"), def.title.en);
        assert.equal(tBugTitle(type, "ja"), def.title.ja);
        assert.equal(tBugTitle(type, "zh"), def.title.zh);
        assert.equal(tBugMechanics(type, "en"), def.mechanics.en);
        assert.equal(tBugMechanics(type, "ja"), def.mechanics.ja);
        assert.equal(tBugMechanics(type, "zh"), def.mechanics.zh);
    }

    for (const [cause, desc] of Object.entries(CAUSE_DESCRIPTIONS)) {
        assert(desc.en && desc.ja && desc.zh, `Missing description for cause: ${cause}`);
        assert.equal(tBugCause(cause, "en"), desc.en);
        assert.equal(tBugCause(cause, "ja"), desc.ja);
        assert.equal(tBugCause(cause, "zh"), desc.zh);
    }
});

test("analyzeSolutionBugs detects command line, color adjacency, and BugStop", () => {
    // 7x7 grid with command line row = 3, hasOob = true
    const gridSettings = { width: 7, height: 7, hasOob: true, commandLineRow: 3 };

    // Part 0: SuprArmr (solid, color 4 red, ID 1 -> movement bug)
    // Part 1: HP+500 (plus/non-solid, color 3 yellow, ID 46 -> battleHp bug)
    const partMetas = [
        { id: 1, name: "SuprArmr (red)", nameZh: "超级装甲（红色）", isSolid: true, color: 4 },
        { id: 46, name: "HP+500 (yellow)", nameZh: "HP+500（黄色）", isSolid: false, color: 3 },
    ];
    const requirements = [{ partIndex: 0 }, { partIndex: 1 }];

    // Scenario A: SuprArmr on row 3 (cmd line), HP+500 on row 1 (not on cmd line) -> NO BUGS
    const cleanCells = new Array(49).fill(null);
    cleanCells[3 * 7 + 3] = 0; // SuprArmr on cmd line
    cleanCells[1 * 7 + 3] = 1; // HP+500 NOT on cmd line
    const cleanAnalysis = analyzeSolutionBugs("bn6", partMetas, requirements, cleanCells, gridSettings, "zh");
    assert.equal(cleanAnalysis.hasBugs, false);
    assert.equal(cleanAnalysis.bugs.length, 0);

    // Scenario B: SuprArmr NOT on cmd line (row 1), HP+500 ON cmd line (row 3) -> BOTH BUGGED
    const buggedCells = new Array(49).fill(null);
    buggedCells[1 * 7 + 3] = 0; // solid not on cmd line
    buggedCells[3 * 7 + 3] = 1; // plus on cmd line
    const buggedAnalysis = analyzeSolutionBugs("bn6", partMetas, requirements, buggedCells, gridSettings, "zh");
    assert.equal(buggedAnalysis.hasBugs, true);
    assert.equal(buggedAnalysis.bugs.length, 2);

    const suprBug = buggedAnalysis.bugs.find(b => b.partId === 1);
    assert(suprBug);
    assert.equal(suprBug.bugType, "movement");
    assert.deepEqual(suprBug.causes, ["solidNotOnCommandLine"]);

    const hpBug = buggedAnalysis.bugs.find(b => b.partId === 46);
    assert(hpBug);
    assert.equal(hpBug.bugType, "battleHp");
    assert.deepEqual(hpBug.causes, ["plusOnCommandLine"]);

    // Scenario C: Adding BugStop (ID 31, solid, color 1 white) on row 3 -> BugStop activates!
    const partMetasWithBugStop = [
        ...partMetas,
        { id: 31, name: "BugStop (white)", nameZh: "BUG停止器（白色）", isSolid: true, color: 1 },
    ];
    const reqsWithBugStop = [...requirements, { partIndex: 2 }];
    const cellsWithBugStop = [...buggedCells];
    cellsWithBugStop[3 * 7 + 2] = 2; // BugStop on cmd line

    const bugStopAnalysis = analyzeSolutionBugs("bn6", partMetasWithBugStop, reqsWithBugStop, cellsWithBugStop, gridSettings, "zh");
    assert.equal(bugStopAnalysis.bugStopActive, true);
    assert.equal(bugStopAnalysis.hasBugs, true); // Still has bugs detected, but BugStop is active!
});
