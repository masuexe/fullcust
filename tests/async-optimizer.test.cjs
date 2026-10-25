const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { test } = require("node:test");
const ts = require("typescript");

test("optimizer streams improvements, terminates on stop, and ignores late messages", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "fullcust-optimizer-test-"));
    const previousWorker = globalThis.Worker;
    try {
        const source = fs.readFileSync(path.join(__dirname, "../async-optimizer.ts"), "utf8");
        const { outputText } = ts.transpileModule(source, {
            compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext },
        });
        const filename = path.join(directory, "async-optimizer.mjs");
        fs.writeFileSync(filename, outputText);
        const { default: AsyncOptimizer } = await import(pathToFileURL(filename).href);
        let worker;
        globalThis.Worker = class {
            constructor() { worker = this; this.terminated = false; }
            postMessage(message) { this.request = message; }
            terminate() { this.terminated = true; }
        };
        const events = [];
        const request = { problem: {}, data: {} };
        const optimizer = new AsyncOptimizer(request, event => events.push(event));
        assert.equal(worker.request, request);
        const handler = worker.onmessage;
        handler({ data: { type: "progress", checkedBuilds: 1, best: { solution: [1] } } });
        handler({ data: { type: "progress", checkedBuilds: 2, best: { solution: [2] } } });
        optimizer.stop();
        assert.equal(worker.terminated, true);
        assert.equal(worker.onmessage, null);
        handler({ data: { type: "done", best: null } });
        assert.equal(events.length, 2);
        assert.deepEqual(events.at(-1).best.solution, [2]);

        const finished = new AsyncOptimizer(request, event => events.push(event));
        worker.onmessage({ data: { type: "done", checkedBuilds: 3, best: null } });
        assert.equal(worker.terminated, true);
        assert.equal(events.at(-1).type, "done");
        finished.stop();

        const failing = new AsyncOptimizer(request, event => events.push(event));
        worker.onerror({ message: "worker failed" });
        assert.equal(worker.terminated, true);
        assert.deepEqual(events.at(-1), { type: "error", message: "worker failed" });
        failing.stop();
    } finally {
        globalThis.Worker = previousWorker;
        fs.rmSync(directory, { recursive: true, force: true });
    }
});
