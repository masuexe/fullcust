const assert = require("assert");
const fs = require("fs");
const path = require("path");

// Load game datasets
const games = {
    bn3: require("../data/bn3.json"),
    bn4: require("../data/bn4.json"),
    bn5: require("../data/bn5.json"),
    bn6: require("../data/bn6.json"),
};

function prepareGameData(gameId) {
    const raw = games[gameId];
    return {
        gameId,
        colors: raw.colors,
        parts: raw.parts,
        partMetas: raw.parts,
        defaultExpansion: raw.gridSettings.height === 7 ? 5 : 2,
    };
}

console.log("Running build-data tests...");

// Compile TypeScript or require compiled/ts-node if available, or test logic directly
// Since tests use CommonJS, let's test using the ts logic converted to test
const { COMMUNITY_PRESETS } = require("../build-data.ts");

// Verify every preset converts cleanly to its game's problem!
for (const preset of COMMUNITY_PRESETS) {
    const gameData = prepareGameData(preset.gameId);
    console.log(`Checking preset: ${preset.name} (${preset.gameId})`);
    assert(preset.version === 1);
    assert(preset.requirements.length > 0);

    for (const req of preset.requirements) {
        const colorIdx = gameData.colors.indexOf(req.color);
        assert(colorIdx >= 0, `Unknown color ${req.color} in ${preset.gameId}`);
        const part = gameData.parts.find(p => p.id === req.id && p.color === colorIdx);
        assert(part, `Part ${req.id} (${req.color}) not found in ${preset.gameId}`);
    }
}

console.log("All preset builds verified successfully!");
