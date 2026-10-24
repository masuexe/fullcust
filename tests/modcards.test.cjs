const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
    BN6_MOD_CARDS,
    BN5_MOD_CARDS,
    BN4_MOD_CARDS,
    getModCard,
    computeDeckStats,
    getCardDisplayName,
    searchModCards,
} = require("../modcards.ts");
const { computeBuildStats, analyzeSolutionBugs } = require("../effects.ts");
const { emptyProblem, toHashString, fromHashString } = require("../problem.ts");
const { loadGame, findGame } = require("../games.ts");

test("BN6 has all 118 patch cards defined with complete translations", () => {
    assert.equal(BN6_MOD_CARDS.length, 118);
    for (const card of BN6_MOD_CARDS) {
        assert.ok(card.id, `Card has id`);
        assert.ok(card.cardNo >= 1 && card.cardNo <= 117, `Card ${card.id} has valid cardNo`);
        assert.ok(card.mb > 0 && card.mb <= 80, `Card ${card.id} has valid MB`);
        assert.ok(card.name, `Card ${card.id} has English name`);
        assert.ok(card.nameZh, `Card ${card.id} has Chinese name`);
        assert.ok(card.nameJa, `Card ${card.id} has Japanese name`);
        assert.ok(Array.isArray(card.posRaw), `Card ${card.id} has posRaw`);
        assert.ok(Array.isArray(card.negRaw), `Card ${card.id} has negRaw`);
    }

    // Verify key iconic cards
    const knightMan = getModCard("137-A036");
    assert.ok(knightMan);
    assert.equal(knightMan.nameZh, "骑士人");
    assert.equal(knightMan.mb, 45);
    assert.deepEqual(knightMan.abilities, ["superArmor", "underShirt"]);

    const numberMan = getModCard("137-A031");
    assert.ok(numberMan);
    assert.equal(numberMan.nameZh, "数字人");
    assert.equal(numberMan.mb, 35);
    assert.equal(numberMan.stats.custom, 3);

    const bassBX = getModCard("137-C005");
    assert.ok(bassBX);
    assert.equal(bassBX.nameZh, "佛鲁迪BX");
    assert.equal(bassBX.mb, 70);

    const gregarBass = getModCard("136-D001-G");
    assert.ok(gregarBass);
    assert.equal(gregarBass.nameZh, "佛鲁迪交错 洛克人 (库雷卡)");
    assert.equal(gregarBass.mb, 70);

    const falzarBass = getModCard("136-D001-F");
    assert.ok(falzarBass);
    assert.equal(falzarBass.nameZh, "佛鲁迪交错 洛克人 (法尔沙)");
    assert.equal(falzarBass.mb, 70);
});

test("computeDeckStats correctly calculates capacity limit and overwriting rules", () => {
    // 1. KnightMan (45 MB) + NumberMan (35 MB) = 80 MB (exact limit)
    const deck = computeDeckStats(["137-A036", "137-A031"]);
    assert.equal(deck.totalMb, 80);
    assert.equal(deck.isOverCapacity, false);
    assert.equal(deck.stats.custom, 3);
    assert.equal(deck.stats.megaFolder, 1);
    assert.equal(deck.stats.gigaFolder, 1);
    assert.equal(deck.stats.hpPercent, 0); // +20% and -20% cancel out
    assert.ok(deck.activeAbilities.includes("superArmor"));
    assert.ok(deck.activeAbilities.includes("underShirt"));
    assert.equal(deck.activeBugs.length, 1);
    assert.equal(deck.activeBugs[0].bug.type, "buster");

    // 2. Over capacity (> 80 MB)
    const overDeck = computeDeckStats(["137-C002", "137-A001"]); // DarkMega (80 MB) + Canodumb (10 MB)
    assert.equal(overDeck.totalMb, 90);
    assert.equal(overDeck.isOverCapacity, true);

    // 3. Card order overwriting: Later card overrides element body
    const bodyDeck = computeDeckStats(["137-A011", "137-B017"]); // Viney (WoodBody) -> Totem (FireBody)
    assert.equal(bodyDeck.body, "Fire");

    // 4. Card order overwriting: Card A grants FloatShoes, Card B disables it
    const disableDeck = computeDeckStats(["137-A015", "137-A004"]); // MagTect (ON: FloatShoes) -> Miney (OFF: FloatShoes)
    assert.ok(!disableDeck.activeAbilities.includes("floatShoes"));
    assert.ok(disableDeck.disabledAbilities.includes("floatShoes"));

    // 5. Card order bug repair: Card A inflicts Battle HP Bug, Card B repairs it
    const repairDeck = computeDeckStats(["137-C002", "137-A029"]); // DarkMega (Battle HP Bug LV4) -> Kettle (Repair: Battle HP Bug)
    const hasBattleHpBug = repairDeck.activeBugs.some(b => b.bug.type === "battleHp");
    assert.equal(hasBattleHpBug, false);
    assert.ok(repairDeck.repairedBugs.includes("Battle HP Bug"));
});

