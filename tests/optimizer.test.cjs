require("./register.cjs");
const assert = require("node:assert/strict");
const { test } = require("node:test");

const { games } = require("../games.ts");
const { parseGameData } = require("../game-data.ts");
const { emptyProblem } = require("../problem.ts");
const { solve, placeAll } = require("../solver.ts");
const {
    analyzeSolutionBugs,
    isSolutionAcceptable,
    isBenignBug,
} = require("../effects.ts");
const {
    compareBuildStats,
    getCandidateFillerParts,
    optimizeBuild,
    optimizeModCards,
} = require("../optimizer.ts");
const { computeDeckStats } = require("../modcards.ts");

function getGameData(gameId) {
    const raw = require(`../data/${gameId}.json`);
    const game = games.find(g => g.id === gameId);
    return parseGameData(raw, game);
}

test("isBenignBug correctly categorizes benign vs lethal bugs", () => {
    assert.equal(isBenignBug("customhp", 1), true);
    assert.equal(isBenignBug("customhp", 2), false);
    assert.equal(isBenignBug("buster", 1), true);
    assert.equal(isBenignBug("emotion", 1), true);

    // Lethal bugs
    assert.equal(isBenignBug("panel", 1), false);
    assert.equal(isBenignBug("movement", 1), false);
    assert.equal(isBenignBug("player", 1), false);
    assert.equal(isBenignBug("battlehp", 1), false);
    assert.equal(isBenignBug("status", 1), false);
});

test("isSolutionAcceptable handles no_bugs with and without BugStop", () => {
    const data = getGameData("bn6");
    const bugStopIndex = data.partMetas.findIndex(p => p.id === 31);
    const custom2Index = data.partMetas.findIndex(p => p.id === 3);

    // Case 1: BugStop placed legally on row 3 (center cmdLine), Custom2 placed on row 1 (violating cmdLine)
    const reqsWithBugStop = [
        { partIndex: bugStopIndex, constraint: { onCommandLine: true, minBugLevel: 0, maxBugLevel: 0, compressed: true } },
        { partIndex: custom2Index, constraint: { onCommandLine: null, minBugLevel: 0, maxBugLevel: Infinity, compressed: true } },
    ];
    const it1 = solve(data.parts, reqsWithBugStop, data.gridSettings, data.colors.map(() => true));
    const sol1 = it1.next().value;
    assert.ok(sol1);
    const occ1 = placeAll(data.parts, reqsWithBugStop, sol1, data.gridSettings);
    const analysis1 = analyzeSolutionBugs("bn6", data.partMetas, reqsWithBugStop, occ1, data.gridSettings, "en");

    assert.equal(analysis1.bugStopActive, true);
    // Because BugStop is active, this is acceptable under no_bugs!
    assert.equal(isSolutionAcceptable(analysis1, { type: "no_bugs" }), true);

    // Case 2: Custom2 placed illegally without BugStop
    const reqsWithoutBugStop = [
        { partIndex: custom2Index, constraint: { onCommandLine: false, minBugLevel: 1, maxBugLevel: 1, compressed: true } },
    ];
    const it2 = solve(data.parts, reqsWithoutBugStop, data.gridSettings, data.colors.map(() => true));
    const sol2 = it2.next().value;
    assert.ok(sol2);
    const occ2 = placeAll(data.parts, reqsWithoutBugStop, sol2, data.gridSettings);
    const analysis2 = analyzeSolutionBugs("bn6", data.partMetas, reqsWithoutBugStop, occ2, data.gridSettings, "en");

    assert.equal(analysis2.bugStopActive, false);
    assert.equal(analysis2.hasBugs, true);
    // Should be rejected under no_bugs
    assert.equal(isSolutionAcceptable(analysis2, { type: "no_bugs" }), false);
});

test("getCandidateFillerParts returns sorted candidate parts", () => {
    const data = getGameData("bn6");
    const candidates = getCandidateFillerParts(data, "max_hp");
    assert.ok(candidates.length > 10);

    // First candidates should be HP+500 variants
    const firstMeta = data.partMetas[candidates[0]];
    assert.match(firstMeta.name, /HP\+500/);
});

test("optimizeBuild automatically fills remaining space and maximizes HP with BugStop (BN6)", () => {
    const data = getGameData("bn6");
    const bugStopIndex = data.partMetas.findIndex(p => p.id === 31);
    const superArmorIndex = data.partMetas.findIndex(p => p.id === 1);
    const floatShoesIndex = data.partMetas.findIndex(p => p.id === 11);

    const problem = emptyProblem(data);
    problem.requirements = [
        { partIndex: bugStopIndex, constraint: { onCommandLine: true, minBugLevel: 0, maxBugLevel: 0, compressed: true } },
        { partIndex: superArmorIndex, constraint: { onCommandLine: null, minBugLevel: 0, maxBugLevel: Infinity, compressed: true } },
        { partIndex: floatShoesIndex, constraint: { onCommandLine: null, minBugLevel: 0, maxBugLevel: Infinity, compressed: true } },
    ];
    problem.bugPolicy = { type: "no_bugs" };

    const result = optimizeBuild({
        data,
        problem,
        target: "max_hp",
        timeoutMs: 2000,
    });

    assert.ok(result, "Optimization must produce a valid result");
    assert.ok(result.addedPartIndices.length >= 2, "Must add at least 2 HP parts");
    assert.ok(result.stats.finalHp >= 2000, `Expected final HP >= 2000 with BugStop, got ${result.stats.finalHp}`);
    assert.equal(result.analysis.bugStopActive, true);
    assert.equal(isSolutionAcceptable(result.analysis, { type: "no_bugs" }), true);
});

