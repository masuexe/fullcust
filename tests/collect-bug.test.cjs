require("./register.cjs");
const assert = require("node:assert/strict");
const { test } = require("node:test");
const { analyzeSolutionBugs, isSolutionAcceptable, getPartBugTypes } = require("../effects.ts");
const { getDefaultBugRules } = require("../panel-effects.ts");

test("BN5 Collect (19) and Millions (20) have resultZenny bug type", () => {
    assert.deepEqual(getPartBugTypes("bn5", 19), ["resultZenny"]);
    assert.deepEqual(getPartBugTypes("bn5", 20), ["resultZenny"]);
});

test("BN6 Collect (21) and Millions (22) have resultZenny bug type", () => {
    assert.deepEqual(getPartBugTypes("bn6", 21), ["resultZenny"]);
    assert.deepEqual(getPartBugTypes("bn6", 22), ["resultZenny"]);
});

test("BN5 off-line Collect triggers resultZenny and defaults to allowed", () => {
    const grid = { width: 5, height: 5, commandLineRow: 2, hasOob: false };
    const metas = [{ id: 19, name: "Collect", isSolid: true, color: 2 }];
    const requirements = [{ partIndex: 0 }];
    const cells = new Array(25).fill(null);
    // Place Collect off the command line (e.g. on row 0)
    cells[0] = 0;
    const analysis = analyzeSolutionBugs("bn5", metas, requirements, cells, grid, "en");
    assert.ok(analysis.activeBugs.some(b => b.bugType === "resultZenny"));

    // Default bug rules for BN5 have resultZenny allowed
    const defaultRules = getDefaultBugRules("bn5");
    assert.equal(defaultRules.resultZenny, "allowed");
    assert.ok(isSolutionAcceptable(analysis, { type: "custom", customRules: defaultRules }));

    // Explicitly forbidding resultZenny rejects it
    assert.equal(isSolutionAcceptable(analysis, { type: "custom", customRules: { resultZenny: "forbidden" } }), false);

    // Requiring resultZenny accepts it
    assert.ok(isSolutionAcceptable(analysis, { type: "custom", customRules: { resultZenny: "required" } }));
});

test("BN6 off-line Collect triggers resultZenny and defaults to allowed", () => {
    const grid = { width: 7, height: 7, commandLineRow: 3, hasOob: true };
    const metas = [{ id: 21, name: "Collect", isSolid: true, color: 3 }];
    const requirements = [{ partIndex: 0 }];
    const cells = new Array(49).fill(null);
    // Place Collect off the command line in-bounds (e.g. row 1, col 1)
    cells[1 * 7 + 1] = 0;
    const analysis = analyzeSolutionBugs("bn6", metas, requirements, cells, grid, "en");
    assert.ok(analysis.activeBugs.some(b => b.bugType === "resultZenny"));

    // Default bug rules for BN6 have resultZenny allowed
    const defaultRules = getDefaultBugRules("bn6");
    assert.equal(defaultRules.resultZenny, "allowed");
    assert.ok(isSolutionAcceptable(analysis, { type: "custom", customRules: defaultRules }));

    // Explicitly forbidding resultZenny rejects it
    assert.equal(isSolutionAcceptable(analysis, { type: "custom", customRules: { resultZenny: "forbidden" } }), false);

    // Requiring resultZenny accepts it
    assert.ok(isSolutionAcceptable(analysis, { type: "custom", customRules: { resultZenny: "required" } }));
});