test("computeBuildStats merges NaviCust parts with equipped Mod Cards", () => {
    // NaviCust: Part 35 (Attack+1, +1 attack), Part 42 (HP+100, +100 hp)
    // Mod Card: 137-A001 (Canodumb: Attack +1, HP -40)
    const stats = computeBuildStats("bn6", [35, 42], ["137-A001"]);
    assert.equal(stats.hp, 60); // 100 - 40
    assert.equal(stats.finalHp, 1060); // 1000 + 100 - 40
    assert.equal(stats.attack, 3); // 1 (base) + 1 (NaviCust) + 1 (Canodumb)
    assert.equal(stats.modMbUsed, 10);
    assert.equal(stats.modCardCount, 1);
    assert.equal(stats.modBPwrAtk, "M-Cannon");

    // KnightMan (+20% HP)
    const kmStats = computeBuildStats("bn6", [], ["137-A036"]);
    assert.equal(kmStats.modBugCount, 1);
    assert.equal(kmStats.hpPercent, 20);
    assert.equal(kmStats.finalHp, 1200); // 1000 * 1.20

    // NC HP+500 (part 46) + KnightMan (+20% HP)
    const comboHpStats = computeBuildStats("bn6", [46], ["137-A036"]);
    assert.equal(comboHpStats.finalHp, 1800); // (1000 + 500) * 1.20
});

test("analyzeSolutionBugs accounts for Mod Card bugs and BugStop isolation in BN6", async () => {
    const game = findGame("bn6");
    const data = await loadGame(game);
    const gs = data.gridSettings;

    // Board with BugStop installed properly on command line (req 0 = BugStop)
    // Cells: 7x7 grid.
    const cells = new Array(gs.height * gs.width).fill(null);
    // Put BugStop (id 31) across the command line
    const cmdLine = gs.commandLineRow;
    cells[cmdLine * gs.width + 1] = 0; // part 0

    const bugStopMeta = data.partMetas.find(p => p.id === 31);
    assert.ok(bugStopMeta);

    // Equip KnightMan (gives Buster Blank Bug)
    const analysis = analyzeSolutionBugs(
        "bn6",
        [bugStopMeta],
        [{ partIndex: 0, constraint: { onCommandLine: true, maxBugLevel: Infinity, minBugLevel: 0, compressed: null } }],
        cells,
        gs,
        "zh",
        ["137-A036"] // KnightMan
    );

    // In BN6, BugStop is active on NaviCust, BUT Mod Card bugs are NOT neutralized!
    assert.equal(analysis.bugStopActive, true);
    assert.equal(analysis.hasBugs, true);
    assert.ok(analysis.activeBugs.some(b => b.isModCardBug && b.sourceCardName.includes("骑士人")));
});

test("Mod Cards serialize and round-trip via URL hash in problem.ts", async () => {
    const game = findGame("bn6");
    const data = await loadGame(game);

    const problem = {
        ...emptyProblem(data),
        modCards: ["137-A036", "137-A031"],
    };

    const hashStr = toHashString(problem, data);
    const parsed = JSON.parse(hashStr);
    assert.deepEqual(parsed.c, ["137-A036", "137-A031"]);

    const restored = fromHashString(hashStr, data);
    assert.ok(restored);
    assert.deepEqual(restored.modCards, ["137-A036", "137-A031"]);
    assert.equal(restored.baseHp, 1000);

    // Custom baseHp roundtrip
    const problemWithHp = {
        ...emptyProblem(data),
        baseHp: 500,
    };
    const hashWithHp = toHashString(problemWithHp, data);
    const parsedWithHp = JSON.parse(hashWithHp);
    assert.equal(parsedWithHp.hp, 500);
    const restoredWithHp = fromHashString(hashWithHp, data);
    assert.equal(restoredWithHp.baseHp, 500);
});

