require("./register.cjs");
const assert = require("node:assert/strict");
const { test } = require("node:test");
const { games } = require("../games.ts");
const { parseGameData } = require("../game-data.ts");
const { emptyProblem, toHashString, fromHashString } = require("../problem.ts");
const { BUG_SPEC_OPTIONS, computeBuildStats } = require("../effects.ts");
const { doesBuildSatisfyConstraints } = require("../optimizer.ts");
const { findFeasibleBuild } = require("../feasible-optimizer.ts");
const { searchBuilds } = require("../exhaustive-optimizer.ts");
const { improveBuildLocally } = require("../local-optimizer.ts");
const { getOptimizerMegaFolderValues, getOptimizerGigaFolderValues } = require("../optimizer-options.ts");
const { from } = require("../array2d.ts");

function options(constraints = {}) {
    const data = parseGameData(require("../data/bn6.json"), games.find(g => g.id === "bn6"));
    return {
        data,
        problem: emptyProblem(data),
        modCardMode: "auto",
        constraints: {
            ...constraints,
            bugRules: Object.fromEntries(BUG_SPEC_OPTIONS.map(b => [b.id, "allowed_any"])),
        },
    };
}

function tiny(opts, id, width) {
    const index = opts.data.partMetas.findIndex(meta => meta.id === id);
    opts.data.partMetas = [opts.data.partMetas[index]];
    opts.data.parts = [{
        ...opts.data.parts[index],
        compressedMask: from([true, ...new Array(width - 1).fill(false)], 1, width),
        uncompressedMask: from([true, ...new Array(width - 1).fill(false)], 1, width),
    }];
    opts.data.gridOptions = [{ label: "fixture", settings: { height: 1, width, commandLineRow: 0, hasOob: false } }];
    opts.problem.expansionMemories = 0;
}

test("Mega and Giga folder capacities start at 5 and 1 and include NC and card modifiers", () => {
    const analysis = { activeBugs: [] };
    const base = computeBuildStats("bn6", []);
    assert.equal(base.megaFolder, 5);
    assert.equal(base.gigaFolder, 1);

    // Part 4 is MegaFolder1, Part 5 is MegaFolder2, Part 6 is GigaFolder1.
    const mega1 = computeBuildStats("bn6", [4]);
    assert.equal(mega1.megaFolder, 6);
    assert.equal(mega1.gigaFolder, 1);

    const mega2 = computeBuildStats("bn6", [5]);
    assert.equal(mega2.megaFolder, 7);

    const bothMega = computeBuildStats("bn6", [4, 5]);
    assert.equal(bothMega.megaFolder, 8);

    const giga1 = computeBuildStats("bn6", [6]);
    assert.equal(giga1.megaFolder, 5);
    assert.equal(giga1.gigaFolder, 2);

    // Card 137-A014 (Number) gives MegaFolder +1, GigaFolder +1
    const cardBoost = computeBuildStats("bn6", [], ["137-A014"]);
    assert.equal(cardBoost.megaFolder, 6);
    assert.equal(cardBoost.gigaFolder, 2);

    // Card 136-D001-G (BassCross Gregar) gives MegaFolder -2
    const bassCross = computeBuildStats("bn6", [], ["136-D001-G"]);
    assert.equal(bassCross.megaFolder, 3);
    assert.equal(doesBuildSatisfyConstraints(bassCross, analysis, { minMegaFolder: 5 }), false);

    // BassCross + MegaFolder2 (3 + 2 = 5) satisfies minMegaFolder: 5
    const compensated = computeBuildStats("bn6", [5], ["136-D001-G"]);
    assert.equal(compensated.megaFolder, 5);
    assert.ok(doesBuildSatisfyConstraints(compensated, analysis, { minMegaFolder: 5 }));
});

test("NC-only minimum Mega and Giga folder capacities can be reached incrementally", () => {
    const opts = options({ minMegaFolder: 7, minGigaFolder: 2 });
    opts.modCardMode = "none";
    const first = findFeasibleBuild({ ...opts, shouldStop: () => false });
    assert.ok(first);
    assert.ok(first.stats.megaFolder >= 7);
    assert.ok(first.stats.gigaFolder >= 2);
    assert.ok(doesBuildSatisfyConstraints(first.stats, first.analysis, opts.constraints));
});

