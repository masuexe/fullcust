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
    BN5_PART_BUG_TYPES,
    BN4_PART_BUG_TYPES,
    BN3_PART_BUG_TYPES,
    GAME_BUG_DEFINITIONS,
    GAME_PART_BUG_TYPES,
    getPartBugTypes,
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
    assert.equal(emptyStats.baseHp, 1000);
    assert.equal(emptyStats.finalHp, 1000);
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
    assert.equal(hpStats.baseHp, 1000);
    assert.equal(hpStats.finalHp, 1700);

    // Custom base HP (e.g. 500)
    const customBaseHpStats = computeBuildStats("bn6", [46, 43], [], 500);
    assert.equal(customBaseHpStats.baseHp, 500);
    assert.equal(customBaseHpStats.finalHp, 1200);

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
        for (const type of getPartBugTypes("bn6", id)) {
            assert(BUG_DEFINITIONS[type], `Missing bug definition for type: ${type}`);
        }
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
    assert.equal(buggedAnalysis.bugs.length, 3);

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

test("BN3, BN4, BN5 part bug mappings and definitions are game-specific", () => {
    // BN3: 50 parts
    for (let id = 1; id <= 50; id++) {
        const type = BN3_PART_BUG_TYPES[id];
        assert(type, `Missing BN3 bug type for ID: ${id}`);
        assert(GAME_BUG_DEFINITIONS.bn3[type], `Missing BN3 bug def for ${type}`);
    }

    // BN4: 40 parts (IDs 1-28, 34-39, 41-46)
    const bn4Ids = [...Array(28).keys()].map(i => i + 1)
        .concat([34, 35, 36, 37, 38, 39, 41, 42, 43, 44, 45, 46]);
    for (const id of bn4Ids) {
        const type = BN4_PART_BUG_TYPES[id];
        assert(type, `Missing BN4 bug type for ID: ${id}`);
        assert(GAME_BUG_DEFINITIONS.bn4[type], `Missing BN4 bug def for ${type}`);
    }

    // BN5: 44 parts
    const bn5Ids = [...Array(26).keys()].map(i => i + 1)
        .concat([28, 29, 30, 31, 32, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47]);
    for (const id of bn5Ids) {
        const type = BN5_PART_BUG_TYPES[id];
        assert(type, `Missing BN5 bug type for ID: ${id}`);
        assert(GAME_BUG_DEFINITIONS.bn5[type], `Missing BN5 bug def for ${type}`);
    }

    // Verify key historical differences:
    // SuperArmor:
    // - In BN6: movement warp
    assert.equal(BN6_PART_BUG_TYPES[1], "movement");
    // - In BN5: movement warp
    assert.equal(BN5_PART_BUG_TYPES[1], "movement");
    // - In BN4: player bug (no movement warp! Lv1 confuse, Lv2 moves front, Lv3 moves back)
    assert.equal(BN4_PART_BUG_TYPES[1], "player");
    assert.equal(GAME_BUG_DEFINITIONS.bn4.player.title.zh, "玩家行动 BUG");
    assert(GAME_BUG_DEFINITIONS.bn4.player.mechanics.zh.includes("无边界瞬移"));
    assert.equal(GAME_BUG_DEFINITIONS.bn4.player.levels[2].zh, "战斗中不受控制地持续向前移动（会向前走）。");
    // - In BN3: involuntary drift
    assert.equal(BN3_PART_BUG_TYPES[1], "involuntaryMove");
    assert.equal(GAME_BUG_DEFINITIONS.bn3.involuntaryMove.title.zh, "自动移动与混乱 BUG");
});