test("searchModCards searches abilities bidirectionally (granting vs removing) and multilingual", () => {
    // 1. Search 超级装甲 (Chinese)
    const armorZh = searchModCards("超级装甲", "all", "zh");
    assert.ok(armorZh.matchedAbility);
    assert.equal(armorZh.matchedAbility.key, "superArmor");
    assert.equal(armorZh.matchedAbility.name, "超级装甲");
    assert.equal(armorZh.grantingCards.length, 10);
    assert.equal(armorZh.removingCards.length, 3);

    // Verify key granting cards: Heavy, KnightMan, StoneMan
    assert.ok(armorZh.grantingCards.some(c => c.nameZh === "重哑铃"));
    assert.ok(armorZh.grantingCards.some(c => c.nameZh === "骑士人"));
    assert.ok(armorZh.grantingCards.some(c => c.nameZh === "石头人"));

    // Verify key removing cards: Sunglasses, FreezeMan, Marina
    assert.ok(armorZh.removingCards.some(c => c.nameZh === "墨镜"));
    assert.ok(armorZh.removingCards.some(c => c.nameZh === "冰冻人"));
    assert.ok(armorZh.removingCards.some(c => c.nameZh === "马力纳"));

    // 2. Search 霸体 (synonym for SuperArmor)
    const armorBati = searchModCards("霸体", "all", "zh");
    assert.equal(armorBati.matchedAbility.key, "superArmor");
    assert.equal(armorBati.grantingCards.length, 10);
    assert.equal(armorBati.removingCards.length, 3);

    // 3. Search SuperArmor (English)
    const armorEn = searchModCards("SuperArmor", "all", "en");
    assert.equal(armorEn.matchedAbility.key, "superArmor");
    assert.equal(armorEn.matchedAbility.name, "SuperArmor");
    assert.equal(armorEn.grantingCards.length, 10);
    assert.equal(armorEn.removingCards.length, 3);

    // 4. Search 飞行鞋 (AirShoes)
    const airZh = searchModCards("飞行鞋", "all", "zh");
    assert.equal(airZh.matchedAbility.key, "airShoes");
    assert.ok(airZh.grantingCards.length > 0);
    assert.ok(airZh.removingCards.length > 0);
    // KillerEye (杀手植物) removes AirShoes
    assert.ok(airZh.removingCards.some(c => c.nameZh === "杀手植物"));

    // 5. Search 浮空鞋 (FloatShoes)
    const floatZh = searchModCards("浮空鞋", "all", "zh");
    assert.equal(floatZh.matchedAbility.key, "floatShoes");
    assert.ok(floatZh.grantingCards.length > 0);
    assert.ok(floatZh.removingCards.length > 0);
    // BlizzardMan (暴风雪人) removes FloatShoes
    assert.ok(floatZh.removingCards.some(c => c.nameZh === "暴风雪人"));

    // 6. Element and gauge query matching
    const waterCards = searchModCards("水属性", "all", "zh");
    assert.ok(waterCards.allCards.length >= 10);
    assert.ok(waterCards.allCards.every(c => c.body === "Aqua"));

    const fastGauge = searchModCards("快速量表", "all", "zh");
    assert.ok(fastGauge.allCards.length > 0);
    assert.ok(fastGauge.allCards.every(c => c.gauge === "fast"));
});

test("BN5 has all 112 patch card entries (111 unique cards) with complete translations and valid parameters", () => {
    assert.equal(BN5_MOD_CARDS.length, 112);
    for (const card of BN5_MOD_CARDS) {
        assert.ok(card.id, `Card has id`);
        assert.ok(card.cardNo >= 1 && card.cardNo <= 111, `Card ${card.id} has valid cardNo`);
        assert.ok(card.mb > 0 && card.mb <= 80, `Card ${card.id} has valid MB`);
        assert.ok(card.name, `Card ${card.id} has English name`);
        assert.ok(card.nameZh, `Card ${card.id} has Chinese name`);
        assert.ok(card.nameJa, `Card ${card.id} has Japanese name`);
        assert.ok(Array.isArray(card.posRaw), `Card ${card.id} has posRaw`);
        assert.ok(Array.isArray(card.negRaw), `Card ${card.id} has negRaw`);
    }

    // Verify key iconic cards
    const kingMan = getModCard("136-B040", "bn5");
    assert.ok(kingMan);
    assert.equal(kingMan.nameZh, "国王人");
    assert.equal(kingMan.mb, 45);
    assert.equal(kingMan.stats.custom, 2);
    assert.equal(kingMan.stats.megaFolder, 1);
    assert.equal(kingMan.stats.hp, -150); // negative stat verified from Japanese reference

    const bassProto = getModCard("136-D001-P", "bn5");
    assert.ok(bassProto);
    assert.equal(bassProto.nameZh, "佛鲁迪交错洛克人 (布鲁斯版)");
    assert.equal(bassProto.mb, 70);
    assert.equal(bassProto.stats.hp, 200);
    assert.equal(bassProto.stats.megaFolder, -2);
    assert.ok(bassProto.abilities.includes("superArmor"));
    assert.equal(bassProto.bPwrAtk, "ShootingBuster");
    assert.equal(bassProto.tripleBuster, true);

    const bassColonel = getModCard("136-D001-C", "bn5");
    assert.ok(bassColonel);
    assert.equal(bassColonel.nameZh, "佛鲁迪交错洛克人 (卡奈尔版)");
    assert.equal(bassColonel.mb, 70);
    assert.equal(bassColonel.stats.hpPercent, 20);
    assert.equal(bassColonel.stats.megaFolder, -2);
    assert.ok(bassColonel.abilities.includes("floatShoes"));
    assert.equal(bassColonel.bPwrAtk, "HellsRolling");
    assert.equal(bassColonel.tripleBuster, true);
});

