require("./register.cjs");
const assert = require("node:assert/strict");
const { test } = require("node:test");
const { games } = require("../games.ts");
const { parseGameData } = require("../game-data.ts");
const { emptyProblem, toHashString, fromHashString } = require("../problem.ts");
const { BUG_SPEC_OPTIONS, computeBuildStats } = require("../effects.ts");
const {
    doesBuildSatisfyConstraints,
    optimizeBuild,
    optimizeModCards,
    soulTimeMinimumPossible,
} = require("../optimizer.ts");
const { findFeasibleBuild } = require("../feasible-optimizer.ts");
const { searchBuilds } = require("../exhaustive-optimizer.ts");
const { improveBuildLocally } = require("../local-optimizer.ts");
const { findKnownBuild } = require("../build-corpus.ts");

function options(minSoulTime, gameId = "bn5") {
    const data = parseGameData(require(`../data/${gameId}.json`), games.find(g => g.id === gameId));
    return {
        data,
        problem: emptyProblem(data),
        modCardMode: "auto",
        constraints: {
            minSoulTime,
            bugRules: Object.fromEntries(BUG_SPEC_OPTIONS.map(b => [b.id, "allowed_any"])),
        },
    };
}

function restrictToSoulTimePart(opts) {
    const index = opts.data.partMetas.findIndex(meta => meta.id === 38);
    assert.ok(index >= 0, "Expected BN5 SoulT+1 part (id 38)");
    opts.data.partMetas = [opts.data.partMetas[index]];
    opts.data.parts = [opts.data.parts[index]];
    opts.data.partIds = [opts.data.partIds[index]];
}

test("BN5 Soul Time starts at three, adds SoulT+1 and card modifiers, and leaves other games undefined", () => {
    const analysis = { activeBugs: [] };
    assert.equal(computeBuildStats("bn5", []).soulTime, 3);
    assert.equal(computeBuildStats("bn5", [38]).soulTime, 4);
    assert.equal(computeBuildStats("bn5", [38, 38, 38, 38]).soulTime, 7);
    assert.equal(computeBuildStats("bn5", [], ["136-B035"]).soulTime, 5); // SnakeMan +2
    assert.equal(computeBuildStats("bn5", [], ["136-B043"]).soulTime, 2); // PlantMan -1
    assert.equal(computeBuildStats("bn5", [], ["136-A040"]).soulTime, 2); // BurnerMan -1
    assert.equal(computeBuildStats("bn5", [], ["136-A034"]).soulTime, 1); // MetalMan -2
    assert.equal(computeBuildStats("bn5", [38, 38], ["136-A034"]).soulTime, 3);
    assert.equal(computeBuildStats("bn5", [38, 38, 38, 38], ["136-B035"]).soulTime, 9);

    for (const otherGame of ["bn6", "bn4", "bn3"]) {
        const stats = computeBuildStats(otherGame, []);
        assert.equal(stats.soulTime, undefined);
        assert.equal(doesBuildSatisfyConstraints(stats, analysis, { minSoulTime: 9 }, otherGame), true);
    }

    const three = computeBuildStats("bn5", []);
    assert.equal(doesBuildSatisfyConstraints(three, analysis, { minSoulTime: 3 }, "bn5"), true);
    assert.equal(doesBuildSatisfyConstraints(three, analysis, { minSoulTime: 4 }, "bn5"), false);
    const nine = computeBuildStats("bn5", [38, 38, 38, 38], ["136-B035"]);
    assert.equal(doesBuildSatisfyConstraints(nine, analysis, { minSoulTime: 9 }, "bn5"), true);
});

