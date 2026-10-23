require("./register.cjs");
const assert = require("node:assert/strict");
const { test } = require("node:test");
const { findGame } = require("../games.ts");
const { parseGameData } = require("../game-data.ts");
const { colorCompatibility, compatibleColors } = require("../compatibility.ts");
const { emptyProblem, makeGridSettings, fromHashString, toHashString } = require("../problem.ts");
const { solve, placeAll } = require("../solver.ts");
const array2d = require("../array2d.ts");

const game = findGame("bn3");
const raw = require("../data/bn3.json");
const data = parseGameData(raw, game);

function problem(ids, overrides = {}, constraint = {}) {
    return {
        ...emptyProblem(data),
        requirements: ids.map(id => {
            const partIndex = data.partIds.indexOf(`bn3:${id}`);
            assert.notEqual(partIndex, -1, `Unknown fixture part: ${id}`);
            return {
                partIndex,
                constraint: { compressed: true, onCommandLine: null, minBugLevel: 0, maxBugLevel: 0, ...constraint },
            };
        }),
        ...overrides,
    };
}

function solutions(p) {
    return [...solve(data.parts, p.requirements, makeGridSettings(data, p), p.spinnableColors)];
}

test("BN3 has 50 program templates, 65 variants, nine colors and three board sizes", () => {
    assert.equal(data.parts.length, 65);
    assert.equal(new Set(data.partMetas.map(p => p.id)).size, 50);
    assert.equal(data.colors.length - 1, 9);
    assert.deepEqual(data.gridOptions.map(g => [g.settings.width, g.settings.height]), [[4, 4], [5, 4], [5, 5]]);
    assert(data.gridOptions.every(g => !g.settings.hasOob && g.settings.commandLineRow === 2));
    assert(data.partMetas.filter(p => !p.isSolid).every(p => p.id >= 35 && p.id <= 43));
});

test("BN3 reference masks preserve shape orientation and compression cells", () => {
    const mask = (id, compressed) => {
        const part = data.parts[data.partIds.indexOf(`bn3:${id}`)];
        const bitmap = compressed ? part.compressedMask : part.uncompressedMask;
        return Array.from({ length: 5 }, (_, i) => bitmap.slice(i * 5, i * 5 + 5).map(v => v ? "#" : ".").join(""));
    };
    assert.deepEqual(mask("1:red", true), [".....", "..#..", "..##.", "..#..", "....."]);
    assert.deepEqual(mask("1:red", false), [".....", "..#..", "..##.", "..##.", "....."]);
    assert.deepEqual(mask("10:blue", true), [".....", "...#.", ".###.", ".....", "....."]);
    assert.deepEqual(mask("41:white", true), [".....", ".....", ".##..", "..#..", "....."]);
    assert.deepEqual(mask("39:yellow", false), [".....", "#####", "#.###", ".....", "....."]);
    for (const part of data.parts) {
        const removed = part.uncompressedMask.filter((v, i) => v && !part.compressedMask[i]).length;
        assert(removed <= 1);
        assert(part.compressedMask.every((v, i) => !v || part.uncompressedMask[i]));
    }
});

for (const [style, extra] of [
    ["normal", null], ["guts", "red"], ["shadow", "red"],
    ["custom", "blue"], ["shield", "blue"], ["team", "green"],
    ["ground", "green"], ["bug", "gray"],
]) {
    test(`BN3 ${style} Style allows exactly its compatible colors`, () => {
        const p = problem([], { style });
        assert.deepEqual(compatibleColors(data, p), ["white", "pink", "yellow", ...(extra ? [extra] : [])]);
        for (let i = 0; i < data.parts.length; i++) {
            const selection = { ...p, requirements: [{ partIndex: i, constraint: {} }] };
            const allowed = ["white", "pink", "yellow", extra].includes(data.colors[data.parts[i].color]);
            assert.equal(colorCompatibility(data, selection).error === null, allowed, data.partMetas[i].name);
        }
    });
}

test("ModTools permits one off-color part, not one entire extra color", () => {
    assert(colorCompatibility(data, problem(["1:red"])).error);
    assert.equal(colorCompatibility(data, problem(["1:red"], { modTools: true })).error, null);
    assert(colorCompatibility(data, problem(["1:red", "2:red"], { modTools: true })).error);
    assert(colorCompatibility(data, problem(["1:red", "1:red"], { modTools: true })).error);
    assert.equal(colorCompatibility(data, problem(["10:blue", "12:green"], { style: "custom", modTools: true })).error, null);
    for (const style of game.styleColorRules.styles) {
        assert(colorCompatibility(data, problem(["48:purple"], { style: style.id })).error);
        assert(colorCompatibility(data, problem(["49:orange"], { style: style.id })).error);
    }
});

