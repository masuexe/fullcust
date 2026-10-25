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
