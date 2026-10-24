require("./register.cjs");
const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");

const { games } = require("../games.ts");
const { parseGameData } = require("../game-data.ts");
const {
    SAVE_EDITIONS,
    buildGbaSave,
    computeRawChecksum,
    applySaveMask,
} = require("../save-exporter.ts");
const { buildDataToProblem, COMMUNITY_PRESETS } = require("../build-data.ts");
const { solve, placeAll } = require("../solver.ts");
const { emptyProblem, makeGridSettings } = require("../problem.ts");
const bn6RegressionBuild = require("./fixtures/bn6-gregar-jp-build.json");

function getGameData(gameId) {
    const raw = require(`../data/${gameId}.json`);
    const game = games.find(g => g.id === gameId);
    return parseGameData(raw, game);
}

// Decode independently of the exporter, just as a consumer of the .sav would.
function readBn6Save(sram) {
    assert.equal(sram.length, 0x10000);
    const raw = Uint8Array.from(sram.subarray(0x100, 0x6810));
    const view = new DataView(raw.buffer);
    const mask = view.getUint32(0x1064, true);
    for (let i = 0; i < raw.length; i++) raw[i] ^= mask & 0xff;
    view.setUint32(0x1064, mask, true);
    assert.equal(view.getUint32(0x1060, true), 0);
    const name = Buffer.from(raw.subarray(0x1c70, 0x1c84)).toString("ascii");
    assert.match(name, /^REXE6 [GF] 200(?:50924a JP|60110a US)$/);
    let checksum = name[6] === "G" ? 0x72 : 0x18;
    for (let i = 0; i < raw.length; i++) {
        if (i < 0x1c6c || i >= 0x1c70) checksum += raw[i];
    }
    assert.equal(view.getUint32(0x1c6c, true), checksum >>> 0);

    // Tango canonicalizes JP saves after decoding the header and checksum.
    const canonical = Uint8Array.from(raw);
    if (name.endsWith("JP")) {
        canonical.copyWithin(0x414c, 0x410c, 0x50fc);
        canonical.fill(0, 0x410c, 0x414c);
    }
    return { raw, canonical };
}

for (const edition of SAVE_EDITIONS.filter(e => e.gameId === "bn6")) {
    test(`${edition.id}: reported AntiDmg/FstBarr build survives Tango loading with active abilities`, () => {
        const data = getGameData("bn6");
        const { problem, solution } = buildDataToProblem(bn6RegressionBuild, data);
        const templateBytes = fs.readFileSync(path.join(__dirname, "../public", edition.rawPath));
        const originalTemplate = Buffer.from(templateBytes);
        const { raw, canonical } = readBn6Save(buildGbaSave({ edition, templateBytes, problem, solution, data }));
        assert.deepEqual(templateBytes, originalTemplate, "Export must not mutate the template");

        // Frozen ROM shapes and centered coordinates, independent of placeAll.
        const shapes = [
            { id: 40, col: 1, row: 1, cells: [[4, 2], [3, 3], [4, 3], [2, 4], [3, 4], [2, 5]] },
            { id: 28, col: 2, row: 3, cells: [[3, 2], [3, 3], [4, 3]] },
        ];
        const expectedGrid = new Uint8Array(49);
        for (const [slot, part] of shapes.entries()) {
            assert.deepEqual(Array.from(canonical.subarray(0x4190 + slot * 8, 0x4198 + slot * 8)),
                [part.id, 0, 0, part.col, part.row, 0, 1, 0]);
            for (const [x, y] of part.cells) {
                const col = part.col - 3 + x;
                const row = part.row - 3 + y;
                assert.ok(col >= 0 && col < 7 && row >= 0 && row < 7);
                assert.equal(expectedGrid[row * 7 + col], 0, "Parts must not overlap");
                expectedGrid[row * 7 + col] = slot + 1;
            }
        }
        assert.deepEqual(canonical.subarray(0x414c, 0x414c + 49), expectedGrid);
        assert.ok(canonical.subarray(0x41a0, 0x4190 + 25 * 8).every(b => b === 0));
        assert.deepEqual(Array.from(canonical.subarray(0x90, 0x96)), [6, 5, 0, 0, 0, 0]);

        const nativeStats = edition.romType === "JP" ? 0x478c : 0x47cc;
        for (const [buf, offset] of [[raw, nativeStats], [canonical, 0x47cc]]) {
            assert.equal(buf[offset + 0x06], 1, "First Barrier is active");
            assert.equal(buf[offset + 0x07], 0x3d, "AntiDamage is assigned to B+Left");
            assert.equal(buf[offset + 0x1b], 1, "MagTect grants FloatShoes");
            assert.equal(new DataView(buf.buffer).getUint16(offset + 0x42, true), 950, "MagTect applies HP -5%");
        }
        assert.equal(canonical[0x65f0], 1);
        assert.equal(canonical[0x6620], 15);
    });
}

