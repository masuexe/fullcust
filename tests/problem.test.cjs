const assert = require("node:assert/strict");
const { test } = require("node:test");
const { games } = require("../games.ts");
const { parseGameData } = require("../game-data.ts");
const { emptyProblem, fromHashString, toHashString, problemFromHash } = require("../problem.ts");

function legacy(data) {
    return {
        r: [
            { i: 0, c: 1, b: -1, d: 0, z: 1 },
            { i: data.parts.findIndex(p => !p.isSolid), c: -1, b: 0, d: 0, z: 0 },
            { i: 0, c: 0, b: 3, d: 1, z: -1 },
        ],
        s: data.colors.map((_, i) => i % 2),
        x: 1,
    };
}

for (const game of games) {
    const raw = require(`../data/${game.id}.json`);
    const data = parseGameData(raw, game);
    const old = legacy(data);

    test(`${game.id}: legacy URLs migrate and round-trip all constraints`, () => {
        const problem = fromHashString(JSON.stringify(old), data);
        assert.equal(problem.requirements[0].constraint.maxBugLevel, Infinity);
        assert.equal(problem.requirements[1].constraint.onCommandLine, null);
        assert.equal(problem.requirements[2].constraint.compressed, null);
        const saved = toHashString(problem, data);
        assert.equal(JSON.parse(saved).v, 2);
        assert.equal(JSON.parse(saved).g, game.id);
        assert.equal(JSON.parse(saved).r[0].p, data.partIds[0]);
        assert.deepEqual(fromHashString(saved, data), problem);
        assert.deepEqual(problemFromHash(`#${encodeURIComponent(saved)}`, data), problem);
    });

    test(`${game.id}: both URL formats survive reordered parts and colors`, () => {
        const reordered = structuredClone(raw);
        reordered.parts.reverse();
        reordered.colors = ["", ...raw.colors.slice(1).reverse()];
        reordered.parts.forEach(part => {
            part.color = reordered.colors.indexOf(raw.colors[part.color]);
        });
        const changed = parseGameData(reordered, game);
        const original = fromHashString(JSON.stringify(old), data);
        for (const saved of [JSON.stringify(old), toHashString(original, data)]) {
            const restored = fromHashString(saved, changed);
            assert.deepEqual(restored.requirements.map(req => changed.partIds[req.partIndex]),
                original.requirements.map(req => data.partIds[req.partIndex]));
            assert.deepEqual(restored.requirements.map(req => req.constraint), original.requirements.map(req => req.constraint));
            for (const color of data.colors) {
                assert.equal(restored.spinnableColors[changed.colors.indexOf(color)], original.spinnableColors[data.colors.indexOf(color)]);
            }
        }
    });

    test(`${game.id}: different color variants restore separately`, () => {
        const first = data.partMetas.findIndex((p, i, parts) => parts.some((q, j) => i !== j && p.id === q.id));
        const second = data.partMetas.findIndex((p, i) => i !== first && p.id === data.partMetas[first].id);
        const saved = { ...old, r: [old.r[0], { ...old.r[0], i: second }] };
        saved.r[0] = { ...old.r[0], i: first };
        const restored = fromHashString(toHashString(fromHashString(JSON.stringify(saved), data), data), data);
        assert.deepEqual(restored.requirements.map(req => req.partIndex), [first, second]);
    });

    test(`${game.id}: empty links use defaults`, () => {
        assert.deepEqual(problemFromHash("", data), emptyProblem(data));
    });
}

const game = games[0];
const data = parseGameData(require("../data/bn6.json"), game);
const valid = JSON.parse(toHashString(fromHashString(JSON.stringify(legacy(data)), data), data));

for (const [name, mutate] of [
    ["unknown format", p => { p.v = 99; }],
    ["wrong game", p => { p.g = "bn4"; }],
    ["unknown part", p => { p.r[0].p = "custom:missing"; }],
    ["invalid toggle", p => { p.r[0].c = 2; }],
    ["negative minimum bugs", p => { p.r[0].d = -1; }],
    ["inverted bug range", p => { p.r[0].d = 2; p.r[0].b = 1; }],
    ["unknown grid", p => { p.x = 3; }],
    ["missing spinner", p => { delete p.s.red; }],
]) {
    test(`rejects saved layout with ${name}`, () => {
        const saved = structuredClone(valid);
        mutate(saved);
        assert.throws(() => fromHashString(JSON.stringify(saved), data));
    });
}

test("rejects malformed and out of range legacy URLs", () => {
    assert.throws(() => problemFromHash("#%broken", data));
    assert.throws(() => problemFromHash("#{", data));
    for (const mutate of [
        p => { p.r[0].i = -1; },
        p => { p.r[0].i = 999; },
        p => { p.r[0].i = 0.5; },
        p => { p.s.pop(); },
    ]) {
        const saved = legacy(data);
        mutate(saved);
        assert.throws(() => fromHashString(JSON.stringify(saved), data));
    }
});

test("deleted parts fail explicitly instead of selecting their old array position", () => {
    const raw = structuredClone(require("../data/bn6.json"));
    raw.parts.shift();
    const changed = parseGameData(raw, game);
    assert.throws(() => fromHashString(JSON.stringify(legacy(data)), changed), /Unknown part/);
    assert.throws(() => fromHashString(JSON.stringify(valid), changed), /Unknown part/);
});
