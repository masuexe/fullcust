require("./register.cjs");
const assert = require("node:assert/strict");
const { test } = require("node:test");
const { BUG_SPEC_OPTIONS, GAME_PART_BUG_TYPES, getPartBugTypes, normalizeBugType,
    analyzeSolutionBugs, computeBuildStats, isSolutionAcceptable, getEffectiveInBattleBugs } = require("../effects.ts");
const { getModCards, getModCard, computeDeckStats, repairsBugType } = require("../modcards.ts");
const { BN4_PLAYER_BUG_TYPES, BN3_INVOLUNTARY_MOVE_BUG_TYPES, BN3_CHARGE_BUG_TYPES, BN3_BUSTER_BUG_TYPES } = require("../panel-effects.ts");
const { doesBuildSatisfyConstraints } = require("../optimizer.ts");
const manifest = require("./fixtures/modcard-bug-audit.json");
const grid = { width: 5, height: 5, commandLineRow: 2, hasOob: false };
const analysisFor = (game, cards) => analyzeSolutionBugs(game, [], [], new Array(25).fill(null), grid, "en", cards);
const allRules = () => Object.fromEntries(BUG_SPEC_OPTIONS.map(option => [option.id, "allowed_any"]));

for (const game of ["bn3", "bn4", "bn5", "bn6"]) {
    test(`${game} exposes every recorded NC and card bug as a configurable option`, () => {
        const options = BUG_SPEC_OPTIONS.filter(o => !o.games || o.games.includes(game));
        const keys = options.map(o => o.id);
        assert.equal(new Set(keys).size, keys.length);
        const types = Object.keys(GAME_PART_BUG_TYPES[game]).flatMap(id => getPartBugTypes(game, Number(id)));
        if (game !== "bn3") types.push(...getModCards(game).flatMap(card => card.bugs.map(b => b.type)));
        for (const type of types) {
            if (game === "bn4" && type === "player") {
                for (const pt of BN4_PLAYER_BUG_TYPES) assert.ok(keys.includes(pt), `Hidden ${game} bug: ${pt}`);
            } else if (game === "bn3" && type === "involuntaryMove") {
                for (const pt of BN3_INVOLUNTARY_MOVE_BUG_TYPES) assert.ok(keys.includes(pt), `Hidden ${game} bug: ${pt}`);
            } else if (game === "bn3" && type === "charge") {
                for (const pt of BN3_CHARGE_BUG_TYPES) assert.ok(keys.includes(pt), `Hidden ${game} bug: ${pt}`);
            } else if (game === "bn3" && type === "buster") {
                for (const pt of BN3_BUSTER_BUG_TYPES) assert.ok(keys.includes(pt), `Hidden ${game} bug: ${pt}`);
            } else {
                assert.ok(keys.includes(normalizeBugType(type)), `Hidden ${game} bug: ${type}`);
            }
        }
        for (const option of options) for (const lang of ["en", "ja", "zh"]) {
            assert.ok(option.name[lang]);
            assert.ok(option.desc[lang]);
        }
    });
}

test("approved BN5/6 source tables match every audited card's bug and repair categories", () => {
    const category = type => type.startsWith("panel") ? "panel" : ["damageHp", "damageConfusion", "damageBlind"].includes(type) ? "damage" : type;
    for (const [game, audit] of Object.entries(manifest.games)) {
        for (const record of audit.cards) {
            const card = getModCard(record.id, game);
            assert.ok(card);
            assert.deepEqual([...new Set(card.bugs.map(b => b.type))].sort(), record.bugs, `${record.id}: self bugs`);
            const repairs = BUG_SPEC_OPTIONS.filter(o => card.repairs.some(repair => repairsBugType(repair, o.id)))
                .map(o => category(o.id));
            assert.deepEqual([...new Set(repairs)].sort(), record.repairs, `${record.id}: repair targets`);
        }
    }
});