test("BN5 computeDeckStats accurately accumulates stats, capacity, and repairs", () => {
    // 1. Mettaur (7 MB) + BassProto (70 MB) = 77 MB
    const deck = computeDeckStats(["136-A001", "136-D001-P"], "bn5");
    assert.equal(deck.totalMb, 77);
    assert.equal(deck.isOverCapacity, false);
    assert.equal(deck.stats.hp, 240); // 40 + 200
    assert.equal(deck.stats.megaFolder, -2);
    assert.ok(deck.activeAbilities.includes("superArmor"));
    assert.ok(deck.disabledAbilities.includes("floatShoes")); // Mettaur disables FloatShoes
    assert.equal(deck.bPwrAtk, "ShootingBuster");
    assert.equal(deck.tripleBuster, true);

    // 2. Over capacity (> 80 MB): Hub Hikari (80 MB) + Mettaur (7 MB) = 87 MB
    const overDeck = computeDeckStats(["136-C010", "136-A001"], "bn5");
    assert.equal(overDeck.totalMb, 87);
    assert.equal(overDeck.isOverCapacity, true);
    assert.equal(overDeck.stats.attackMult, 2);
    assert.equal(overDeck.stats.hpPercent, -50);
    assert.equal(overDeck.stats.custom, 3);
    assert.equal(overDeck.stats.gigaFolder, 1);
});

test("BN5 computeBuildStats and searchModCards function properly", () => {
    // NaviCust BN5: Part 1 (SuperArmor, id 1), Part 43 (HP+100, id 43)
    // Mod Card: 136-A001 (Mettaur: HP+40, bLeft: MetGuard, disables floatShoes)
    const stats = computeBuildStats("bn5", [1, 43], ["136-A001"]);
    assert.equal(stats.hp, 140); // 100 + 40
    assert.ok(stats.abilities.includes("superArmor"));
    assert.ok(!stats.abilities.includes("floatShoes"));
    assert.equal(stats.modBLeft, "MetGuard");
    assert.equal(stats.modMbUsed, 7);

    // Search SuperArmor in BN5
    const armorResult = searchModCards("超级装甲", "all", "zh", "bn5");
    assert.ok(armorResult.matchedAbility);
    assert.equal(armorResult.matchedAbility.key, "superArmor");
    assert.ok(armorResult.grantingCards.length > 0);
    assert.ok(armorResult.removingCards.length > 0);
    // BassCross ProtoMan grants SuperArmor in BN5
    assert.ok(armorResult.grantingCards.some(c => c.id === "136-D001-P"));
    // Null (水滴怪, 136-A016) removes SuperArmor in BN5
    assert.ok(armorResult.removingCards.some(c => c.id === "136-A016"));
});