test("optimizeBuild automatically fills remaining space without BugStop under no_bugs (BN6)", () => {
    const data = getGameData("bn6");
    const superArmorIndex = data.partMetas.findIndex(p => p.id === 1);
    const floatShoesIndex = data.partMetas.findIndex(p => p.id === 11);

    const problem = emptyProblem(data);
    problem.requirements = [
        { partIndex: superArmorIndex, constraint: { onCommandLine: true, minBugLevel: 0, maxBugLevel: 0, compressed: true } },
        { partIndex: floatShoesIndex, constraint: { onCommandLine: true, minBugLevel: 0, maxBugLevel: 0, compressed: true } },
    ];
    problem.bugPolicy = { type: "no_bugs" };

    const result = optimizeBuild({
        data,
        problem,
        target: "max_hp",
        timeoutMs: 2000,
    });

    assert.ok(result, "Optimization must produce a valid result");
    assert.ok(result.addedPartIndices.length >= 1, "Must add at least 1 HP part");
    assert.ok(result.stats.finalHp > 1000, "HP must increase");
    assert.equal(result.analysis.hasBugs, false, "Must have zero bugs");
    assert.equal(isSolutionAcceptable(result.analysis, { type: "no_bugs" }), true);
});

test("optimizeBuild operates on BN5 and respects game constraints", () => {
    const data = getGameData("bn5");
    const superArmorIndex = data.partMetas.findIndex(p => p.id === 1);

    const problem = emptyProblem(data);
    problem.requirements = [
        { partIndex: superArmorIndex, constraint: { onCommandLine: true, minBugLevel: 0, maxBugLevel: 0, compressed: true } },
    ];
    problem.bugPolicy = { type: "no_bugs" };

    const result = optimizeBuild({
        data,
        problem,
        target: "max_hp",
        timeoutMs: 2000,
    });

    assert.ok(result);
    assert.ok(result.addedPartIndices.length >= 1);
    assert.ok(result.stats.finalHp > 1000);
    assert.equal(isSolutionAcceptable(result.analysis, { type: "no_bugs" }), true);
});

test("optimizeBuild operates on BN3 and respects Style color rules", () => {
    const data = getGameData("bn3");
    // Normal style (only white, yellow, pink)
    const problem = emptyProblem(data);
    problem.style = "normal";

    const result = optimizeBuild({
        data,
        problem,
        target: "max_hp",
        timeoutMs: 2000,
    });

    assert.ok(result);
    assert.ok(result.addedPartIndices.length >= 1);
    assert.ok(result.stats.finalHp > 1000);
});

test("optimizeModCards knapsack correctly selects optimal zero-bug cards for BN6 and BN5", () => {
    const cards6 = optimizeModCards({ gameId: "bn6", target: "max_hp", policy: { type: "no_bugs" } });
    assert.ok(cards6.length >= 2, "Should select multiple cards");
    const deck6 = computeDeckStats(cards6, "bn6");
    assert.ok(deck6.totalMb <= 80, "Total MB must not exceed 80");
    assert.equal(deck6.activeBugs.length, 0, "Must have zero bugs under no_bugs");
    assert.ok(deck6.stats.hp > 0 || deck6.stats.hpPercent > 0, "Must increase HP");

    const cards5 = optimizeModCards({ gameId: "bn5", target: "max_hp", policy: { type: "no_bugs" } });
    assert.ok(cards5.length >= 2);
    const deck5 = computeDeckStats(cards5, "bn5");
    assert.ok(deck5.totalMb <= 80);
    assert.equal(deck5.activeBugs.length, 0);
    assert.ok(deck5.stats.hp > 0);

    // BN3 should produce empty array (no mod cards)
    const cards3 = optimizeModCards({ gameId: "bn3", target: "max_hp" });
    assert.deepEqual(cards3, []);
});

test("optimizeModCards slot-based optimization correctly selects cards for BN4", () => {
    const cards4 = optimizeModCards({ gameId: "bn4", target: "max_hp", policy: { type: "no_bugs" } });
    assert.ok(cards4.length >= 4, "Should select cards across 0A~0E");
    const deck4 = computeDeckStats(cards4, "bn4");
    assert.equal(deck4.activeBugs.length, 0, "Must have zero bugs");
    assert.ok(deck4.stats.hp >= 2000, "BN4 HP cards should provide massive HP boost (>2000)");
});

