// Usage: node scripts/import-build-corpus-all.cjs <root-directory> [--write]
// Scan a folder tree for GBA battery saves, detect the game, validate the build,
// and append unique seeds to data/<game>-build-seeds.json.
require("../tests/register.cjs");
const fs = require("node:fs");
const path = require("node:path");
const { parseGameData } = require("../game-data.ts");
const { games } = require("../games.ts");
const { readBatterySave } = require("../save-importer.ts");

const args = process.argv.slice(2);
const root = args.find(a => !a.startsWith("--"));
const write = args.includes("--write");
if (!root) throw new Error("Expected a root directory");
if (!fs.existsSync(root)) throw new Error("Directory not found: " + root);

const GAME_IDS = ["bn6", "bn5", "bn4", "bn3"];
const DATA = {};
for (const id of GAME_IDS) DATA[id] = parseGameData(require(`../data/${id}.json`), games.find(g => g.id === id));

const SAVE_EXT = new Set([".sav", ".sa1", ".srm", ".bin", ".raw"]);
function walk(dir, acc) {
    for (const name of fs.readdirSync(dir)) {
        const p = path.join(dir, name);
        let st; try { st = fs.statSync(p); } catch { continue; }
        if (st.isDirectory()) walk(p, acc); else acc.push({ p, size: st.size });
    }
    return acc;
}
function canonicalize(seed) {
    return { parts: [...seed.parts].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))), cards: seed.cards ?? [] };
}
function loadCorpus(id) {
    const file = `data/${id}-build-seeds.json`;
    if (!fs.existsSync(file)) return { file, map: new Map() };
    const map = new Map();
    for (const value of JSON.parse(fs.readFileSync(file, "utf8"))) {
        const seed = canonicalize(value); map.set(JSON.stringify(seed), seed);
    }
    return { file, map };
}

const files = walk(root, []).filter(f => SAVE_EXT.has(path.extname(f.p).toLowerCase()));
const report = { root, scanned: files.length, byGame: {}, undetected: [], skippedSize: 0 };
const corpora = {};
for (const id of GAME_IDS) corpora[id] = { ...loadCorpus(id), detected: 0, empty: 0, rejected: {}, added: 0 };

for (const f of files) {
    if (f.size < 0x100) { report.skippedSize++; continue; }
    let bytes; try { bytes = fs.readFileSync(f.p); } catch (e) { continue; }
    let gameId = null, parsed = null, lastError = null;
    for (const id of GAME_IDS) {
        try { const r = readBatterySave(bytes, DATA[id]); gameId = id; parsed = r; break; }
        catch (e) { lastError = e.message; }
    }
    if (!gameId) { report.undetected.push({ rel: path.relative(root, f.p), reason: lastError }); continue; }
    const c = corpora[gameId]; c.detected++;
    const problem = parsed.problem;
    if (!problem.requirements.length && !(problem.modCards ?? []).length) { c.empty++; continue; }
    const parts = problem.requirements.map((req, i) => {
        const meta = DATA[gameId].partMetas[req.partIndex], p = parsed.solution[i];
        return [meta.id, DATA[gameId].colors[meta.color], p.loc.position.x, p.loc.position.y, p.loc.rotation, p.compressed];
    });
    const seed = canonicalize({ parts, cards: problem.modCards ?? [] });
    const key = JSON.stringify(seed);
    if (c.map.has(key)) { c.rejected.duplicate = (c.rejected.duplicate ?? 0) + 1; continue; }
    c.map.set(key, seed); c.added++;
}

for (const id of GAME_IDS) {
    const c = corpora[id];
    report.byGame[id] = { detected: c.detected, empty: c.empty, addedUnique: c.added, total: c.map.size, rejected: c.rejected };
    if (write) {
        const seeds = [...c.map.values()].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
        fs.writeFileSync(c.file, "[\n" + seeds.map(s => "  " + JSON.stringify(s)).join(",\n") + "\n]\n");
    }
}
report.undetectedByExt = {};
for (const u of report.undetected) { const e = path.extname(u.rel).toLowerCase() || "(none)"; report.undetectedByExt[e] = (report.undetectedByExt[e] ?? 0) + 1; }
console.log(JSON.stringify({ mode: write ? "write" : "dry-run", scanned: report.scanned, byGame: report.byGame, undetected: report.undetected.length, undetectedByExt: report.undetectedByExt }, null, 2));
console.log("undetected sample:");
for (const u of report.undetected.slice(0, 60)) console.log("  " + u.rel + " :: " + u.reason);
