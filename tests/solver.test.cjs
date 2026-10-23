const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const { test } = require("node:test");
const { games } = require("../games.ts");
const { parseGameData } = require("../game-data.ts");
const { emptyProblem, makeGridSettings, fromHashString, toHashString } = require("../problem.ts");
const { solve } = require("../solver.ts");
const { solverCases } = require("./solver-cases.cjs");
const baseline = require("./solver-baseline.json");

// Baseline generated with the original data conversion and grid expansion logic.
// Compare every solution, not just the first result or a successful solve.
for (const game of games) {
    const data = parseGameData(require(`../data/${game.id}.json`), game);
    for (const fixture of solverCases(data)) {
        const name = `${game.id}/${fixture.name}`;
        test(`${name}: layouts match the pre-refactor baseline`, () => {
            const problem = {
                ...emptyProblem(data),
                requirements: fixture.requirements,
                expansionMemories: fixture.expansion,
                spinnableColors: data.colors.map(() => fixture.spin),
            };
            const restored = fromHashString(toHashString(problem, data), data);
            const solutions = [...solve(data.parts, restored.requirements, makeGridSettings(data, restored), restored.spinnableColors)];
            assert.deepEqual({
                count: solutions.length,
                sha256: createHash("sha256").update(JSON.stringify(solutions)).digest("hex"),
            }, baseline[name]);
        });
    }
}
