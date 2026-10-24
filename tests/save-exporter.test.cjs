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

function getGameData(gameId) {
    const raw = require(`../data/${gameId}.json`);
    const game = games.find(g => g.id === gameId);
    return parseGameData(raw, game);
}

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
