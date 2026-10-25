require("./register.cjs");
const assert = require("node:assert/strict");
const path = require("node:path");
const { Worker } = require("node:worker_threads");
const { test } = require("node:test");
const { games } = require("../games.ts");
const { parseGameData } = require("../game-data.ts");
const { emptyProblem } = require("../problem.ts");
const { from } = require("../array2d.ts");

function worker() {
    return new Worker(`
        const { parentPort } = require("node:worker_threads");
        require(${JSON.stringify(path.join(__dirname, "register.cjs"))});
        globalThis.self = { postMessage: message => parentPort.postMessage(message) };
        require(${JSON.stringify(path.join(__dirname, "../optimizer-worker.ts"))});
        parentPort.on("message", data => self.onmessage({ data }));
    `, { eval: true });
}

function tinyData() {
    const data = parseGameData(require("../data/bn6.json"), games.find(g => g.id === "bn6"));
    const index = data.partMetas.findIndex(p => p.id === 46);
    data.partMetas = [data.partMetas[index]];
    data.parts = [{ ...data.parts[index], compressedMask: from([true, false], 1, 2), uncompressedMask: from([true, false], 1, 2) }];
    data.gridOptions = [{ label: "fixture", settings: { height: 1, width: 2, commandLineRow: 0, hasOob: false } }];
    data.defaultExpansion = 0;
    return data;
}

function run(request) {
    return new Promise((resolve, reject) => {
        const thread = worker();
        const events = [];
        const timer = setTimeout(() => { thread.terminate(); reject(new Error("Worker did not finish tiny search")); }, 5000);
        thread.on("error", error => { clearTimeout(timer); thread.terminate(); reject(error); });
        thread.on("message", message => {
            events.push(message);
            if (message.type === "error") { clearTimeout(timer); thread.terminate(); reject(new Error(message.message)); }
            if (message.type === "done") { clearTimeout(timer); thread.terminate(); resolve(events); }
        });
        thread.postMessage(request);
    });
}

test("the real optimizer worker streams improved builds and completes after exhaustive search", async () => {
    const data = tinyData();
    const events = await run({ data, problem: emptyProblem(data), modCardMode: "none",
        constraints: { bugRules: { battleHp: "allowed_any", damageHp: "allowed_any" } } });
    const scores = events.filter(e => e.type === "progress" && e.best).map(e => e.best.stats.finalHp);
    assert.ok(scores.includes(1500), "Early incumbent should be streamed");
    assert.ok(scores.includes(2000), "Exhaustive search must improve beyond the one-copy seed");
    assert.equal(events.at(-1).type, "done");
    assert.equal(events.at(-1).best.stats.finalHp, 2000);
    assert.equal(events.at(-1).completed, true);
});

test("the real optimizer worker reports exhaustion without conflating it with cancellation", async () => {
    const data = tinyData();
    const events = await run({ data, problem: emptyProblem(data), modCardMode: "none",
        constraints: { requiredAbilities: ["superArmor"] } });
    assert.equal(events.at(-1).type, "done");
    assert.equal(events.at(-1).best, null);
    assert.equal(events.at(-1).completed, true);
});

test("a running optimizer worker can be interrupted while retaining its last streamed result", async () => {
    const data = parseGameData(require("../data/bn6.json"), games.find(g => g.id === "bn6"));
    const thread = worker();
    let timer;
    try {
        const best = await new Promise((resolve, reject) => {
            timer = setTimeout(() => reject(new Error("No early worker result")), 5000);
            thread.on("error", reject);
            thread.on("message", message => {
                if (message.type === "error") reject(new Error(message.message));
                if (message.type === "progress" && message.best) resolve(message.best);
            });
            thread.postMessage({ data, problem: emptyProblem(data), modCardMode: "none" });
        });
        await thread.terminate();
        assert.ok(best.solution);
        assert.ok(best.stats.finalHp >= 1000);
        assert.equal(thread.threadId, -1);
    } finally {
        clearTimeout(timer);
        await thread.terminate();
    }
});

test("the optimizer worker never streams a build below a required Buster stat", async () => {
    const data = tinyData(); // HP parts cannot supply Attack Lv5.
    const events = await run({ data, problem: emptyProblem(data), modCardMode: "none",
        constraints: { requiredMaxBusterStats: ["attack"], bugRules: { battleHp: "allowed_any", damageHp: "allowed_any" } } });
    assert.ok(events.every(event => !event.best));
    assert.equal(events.at(-1).type, "done");
    assert.equal(events.at(-1).completed, true);
});

