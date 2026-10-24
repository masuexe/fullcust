const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");

const {
    SAVE_EDITIONS,
    buildGbaSave,
    computeRawChecksum,
    applySaveMask,
} = require("../save-exporter.ts");
const { buildDataToProblem, COMMUNITY_PRESETS } = require("../build-data.ts");

const games = {
    bn3: require("../data/bn3.json"),
    bn4: require("../data/bn4.json"),
    bn5: require("../data/bn5.json"),
    bn6: require("../data/bn6.json"),
};

function getGameData(gameId) {
    const raw = games[gameId];
    return {
        gameId,
        colors: raw.colors,
        gridSettings: raw.gridSettings,
        gridOptions: [{ label: "Default", settings: raw.gridSettings }],
        defaultExpansion: raw.gridSettings.height === 7 ? 5 : 2,
        parts: raw.parts,
        partMetas: raw.parts,
    };
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
});