test("opening damage, continuous menu drain, and chip-slot loss remain distinct", () => {
    assert.equal(normalizeBugType("customDamage"), "customDamage");
    assert.equal(normalizeBugType("customHp"), "customHp");
    assert.equal(normalizeBugType("custom"), "custom");
    for (const [game, card, type] of [["bn6", "137-B005", "customDamage"], ["bn6", "137-B017", "customHp"],
        ["bn5", "136-B001", "customDamage"]]) {
        const analysis = analysisFor(game, [card]);
        const stats = computeBuildStats(game, [], [card]);
        const allowed = { ...allRules(), [type]: "required" };
        assert.ok(isSolutionAcceptable(analysis, { type: "custom" }, [], allowed));
        assert.ok(doesBuildSatisfyConstraints(stats, analysis, { bugRules: allowed }));
        for (const other of ["customDamage", "customHp", "custom"].filter(key => key !== type)) {
            const rules = { ...allRules(), [type]: "forbidden", [other]: "allowed_any" };
            assert.equal(isSolutionAcceptable(analysis, { type: "custom" }, [], rules), false);
            assert.equal(doesBuildSatisfyConstraints(stats, analysis, { bugRules: rules }), false);
        }
    }
    assert.deepEqual(getPartBugTypes("bn5", 2), ["customDamage"]);
});

test("each catalog card bug can independently be required or forbidden in final checks", () => {
    for (const game of ["bn4", "bn5", "bn6"]) for (const card of getModCards(game)) {
        const analysis = analysisFor(game, [card.id]);
        const stats = computeBuildStats(game, [], [card.id]);
        for (const bug of getEffectiveInBattleBugs(analysis)) {
            const key = normalizeBugType(bug.bugType);
            const required = { ...allRules(), [key]: "required" };
            const forbidden = { ...allRules(), [key]: "forbidden" };
            assert.ok(isSolutionAcceptable(analysis, { type: "custom" }, [], required), `${card.id}: require ${key}`);
            assert.ok(doesBuildSatisfyConstraints(stats, analysis, { bugRules: required }));
            assert.equal(isSolutionAcceptable(analysis, { type: "custom" }, [], forbidden), false, `${card.id}: forbid ${key}`);
            assert.equal(doesBuildSatisfyConstraints(stats, analysis, { bugRules: forbidden }), false);
        }
    }
});

test("targeted repairs never erase unrelated HP or on-hit bugs", () => {
    assert.equal(repairsBugType("Custom Damage Bug", "customDamage"), true);
    for (const type of ["customHp", "damageHp", "damageConfusion", "damageBlind"])
        assert.equal(repairsBugType("Custom Damage Bug", type), false);
    assert.equal(repairsBugType("Battle HP Bug", "damageHp"), false);
    assert.equal(repairsBugType("Status Bug", "damageConfusion"), false);
    const customRepair = computeDeckStats(["137-A027", "137-B025", "137-B005", "137-A019"], "bn6");
    assert.deepEqual(customRepair.activeBugs.map(entry => entry.bug.type).sort(), ["damageConfusion", "damageHp"]);
    const battleRepair = computeDeckStats(["137-A027", "137-A021", "137-A029"], "bn6");
    assert.deepEqual(battleRepair.activeBugs.map(entry => entry.bug.type).sort(), ["customDamage", "damageHp"]);
    const laterEntry = computeDeckStats(["137-A019", "137-B005"], "bn6");
    assert.ok(laterEntry.activeBugs.some(entry => entry.bug.type === "customDamage"));
});

