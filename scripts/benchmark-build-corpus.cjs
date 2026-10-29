// A local measurement of seed lookup and the independent first-solution pass.
// Usage: node scripts/benchmark-build-corpus.cjs [gameId]
require("../tests/register.cjs");
const { performance } = require("node:perf_hooks");
const { parseGameData } = require("../game-data.ts");
const { games } = require("../games.ts");
const { emptyProblem } = require("../problem.ts");
const { BUG_SPEC_OPTIONS } = require("../effects.ts");
const { findKnownBuild, getBuildSeeds } = require("../build-corpus.ts");
const { findFeasibleBuild } = require("../feasible-optimizer.ts");

const gameId = process.argv[2] || "bn6";
const game = games.find(entry => entry.id === gameId);
if (!game) throw new Error(`Unknown game: ${gameId}`);
const data = parseGameData(require(`../data/${gameId}.json`), game);
const bugRules = Object.fromEntries(BUG_SPEC_OPTIONS.map(o => [o.id, "allowed_any"]));
const options = { data, problem: emptyProblem(data), modCardMode: "auto", constraints: { bugRules } };

let first = null, start = performance.now();
const known = findKnownBuild({ ...options, onImprove: () => { first ??= performance.now() - start; } });
const lookupMs = performance.now() - start;
start = performance.now();
const deadline = Date.now() + 1000;
const feasible = findFeasibleBuild({ ...options, shouldStop: () => Date.now() >= deadline });
console.log(JSON.stringify({
    gameId, seeds: getBuildSeeds(gameId).length,
    libraryFirstMs: first, libraryLookupMs: lookupMs, libraryHp: known?.stats.finalHp ?? null,
    independentFirstPassMs: performance.now() - start, independentHp: feasible?.stats.finalHp ?? null,
}));
