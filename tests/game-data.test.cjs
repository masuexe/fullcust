const assert = require("node:assert/strict");
const { test } = require("node:test");
const { games, findGame, loadGame } = require("../games.ts");
const { parseGameData } = require("../game-data.ts");

for (const game of games) {
    test(`${game.id}: data validates and retains every legacy variant`, async () => {
        const data = await loadGame(game);
        assert.equal(data.partIds.length, new Set(data.partIds).size);
        assert.deepEqual(data.partIds, game.legacyCatalog.partIds);
        assert.deepEqual(data.colors, game.legacyCatalog.colors);
        assert.equal(data.defaultExpansion, 2);
        for (const part of data.parts) {
            assert.equal(part.compressedMask.length, data.gridSettings.height * data.gridSettings.width);
        }
    });
}

const game = findGame("bn4");
const raw = () => structuredClone(require("../data/bn4.json"));

for (const [name, mutate] of [
    ["unknown color", d => { d.colors[1] = "invisible"; }],
    ["duplicate color", d => { d.colors[2] = d.colors[1]; }],
    ["missing sentinel", d => { d.colors[0] = "red"; }],
    ["missing color reference", d => { d.parts[0].color = 999; }],
    ["fractional color reference", d => { d.parts[0].color = 1.5; }],
    ["duplicate variant", d => { d.parts.push(structuredClone(d.parts[0])); }],
    ["empty shape", d => { d.parts[0].compressedMask.fill(0); }],
    ["wrong shape dimensions", d => { d.parts[0].uncompressedMask.pop(); }],
    ["invalid shape cell", d => { d.parts[0].compressedMask[0] = 2; }],
    ["out of bounds command line", d => { d.gridSettings.commandLineRow = 5; }],
    ["invalid border grid", d => { d.gridSettings.hasOob = true; d.gridSettings.width = 2; }],
]) {
    test(`rejects ${name}`, () => {
        const data = raw();
        mutate(data);
        assert.throws(() => parseGameData(data, game));
    });
}

test("grid presets are validated independently of part masks", () => {
    assert.throws(() => parseGameData(raw(), { ...game, gridSizes: [{ height: 1, width: 1, label: "bad" }] }));
    assert.throws(() => parseGameData(raw(), { ...game, defaultExpansion: 3 }));
});

test("unknown versions do not load an arbitrary file", () => {
    assert.equal(findGame("../bn4"), undefined);
});