test("optimizeBuild with modCardMode auto delivers synergistic high HP and sets modCards", () => {
    const data = getGameData("bn6");
    const superArmorIndex = data.partMetas.findIndex(p => p.id === 1);

    const problem = emptyProblem(data);
    problem.requirements = [
        { partIndex: superArmorIndex, constraint: { onCommandLine: true, minBugLevel: 0, maxBugLevel: 0, compressed: true } },
    ];
    problem.bugPolicy = { type: "no_bugs" };

    const result = optimizeBuild({
        data,
        problem,
        target: "max_hp",
        modCardMode: "auto",
        timeoutMs: 3000,
    });

    assert.ok(result);
    assert.ok(result.addedCardIds && result.addedCardIds.length > 0, "Must have added mod cards");
    assert.equal(result.problem.modCards.length, result.addedCardIds.length);
    assert.ok(result.addedPartIndices.length > 0, "Must have added NC parts");
    // Synergistic HP calculation (cards + parts + HP% multiplier) should reach > 2500 HP
    assert.ok(result.stats.finalHp >= 2500, `Expected HP >= 2500, got ${result.stats.finalHp}`);
    assert.equal(isSolutionAcceptable(result.analysis, { type: "no_bugs" }), true);
});

test("optimizeBuild with modCardMode none clears existing mod cards", () => {
    const data = getGameData("bn6");
    const superArmorIndex = data.partMetas.findIndex(p => p.id === 1);

    const problem = emptyProblem(data);
    problem.requirements = [
        { partIndex: superArmorIndex, constraint: { onCommandLine: true, minBugLevel: 0, maxBugLevel: 0, compressed: true } },
    ];
    problem.modCards = ["137-A001", "137-A002"];
    problem.bugPolicy = { type: "no_bugs" };

    const result = optimizeBuild({
        data,
        problem,
        target: "max_hp",
        modCardMode: "none",
        timeoutMs: 2000,
    });

    assert.ok(result);
    assert.deepEqual(result.problem.modCards, [], "modCards should be cleared");
    assert.deepEqual(result.addedCardIds, [], "addedCardIds should be empty");
});

test("optimizeBuild with cross-domain constraints (SuperArmor, AirShoes, CS DollThunder, no movement/custom bugs)", () => {
    const data = getGameData("bn6");
    const problem = emptyProblem(data);

    const result = optimizeBuild({
        data,
        problem,
        target: "max_hp",
        modCardMode: "auto",
        constraints: {
            requiredAbilities: ["superArmor", "airShoes"],
            requiredSpecialMove: "DollThunder",
            forbiddenBugs: ["movement", "custom"],
        },
        timeoutMs: 3000,
    });

    assert.ok(result, "Expected to find an optimal solution satisfying all constraints");
    assert.equal(result.stats.modBPwrAtk, "DollThunder");
    assert.ok(result.stats.abilities.includes("superArmor"), "Must include SuperArmor");
    assert.ok(result.stats.abilities.includes("airShoes"), "Must include AirShoes");
    assert.ok(result.stats.finalHp >= 2000, `Expected HP >= 2000, got ${result.stats.finalHp}`);

    // Verify forbidden bugs are not present in active bugs
    for (const b of result.analysis.activeBugs) {
        assert.notEqual(b.bugType.toLowerCase(), "movement");
        assert.notEqual(b.bugType.toLowerCase(), "custom");
    }

    // Verify rejecting when impossible constraints given
    const impossible = optimizeBuild({
        data,
        problem,
        target: "max_hp",
        modCardMode: "auto",
        constraints: {
            requiredSpecialMove: "DollThunder",
            forbiddenBugs: ["buster"],
        },
        timeoutMs: 1000,
    });
    assert.equal(impossible, null, "Should return null when ScarCrow buster bug is forbidden");
});

test("problem hash serialization round-trips BuildConstraints", () => {
    const data = getGameData("bn6");
    const { toHashString, fromHashString } = require("../problem.ts");

    const prob = emptyProblem(data);
    prob.constraints = {
        requiredAbilities: ["superArmor", "airShoes"],
        requiredSpecialMove: "DollThunder",
        requiredBLeft: "AntiDamage",
        forbiddenBugs: ["movement", "custom"],
    };

    const hash = toHashString(prob, data);
    const restored = fromHashString(hash, data);

    assert.ok(restored);
    assert.ok(restored.constraints);
    assert.deepEqual(restored.constraints.requiredAbilities, ["superArmor", "airShoes"]);
    assert.equal(restored.constraints.requiredSpecialMove, "DollThunder");
    assert.equal(restored.constraints.requiredBLeft, "AntiDamage");
    assert.deepEqual(restored.constraints.forbiddenBugs, ["movement", "custom"]);
});

