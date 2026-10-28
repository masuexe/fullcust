require("./register.cjs");
const assert = require("node:assert/strict");
const { test } = require("node:test");
const { games } = require("../games.ts");
const { parseGameData } = require("../game-data.ts");
const { emptyProblem, makeGridSettings, toHashString, fromHashString } = require("../problem.ts");
const { BUG_SPEC_OPTIONS, analyzeSolutionBugs, computeBuildStats } = require("../effects.ts");
const { getModCards, computeDeckStats } = require("../modcards.ts");
const {
    isSpecialMoveAllowed,
    isBButtonAllowed,
    isChargeAdditionAllowed,
    isBLeftAllowed,
    isBusterAdditionAllowed,
    cardSpecConstraintsPossible,
    doesBuildSatisfyConstraints,
    optimizeModCards,
    orderModCardsForConstraints,
} = require("../optimizer.ts");

function options(constraints = {}) {
    const data = parseGameData(require("../data/bn6.json"), games.find(g => g.id === "bn6"));
    return {
        data,
        problem: emptyProblem(data),
        modCardMode: "auto",
        constraints: {
            bugRules: Object.fromEntries(BUG_SPEC_OPTIONS.map(b => [b.id, "allowed_any"])),
            ...constraints,
        },
    };
}

function analysisFor(opts, cards = []) {
    const grid = makeGridSettings(opts.data, opts.problem);
    return analyzeSolutionBugs("bn6", opts.data.partMetas, [], new Array(grid.height * grid.width).fill(null), grid, "en", cards);
}

test("Scenario 1: CS is DrillArm or WindRacket ('CS是钻椎臂和风神球拍都可以')", () => {
    const constraints = { allowedSpecialMoves: ["DrillArm", "WindRacket"] };

    // Standard ChargeShot (no cards) is rejected because standard ChargeShot was not allowed
    assert.equal(isSpecialMoveAllowed(undefined, constraints), false);
    assert.equal(isSpecialMoveAllowed("ChargeShot", constraints), false);

    // DrillArm and WindRacket are accepted
    assert.equal(isSpecialMoveAllowed("DrillArm", constraints), true);
    assert.equal(isSpecialMoveAllowed("WindRacket", constraints), true);

    // Other special moves are rejected
    assert.equal(isSpecialMoveAllowed("WideSword", constraints), false);
    assert.equal(isSpecialMoveAllowed("Cannon", constraints), false);

    // If ChargeShot is explicitly added to the allow-list, baseline is accepted
    const withStandard = { allowedSpecialMoves: ["ChargeShot", "DrillArm", "WindRacket"] };
    assert.equal(isSpecialMoveAllowed(undefined, withStandard), true);
    assert.equal(isSpecialMoveAllowed("ChargeShot", withStandard), true);
    assert.equal(isSpecialMoveAllowed("DrillArm", withStandard), true);
    assert.equal(isSpecialMoveAllowed("WideSword", withStandard), false);

    // Optimizer locks a card providing DrillArm or WindRacket
    const opts = options(constraints);
    const ids = optimizeModCards({ gameId: "bn6", constraints: opts.constraints, policy: { type: "custom", customRules: opts.constraints.bugRules } });
    const deck = computeDeckStats(ids, "bn6");
    assert.ok(isSpecialMoveAllowed(deck.bPwrAtk, constraints), `Deck CS ${deck.bPwrAtk} must be DrillArm or WindRacket`);
});

test("Scenario 2: CS addition is Paralyze or Freeze ('CS附加麻痹/冻结都可以')", () => {
    const constraints = { allowedChargeAdditions: ["Paralyze", "Freeze"] };

    // Baseline (no addition) is rejected
    assert.equal(isChargeAdditionAllowed(undefined, constraints), false);
    assert.equal(isChargeAdditionAllowed("none", constraints), false);

    // Paralyze and Freeze are accepted
    assert.equal(isChargeAdditionAllowed("Paralyze", constraints), true);
    assert.equal(isChargeAdditionAllowed("Freeze", constraints), true);

    // Confusion or other additions are rejected
    assert.equal(isChargeAdditionAllowed("Confusion", constraints), false);

    // If 'none' is in the allow-list, baseline is accepted
    const withNone = { allowedChargeAdditions: ["none", "Paralyze", "Freeze"] };
    assert.equal(isChargeAdditionAllowed(undefined, withNone), true);
    assert.equal(isChargeAdditionAllowed("none", withNone), true);
    assert.equal(isChargeAdditionAllowed("Paralyze", withNone), true);
    assert.equal(isChargeAdditionAllowed("Confusion", withNone), false);

    // Optimizer locks a card providing Paralyze or Freeze
    const opts = options(constraints);
    const ids = optimizeModCards({ gameId: "bn6", constraints: opts.constraints, policy: { type: "custom", customRules: opts.constraints.bugRules } });
    const deck = computeDeckStats(ids, "bn6");
    assert.ok(isChargeAdditionAllowed(deck.chargeAddition, constraints), `Deck CA ${deck.chargeAddition} must be Paralyze or Freeze`);
});