test("BN6 real rotated solutions reproduce their grid when decoded from part records", () => {
    const data = getGameData("bn6");
    const problem = emptyProblem(data);
    problem.requirements = [1, 7, 10].map(id => ({
        partIndex: data.partMetas.findIndex(p => p.id === id),
        constraint: { compressed: null, onCommandLine: null, minBugLevel: 0, maxBugLevel: 1 },
    }));
    const solutions = solve(data.parts, problem.requirements, makeGridSettings(data, problem), problem.spinnableColors);
    let foundRotation = false;
    let foundUncompressed = false;
    for (let i = 0; i < 200 && !(foundRotation && foundUncompressed); i++) {
        const { value: solution, done } = solutions.next();
        assert.equal(done, false);
        foundRotation ||= solution.some(p => p.loc.rotation !== 0);
        foundUncompressed ||= solution.some(p => !p.compressed);
        const edition = SAVE_EDITIONS.find(e => e.id === "bn6_gregar_jp");
        const templateBytes = fs.readFileSync(path.join(__dirname, "../public", edition.rawPath));
        const { canonical } = readBn6Save(buildGbaSave({ edition, templateBytes, problem, solution, data }));
        const decoded = solution.map((_, slot) => {
            const offset = 0x4190 + slot * 8;
            return {
                loc: { position: { x: canonical[offset + 3] - 3, y: canonical[offset + 4] - 3 }, rotation: canonical[offset + 5] },
                compressed: canonical[offset + 6] !== 0,
            };
        });
        const grid = placeAll(data.parts, problem.requirements, decoded, data.gridSettings);
        assert.deepEqual(Array.from(canonical.subarray(0x414c, 0x414c + 49)), grid.map(v => v === null ? 0 : v + 1));
    }
    assert.ok(foundRotation && foundUncompressed, "Exercise rotated and uncompressed placements");
});

test("BN6 caches every NC ability without retaining template flags", () => {
    const data = getGameData("bn6");
    const edition = SAVE_EDITIONS.find(e => e.id === "bn6_gregar_jp");
    const template = fs.readFileSync(path.join(__dirname, "../public", edition.rawPath));
    const cases = [
        [11, 0x1b, 1], [12, 0x1c, 1], [13, 0x1d, 1], [14, 0x60, 1], [15, 0x61, 1],
        [16, 0x1e, 1], [17, 0x27, 2], [18, 0x27, 4], [19, 0x27, 8], [20, 0x27, 16],
        [21, 0x26, 2], [22, 0x33, 1], [23, 0x25, 1], [24, 0x5f, 1], [25, 0x35, 1],
        [26, 0x36, 1], [31, 0x1f, 1], [32, 0x0d, 1], [33, 0x0d, 2], [34, 0x0d, 4],
    ];
    for (const [id, offset, expected] of cases) {
        const problem = emptyProblem(data);
        problem.requirements = [{ partIndex: data.partMetas.findIndex(p => p.id === id),
            constraint: { compressed: true, onCommandLine: null, minBugLevel: 0, maxBugLevel: Infinity } }];
        const solution = solve(data.parts, problem.requirements, data.gridSettings, problem.spinnableColors).next().value;
        assert.ok(solution, `Part ${id} must have a real placement`);
        const templateBytes = Uint8Array.from(template);
        templateBytes[0x478c + offset] = 0xff;
        const { raw } = readBn6Save(buildGbaSave({ edition, templateBytes, problem, solution, data }));
        assert.equal(raw[0x478c + offset], expected, `Part ${id} must activate its cached ability`);
        const { raw: cleared } = readBn6Save(buildGbaSave({ edition, templateBytes, problem, data }));
        assert.equal(cleared[0x478c + offset], offset === 0x27 ? 0x1f : 0, `Absent part ${id} must clear its cached ability`);
    }
});

