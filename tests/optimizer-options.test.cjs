require("./register.cjs");
const assert = require("node:assert/strict");
const { test } = require("node:test");
const { games } = require("../games.ts");
const { parseGameData } = require("../game-data.ts");
const { emptyProblem } = require("../problem.ts");
const { getOptimizerAbilityOptions, getOptimizerBugOptions, getOptimizerCustomValues, getOptimizerModeConstraints } = require("../optimizer-options.ts");
const { findFeasibleBuild } = require("../feasible-optimizer.ts");
const dataFor = game => parseGameData(require(`../data/${game}.json`), games.find(g => g.id === game));
const ids = options => options.map(option => option.id);

for (const game of ["bn4", "bn5", "bn6"]) {
    test(`${game}: pure NC hides card-only barriers while retaining normal FirstBarrier`, () => {
        const data = dataFor(game);
        const pure = ids(getOptimizerAbilityOptions(data, false));
        const cards = ids(getOptimizerAbilityOptions(data, true));
        assert.ok(pure.includes("firstBarrier"));
        for (const id of ["firstBarrier100", "firstBarrier200"]) {
            assert.ok(!pure.includes(id));
            assert.ok(cards.includes(id));
        }
    });
}

test("BN6 pure NC hides card-only abilities and bugs without hiding actual NC effects", () => {
    const data = dataFor("bn6");
    const abilities = ids(getOptimizerAbilityOptions(data, false));
    assert.ok(!abilities.includes("statusGuard"));
    assert.ok(!abilities.includes("chipRecovery"));
    for (const id of ["superArmor", "airShoes", "underShirt", "chipShuffle"]) assert.ok(abilities.includes(id));
    const pure = ids(getOptimizerBugOptions(data, false));
    for (const id of ["customDamage", "customHp", "damageConfusion"]) assert.ok(!pure.includes(id));
    for (const id of ["battleHp", "damageHp", "buster", "custom", "status"]) assert.ok(pure.includes(id));
    const cards = ids(getOptimizerBugOptions(data, true));
    for (const id of ["customDamage", "customHp", "damageConfusion"]) assert.ok(cards.includes(id));
});

test("NC bug availability is game-specific: BN5 entry damage and BN3 menu drain remain available", () => {
    const bn5 = ids(getOptimizerBugOptions(dataFor("bn5"), false));
    assert.ok(bn5.includes("customDamage"));
    assert.ok(!bn5.includes("customHp"));
    assert.ok(!bn5.includes("damageBlind"));
    assert.ok(bn5.includes("panelCrack"));
    assert.ok(!bn5.includes("panel"));
    assert.ok(!bn5.includes("panelGrass"));
    const bn3 = ids(getOptimizerBugOptions(dataFor("bn3"), false));
    assert.ok(bn3.includes("customHp"));
    assert.ok(bn3.includes("charge"));
    assert.ok(!bn3.includes("movement"));
    assert.ok(bn3.includes("involuntaryMoveUp"));
    assert.ok(bn3.includes("involuntaryMoveDown"));
    assert.ok(bn3.includes("involuntaryMoveConfuse"));

    const bn4 = ids(getOptimizerBugOptions(dataFor("bn4"), false));
    assert.ok(!bn4.includes("movement"));
    assert.ok(bn4.includes("playerConfuse"));
    assert.ok(bn4.includes("playerMoveForward"));
    assert.ok(bn4.includes("playerMoveBackward"));
    const bn4Cards = ids(getOptimizerBugOptions(dataFor("bn4"), true));
    assert.ok(!bn4Cards.includes("movement"));
    assert.ok(bn4Cards.includes("playerConfuse"));
    assert.ok(bn4Cards.includes("playerMoveForward"));
    assert.ok(bn4Cards.includes("playerMoveBackward"));
});

const draft = () => ({
    requiredAbilities: ["superArmor", "firstBarrier", "firstBarrier100", "firstBarrier200", "chipRecovery", "statusGuard"],
    minChipRecovery: 30, minCustom: 7, minBusterStats: { attack: 10, rapid: 3, charge: 5 },
    requiredSpecialMove: "DrillArm", requiredBLeft: "Shield", requiredBButton: "Sword",
    requiredChargeAddition: "Freeze", requiredBusterAddition: "Grass Panel", requiredGauge: "fast",
    allowedBodies: [], requiredBody: "Fire", allowedGauges: ["fast", "normal"],
    bugRules: { battleHp: "allowed_any", damageHp: "allowed_any", customDamage: "required", customHp: "allowed_any" },
    forbiddenBugs: ["damageConfusion", "buster"],
});