test("Scenario 3: B-Button is Standard Buster or CrackShot ('B键标准洛克炮和裂缝射击都可以')", () => {
    const constraints = { allowedBButtons: ["none", "CrackShot"] };

    // Baseline standard buster (no card) is accepted
    assert.equal(isBButtonAllowed(undefined, constraints), true);
    assert.equal(isBButtonAllowed("none", constraints), true);

    // CrackShot is accepted
    assert.equal(isBButtonAllowed("CrackShot", constraints), true);

    // Sword, MiniBomb, Meteor1 are rejected
    assert.equal(isBButtonAllowed("Sword", constraints), false);
    assert.equal(isBButtonAllowed("MiniBomb", constraints), false);
    assert.equal(isBButtonAllowed("Meteor1", constraints), false);

    // Optimizer generates a deck where B-Button is either none or CrackShot
    const opts = options(constraints);
    const ids = optimizeModCards({ gameId: "bn6", constraints: opts.constraints, policy: { type: "custom", customRules: opts.constraints.bugRules } });
    const deck = computeDeckStats(ids, "bn6");
    assert.ok(isBButtonAllowed(deck.bButton, constraints), `Deck B-Button ${deck.bButton} must be none or CrackShot`);
});

test("orderModCardsForConstraints orders cards with allowed attributes last", () => {
    // 137-A016 sets Spidy (CS: none, body: Wood), 137-B048 sets GridMan (CS: none), etc.
    // GroundMan (137-A055) has DrillArm; SlashMan (137-A053) has WideSword.
    const allCards = getModCards("bn6");
    const groundMan = allCards.find(c => c.bPwrAtk && c.bPwrAtk.includes("DrillArm"));
    const slashMan = allCards.find(c => c.bPwrAtk && c.bPwrAtk.includes("WideSword"));
    assert.ok(groundMan && slashMan);

    const constraints = { allowedSpecialMoves: ["DrillArm"] };
    // Start with GroundMan first, then SlashMan (which would overwrite with WideSword)
    const ordered = orderModCardsForConstraints([groundMan.id, slashMan.id], "bn6", constraints);
    // GroundMan should be moved to the end so DrillArm takes precedence
    assert.deepEqual(ordered, [slashMan.id, groundMan.id]);
    const deck = computeDeckStats(ordered, "bn6");
    assert.ok(isSpecialMoveAllowed(deck.bPwrAtk, constraints));
});

test("cardSpecConstraintsPossible detects empty and contradictory constraints", () => {
    assert.equal(cardSpecConstraintsPossible({ allowedSpecialMoves: [] }), false);
    assert.equal(cardSpecConstraintsPossible({ allowedBButtons: [] }), false);
    assert.equal(cardSpecConstraintsPossible({ allowedChargeAdditions: [] }), false);
    assert.equal(cardSpecConstraintsPossible({ allowedBLefts: [] }), false);
    assert.equal(cardSpecConstraintsPossible({ allowedBusterAdditions: [] }), false);

    // Contradiction between legacy required and allowed
    assert.equal(cardSpecConstraintsPossible({ requiredSpecialMove: "DrillArm", allowedSpecialMoves: ["WindRacket"] }), false);
    assert.equal(cardSpecConstraintsPossible({ requiredSpecialMove: "DrillArm", allowedSpecialMoves: ["DrillArm", "WindRacket"] }), true);
});

test("URL Hash serialization round-trips for allowedSpecialMoves, allowedBButtons, allowedChargeAdditions", () => {
    const opts = options();
    const problem = {
        ...opts.problem,
        constraints: {
            allowedSpecialMoves: ["DrillArm", "WindRacket"],
            allowedBButtons: ["none", "CrackShot"],
            allowedChargeAdditions: ["Paralyze", "Freeze"],
            allowedBLefts: ["none", "Shield"],
            allowedBusterAdditions: ["none", "Cracked Panel"],
        },
    };

    const hash = toHashString(problem, opts.data);
    const parsed = JSON.parse(hash);
    assert.deepEqual(parsed.bc.acs, ["DrillArm", "WindRacket"]);
    assert.deepEqual(parsed.bc.abb, ["none", "CrackShot"]);
    assert.deepEqual(parsed.bc.aca, ["Paralyze", "Freeze"]);
    assert.deepEqual(parsed.bc.abl, ["none", "Shield"]);
    assert.deepEqual(parsed.bc.aba, ["none", "Cracked Panel"]);

    const restored = fromHashString(hash, opts.data);
    assert.deepEqual(restored.constraints.allowedSpecialMoves, ["DrillArm", "WindRacket"]);
    assert.deepEqual(restored.constraints.allowedBButtons, ["none", "CrackShot"]);
    assert.deepEqual(restored.constraints.allowedChargeAdditions, ["Paralyze", "Freeze"]);
    assert.deepEqual(restored.constraints.allowedBLefts, ["none", "Shield"]);
    assert.deepEqual(restored.constraints.allowedBusterAdditions, ["none", "Cracked Panel"]);

    // Empty allow-lists are not emitted into the hash
    const emptyProblemObj = { ...opts.problem, constraints: { allowedSpecialMoves: [], allowedBButtons: [] } };
    const emptyHash = toHashString(emptyProblemObj, opts.data);
    const emptyParsed = JSON.parse(emptyHash);
    assert.equal(emptyParsed.bc?.acs, undefined);
    assert.equal(emptyParsed.bc?.abb, undefined);
});