test("isSolutionAcceptable strictly enforces tri-state bugRules (forbidden, allowed, required)", () => {
    const cleanAnalysis = {
        hasBugs: false,
        bugStopActive: false,
        activeBugs: [],
        tooManyColors: false,
    };
    const busterBugAnalysis = {
        hasBugs: true,
        bugStopActive: false,
        activeBugs: [{ bugType: "buster", level: 1, isModCardBug: true }],
        tooManyColors: false,
    };
    const multiBugAnalysis = {
        hasBugs: true,
        bugStopActive: false,
        activeBugs: [
            { bugType: "buster", level: 1, isModCardBug: true },
            { bugType: "movement", level: 1, isModCardBug: true },
        ],
        tooManyColors: false,
    };

    // 1. Default (all forbidden / empty rules)
    assert.equal(isSolutionAcceptable(cleanAnalysis, { type: "custom" }, undefined, {}), true);
    assert.equal(isSolutionAcceptable(busterBugAnalysis, { type: "custom" }, undefined, {}), false);

    // 2. Allowed bug
    const allowBuster = { buster: "allowed" };
    assert.equal(isSolutionAcceptable(cleanAnalysis, { type: "custom" }, undefined, allowBuster), true);
    assert.equal(isSolutionAcceptable(busterBugAnalysis, { type: "custom" }, undefined, allowBuster), true);
    // movement is still forbidden by default
    assert.equal(isSolutionAcceptable(multiBugAnalysis, { type: "custom" }, undefined, allowBuster), false);

    // 3. Required bug
    const requireBuster = { buster: "required" };
    // cleanAnalysis doesn't have buster -> rejected
    assert.equal(isSolutionAcceptable(cleanAnalysis, { type: "custom" }, undefined, requireBuster), false);
    // busterBugAnalysis has buster -> accepted
    assert.equal(isSolutionAcceptable(busterBugAnalysis, { type: "custom" }, undefined, requireBuster), true);
    // multiBugAnalysis has buster BUT also forbidden movement -> rejected
    assert.equal(isSolutionAcceptable(multiBugAnalysis, { type: "custom" }, undefined, requireBuster), false);

    // 4. Required bug + Allowed bug
    const reqBusterAllowMove = { buster: "required", movement: "allowed" };
    assert.equal(isSolutionAcceptable(multiBugAnalysis, { type: "custom" }, undefined, reqBusterAllowMove), true);
});

test("optimizeBuild with bugRules: required buster bug selects build with Buster blank bug", () => {
    const data = getGameData("bn6");
    const problem = emptyProblem(data);

    const result = optimizeBuild({
        data,
        problem,
        target: "max_hp",
        modCardMode: "auto",
        constraints: {
            bugRules: {
                buster: "required",
            },
        },
        timeoutMs: 3000,
    });

    assert.ok(result, "Expected to find an optimal solution satisfying required buster bug");
    const effectiveBugs = result.analysis.activeBugs || [];
    assert.ok(
        effectiveBugs.some(b => b.bugType.toLowerCase() === "buster" && b.level >= 1),
        "Result must trigger the required Buster blank bug"
    );

    // Verify rejecting when required bug is impossible to trigger (modCardMode: none and clean NC)
    const impossible = optimizeBuild({
        data,
        problem,
        target: "max_hp",
        modCardMode: "none",
        constraints: {
            bugRules: {
                buster: "required",
            },
        },
        timeoutMs: 1000,
    });
    assert.equal(impossible, null, "Should return null when required bug cannot be triggered in modCardMode none");
});

test("problem hash serialization round-trips bugRules", () => {
    const data = getGameData("bn6");
    const { toHashString, fromHashString } = require("../problem.ts");

    const prob = emptyProblem(data);
    prob.constraints = {
        requiredAbilities: ["superArmor"],
        bugRules: {
            buster: "required",
            movement: "forbidden",
            customHp: "allowed",
        },
    };

    const hash = toHashString(prob, data);
    const restored = fromHashString(hash, data);

    assert.ok(restored);
    assert.ok(restored.constraints);
    assert.deepEqual(restored.constraints.requiredAbilities, ["superArmor"]);
    assert.deepEqual(restored.constraints.bugRules, {
        buster: "required",
        movement: "forbidden",
        customHp: "allowed",
    });
});

