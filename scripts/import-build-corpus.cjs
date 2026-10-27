// Usage: node scripts/import-build-corpus.cjs <extracted-directory> <output.json>
require("../tests/register.cjs");
const fs = require("node:fs");
const path = require("node:path");
const { parseGameData } = require("../game-data.ts");
const { games } = require("../games.ts");
const { readBn6Save } = require("../save-importer.ts");
const data = parseGameData(require("../data/bn6.json"), games.find(g => g.id === "bn6"));
const [input, output] = process.argv.slice(2);
if (!input || !output) throw new Error("Expected extracted directory and output JSON path");
const unique = new Map(), rejected = {}, totals = { files: 0, decoded: 0, empty: 0 };
for (const name of fs.readdirSync(input, { recursive: true }).filter(name => name.toLowerCase().endsWith(".sav")).sort()) {
    totals.files++;
    try {
        const { problem, solution } = readBn6Save(fs.readFileSync(path.join(input, name)), data);
        totals.decoded++;
        if (!problem.requirements.length && !problem.modCards.length) { totals.empty++; continue; }
        const parts = problem.requirements.map((req, i) => {
            const meta = data.partMetas[req.partIndex], p = solution[i];
            return [meta.id, data.colors[meta.color], p.loc.position.x, p.loc.position.y, p.loc.rotation, p.compressed];
        }).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
        const seed = { parts, cards: problem.modCards };
        unique.set(JSON.stringify(seed), seed);
    } catch (error) { rejected[error.message] = (rejected[error.message] ?? 0) + 1; }
}
// Keep only reconstructable parts/layouts and ordered card IDs. No save bytes,
// player data, filenames, or modified base HP are copied into the application.
fs.writeFileSync(output, "[\n" + [...unique.values()].map(seed => "  " + JSON.stringify(seed)).join(",\n") + "\n]\n");
console.log(JSON.stringify({ ...totals, unique: unique.size, rejected }, null, 2));