test("analyzeSolutionBugs uses game-specific bug types and BugStop across all games", () => {
    const gridSettings = { width: 7, height: 7, hasOob: false, commandLineRow: 3 };

    // In BN4, misplacing SuperArmor (ID 1) triggers "player" bug (NOT "movement"!)
    const bn4Metas = [{ id: 1, name: "SprArmr (red)", nameZh: "超级装甲（红色）", isSolid: true, color: 4 }];
    const cellsOffLine = new Array(49).fill(null);
    cellsOffLine[1 * 7 + 3] = 0; // row 1, not cmd line

    const bn4Analysis = analyzeSolutionBugs("bn4", bn4Metas, [{ partIndex: 0 }], cellsOffLine, gridSettings, "zh");
    assert.equal(bn4Analysis.bugs.length, 1);
    assert.equal(bn4Analysis.bugs[0].bugType, "player");
    assert.equal(bn4Analysis.bugs[0].level, 1);
    assert.equal(bn4Analysis.bugs[0].bugTitle, "玩家行动 BUG (Lv1)");
    assert(bn4Analysis.bugs[0].bugMechanics.includes("混乱"));

    // Scenario: BN4 Shield (ID 8, Blue) adjacent to Reflect (ID 9, Blue) -> Triggers Player Bug Level 2: Always moves front (向前走)!
    const bn4ShieldReflectMetas = [
        { id: 8, name: "Shield (blue)", nameZh: "盾（蓝色）", isSolid: true, color: 2 },
        { id: 9, name: "Reflect (blue)", nameZh: "反射（蓝色）", isSolid: true, color: 2 },
    ];
    const adjacentCells = new Array(49).fill(null);
    adjacentCells[3 * 7 + 2] = 0; // row 3 col 2
    adjacentCells[3 * 7 + 3] = 1; // row 3 col 3 (adjacent same color)
    const bn4Lv2Analysis = analyzeSolutionBugs("bn4", bn4ShieldReflectMetas, [{ partIndex: 0 }, { partIndex: 1 }], adjacentCells, gridSettings, "zh");
    assert.equal(bn4Lv2Analysis.hasBugs, true);
    assert.equal(bn4Lv2Analysis.activeBugs.length, 1); // Aggregated into 1 active bug effect
    assert.equal(bn4Lv2Analysis.activeBugs[0].level, 2);
    assert.equal(bn4Lv2Analysis.activeBugs[0].title, "玩家行动 BUG (Lv2)");
    assert.equal(bn4Lv2Analysis.activeBugs[0].mechanics, "战斗中不受控制地持续向前移动（会向前走）。");
    assert.equal(bn4Lv2Analysis.activeBugs[0].parts.length, 2);

    // In BN4, BugStop is ID 24
    const bn4WithBugStop = [
        ...bn4Metas,
        { id: 24, name: "BugStop (white)", nameZh: "BUG停止器（白色）", isSolid: true, color: 1 },
    ];
    const cellsWithBn4BugStop = [...cellsOffLine];
    cellsWithBn4BugStop[3 * 7 + 3] = 1; // row 3 cmd line
    const bn4BugStopAnalysis = analyzeSolutionBugs("bn4", bn4WithBugStop, [{ partIndex: 0 }, { partIndex: 1 }], cellsWithBn4BugStop, gridSettings, "zh");
    assert.equal(bn4BugStopAnalysis.bugStopActive, true);

    // In BN3, BugStop is ID 44
    const bn3Metas = [
        { id: 1, name: "SprArmor (red)", nameZh: "超级装甲（红色）", isSolid: true, color: 4 },
        { id: 44, name: "BugStop (white)", nameZh: "BUG停止器（白色）", isSolid: true, color: 1 },
    ];
    const bn3BugStopAnalysis = analyzeSolutionBugs("bn3", bn3Metas, [{ partIndex: 0 }, { partIndex: 1 }], cellsWithBn4BugStop, gridSettings, "zh");
    assert.equal(bn3BugStopAnalysis.bugStopActive, true);
    assert.equal(bn3BugStopAnalysis.bugs[0].bugType, "involuntaryMove");
    assert.equal(bn3BugStopAnalysis.bugs[0].bugTitle, "自动移动与混乱 BUG (Lv1)");
    assert.equal(bn3BugStopAnalysis.bugs[0].bugMechanics, "战斗中不受控制地持续向上移动（会向上走）。");
});

