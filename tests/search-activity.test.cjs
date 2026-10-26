require("./register.cjs");
const assert = require("node:assert/strict");
const { test } = require("node:test");
const { createSearchActivity } = require("../search-activity.ts");
const { solve } = require("../solver.ts");
const { from } = require("../array2d.ts");

test("search activity reports immediately on stage changes and throttles work updates", () => {
    let time = 100;
    const reports = [];
    const activity = createSearchActivity(value => reports.push(value), () => time);
    activity.setStage("feasible");
    assert.deepEqual(reports[0], { stage: "feasible", elapsedMs: 0, candidateChecks: 0, placementAttempts: 0 });
    for (let i = 0; i < 1000; i++) activity.onSearchWork("placement");
    activity.onSearchWork("candidate");
    assert.equal(reports.length, 1);
    time = 1100;
    activity.tick();
    assert.equal(reports.length, 2);
    assert.equal(reports[1].candidateChecks, 1);
    assert.equal(reports[1].placementAttempts, 1000);
    assert.equal(reports[1].elapsedMs, 1000);
    activity.setStage("exhaustive");
    assert.equal(reports.at(-1).stage, "exhaustive");
    assert.equal(reports.at(-1).placementAttempts, 1000);
    activity.onSearchWork("candidate");
    assert.equal(reports[1].candidateChecks, 1, "Published snapshots must not mutate");
});

test("placement instrumentation counts failed attempts without changing solver results", () => {
    const mask = from([true, false], 1, 2);
    const parts = [{ isSolid: false, color: 0, compressedMask: mask, uncompressedMask: mask }];
    const constraint = { compressed: true, onCommandLine: null, minBugLevel: 0, maxBugLevel: Infinity };
    const requirements = [{ partIndex: 0, constraint }, { partIndex: 0, constraint }];
    const grid = { height: 1, width: 2, commandLineRow: 0, hasOob: false };
    const expected = [...solve(parts, requirements, grid, [false], () => false, false)];
    let attempts = 0;
    const actual = [...solve(parts, requirements, grid, [false], () => false, false, () => attempts++)];
    assert.deepEqual(actual, expected);
    assert.ok(actual.length > 0);
    assert.ok(attempts > actual.length, "Includes individual and rejected placements, not just full layouts");
});