test("Save export rejects incomplete or overflowing NC solutions", () => {
    const data = getGameData("bn6");
    const edition = SAVE_EDITIONS.find(e => e.id === "bn6_gregar_jp");
    const templateBytes = fs.readFileSync(path.join(__dirname, "../public", edition.rawPath));
    const { problem, solution } = buildDataToProblem(bn6RegressionBuild, data);
    assert.throws(() => buildGbaSave({ edition, templateBytes, problem, solution: solution.slice(1), data }), /does not match/);
    const crowded = { ...problem, requirements: Array(26).fill(problem.requirements[0]) };
    assert.throws(() => buildGbaSave({ edition, templateBytes, problem: crowded, solution: Array(26).fill(solution[0]), data }), /at most 25/);
});

test("SAVE_EDITIONS contains presets for all 4 games", () => {
    assert.ok(SAVE_EDITIONS.length >= 14);
    for (const edition of SAVE_EDITIONS) {
        assert.ok(edition.id);
        assert.ok(edition.gameId);
        assert.ok(edition.rawPath);
        assert.ok(fs.existsSync(path.join(__dirname, "../public", edition.rawPath)), `Template ${edition.rawPath} must exist`);
    }
});

test("BN6 buildGbaSave produces valid 64KB SRAM with clean unmasking and checksum", () => {
    const edition = SAVE_EDITIONS.find(e => e.id === "bn6_gregar_jp");
    assert.ok(edition);
    const templateBytes = fs.readFileSync(path.join(__dirname, "../public", edition.rawPath));

    const gameData = getGameData("bn6");
    const preset = COMMUNITY_PRESETS.find(p => p.id === "preset_bn6_gregar_standard");
    const { problem } = buildDataToProblem(preset, gameData);

    // Dummy solution placing each part at a valid slot
    const dummySolution = problem.requirements.map((_, i) => ({
        loc: {
            position: { x: (i % 3) - 1, y: Math.floor(i / 3) - 1 },
            rotation: 0,
        },
        compressed: true,
    }));

    const sram = buildGbaSave({
        edition,
        templateBytes,
        problem,
        solution: dummySolution,
        data: gameData,
    });

    assert.equal(sram.length, 0x10000);

    // Unmask and verify
    const wramSlice = sram.subarray(0x0100, 0x0100 + templateBytes.length);
    applySaveMask(wramSlice, 0x1064);

    const storedCs = new DataView(wramSlice.buffer, wramSlice.byteOffset, wramSlice.byteLength).getUint32(0x1c6c, true);
    const computedCs = (computeRawChecksum(wramSlice, 0x1c6c) + 0x72) >>> 0;
    assert.equal(storedCs, computedCs, "Checksum must match computed");

    // Check Mod Cards count at 0x65f0
    assert.equal(wramSlice[0x65f0], problem.modCards.length);
    // Check Color Bar at 0x90 has colors
    assert.ok(wramSlice[0x90] > 0);

    // JP Grid is at 0x410c, parts at 0x4150, NaviStats at 0x478c
    assert.ok(wramSlice.subarray(0x410c, 0x410c + 49).some(b => b > 0), "JP Grid should be populated at 0x410c");
    assert.ok(wramSlice[0x4150] > 0, "JP Parts should be populated at 0x4150");
    assert.equal(wramSlice[0x478c + 0x23], 1, "JP SuperArmor should be enabled at 0x478c + 0x23");
    const effHp = new DataView(wramSlice.buffer, wramSlice.byteOffset, wramSlice.byteLength).getUint16(0x478c + 0x42, true);
    assert.ok(effHp >= 1000, "JP effective_max_hp must be set");

    // Simulate Tango loading JP save (shift 0x410c..0x50fc forward by 0x40 to canonicalize to US)
    const tangoCanonical = new Uint8Array(wramSlice);
    tangoCanonical.copyWithin(0x410c + 0x40, 0x410c, 0x50fc);
    tangoCanonical.fill(0, 0x410c, 0x410c + 0x40);

    assert.ok(tangoCanonical.subarray(0x414c, 0x414c + 49).some(b => b > 0), "Tango canonicalized grid at 0x414c must be populated");
    assert.ok(tangoCanonical[0x4190] > 0, "Tango canonicalized parts at 0x4190 must be populated");
    assert.equal(tangoCanonical[0x47cc + 0x23], 1, "Tango canonicalized SuperArmor at 0x47cc + 0x23 must be 1");
});