test("CS and Buster addition invalidation rules and tripleBuster compatibility", () => {
    const { computeDeckStats } = require("../modcards.ts");
    const { orderModCardsForConstraints, optimizeModCards } = require("../optimizer.ts");

    // 1. Special CS overrides standard ChargeShot -> chargeAddition is invalidated
    // ToadMan (137-A037, chargeAddition: Paralyze) + ScarCrow (137-A025, bPwrAtk: DollThunder)
    const deckSpecialCS = computeDeckStats(["137-A037", "137-A025"], "bn6");
    assert.equal(deckSpecialCS.bPwrAtk, "DollThunder");
    assert.equal(deckSpecialCS.chargeAddition, undefined);
    assert.equal(deckSpecialCS.invalidatedChargeAddition, "Paralyze");

    // 2. Standard ChargeShot explicitly set -> chargeAddition is preserved
    // ToadMan (137-A037) + NumberMan (137-A014, bPwrAtk: ChargeShot)
    const deckStandardCS = computeDeckStats(["137-A037", "137-A014"], "bn6");
    assert.equal(deckStandardCS.bPwrAtk, "ChargeShot");
    assert.equal(deckStandardCS.chargeAddition, "Paralyze");
    assert.equal(deckStandardCS.invalidatedChargeAddition, undefined);

    // 3. TripleBuster preserves busterAddition (fires 3 standard buster pellets)
    // BassBX (137-C005, tripleBuster: true) + BomBoy (137-A017, busterAddition: "1 square knock back")
    const deckTripleBuster = computeDeckStats(["137-C005", "137-A017"], "bn6");
    assert.equal(deckTripleBuster.tripleBuster, true);
    assert.equal(deckTripleBuster.busterAddition, "1 square knock back");
    assert.equal(deckTripleBuster.invalidatedBusterAddition, undefined);

    // 4. B-Button weapon override invalidates busterAddition
    // Shadow (137-A008, bButton: Sword) + BomBoy (137-A017)
    const deckBButton = computeDeckStats(["137-A008", "137-A017"], "bn6");
    assert.equal(deckBButton.bButton, "Sword");
    assert.equal(deckBButton.busterAddition, undefined);
    assert.equal(deckBButton.invalidatedBusterAddition, "1 square knock back");

    // 5. Card ordering ensures required special move is loaded last
    const ordered = orderModCardsForConstraints(["137-A025", "137-A014"], "bn6", {
        requiredSpecialMove: "DollThunder",
    });
    assert.equal(ordered[ordered.length - 1], "137-A025", "ScarCrow (DollThunder) must be ordered after NumberMan");

    // 6. ChargeShot constraint excludes special CS cards
    const optimizedCards = optimizeModCards({
        gameId: "bn6",
        target: "max_hp",
        policy: { type: "custom" },
        constraints: { requiredSpecialMove: "ChargeShot" },
    });
    const optimizedDeck = computeDeckStats(optimizedCards, "bn6");
    assert.ok(
        !optimizedDeck.bPwrAtk || optimizedDeck.bPwrAtk.toLowerCase() === "chargeshot",
        "ChargeShot constraint must not select any special CS"
    );
});

test("Mod Card negative properties strip NC abilities and report disabledAbilitiesFromCards", () => {
    const { computeBuildStats } = require("../effects.ts");
    // Part ID 1 is SuperArmor in BN6
    // Card 137-A024 is BigHat, which disables superArmor
    const statsWithSA = computeBuildStats("bn6", [1], ["137-A024"], 1000);
    assert.equal(statsWithSA.abilities.includes("superArmor"), false, "SuperArmor must be stripped from final abilities");
    assert.deepEqual(statsWithSA.disabledAbilitiesFromCards, ["superArmor"], "disabledAbilitiesFromCards must report superArmor");
});