test("BN3 settings and part identities survive shared-link round trips and reordering", () => {
    const p = problem(["10:blue", "12:green"], { style: "custom", modTools: true, expansionMemories: 1 });
    const saved = toHashString(p, data);
    assert.equal(JSON.parse(saved).t, "custom");
    assert.equal(JSON.parse(saved).m, 1);
    assert.deepEqual(fromHashString(saved, data), p);
    const reordered = parseGameData({ ...raw, parts: [...raw.parts].reverse() }, game);
    const restored = fromHashString(saved, reordered);
    assert.deepEqual(restored.requirements.map(req => reordered.partIds[req.partIndex]), ["bn3:10:blue", "bn3:12:green"]);
    assert.equal(colorCompatibility(reordered, restored).error, null);
    const defaults = JSON.parse(saved);
    delete defaults.t;
    delete defaults.m;
    const loadedDefaults = fromHashString(JSON.stringify(defaults), data);
    assert.equal(loadedDefaults.style, "normal");
    assert.equal(loadedDefaults.modTools, false);
});

test("BN3 rejects unknown Styles and unsupported legacy links", () => {
    const saved = JSON.parse(toHashString(emptyProblem(data), data));
    saved.t = "invalid";
    assert.throws(() => fromHashString(JSON.stringify(saved), data), /Unknown Style/);
    assert.throws(() => fromHashString(JSON.stringify({ r: [], s: [], x: 2 }), data), /no legacy/);
});

test("Style rule metadata rejects missing colors, duplicate Styles and invalid defaults", () => {
    for (const change of [
        r => { r.baseColors.push("invisible"); },
        r => { r.styles[0].extraColor = "invisible"; },
        r => { r.styles.push(r.styles[0]); },
        r => { r.defaultStyle = "invalid"; },
    ]) {
        const rules = structuredClone(game.styleColorRules);
        change(rules);
        assert.throws(() => parseGameData(raw, { ...game, styleColorRules: rules }));
    }
});

for (const expansionMemories of [0, 1, 2]) {
    test(`BN3 expansion ${expansionMemories}: mixed parts produce valid layouts`, () => {
        const p = problem(["30:white", "41:pink", "43:yellow"], { expansionMemories });
        assert.equal(colorCompatibility(data, p).error, null);
        const found = solutions(p);
        assert(found.length > 0);
        const gs = makeGridSettings(data, p);
        for (const solution of found) {
            const covered = new Set();
            p.requirements.forEach((req, i) => {
                const part = data.parts[req.partIndex];
                let mask = solution[i].compressed ? part.compressedMask : part.uncompressedMask;
                for (let rotation = 0; rotation < solution[i].loc.rotation; rotation++) mask = array2d.rot90(mask);
                const ys = [];
                mask.forEach((occupied, j) => {
                    if (!occupied) return;
                    const x = j % mask.ncols + solution[i].loc.position.x;
                    const y = Math.floor(j / mask.ncols) + solution[i].loc.position.y;
                    assert(x >= 0 && x < gs.width && y >= 0 && y < gs.height);
                    const key = `${x},${y}`;
                    assert(!covered.has(key));
                    covered.add(key);
                    ys.push(y);
                });
                assert.equal(ys.includes(gs.commandLineRow), part.isSolid);
            });
            assert.equal(placeAll(data.parts, p.requirements, solution, gs).filter(v => v !== null).length, 6);
        }
    });
}

test("BN3 cannot spill HP+500 beyond a 4x4 board", () => {
    assert.equal(solutions(problem(["39:yellow"], { expansionMemories: 0 })).length, 0);
    assert(solutions(problem(["39:yellow"], { expansionMemories: 1 })).length > 0);
});

test("an explicit off-command-line constraint is enforced even when bugs are allowed", () => {
    const p = problem(["42:white"], {}, { onCommandLine: false, maxBugLevel: Infinity });
    const found = solutions(p);
    assert.equal(found.length, 20);
    for (const solution of found) {
        const gs = makeGridSettings(data, p);
        const cells = placeAll(data.parts, p.requirements, solution, gs);
        assert(cells.slice(gs.commandLineRow * gs.width, (gs.commandLineRow + 1) * gs.width).every(v => v === null));
    }
});

test("optional compression does not reject a board that fits compressed parts exactly", () => {
    const p = problem(["1:red", "1:red", "1:red", "1:red"], { expansionMemories: 0, style: "guts" },
        { compressed: null, maxBugLevel: Infinity });
    const found = solve(data.parts, p.requirements, makeGridSettings(data, p), p.spinnableColors)[Symbol.iterator]().next();
    assert.equal(found.done, false);
    assert(found.value.every(placement => placement.compressed));
});
