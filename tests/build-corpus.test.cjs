require("./register.cjs");
const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { games } = require("../games.ts");
const { parseGameData } = require("../game-data.ts");
const { emptyProblem, makeGridSettings } = require("../problem.ts");
const { BN6_BUILD_SEEDS, findKnownBuild } = require("../build-corpus.ts");
const { readBn6Save } = require("../save-importer.ts");
const { buildGbaSave, SAVE_EDITIONS, applySaveMask, computeRawChecksum } = require("../save-exporter.ts");
const { buildDataToProblem } = require("../build-data.ts");
const { computeDeckStats } = require("../modcards.ts");
const { BUG_SPEC_OPTIONS, computePlacedBuildStats, isSolutionAcceptable } = require("../effects.ts");
const { doesBuildSatisfyConstraints } = require("../optimizer.ts");
const { isSolutionGeometryValid, placeAll } = require("../solver.ts");
const fixture = require("./fixtures/bn6-gregar-jp-build.json");
const dataFor = () => parseGameData(require("../data/bn6.json"), games.find(g => g.id === "bn6"));
const allRules = () => Object.fromEntries(BUG_SPEC_OPTIONS.map(b => [b.id, "allowed_any"]));

for (const edition of SAVE_EDITIONS.filter(e => e.gameId === "bn6")) {
    test(`${edition.id}: battery save import preserves parts, real layout and ordered cards`, () => {
        const data = dataFor();
        const { problem, solution } = buildDataToProblem(fixture, data);
        const bytes = buildGbaSave({ edition, data, problem, solution,
            templateBytes: fs.readFileSync(path.join(__dirname, "../public", edition.rawPath)) });
        const before = Uint8Array.from(bytes);
        const decoded = readBn6Save(bytes, data);
        assert.deepEqual(bytes, before);
        assert.deepEqual(decoded.solution, solution);
        assert.deepEqual(decoded.problem.requirements.map(r => r.partIndex), problem.requirements.map(r => r.partIndex));
        assert.deepEqual(decoded.problem.modCards, problem.modCards);
        assert.equal(decoded.region, edition.romType);
        assert.equal(decoded.variant, edition.variant);
        assert.equal(readBn6Save(bytes.subarray(0, 0x8000), data).solution.length, solution.length);
        bytes[1000] ^= 1;
        assert.throws(() => readBn6Save(bytes, data), /checksum/);
    });
}

test("import validates geometry and discards cached or modified combat stats", () => {
    const data = dataFor(), edition = SAVE_EDITIONS.find(e => e.id === "bn6_gregar_jp");
    const { problem, solution } = buildDataToProblem(fixture, data);
    const original = buildGbaSave({ edition, data, problem, solution,
        templateBytes: fs.readFileSync(path.join(__dirname, "../public", edition.rawPath)) });
    const rewrite = mutate => {
        const bytes = Uint8Array.from(original), raw = bytes.subarray(0x100, 0x6810);
        applySaveMask(raw, 0x1064); mutate(raw);
        new DataView(raw.buffer, raw.byteOffset).setUint32(0x1c6c, (computeRawChecksum(raw, 0x1c6c) + 0x72) >>> 0, true);
        applySaveMask(raw, 0x1064);
        return bytes;
    };
    const cached = rewrite(raw => { new DataView(raw.buffer, raw.byteOffset).setUint16(0x478c + 0x3e, 2000, true); raw[0x478c + 0x01] = 9; });
    assert.equal(readBn6Save(cached, data).problem.baseHp, 1000);
    const clipped = rewrite(raw => { raw[0x4150 + 3] = 255; });
    assert.throws(() => readBn6Save(clipped, data), /valid stored grid/);
    assert.throws(() => readBn6Save(new Uint8Array(200), data), /Unsupported/);
});