test("Extended build constraints: BButton, Additions, Body, Gauge and URL round-trip", () => {
    const { computeDeckStats } = require("../modcards.ts");
    const { optimizeModCards, orderModCardsForConstraints } = require("../optimizer.ts");
    const { toHashString, fromHashString } = require("../problem.ts");
    const data = getGameData("bn6");

    // 1. Optimize with requiredChargeAddition: Paralyze (ToadMan 137-A037)
    const cardsWithCA = optimizeModCards({
        gameId: "bn6",
        target: "max_hp",
        policy: { type: "custom" },
        constraints: { requiredChargeAddition: "Paralyze" },
    });
    const deckCA = computeDeckStats(cardsWithCA, "bn6");
    assert.equal(deckCA.chargeAddition, "Paralyze", "Must fulfill requiredChargeAddition: Paralyze");
    assert.ok(!deckCA.bPwrAtk || deckCA.bPwrAtk.toLowerCase() === "chargeshot", "Must not invalidate chargeAddition with special CS");

    // 2. Optimize with requiredBusterAddition: 1 square knock back (BomBoy 137-A017)
    const cardsWithBA = optimizeModCards({
        gameId: "bn6",
        target: "max_hp",
        policy: { type: "custom" },
        constraints: { requiredBusterAddition: "1 square knock back" },
    });
    const deckBA = computeDeckStats(cardsWithBA, "bn6");
    assert.equal(deckBA.busterAddition, "1 square knock back", "Must fulfill requiredBusterAddition");
    assert.equal(deckBA.bButton, undefined, "Must not invalidate busterAddition with bButton override");

    // 3. Optimize with requiredBButton: Sword
    const cardsWithSword = optimizeModCards({
        gameId: "bn6",
        target: "max_hp",
        policy: { type: "custom" },
        constraints: { requiredBButton: "Sword" },
    });
    const deckSword = computeDeckStats(cardsWithSword, "bn6");
    assert.equal(deckSword.bButton, "Sword", "Must fulfill requiredBButton: Sword");

    // 4. Optimize with requiredBButton: none (pure standard buster)
    const cardsNoBButton = optimizeModCards({
        gameId: "bn6",
        target: "max_attack",
        policy: { type: "custom" },
        constraints: { requiredBButton: "none" },
    });
    const deckNoB = computeDeckStats(cardsNoBButton, "bn6");
    assert.equal(deckNoB.bButton, undefined, "Must not have any bButton weapon override");

    // 5. Optimize with requiredGauge: fast
    const cardsFastGauge = optimizeModCards({
        gameId: "bn6",
        target: "max_hp",
        policy: { type: "custom" },
        constraints: { requiredGauge: "fast" },
    });
    const deckGauge = computeDeckStats(cardsFastGauge, "bn6");
    assert.equal(deckGauge.gauge, "fast", "Must fulfill requiredGauge: fast");

    // 6. Optimize with requiredBody: Wood
    const cardsWood = optimizeModCards({
        gameId: "bn6",
        target: "max_hp",
        policy: { type: "custom" },
        constraints: { requiredBody: "Wood" },
    });
    const deckWood = computeDeckStats(cardsWood, "bn6");
    assert.equal(deckWood.body, "Wood", "Must fulfill requiredBody: Wood");

    // 7. Problem hash serialization round-trip for all extended constraints
    const prob = emptyProblem(data);
    prob.constraints = {
        requiredAbilities: ["superArmor"],
        requiredSpecialMove: "ChargeShot",
        requiredBLeft: "AntiDamage",
        requiredBButton: "Sword",
        requiredChargeAddition: "Paralyze",
        requiredBusterAddition: "1 square knock back",
        requiredBody: "Wood",
        requiredGauge: "fast",
        bugRules: { buster: "required" },
    };
    const hash = toHashString(prob, data);
    const restored = fromHashString(hash, data);
    assert.ok(restored && restored.constraints);
    assert.equal(restored.constraints.requiredSpecialMove, "ChargeShot");
    assert.equal(restored.constraints.requiredBLeft, "AntiDamage");
    assert.equal(restored.constraints.requiredBButton, "Sword");
    assert.equal(restored.constraints.requiredChargeAddition, "Paralyze");
    assert.equal(restored.constraints.requiredBusterAddition, "1 square knock back");
    assert.equal(restored.constraints.requiredBody, "Wood");
    assert.equal(restored.constraints.requiredGauge, "fast");
    assert.deepEqual(restored.constraints.bugRules, { buster: "required" });
});