test("BN6 US buildGbaSave places grid and stats at US offsets", () => {
    const edition = SAVE_EDITIONS.find(e => e.id === "bn6_gregar_us");
    assert.ok(edition);
    const templateBytes = fs.readFileSync(path.join(__dirname, "../public", edition.rawPath));

    const gameData = getGameData("bn6");
    const preset = COMMUNITY_PRESETS.find(p => p.id === "preset_bn6_gregar_standard");
    const { problem } = buildDataToProblem(preset, gameData);

    const dummySolution = problem.requirements.map((_, i) => ({
        loc: {
            position: { x: (i % 3) - 1, y: Math.floor(i / 3) - 1 },
            rotation: 0,
        },
        compressed: true,
    }));

    const sram = buildGbaSave({
        edition,
        templateBytes,
        problem,
        solution: dummySolution,
        data: gameData,
    });

    assert.equal(sram.length, 0x10000);

    const wramSlice = sram.subarray(0x0100, 0x0100 + templateBytes.length);
    applySaveMask(wramSlice, 0x1064);

    const storedCs = new DataView(wramSlice.buffer, wramSlice.byteOffset, wramSlice.byteLength).getUint32(0x1c6c, true);
    const computedCs = (computeRawChecksum(wramSlice, 0x1c6c) + 0x72) >>> 0;
    assert.equal(storedCs, computedCs, "Checksum must match computed");

    // US Grid is at 0x414c, parts at 0x4190, NaviStats at 0x47cc
    assert.ok(wramSlice.subarray(0x414c, 0x414c + 49).some(b => b > 0), "US Grid should be populated at 0x414c");
    assert.ok(wramSlice[0x4190] > 0, "US Parts should be populated at 0x4190");
    assert.equal(wramSlice[0x47cc + 0x23], 1, "US SuperArmor should be enabled at 0x47cc + 0x23");
    const effHp = new DataView(wramSlice.buffer, wramSlice.byteOffset, wramSlice.byteLength).getUint16(0x47cc + 0x42, true);
    assert.ok(effHp >= 1000, "US effective_max_hp must be set");
});

test("BN5 buildGbaSave produces valid 64KB SRAM with clean unmasking and checksum", () => {
    const edition = SAVE_EDITIONS.find(e => e.id === "bn5_protoman_us");
    assert.ok(edition);
    const templateBytes = fs.readFileSync(path.join(__dirname, "../public", edition.rawPath));

    const gameData = getGameData("bn5");
    const preset = COMMUNITY_PRESETS.find(p => p.id === "preset_bn5_protoman_standard");
    const { problem } = buildDataToProblem(preset, gameData);

    const dummySolution = problem.requirements.map((_, i) => ({
        loc: {
            position: { x: (i % 3) - 1, y: Math.floor(i / 3) - 1 },
            rotation: 0,
        },
        compressed: true,
    }));

    const sram = buildGbaSave({
        edition,
        templateBytes,
        problem,
        solution: dummySolution,
        data: gameData,
    });

    assert.equal(sram.length, 0x10000);

    const wramSlice = sram.subarray(0x0100, 0x0100 + templateBytes.length);
    applySaveMask(wramSlice, 0x1a34);

    const storedCs = new DataView(wramSlice.buffer, wramSlice.byteOffset, wramSlice.byteLength).getUint32(0x29dc, true);
    const computedCs = (computeRawChecksum(wramSlice, 0x29dc) + 0x72) >>> 0;
    assert.equal(storedCs, computedCs, "Checksum must match computed");

    // Check Mod Cards count at 0x79a0
    assert.equal(wramSlice[0x79a0], problem.modCards.length);

    // Check BN5 effective max HP at 0x52e6 + 0x04
    const effHp = new DataView(wramSlice.buffer, wramSlice.byteOffset, wramSlice.byteLength).getUint16(0x52e6 + 0x04, true);
    assert.ok(effHp >= 1000, "BN5 effective_max_hp must be at least 1000");
});