test("later cards set the final same-type HP tier and repairs apply before a card's own replacement", () => {
    for (const [ids, expected] of [[["137-C002", "137-A021"], 1], [["137-A021", "137-C002"], 4]]) {
        const active = computeDeckStats(ids, "bn6").activeBugs.filter(entry => entry.bug.type === "battleHp");
        assert.equal(active.length, 1);
        assert.equal(active[0].bug.level, expected);
    }
    const topMan = computeDeckStats(["137-A036", "137-B043"], "bn6");
    const buster = topMan.activeBugs.filter(entry => entry.bug.type === "buster");
    assert.equal(buster.length, 1);
    assert.equal(buster[0].sourceCardId, "137-B043");
    assert.match(buster[0].bug.description.en, /1\/8/);
    assert.match(buster[0].bug.description.en, /blank shots are repaired/);
});

test("approved BWiki Custom HP tiers remain distinct from external level interpretations", () => {
    for (const [id, level] of [["137-A014", 3], ["137-A042", 3], ["137-B017", 3], ["137-B038", 1], ["137-C009", 3]]) {
        const bug = getModCard(id, "bn6").bugs.find(b => b.type === "customHp");
        assert.equal(bug.level, level);
        assert.ok(bug.name.en.includes(`LV${level}`));
    }
});

test("the actual search enforces separate entry-damage rules and preserves them in shared links", () => {
    const { games } = require("../games.ts");
    const { parseGameData } = require("../game-data.ts");
    const { emptyProblem, toHashString, fromHashString } = require("../problem.ts");
    const { searchBuilds } = require("../exhaustive-optimizer.ts");
    const { findFeasibleBuild } = require("../feasible-optimizer.ts");
    const data = parseGameData(require("../data/bn6.json"), games.find(game => game.id === "bn6"));
    data.parts = [];
    data.partMetas = [];
    const problem = emptyProblem(data);
    problem.modCards = ["137-B005"];
    for (const [rule, expected] of [["required", true], ["forbidden", false]]) {
        const constraints = { bugRules: { customHp: "allowed_any", customDamage: rule } };
        const options = { data, problem, constraints, modCardMode: "keep" };
        const first = findFeasibleBuild({ ...options, shouldStop: () => false });
        assert.equal(Boolean(first), expected);
        const result = searchBuilds(options);
        assert.ok(result.completed);
        assert.equal(Boolean(result.best), expected);
        const saved = { ...problem, constraints };
        assert.deepEqual(fromHashString(toHashString(saved, data), data).constraints.bugRules, constraints.bugRules);
    }
});

test("BugStop never hides the newly separated card bugs", () => {
    const metas = [{ id: 31, name: "BugStop", isSolid: true, color: 1 }];
    const cells = new Array(25).fill(null);
    cells[2 * 5 + 2] = 0;
    const cards = ["137-B005", "137-A027", "137-B025"];
    const analysis = analyzeSolutionBugs("bn6", metas, [{ partIndex: 0 }], cells, grid, "en", cards);
    assert.ok(analysis.bugStopActive);
    const effective = getEffectiveInBattleBugs(analysis);
    assert.deepEqual(effective.map(b => b.bugType).sort(), ["customDamage", "damageConfusion", "damageHp"]);
    assert.ok(effective.every(b => b.isModCardBug && b.sourceCardName && b.mechanics));
    assert.equal(isSolutionAcceptable(analysis, { type: "no_bugs" }), false);
});

test("automatic card search can require entry damage while forbidding continuous menu drain", () => {
    const { games } = require("../games.ts");
    const { parseGameData } = require("../game-data.ts");
    const { emptyProblem } = require("../problem.ts");
    const { searchBuilds } = require("../exhaustive-optimizer.ts");
    const data = parseGameData(require("../data/bn6.json"), games.find(game => game.id === "bn6"));
    data.parts = [];
    data.partMetas = [];
    let cancelled = false;
    const constraints = { bugRules: { customDamage: "required", customHp: "forbidden" } };
    const result = searchBuilds({ data, problem: emptyProblem(data), modCardMode: "auto", constraints,
        shouldStop: () => cancelled, onProgress: progress => { if (progress.best) cancelled = true; } });
    assert.ok(result.best);
    assert.ok(result.best.problem.modCards.length > 0);
    assert.ok(isSolutionAcceptable(result.best.analysis, { type: "custom" }, [], constraints.bugRules));
    assert.ok(result.best.analysis.activeBugs.some(bug => bug.bugType === "customDamage"));
    assert.ok(!result.best.analysis.activeBugs.some(bug => bug.bugType === "customHp"));
});