test("Full Special CS and B+Left move catalog across BN6, BN5, and BN4", () => {
    const { getSpecialCsOptions, getBLeftOptions, getBButtonOptions } = require("../effects.ts");
    const { optimizeModCards } = require("../optimizer.ts");
    const { computeDeckStats } = require("../modcards.ts");

    // 1. Check counts of complete catalogs
    const bn6Cs = getSpecialCsOptions("bn6");
    assert.equal(bn6Cs.length, 44, "BN6 must have all 44 special CS options (including ChargeShot and Vulcan)");
    assert.ok(bn6Cs.some(o => o.id === "Vulcan"), "BN6 must have CS: Vulcan (BowlMan)");

    const bn5Cs = getSpecialCsOptions("bn5");
    assert.equal(bn5Cs.length, 32, "BN5 must have 32 CS options (including ChargeShot)");
    const bn4Cs = getSpecialCsOptions("bn4");
    assert.equal(bn4Cs.length, 31, "BN4 must have all BN4 CS options");

    const bn6BLeft = getBLeftOptions("bn6");
    assert.equal(bn6BLeft.length, 8, "BN6 must have 8 B+Left options (including MachineSword)");

    const bn6BButton = getBButtonOptions("bn6");
    assert.equal(bn6BButton.length, 5, "BN6 must have 5 B-Button options (none, Sword, MiniBomb, CrackShot, Meteor1)");
    assert.ok(!bn6BButton.some(o => o.id === "Vulcan"), "BN6 B-Button options must not contain Vulcan (BowlMan is CS)");

    // 2. Test optimizing with CS: Cannon (CanGard)
    const cardsCannon = optimizeModCards({
        gameId: "bn6",
        target: "max_hp",
        policy: { type: "custom" },
        constraints: { requiredSpecialMove: "Cannon" },
    });
    const deckCannon = computeDeckStats(cardsCannon, "bn6");
    assert.equal(deckCannon.bPwrAtk, "Cannon", "Must successfully select Cannon CS");

    // 3. Test optimizing with CS: LongSword (ShadowMan)
    const cardsLongSword = optimizeModCards({
        gameId: "bn6",
        target: "max_hp",
        policy: { type: "custom" },
        constraints: { requiredSpecialMove: "LongSword" },
    });
    const deckLongSword = computeDeckStats(cardsLongSword, "bn6");
    assert.equal(deckLongSword.bPwrAtk, "LongSword", "Must successfully select LongSword CS");

    // 4. Test optimizing with CS: ElecSword (ThunderMan)
    const cardsElecSword = optimizeModCards({
        gameId: "bn6",
        target: "max_hp",
        policy: { type: "custom" },
        constraints: { requiredSpecialMove: "ElecSword" },
    });
    const deckElecSword = computeDeckStats(cardsElecSword, "bn6");
    assert.equal(deckElecSword.bPwrAtk, "ElecSword", "Must successfully select ElecSword CS");

    // 5. Test optimizing with B+Left: MachineSword (Colonel)
    const cardsMachineSword = optimizeModCards({
        gameId: "bn6",
        target: "max_hp",
        policy: { type: "custom" },
        constraints: { requiredBLeft: "MachineSword" },
    });
    const deckMachineSword = computeDeckStats(cardsMachineSword, "bn6");
    assert.equal(deckMachineSword.bLeft, "MachineSword", "Must successfully select MachineSword B+Left");

    // 6. Test matching B+Left: Magnetize with card having description 'Magnetize (immobilizes enemy)'
    const cardsMagnetize = optimizeModCards({
        gameId: "bn6",
        target: "max_hp",
        policy: { type: "custom" },
        constraints: { requiredBLeft: "Magnetize" },
    });
    const deckMagnetize = computeDeckStats(cardsMagnetize, "bn6");
    assert.ok(
        deckMagnetize.bLeft && deckMagnetize.bLeft.startsWith("Magnetize"),
        "Must successfully match Magnetize"
    );

    // 7. Test BowlMan CS: Vulcan
    const cardsVulcan = optimizeModCards({
        gameId: "bn6",
        target: "max_hp",
        policy: { type: "custom" },
        constraints: { requiredSpecialMove: "Vulcan" },
    });
    const deckVulcan = computeDeckStats(cardsVulcan, "bn6");
    assert.equal(deckVulcan.bPwrAtk, "Vulcan", "BowlMan must be selected for CS: Vulcan");
    assert.ok(cardsVulcan.includes("137-B041"), "Deck must include BowlMan (137-B041)");

    // 8. Test FirstBarrier 100 ability support
    const { getCoreAbilityOptions } = require("../effects.ts");
    const bn6Abilities = getCoreAbilityOptions("bn6");
    assert.ok(bn6Abilities.some(o => o.id === "firstBarrier100"), "BN6 core abilities must include firstBarrier100");

    const cardsBarrier100 = optimizeModCards({
        gameId: "bn6",
        target: "max_hp",
        policy: { type: "custom" },
        constraints: { requiredAbilities: ["firstBarrier100"] },
    });
    const deckBarrier100 = computeDeckStats(cardsBarrier100, "bn6");
    assert.ok(deckBarrier100.activeAbilities.includes("firstBarrier100"), "Deck must include firstBarrier100");
    assert.ok(cardsBarrier100.includes("137-A005"), "Deck must include Heady (137-A005)");
});

test("optimizer finds valid core layouts beyond the old first-50 cutoff", () => {
    const data = getGameData("bn6");
    const problem = emptyProblem(data);
    problem.requirements = [1, 11].map(id => ({
        partIndex: data.partMetas.findIndex(p => p.id === id),
        constraint: { onCommandLine: null, minBugLevel: 0, maxBugLevel: Infinity, compressed: true },
    }));
    const { makeGridSettings } = require("../problem.ts");
    const grid = makeGridSettings(data, problem);
    let checked = 0;
    for (const solution of solve(data.parts, problem.requirements, grid, problem.spinnableColors)) {
        checked++;
        const analysis = analyzeSolutionBugs(data.gameId, data.partMetas, problem.requirements,
            placeAll(data.parts, problem.requirements, solution, grid), grid, "en");
        if (isSolutionAcceptable(analysis, { type: "no_bugs" })) break;
    }
    assert.ok(checked > 50, "Fixture must exercise the original false negative");
    const original = JSON.stringify(problem);
    const result = optimizeBuild({ data, problem, timeoutMs: 1000, modCardMode: "none" });
    assert.ok(result);
    assert.ok(isSolutionAcceptable(result.analysis, { type: "no_bugs" }));
    assert.equal(JSON.stringify(problem), original, "Search must preserve the user's input constraints");
});