test("BN4 buildGbaSave produces valid 64KB SRAM with clean unmasking and checksum", () => {
    const edition = SAVE_EDITIONS.find(e => e.id === "bn4_redsun_us");
    assert.ok(edition);
    const templateBytes = fs.readFileSync(path.join(__dirname, "../public", edition.rawPath));

    const gameData = getGameData("bn4");
    const preset = COMMUNITY_PRESETS.find(p => p.id === "preset_bn4_redsun_custom");
    const { problem } = buildDataToProblem(preset, gameData);

    const dummySolution = problem.requirements.map((_, i) => ({
        loc: {
            position: { x: (i % 3) - 1, y: Math.floor(i / 3) - 1 },
            rotation: 0,
        },
        compressed: true,
    }));

    const sram = buildGbaSave({
        edition,
        templateBytes,
        problem,
        solution: dummySolution,
        data: gameData,
    });

    assert.equal(sram.length, 0x10000);

    const wramSlice = sram.subarray(0x0100, 0x0100 + templateBytes.length);
    applySaveMask(wramSlice, 0x1554);

    const storedCs = new DataView(wramSlice.buffer, wramSlice.byteOffset, wramSlice.byteLength).getUint32(0x21e8, true);
    const computedCs = (computeRawChecksum(wramSlice, 0x21e8) + 0x16) >>> 0;
    assert.equal(storedCs, computedCs, "Checksum must match computed");

    // Check BN4 patch card slots at 0x464c
    assert.notEqual(wramSlice[0x464c], 0xff, "Slot 0A should be equipped");

    // Check BN4 effective max HP at 0x21ca
    const effHp = new DataView(wramSlice.buffer, wramSlice.byteOffset, wramSlice.byteLength).getUint16(0x21ca, true);
    assert.ok(effHp >= 1000, "BN4 effective_max_hp at 0x21ca must be at least 1000");
});

test("BN3 buildGbaSave produces valid 64KB SRAM with checksum", () => {
    const edition = SAVE_EDITIONS.find(e => e.id === "bn3_white");
    assert.ok(edition);
    const templateBytes = fs.readFileSync(path.join(__dirname, "../public", edition.rawPath));

    const gameData = getGameData("bn3");
    const preset = COMMUNITY_PRESETS.find(p => p.id === "preset_bn3_custom_style");
    const { problem } = buildDataToProblem(preset, gameData);

    const dummySolution = problem.requirements.map((_, i) => ({
        loc: {
            position: { x: (i % 3) - 1, y: Math.floor(i / 3) - 1 },
            rotation: 0,
        },
        compressed: true,
    }));

    const sram = buildGbaSave({
        edition,
        templateBytes,
        problem,
        solution: dummySolution,
        data: gameData,
    });

    assert.equal(sram.length, 0x10000);

    const storedCs = new DataView(sram.buffer, sram.byteOffset, sram.byteLength).getUint32(0x1dd8, true);
    const computedCs = (computeRawChecksum(sram.subarray(0, templateBytes.length), 0x1dd8) + 0x16) >>> 0;
    assert.equal(storedCs, computedCs, "Checksum must match computed");

    // Check BN3 HP memory count at 0x1a20
    assert.ok(sram[0x1a20] >= 40, "BN3 HP memory count at 0x1a20 must be set");
});