test("importer appends to an existing corpus and adds no duplicates on reimport", () => {
    const data = dataFor(), edition = SAVE_EDITIONS.find(e => e.id === "bn6_gregar_jp");
    const { problem, solution } = buildDataToProblem(fixture, data);
    const bytes = buildGbaSave({ edition, data, problem, solution,
        templateBytes: fs.readFileSync(path.join(__dirname, "../public", edition.rawPath)) });
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "fullcust-corpus-import-"));
    try {
        fs.mkdirSync(path.join(directory, "bn6"));
        fs.writeFileSync(path.join(directory, "bn6", "sample.sav"), bytes);
        const output = path.join(directory, "seeds.json");
        const run = (...args) => JSON.parse(execFileSync(process.execPath,
            ["scripts/import-build-corpus.cjs", ...args],
            { cwd: path.join(__dirname, ".."), encoding: "utf8" }));
        const first = run(path.join(directory, "bn6"), output);
        assert.deepEqual([first.files, first.decoded, first.empty, first.existing, first.added, first.unique],
            [1, 1, 0, 0, 1, 1]);
        const second = run(path.join(directory, "bn6"), output, output);
        assert.deepEqual([second.files, second.decoded, second.existing, second.added, second.unique],
            [1, 1, 1, 0, 1]);
        assert.equal(JSON.parse(fs.readFileSync(output, "utf8")).length, 1);
    } finally {
        fs.rmSync(directory, { recursive: true, force: true });
    }
});

test("every corpus seed has known parts, valid geometry and a legal ordered card deck", () => {
    const data = dataFor();
    assert.equal(BN6_BUILD_SEEDS.length, 78);
    for (const seed of BN6_BUILD_SEEDS) {
        const requirements = seed.parts.map(([id, color]) => ({
            partIndex: data.partMetas.findIndex(m => m.id === id && data.colors[m.color] === color),
            constraint: { compressed: null, onCommandLine: null, minBugLevel: 0, maxBugLevel: Infinity },
        }));
        const solution = seed.parts.map(([, , x, y, rotation, compressed]) => ({ loc: { position: { x, y }, rotation }, compressed }));
        assert.ok(requirements.every(r => r.partIndex >= 0));
        assert.ok(isSolutionGeometryValid(data.parts, requirements, solution, data.gridSettings));
        assert.ok(!computeDeckStats(seed.cards, "bn6").isOverCapacity);
        assert.deepEqual(Object.keys(seed).sort(), ["cards", "parts"]);
    }
});

test("known builds satisfy current requirements and use the user's current base HP", () => {
    const data = dataFor(), problem = emptyProblem(data);
    problem.baseHp = 1500;
    const constraints = { requiredAbilities: ["superArmor", "airShoes", "underShirt"],
        minCustom: 8, minBusterStats: { attack: 9, charge: 5 }, bugRules: allRules() };
    const options = { data, problem, constraints, modCardMode: "auto" };
    const before = JSON.stringify(options), updates = [];
    const result = findKnownBuild({ ...options, onImprove: result => updates.push(result) });
    assert.ok(result);
    assert.ok(updates.length > 0);
    assert.equal(result.stats.baseHp, 1500);
    assert.ok(doesBuildSatisfyConstraints(result.stats, result.analysis, constraints));
    assert.ok(isSolutionAcceptable(result.analysis, { type: "custom" }, [], constraints.bugRules));
    assert.equal(JSON.stringify(options), before);
    const grid = makeGridSettings(data, result.problem);
    assert.deepEqual(result.stats, computePlacedBuildStats("bn6", data.partMetas, result.problem.requirements,
        placeAll(data.parts, result.problem.requirements, result.solution, grid), grid, result.problem.modCards, 1500));
});

test("known-build lookup preserves core constraints and card modes, and safely falls back on misses", () => {
    const data = dataFor(), problem = emptyProblem(data);
    const constraints = { bugRules: allRules() };
    const pure = findKnownBuild({ data, problem, constraints, modCardMode: "none" });
    assert.ok(pure);
    assert.deepEqual(pure.problem.modCards, []);
    problem.requirements = [pure.problem.requirements[0]];
    const matched = findKnownBuild({ data, problem, constraints, modCardMode: "none" });
    assert.ok(matched);
    assert.equal(matched.problem.requirements[0], problem.requirements[0]);
    problem.modCards = ["137-A001"];
    assert.equal(findKnownBuild({ data, problem, constraints, modCardMode: "keep" }), null);
    assert.equal(findKnownBuild({ data, problem, constraints: { requiredAbilities: ["notAnAbility"] }, modCardMode: "auto" }), null);
    assert.equal(findKnownBuild({ data, problem, constraints, modCardMode: "auto", shouldStop: () => true }), null);
});