test("old BN5 Custom Damage rule keys migrate without changing BN6 chip-slot rules", () => {
    const { games } = require("../games.ts");
    const { parseGameData } = require("../game-data.ts");
    const { emptyProblem, toHashString, fromHashString } = require("../problem.ts");
    for (const game of ["bn5", "bn6"]) {
        const data = parseGameData(require(`../data/${game}.json`), games.find(g => g.id === game));
        const problem = { ...emptyProblem(data), bugPolicy: { type: "custom", customRules: { custom: "allowed_any" } },
            constraints: { bugRules: { custom: "required" }, forbiddenBugs: ["custom"] } };
        const restored = fromHashString(toHashString(problem, data), data);
        const key = game === "bn5" ? "customDamage" : "custom";
        assert.deepEqual(restored.bugPolicy.customRules, { [key]: "allowed_any" });
        assert.deepEqual(restored.constraints.bugRules, { [key]: "required" });
        assert.deepEqual(restored.constraints.forbiddenBugs, [key]);
        assert.deepEqual(fromHashString(toHashString(restored, data), data), restored);
    }
});

test("explicit new BN5 entry-damage rules take precedence over legacy aliases", () => {
    const { games } = require("../games.ts");
    const { parseGameData } = require("../game-data.ts");
    const { emptyProblem, toHashString, fromHashString } = require("../problem.ts");
    const data = parseGameData(require("../data/bn5.json"), games.find(g => g.id === "bn5"));
    const problem = { ...emptyProblem(data), constraints: { bugRules: { custom: "required", customDamage: "forbidden" } } };
    const restored = fromHashString(toHashString(problem, data), data);
    assert.deepEqual(restored.constraints.bugRules, { customDamage: "forbidden" });
});

test("BN3 and BN4 do not include emotion bug in catalog and map Humor and BugStop appropriately", () => {
    const bn3Options = BUG_SPEC_OPTIONS.filter(o => !o.games || o.games.includes("bn3"));
    assert.ok(!bn3Options.some(o => o.id === "emotion"));
    assert.ok(!bn3Options.some(o => o.id === "movement"));
    assert.ok(!bn3Options.some(o => o.id === "custom"));
    assert.ok(!bn3Options.some(o => o.id === "buster"));
    assert.ok(!bn3Options.some(o => o.id === "charge"));
    for (const pt of BN3_INVOLUNTARY_MOVE_BUG_TYPES) {
        assert.ok(bn3Options.some(o => o.id === pt));
    }
    for (const pt of BN3_CHARGE_BUG_TYPES) {
        assert.ok(bn3Options.some(o => o.id === pt));
    }
    for (const pt of BN3_BUSTER_BUG_TYPES) {
        assert.ok(bn3Options.some(o => o.id === pt));
    }
    assert.deepEqual(getPartBugTypes("bn3", 44), ["involuntaryMove"]);
    assert.deepEqual(getPartBugTypes("bn3", 45), ["involuntaryMove"]);

    const bn4Options = BUG_SPEC_OPTIONS.filter(o => !o.games || o.games.includes("bn4"));
    assert.ok(!bn4Options.some(o => o.id === "emotion"));
    assert.ok(!bn4Options.some(o => o.id === "movement"));
    assert.ok(!bn4Options.some(o => o.id === "custom"));
    for (const pt of BN4_PLAYER_BUG_TYPES) {
        assert.ok(bn4Options.some(o => o.id === pt));
    }
    assert.deepEqual(getPartBugTypes("bn4", 20), ["player"]);
    assert.deepEqual(getPartBugTypes("bn4", 24), ["player"]);
});

