const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
    BN6_MOD_CARDS,
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
    assert.equal(stats.attack, 3); // 1 (base) + 1 (NaviCust) + 1 (Canodumb)
    assert.equal(stats.modMbUsed, 10);
    assert.equal(stats.modCardCount, 1);
    assert.equal(stats.modBPwrAtk, "M-Cannon");
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