test("a minimum MegaFolder of 5 requires compensation for a fixed negative card", () => {
    const opts = options({ minMegaFolder: 5 });
    opts.modCardMode = "keep";
    opts.problem.modCards = ["136-D001-G"]; // BassCross gives -2 MegaFolder
    tiny(opts, 5, 1); // Only MegaFolder2 (+2) is available
    const first = findFeasibleBuild({ ...opts, shouldStop: () => false });
    assert.ok(first);
    assert.equal(first.stats.megaFolder, 5);
    assert.equal(first.problem.requirements.length, 1);

    const exact = searchBuilds(opts);
    assert.equal(exact.completed, true);
    assert.equal(exact.best.stats.megaFolder, 5);
});

test("exhaustive search proves impossibility when MegaFolder exceeds achievable limits", () => {
    const opts = options({ minMegaFolder: 9 });
    opts.modCardMode = "none";
    tiny(opts, 4, 3); // Only MegaFolder1 is available on a 1x3 grid (max 5 + 3 = 8).
    const impossible = searchBuilds(opts);
    assert.equal(impossible.completed, true);
    assert.equal(impossible.best, null);
});

test("local improvements retain the selected minimum Mega and Giga counts", () => {
    const opts = options({ minMegaFolder: 7, minGigaFolder: 2 });
    const first = findFeasibleBuild({ ...opts, shouldStop: () => false });
    assert.ok(first);
    const deadline = Date.now() + 300;
    let changes = 0;
    const best = improveBuildLocally({
        ...opts,
        initialBest: first,
        shouldStop: () => Date.now() >= deadline,
        onImprove: result => {
            assert.ok(result.stats.megaFolder >= 7);
            assert.ok(result.stats.gigaFolder >= 2);
            assert.ok(doesBuildSatisfyConstraints(result.stats, result.analysis, opts.constraints));
            changes++;
        },
    });
    assert.ok(changes > 0);
    assert.ok(best.stats.megaFolder >= 7);
    assert.ok(best.stats.gigaFolder >= 2);
});

test("minimum Mega and Giga folder constraints round-trip in shared links and validate ranges", () => {
    const opts = options();
    for (const minMegaFolder of [3, 5, 6, 7, 8, 9, 10]) {
        for (const minGigaFolder of [1, 2, 3]) {
            const problem = { ...opts.problem, constraints: { minMegaFolder, minGigaFolder } };
            const saved = toHashString(problem, opts.data);
            assert.deepEqual(fromHashString(saved, opts.data).constraints, problem.constraints);
        }
    }
    // Validation: out-of-range values should throw
    const saved = toHashString({ ...opts.problem, constraints: { minMegaFolder: 6, minGigaFolder: 2 } }, opts.data);
    for (const invalid of [-1, 11, 6.5, "6"]) {
        const malformed = JSON.parse(saved);
        malformed.bc.mf = invalid;
        assert.throws(() => fromHashString(JSON.stringify(malformed), opts.data));
    }
    for (const invalid of [-1, 11, 2.5, "2"]) {
        const malformed = JSON.parse(saved);
        malformed.bc.gf = invalid;
        assert.throws(() => fromHashString(JSON.stringify(malformed), opts.data));
    }
    const restored = fromHashString(toHashString(opts.problem, opts.data), opts.data);
    assert.equal(restored.constraints?.minMegaFolder, undefined);
    assert.equal(restored.constraints?.minGigaFolder, undefined);
});

test("option helpers return expected values per game and card configuration", () => {
    assert.deepEqual(getOptimizerMegaFolderValues("bn6", false), [6, 7, 8]);
    assert.deepEqual(getOptimizerMegaFolderValues("bn6", true), [3, 4, 5, 6, 7, 8, 9, 10]);
    assert.deepEqual(getOptimizerMegaFolderValues("bn4", true), [5, 6, 7, 8, 9, 10]);
    assert.deepEqual(getOptimizerMegaFolderValues("bn3", false), [6, 7, 8]);

    assert.deepEqual(getOptimizerGigaFolderValues("bn6", false), [2]);
    assert.deepEqual(getOptimizerGigaFolderValues("bn6", true), [2, 3, 4]);
    assert.deepEqual(getOptimizerGigaFolderValues("bn4", true), [2, 3]);
    assert.deepEqual(getOptimizerGigaFolderValues("bn3", false), [2]);
});