test("BN4 has all 133 patch cards defined with 5 functional slots (0A~0E) and color slot (0F)", () => {
    assert.equal(BN4_MOD_CARDS.length, 133);
    for (const card of BN4_MOD_CARDS) {
        assert.ok(card.id, `Card has id`);
        assert.ok(card.cardNo >= 1 && card.cardNo <= 133, `Card ${card.id} has valid cardNo`);
        assert.ok(card.slot, `Card ${card.id} has slot`);
        assert.ok(["0A", "0B", "0C", "0D", "0E", "0F"].includes(card.slot), `Card ${card.id} has valid slot`);
        assert.ok(card.name, `Card ${card.id} has English name`);
        assert.ok(card.nameZh, `Card ${card.id} has Chinese name`);
        assert.ok(card.nameJa, `Card ${card.id} has Japanese name`);
        assert.ok(Array.isArray(card.posRaw), `Card ${card.id} has posRaw`);
        assert.ok(Array.isArray(card.negRaw), `Card ${card.id} has negRaw`);
    }

    // Verify key iconic cards
    const card1 = getModCard("134-001", "bn4");
    assert.ok(card1);
    assert.equal(card1.slot, "0A");
    assert.equal(card1.stats.hp, 100);

    const fullSynchroCard = getModCard("134-045", "bn4");
    assert.ok(fullSynchroCard);
    assert.equal(fullSynchroCard.slot, "0C");
    assert.ok(fullSynchroCard.abilities.includes("fullSynchro"));

    const tripleSupportCard = getModCard("134-074", "bn4");
    assert.ok(tripleSupportCard);
    assert.equal(tripleSupportCard.slot, "0B");
    assert.ok(tripleSupportCard.abilities.includes("rush"));
    assert.ok(tripleSupportCard.abilities.includes("beat"));
    assert.ok(tripleSupportCard.abilities.includes("tango"));

    const rollSoul = getModCard("134-G001", "bn4");
    assert.ok(rollSoul);
    assert.equal(rollSoul.nameZh, "萝露灵魂");
    assert.equal(rollSoul.slot, "0E");
    assert.equal(rollSoul.soul, "RollSoul");
    assert.ok(rollSoul.bugs.some(b => b.type === "battleHp"));

    // Slot 0F palette card
    const paletteBlue = getModCard("134-028", "bn4");
    assert.ok(paletteBlue);
    assert.equal(paletteBlue.slot, "0F");
});

test("BN4 computeDeckStats handles 5-slot architecture and slot conflicts", () => {
    // 1. Valid 5-card loadout across distinct slots 0A ~ 0E
    // 0A: 134-001 (HP+100)
    // 0B: 134-003 (HP+150)
    // 0C: 134-045 (Full Synchro)
    // 0D: 134-014 (Metal panel walk)
    // 0E: 134-G001 (RollSoul)
    const deck = computeDeckStats(
        ["134-001", "134-003", "134-045", "134-014", "134-G001"],
        "bn4"
    );
    assert.equal(deck.slotsUsed.length, 5);
    assert.equal(deck.hasSlotConflict, false);
    assert.equal(deck.isOverCapacity, false);
    assert.equal(deck.soul, "RollSoul");
    assert.equal(deck.stats.hp, 250); // 100 + 150
    assert.ok(deck.activeAbilities.includes("fullSynchro"));
    assert.ok(deck.activeBugs.some(b => b.bug.type === "battleHp"));

    // 2. Slot conflict: two cards with slot 0A (134-001 and 134-004)
    const conflictDeck = computeDeckStats(
        ["134-001", "134-004"],
        "bn4"
    );
    assert.equal(conflictDeck.hasSlotConflict, true);
    assert.equal(conflictDeck.isOverCapacity, true);
});

test("BN4 computeBuildStats and searchModCards function properly", () => {
    // NaviCust BN4 + BN4 Mod Card
    // Part 1 (SuperArmor in BN4) + 134-045 (FullSynchro) + 134-G001 (RollSoul)
    const stats = computeBuildStats("bn4", [1], ["134-045", "134-G001"]);
    assert.equal(stats.modSoul, "RollSoul");
    assert.equal(stats.modCardCount, 2);
    assert.equal(stats.modSlotsUsed.length, 2);
    assert.ok(stats.abilities.includes("superArmor"));
    assert.ok(stats.abilities.includes("fullSynchro"));

    // Search by slot
    const slot0A = searchModCards("", "slot0A", "zh", "bn4");
    assert.equal(slot0A.allCards.length, 27);
    assert.ok(slot0A.allCards.every(c => c.slot === "0A"));

    // Search by soul unisons
    const souls = searchModCards("", "souls", "zh", "bn4");
    assert.equal(souls.allCards.length, 12);
    assert.ok(souls.allCards.every(c => c.soul != null));

    // Search by ability in BN4 (e.g. 完全同步 / fullSynchro)
    const synchroResult = searchModCards("完全同步", "all", "zh", "bn4");
    assert.ok(synchroResult.allCards.length > 0);
    assert.ok(synchroResult.allCards.some(c => c.id === "134-045"));
});