test("pure NC reaches BN5 minSoulTime up to 7 on 5x5 and immediately reports 8 impossible", () => {
    const opts = options(7);
    opts.modCardMode = "none";
    const first = findFeasibleBuild({ ...opts, shouldStop: () => false });
    assert.ok(first, "findFeasibleBuild should reach 7 turns with 4 SoulT+1 parts");
    assert.equal(first.stats.soulTime, 7);
    assert.equal(first.addedPartIndices.length, 4);
    assert.ok(doesBuildSatisfyConstraints(first.stats, first.analysis, opts.constraints, "bn5"));

    const restricted = options(7);
    restricted.modCardMode = "none";
    restrictToSoulTimePart(restricted);
    const exact = searchBuilds(restricted);
    assert.equal(exact.completed, true);
    assert.ok(exact.best);
    assert.equal(exact.best.stats.soulTime, 7);
    assert.equal(exact.best.addedPartIndices.length, 4);

    opts.constraints.minSoulTime = 8;
    assert.equal(soulTimeMinimumPossible(opts), false);
    assert.equal(findFeasibleBuild({ ...opts, shouldStop: () => false }), null);
    assert.equal(optimizeBuild(opts), null);
    const impossible = searchBuilds(opts);
    assert.equal(impossible.completed, true);
    assert.equal(impossible.best, null);
    assert.equal(impossible.checkedBuilds, 0);
});

test("fixed negative soulTime cards require NC SoulT+1 compensation", () => {
    const metalOpts = options(3);
    metalOpts.modCardMode = "keep";
    metalOpts.problem.modCards = ["136-A034"]; // MetalMan -2 (base becomes 1).
    assert.equal(soulTimeMinimumPossible(metalOpts), true);
    const metalFeasible = findFeasibleBuild({ ...metalOpts, shouldStop: () => false });
    assert.ok(metalFeasible);
    assert.equal(metalFeasible.stats.soulTime, 3);
    assert.equal(metalFeasible.addedPartIndices.length, 2);

    restrictToSoulTimePart(metalOpts);
    const metalExact = searchBuilds(metalOpts);
    assert.equal(metalExact.completed, true);
    assert.ok(metalExact.best);
    assert.equal(metalExact.best.stats.soulTime, 3);
    assert.equal(metalExact.best.addedPartIndices.length, 2);

    const plantOpts = options(3);
    plantOpts.modCardMode = "keep";
    plantOpts.problem.modCards = ["136-B043"]; // PlantMan -1 (base becomes 2).
    const plantFeasible = findFeasibleBuild({ ...plantOpts, shouldStop: () => false });
    assert.ok(plantFeasible);
    assert.equal(plantFeasible.stats.soulTime, 3);
    assert.equal(plantFeasible.addedPartIndices.length, 1);

    restrictToSoulTimePart(plantOpts);
    const plantExact = searchBuilds(plantOpts);
    assert.equal(plantExact.completed, true);
    assert.ok(plantExact.best);
    assert.equal(plantExact.best.stats.soulTime, 3);
    assert.equal(plantExact.best.addedPartIndices.length, 1);

    // Fixed MetalMan (-2) caps reachable soulTime at 3 + 4 - 2 = 5.
    metalOpts.constraints.minSoulTime = 6;
    assert.equal(soulTimeMinimumPossible(metalOpts), false);
    const metalImpossible = searchBuilds(metalOpts);
    assert.equal(metalImpossible.completed, true);
    assert.equal(metalImpossible.best, null);
    assert.equal(metalImpossible.checkedBuilds, 0);
});