test("switching to pure NC excludes hidden requirements and uses the visible Attack Lv5 minimum", () => {
    const data = dataFor("bn6");
    const configured = draft();
    const snapshot = JSON.stringify(configured);
    const pure = getOptimizerModeConstraints(data, configured, false);
    assert.deepEqual(pure, {
        requiredAbilities: ["superArmor", "firstBarrier"], minCustom: 7,
        minBusterStats: { attack: 5, rapid: 3, charge: 5 },
        bugRules: { battleHp: "allowed_any", damageHp: "allowed_any" }, forbiddenBugs: ["buster"],
    });
    assert.equal(JSON.stringify(configured), snapshot);
    assert.equal(getOptimizerModeConstraints(data, configured, true), configured,
        "Re-enabling cards restores the draft, including body selection and Attack Lv10");
});

test("hidden empty body and card-only required bug cannot block a pure NC search", () => {
    const data = dataFor("bn6");
    const configured = { allowedBodies: [], requiredAbilities: ["firstBarrier200", "chipRecovery"],
        minChipRecovery: 40, requiredSpecialMove: "DrillArm", bugRules: { customDamage: "required" } };
    const options = { data, problem: emptyProblem(data), modCardMode: "none", shouldStop: () => false };
    assert.equal(findFeasibleBuild({ ...options, constraints: configured }), null);
    const pure = getOptimizerModeConstraints(data, configured, false);
    assert.deepEqual(pure, {});
    const result = findFeasibleBuild({ ...options, constraints: pure });
    assert.ok(result);
    assert.equal(result.problem.requirements.length, 0);
    assert.deepEqual(result.problem.constraints, {});
});

test("BN3 never gains card-only UI requirements even if an enabled flag is supplied", () => {
    const data = dataFor("bn3");
    assert.deepEqual(getOptimizerAbilityOptions(data, true), getOptimizerAbilityOptions(data, false));
    assert.deepEqual(getOptimizerModeConstraints(data, draft(), true), getOptimizerModeConstraints(data, draft(), false));
});

for (const game of ["bn5", "bn6"]) {
    test(`${game}: Chip Recovery is selectable with cards and omitted in pure NC mode`, () => {
        const data = dataFor(game);
        assert.ok(ids(getOptimizerAbilityOptions(data, true)).includes("chipRecovery"));
        assert.ok(!ids(getOptimizerAbilityOptions(data, false)).includes("chipRecovery"));
        const constraints = { requiredAbilities: ["chipRecovery"], minChipRecovery: 20 };
        assert.deepEqual(getOptimizerModeConstraints(data, constraints, true), constraints);
        assert.deepEqual(getOptimizerModeConstraints(data, constraints, false), {});
    });
}

test("BN6 custom values: pure NC omits 9 and starts from 6; cards enabled includes negative-safe values 3, 4, baseline 5", () => {
    assert.deepEqual(getOptimizerCustomValues("bn6", false), [6, 7, 8, 10]);
    assert.deepEqual(getOptimizerCustomValues("bn6", true), [3, 4, 5, 6, 7, 8, 9, 10]);
});

test("BN5, BN4, BN3 custom values adapt to NC and mod card availability", () => {
    assert.deepEqual(getOptimizerCustomValues("bn5", false), [6, 7, 8, 9, 10]);
    assert.deepEqual(getOptimizerCustomValues("bn5", true), [3, 4, 5, 6, 7, 8, 9, 10]);
    assert.deepEqual(getOptimizerCustomValues("bn4", false), [6, 7, 8, 9]);
    assert.deepEqual(getOptimizerCustomValues("bn4", true), [4, 5, 6, 7, 8, 9, 10]);
    assert.deepEqual(getOptimizerCustomValues("bn3", false), [6, 7, 8]);
    assert.deepEqual(getOptimizerCustomValues("bn3", true), [6, 7, 8]);
});