test("the reported DrillArm case streams a feasible solution before improving its cards and HP", async () => {
    const { BUG_SPEC_OPTIONS } = require("../effects.ts");
    const { doesBuildSatisfyConstraints } = require("../optimizer.ts");
    const data = parseGameData(require("../data/bn6.json"), games.find(g => g.id === "bn6"));
    const constraints = {
        requiredAbilities: ["superArmor", "airShoes", "underShirt", "chipRecovery"],
        requiredSpecialMove: "DrillArm", requiredMaxBusterStats: ["charge"], minChipRecovery: 30,
        allowedBodies: ["Normal", "Fire", "Elec"],
        bugRules: Object.fromEntries(BUG_SPEC_OPTIONS.map(b => [b.id, "allowed_any"])),
    };
    const thread = worker();
    let timer;
    try {
        const results = await new Promise((resolve, reject) => {
            let first;
            timer = setTimeout(() => reject(new Error("Reported build did not stream a first solution and improvement")), 5000);
            thread.on("error", reject);
            thread.on("message", message => {
                if (message.type === "error") return reject(new Error(message.message));
                if (message.type !== "progress" || !message.best) return;
                try {
                    assert.ok(doesBuildSatisfyConstraints(message.best.stats, message.best.analysis, constraints));
                    if (!first) first = message.best;
                    else if (message.best.stats.finalHp > first.stats.finalHp && message.best.stats.modMbUsed > first.stats.modMbUsed) {
                        resolve([first, message.best]);
                    }
                } catch (error) { reject(error); }
            });
            thread.postMessage({ data, problem: emptyProblem(data), modCardMode: "auto", constraints, target: "max_hp" });
        });
        assert.ok(results[0].stats.modChipRecovery >= 30);
        assert.ok(results[1].stats.modChipRecovery >= 30);
        assert.ok(constraints.allowedBodies.includes(results[0].stats.modBody ?? "Normal"));
        assert.ok(constraints.allowedBodies.includes(results[1].stats.modBody ?? "Normal"));
        assert.equal(results[0].stats.modBPwrAtk, "DrillArm");
        assert.equal(results[0].stats.charge, 5);
        assert.ok(results[1].stats.finalHp > results[0].stats.finalHp);
        assert.ok(results[1].stats.modMbUsed > results[0].stats.modMbUsed);
        assert.ok(results[1].stats.modMbUsed <= 80);
        assert.deepEqual(results[1].problem.constraints, constraints);
        assert.equal(results[1].addedPartIndices.length, results[1].problem.requirements.length);
        assert.deepEqual(results[1].addedCardIds, results[1].problem.modCards);
    } finally {
        clearTimeout(timer);
        await thread.terminate();
    }
});

test("the worker searches and streams Attack >=10 with a fixed double-Attack card", async () => {
    const data = tinyData();
    const real = parseGameData(require("../data/bn6.json"), games.find(g => g.id === "bn6"));
    const index = real.partMetas.findIndex(p => p.id === 38);
    data.partMetas = [real.partMetas[index]];
    data.parts = [{ ...real.parts[index], compressedMask: from([true, false], 1, 2), uncompressedMask: from([true, false], 1, 2) }];
    const problem = emptyProblem(data);
    problem.modCards = ["137-A036"];
    const events = await run({ data, problem, modCardMode: "keep",
        constraints: { minBusterStats: { attack: 10 }, bugRules: { buster: "allowed_any" } } });
    const found = events.filter(event => event.best);
    assert.ok(found.length > 0);
    assert.ok(found.every(event => event.best.stats.attack >= 10));
    assert.equal(events.at(-1).type, "done");
    assert.equal(events.at(-1).best.stats.attack, 10);
});

test("the worker incrementally fills NC to meet a minimum Custom count", async () => {
    const data = tinyData();
    const real = parseGameData(require("../data/bn6.json"), games.find(g => g.id === "bn6"));
    const index = real.partMetas.findIndex(p => p.id === 2);
    data.partMetas = [real.partMetas[index]];
    data.parts = [{ ...real.parts[index], compressedMask: from([true, false], 1, 2), uncompressedMask: from([true, false], 1, 2) }];
    const events = await run({ data, problem: emptyProblem(data), modCardMode: "none",
        constraints: { minCustom: 7, bugRules: { custom: "allowed_any" } } });
    const found = events.filter(event => event.best);
    assert.ok(found.length > 0);
    assert.ok(found.every(event => event.best.stats.custom >= 7));
    assert.equal(events.at(-1).type, "done");
    assert.equal(events.at(-1).best.stats.custom, 7);
});

test("worker updates keep the selected priority order through every search phase", async () => {
    const { BUG_SPEC_OPTIONS } = require("../effects.ts");
    const real = parseGameData(require("../data/bn6.json"), games.find(g => g.id === "bn6"));
    const data = tinyData();
    const indices = [38, 46].map(id => real.partMetas.findIndex(part => part.id === id));
    data.partMetas = indices.map(i => real.partMetas[i]);
    data.parts = indices.map(i => ({ ...real.parts[i], compressedMask: from([true, false], 1, 2),
        uncompressedMask: from([true, false], 1, 2) }));
    for (const [target, minimum, expected] of [["max_hp", undefined, [2000, 1]],
        ["max_attack", undefined, [1500, 5]], ["max_hp", 5, [1500, 5]]]) {
        const events = await run({ data, problem: emptyProblem(data), modCardMode: "none", target,
            constraints: { bugRules: Object.fromEntries(BUG_SPEC_OPTIONS.map(bug => [bug.id, "allowed_any"])),
                minBusterStats: minimum ? { attack: minimum } : undefined } });
        const stats = events.filter(event => event.best).map(event => event.best.stats);
        assert.ok(stats.length > 0);
        for (let i = 0; i < stats.length; i++) {
            if (minimum) assert.ok(stats[i].attack >= minimum);
            if (i === 0) continue;
            const primary = target === "max_hp" ? "finalHp" : "attack";
            const secondary = target === "max_hp" ? "attack" : "finalHp";
            assert.ok(stats[i][primary] > stats[i - 1][primary] ||
                (stats[i][primary] === stats[i - 1][primary] && stats[i][secondary] >= stats[i - 1][secondary]));
        }
        assert.deepEqual([stats.at(-1).finalHp, stats.at(-1).attack], expected);
        assert.equal(events.at(-1).completed, true);
    }
});