test("allowed placement bugs can be used when adding filler parts", () => {
    // A one-row board forces the HP part onto the command line. It fits only
    // if its explicitly allowed battle HP bug is respected by the search.
    const { from } = require("../array2d.ts");
    const data = getGameData("bn6");
    const indices = [1, 46].map(id => data.partMetas.findIndex(p => p.id === id));
    data.partMetas = indices.map((i, n) => ({ ...data.partMetas[i], color: n + 1 }));
    data.parts = indices.map((i, n) => ({
        ...data.parts[i], color: n + 1,
        compressedMask: from([true, false], 1, 2),
        uncompressedMask: from([true, false], 1, 2),
    }));
    data.gridOptions = [{ label: "fixture", settings: { height: 1, width: 2, commandLineRow: 0, hasOob: false } }];
    const problem = emptyProblem(data);
    problem.expansionMemories = 0;
    problem.requirements = [{ partIndex: 0, constraint: { onCommandLine: true, minBugLevel: 0, maxBugLevel: 0, compressed: true } }];
    const constraints = { bugRules: { battleHp: "allowed_any", damageHp: "allowed_any" } };
    const result = optimizeBuild({ data, problem, constraints, timeoutMs: 500, modCardMode: "none" });
    assert.ok(result);
    assert.deepEqual(result.addedPartIndices, [1]);
    assert.equal(result.stats.finalHp, 1500);
    assert.ok(isSolutionAcceptable(result.analysis, { type: "no_bugs" }, [], constraints.bugRules));
});

test("a valid core with no available fillers remains a successful result", () => {
    const data = getGameData("bn6");
    data.partMetas = data.partMetas.slice(0, 1);
    data.parts = data.parts.slice(0, 1);
    const problem = emptyProblem(data);
    problem.requirements = [{ partIndex: 0, constraint: { onCommandLine: true, minBugLevel: 0, maxBugLevel: 0, compressed: true } }];
    const result = optimizeBuild({ data, problem, modCardMode: "none" });
    assert.ok(result);
    assert.deepEqual(result.addedPartIndices, []);
    assert.ok(isSolutionAcceptable(result.analysis, { type: "no_bugs" }));
});

test("required NC abilities are reported among added parts", () => {
    const data = getGameData("bn6");
    data.partMetas = data.partMetas.slice(0, 1);
    data.parts = data.parts.slice(0, 1);
    const result = optimizeBuild({ data, problem: emptyProblem(data), modCardMode: "none",
        constraints: { requiredAbilities: ["superArmor"] } });
    assert.ok(result);
    assert.deepEqual(result.addedPartIndices, [0]);
    assert.ok(result.stats.abilities.includes("superArmor"));
});

test("BugStop layouts beyond the old cutoff remain searchable", () => {
    const data = getGameData("bn6");
    const indices = [31, 1, 11].map(id => data.partMetas.findIndex(p => p.id === id));
    data.partMetas = indices.map(i => data.partMetas[i]);
    data.parts = indices.map(i => data.parts[i]);
    const problem = emptyProblem(data);
    problem.requirements = indices.map((_, partIndex) => ({
        partIndex,
        constraint: { onCommandLine: null, minBugLevel: 0, maxBugLevel: Infinity, compressed: true },
    }));
    const result = optimizeBuild({ data, problem, timeoutMs: 1000, modCardMode: "none" });
    assert.ok(result);
    assert.ok(result.analysis.bugStopActive);
    assert.ok(isSolutionAcceptable(result.analysis, { type: "no_bugs" }));
});

test("policy pruning preserves explicit core placement constraints", () => {
    const data = getGameData("bn6");
    const problem = emptyProblem(data);
    problem.requirements = [{ partIndex: 0,
        constraint: { onCommandLine: false, minBugLevel: 1, maxBugLevel: 1, compressed: true } }];
    assert.equal(optimizeBuild({ data, problem, modCardMode: "none" }), null);
});


test("HP priority never trades HP for Attack or unrelated bonuses", () => {
    const hp = { finalHp: 1001, attack: 1, rapid: 1, charge: 1, custom: 5 };
    const attack = { finalHp: 1000, attack: 10, rapid: 5, charge: 5, custom: 10 };
    assert.ok(compareBuildStats(hp, attack, "max_hp") > 0);
    assert.ok(compareBuildStats(attack, hp, "max_hp") < 0);
    assert.ok(compareBuildStats({ ...hp, attack: 2 }, hp, "max_hp") > 0);
    assert.equal(compareBuildStats({ ...hp, rapid: 5, charge: 5, custom: 10 }, hp, "max_hp"), 0);
});

test("Attack priority never trades Attack for HP, then maximizes HP at equal Attack", () => {
    const attack = { finalHp: 1, attack: 10 };
    const hp = { finalHp: 1000000000, attack: 9 };
    assert.ok(compareBuildStats(attack, hp, "max_attack") > 0);
    assert.ok(compareBuildStats(hp, attack, "max_attack") < 0);
    assert.ok(compareBuildStats({ ...attack, finalHp: 2 }, attack, "max_attack") > 0);
    assert.equal(compareBuildStats({ ...attack, rapid: 5, charge: 5, custom: 10 }, attack, "max_attack"), 0);
});
