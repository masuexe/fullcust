// A local measurement of seed lookup and the independent first-solution pass.
require("../tests/register.cjs");
const { performance } = require("node:perf_hooks");
const { parseGameData } = require("../game-data.ts");
const { games } = require("../games.ts");
const { emptyProblem } = require("../problem.ts");
const { BUG_SPEC_OPTIONS } = require("../effects.ts");
const { findKnownBuild } = require("../build-corpus.ts");
const { findFeasibleBuild } = require("../feasible-optimizer.ts");
const data = parseGameData(require("../data/bn6.json"), games.find(g => g.id === "bn6"));
const bugRules = Object.fromEntries(BUG_SPEC_OPTIONS.map(o => [o.id, "allowed_any"]));
const cases = [
    ["Armor/shoes/UnderShirt, Attack 9, Charge 5, Custom 8", { requiredAbilities: ["superArmor", "airShoes", "underShirt"], minBusterStats: { attack: 9, charge: 5 }, minCustom: 8 }],
    ["Armor/UnderShirt/StatusGuard, Attack/Charge 5, Custom 8", { requiredAbilities: ["superArmor", "underShirt", "statusGuard"], minBusterStats: { attack: 5, charge: 5 }, minCustom: 8 }],
    ["Reported DrillArm + ChipRecovery 30", { requiredAbilities: ["superArmor", "airShoes", "underShirt", "chipRecovery"], minChipRecovery: 30, requiredSpecialMove: "DrillArm", minBusterStats: { charge: 5 } }],
];
for (const [name, requirements] of cases) {
    const options = { data, problem: emptyProblem(data), modCardMode: "auto", constraints: { ...requirements, bugRules } };
    let first = null, start = performance.now();
    const known = findKnownBuild({ ...options, onImprove: () => { first ??= performance.now() - start; } });
    const lookupMs = performance.now() - start;
    start = performance.now();
    const deadline = Date.now() + 1000;
    const feasible = findFeasibleBuild({ ...options, shouldStop: () => Date.now() >= deadline });
    console.log(JSON.stringify({ name, libraryFirstMs: first, libraryLookupMs: lookupMs, libraryHp: known?.stats.finalHp ?? null,
        independentFirstPassMs: performance.now() - start, independentHp: feasible?.stats.finalHp ?? null }));
}