test("BN3 bug level scaling: charge shot and buster bugs map to discrete effective bug types", () => {
    const gridSettings = { width: 5, height: 5, hasOob: false, commandLineRow: 2 };
    const metas = [
        { id: 3, name: "BrakChrg", isSolid: true, color: 4 },
        { id: 35, name: "WeapLV+1", isSolid: false, color: 1 },
        { id: 41, name: "Atk+1", isSolid: false, color: 1 },
        { id: 42, name: "Speed+1", isSolid: false, color: 1 },
        { id: 43, name: "Charge+1", isSolid: false, color: 1 },
    ];
    // BrakChrg off line -> Lv1 chargeCube
    const cells1 = new Array(25).fill(null);
    cells1[0] = 0; // row 0 != commandLineRow 2
    const a1 = analyzeSolutionBugs("bn3", metas, [{ partIndex: 0 }], cells1, gridSettings, "zh");
    assert.equal(a1.activeBugs[0].bugType, "chargeCube");
    assert.equal(a1.activeBugs[0].level, 1);

    // BrakChrg off line (1) + WeapLV+1 on line (1) -> Lv2 chargeWater
    const cells2 = new Array(25).fill(null);
    cells2[0] = 0; // row 0 != commandLineRow 2
    cells2[2 * 5 + 0] = 1; // row 2 (command line)
    const a2 = analyzeSolutionBugs("bn3", metas, [{ partIndex: 0 }, { partIndex: 1 }], cells2, gridSettings, "zh");
    assert.equal(a2.activeBugs[0].bugType, "chargeWater");
    assert.equal(a2.activeBugs[0].level, 2);

    // BrakChrg off line (1) + 2 WeapLV+1 on line (2) -> Lv3 chargeFlower
    const cells3 = new Array(25).fill(null);
    cells3[0] = 0; // row 0 != commandLineRow 2
    cells3[2 * 5 + 0] = 1; // row 2 (command line)
    cells3[2 * 5 + 1] = 2; // row 2 (command line)
    const a3 = analyzeSolutionBugs("bn3", metas, [{ partIndex: 0 }, { partIndex: 1 }, { partIndex: 1 }], cells3, gridSettings, "zh");
    assert.equal(a3.activeBugs[0].bugType, "chargeFlower");
    assert.equal(a3.activeBugs[0].level, 3);

    // Atk+1 on command line -> Lv1 busterBlank
    const cellsB1 = new Array(25).fill(null);
    cellsB1[2 * 5 + 0] = 0; // row 2 (command line)
    const aB1 = analyzeSolutionBugs("bn3", metas, [{ partIndex: 2 }], cellsB1, gridSettings, "zh");
    assert.equal(aB1.activeBugs[0].bugType, "busterBlank");
    assert.equal(aB1.activeBugs[0].level, 1);

    // Atk+1 and Speed+1 on command line (not touching) -> Lv2 busterBlank
    const cellsB2 = new Array(25).fill(null);
    cellsB2[2 * 5 + 0] = 0; // (0, 2)
    cellsB2[2 * 5 + 2] = 1; // (2, 2) not adjacent to (0, 2)
    const aB2 = analyzeSolutionBugs("bn3", metas, [{ partIndex: 2 }, { partIndex: 3 }], cellsB2, gridSettings, "zh");
    assert.equal(aB2.activeBugs[0].bugType, "busterBlank");
    assert.equal(aB2.activeBugs[0].level, 2);

    // Atk+1, Speed+1, and Charge+1 on command line -> Lv3 busterGuard
    const cellsB3 = new Array(25).fill(null);
    cellsB3[2 * 5 + 0] = 0;
    cellsB3[2 * 5 + 1] = 1;
    cellsB3[2 * 5 + 2] = 2;
    const aB3 = analyzeSolutionBugs("bn3", metas, [{ partIndex: 2 }, { partIndex: 3 }, { partIndex: 4 }], cellsB3, gridSettings, "zh");
    assert.equal(aB3.activeBugs[0].bugType, "busterGuard");
    assert.equal(aB3.activeBugs[0].level, 3);
});

test("BN5 bug level scaling: adjacent same-color parts count distinct neighbors, not cells (Lv2 panel bug)", () => {
    // 5x5 grid, row 2 is command line, no oob
    const gridSettings = { width: 5, height: 5, hasOob: false, commandLineRow: 2 };

    // Layout from user screenshot /tmp/FD2C9A4BDAFCD4319BC15A3D04E55046.png:
    // All 3 parts are Yellow (color 3)
    // Part 0: Rush (ID 30, solid, Yellow)
    // Part 1: Charge+1 (ID 37, plus, Yellow)
    // Part 2: AirShoes (ID 12, solid, Yellow)
    const partMetas = [
        { id: 30, name: "Rush (yellow)", nameZh: "莱西支援（黄色）", isSolid: true, color: 3 },
        { id: 37, name: "Charge+1 (yellow)", nameZh: "集气+1（黄色）", isSolid: false, color: 3 },
        { id: 12, name: "AirShoes (yellow)", nameZh: "飞行鞋（黄色）", isSolid: true, color: 3 },
    ];
    const requirements = [{ partIndex: 0 }, { partIndex: 1 }, { partIndex: 2 }];

    const cells = new Array(25).fill(null);
    // Part 0 (Rush): at (0, 0)
    cells[0 * 5 + 0] = 0;

    // Part 1 (Charge+1): at (1, 0) and (2, 0)
    cells[1 * 5 + 0] = 1;
    cells[2 * 5 + 0] = 1;

    // Part 2 (AirShoes): at (0, 1), (1, 1), (2, 1), (2, 2), (2, 3), (3, 3)
    // Note: AirShoes touches Rush at (0, 1) <-> (0, 0) [1 cell edge]
    // And AirShoes touches Charge+1 at (1, 1) <-> (1, 0) and (2, 1) <-> (2, 0) [2 cell edges]
    // Total touching edges = 3, but distinct adjacent same-colored parts = 2 (Rush and Charge+1)!
    cells[0 * 5 + 1] = 2;
    cells[1 * 5 + 1] = 2;
    cells[2 * 5 + 1] = 2;
    cells[2 * 5 + 2] = 2;
    cells[2 * 5 + 3] = 2;
    cells[3 * 5 + 3] = 2;

    const analysis = analyzeSolutionBugs("bn5", partMetas, requirements, cells, gridSettings, "zh");
    assert.equal(analysis.hasBugs, true);

    const panelBug = analysis.activeBugs.find(b => b.bugType === "panel");
    assert(panelBug, "Panel bug must be present");
    // Expected level is 2 (2 adjacent distinct same-color programs), NOT 1 (part count) and NOT 3 (cell edge count)
    assert.equal(panelBug.level, 2);
    assert.equal(panelBug.title, "地面 BUG (Lv2)");
    assert.equal(panelBug.mechanics, "移动离开面板时有 1/2 (50%) 几率使面板开裂。");
});