test("card + NC synergy reaches minSoulTime 8 and 9 and hits 7-turn BN5 corpus seeds", () => {
    for (const targetSoulTime of [8, 9]) {
        const cards = optimizeModCards({
            gameId: "bn5",
            constraints: { minSoulTime: targetSoulTime },
        });
        assert.ok(cards.includes("136-B035"), `optimizeModCards must lock SnakeMan for minSoulTime ${targetSoulTime}`);

        const opts = options(targetSoulTime);
        assert.equal(soulTimeMinimumPossible(opts), true);
        const feasible = findFeasibleBuild({ ...opts, shouldStop: () => false });
        assert.ok(feasible, `findFeasibleBuild should satisfy minSoulTime ${targetSoulTime}`);
        assert.ok(feasible.stats.soulTime >= targetSoulTime);
        assert.ok((feasible.problem.modCards ?? []).includes("136-B035"));
        const soulParts = feasible.problem.requirements.filter(
            r => opts.data.partMetas[r.partIndex].id === 38
        ).length;
        assert.equal(soulParts, targetSoulTime - 5);
        assert.ok(doesBuildSatisfyConstraints(feasible.stats, feasible.analysis, opts.constraints, "bn5"));
    }

    // optimizeModCards avoids negative soulTime cards when minSoulTime: 7 makes them unreachable.
    const cards7 = optimizeModCards({ gameId: "bn5", constraints: { minSoulTime: 7 } });
    for (const negId of ["136-A034", "136-A040", "136-B043"]) {
        assert.ok(!cards7.includes(negId), `optimizeModCards should avoid ${negId} for minSoulTime 7`);
    }

    // Exhaustive search with keep SnakeMan (+2) reaches 9 with 4 SoulT+1 parts.
    const snakeKeep = options(9);
    snakeKeep.modCardMode = "keep";
    snakeKeep.problem.modCards = ["136-B035"];
    restrictToSoulTimePart(snakeKeep);
    const exactNine = searchBuilds(snakeKeep);
    assert.equal(exactNine.completed, true);
    assert.ok(exactNine.best);
    assert.equal(exactNine.best.stats.soulTime, 9);
    assert.equal(exactNine.best.addedPartIndices.length, 4);

    // Impossible even with auto cards for 10.
    const tenOpts = options(10);
    assert.equal(soulTimeMinimumPossible(tenOpts), false);
    assert.equal(findFeasibleBuild({ ...tenOpts, shouldStop: () => false }), null);

    // Corpus warm-start finds existing 7-turn BN5 seeds.
    const corpusOpts = options(7);
    const seed = findKnownBuild(corpusOpts);
    assert.ok(seed, "findKnownBuild should find an existing 7-turn BN5 seed");
    assert.ok(seed.stats.soulTime >= 7);
    assert.ok(doesBuildSatisfyConstraints(seed.stats, seed.analysis, corpusOpts.constraints, "bn5"));
});

test("improveBuildLocally preserves minSoulTime across card and NC improvements", () => {
    const opts = options(7);
    const first = findFeasibleBuild({ ...opts, shouldStop: () => false });
    assert.ok(first);
    const deadline = Date.now() + 400;
    let changes = 0;
    const best = improveBuildLocally({
        ...opts,
        initialBest: first,
        shouldStop: () => Date.now() >= deadline,
        onImprove: result => {
            assert.ok((result.stats.soulTime ?? 0) >= 7);
            assert.ok(doesBuildSatisfyConstraints(result.stats, result.analysis, opts.constraints, "bn5"));
            changes++;
        },
    });
    assert.ok(changes > 0);
    assert.ok((best.stats.soulTime ?? 0) >= 7);
    assert.ok(doesBuildSatisfyConstraints(best.stats, best.analysis, opts.constraints, "bn5"));
});

test("minSoulTime round-trips in shared links via bc.st and rejects invalid values", () => {
    const opts = options(7);
    for (const minSoulTime of [2, 3, 4, 5, 6, 7, 8, 9]) {
        const problem = { ...opts.problem, constraints: { minSoulTime } };
        const saved = toHashString(problem, opts.data);
        assert.deepEqual(fromHashString(saved, opts.data).constraints, problem.constraints);
        if (minSoulTime === 7) {
            for (const invalid of [0, 1, 10, 4.5, "5"]) {
                const malformed = JSON.parse(saved);
                malformed.bc.st = invalid;
                assert.throws(() => fromHashString(JSON.stringify(malformed), opts.data));
            }
        }
    }
    const restored = fromHashString(toHashString(opts.problem, opts.data), opts.data);
    assert.equal(restored.constraints?.minSoulTime, undefined);
});
