const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { test } = require("node:test");
const ts = require("typescript");

test("the solver retains a worker's ready message until the first next() call", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "fullcust-worker-test-"));
    const previousWorker = globalThis.Worker;
    let timer;
    try {
        // Keep import.meta.url valid while replacing the browser Worker with an
        // event-driven double. Test the actual class without a bundler dependency.
        const source = fs.readFileSync(path.join(__dirname, "../async-solver.ts"), "utf8");
        const { outputText } = ts.transpileModule(source, {
            compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext },
        });
        const filename = path.join(directory, "async-solver.mjs");
        fs.writeFileSync(filename, outputText);
        const { default: AsyncSolver } = await import(pathToFileURL(filename).href);

        globalThis.Worker = class extends EventTarget {
            constructor() {
                super();
                queueMicrotask(() => this.dispatchEvent(new MessageEvent("message", { data: { type: "ready" } })));
            }
            postMessage(message) {
                if (message.type === "next") {
                    queueMicrotask(() => this.dispatchEvent(new MessageEvent("message", {
                        data: { type: "next", done: true },
                    })));
                }
            }
            terminate() {}
        };
        const solver = new AsyncSolver([], [], { height: 5, width: 5, hasOob: false, commandLineRow: 2 }, []);
        // Let ready arrive before requesting results, as happens when scrolling
        // or switching Styles after the worker has started.
        await new Promise(resolve => setImmediate(resolve));
        const result = await Promise.race([
            solver.next(),
            new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("Lost worker ready message")), 1000); }),
        ]);
        assert.deepEqual(result, { value: undefined, done: true });
        solver.terminate();
    } finally {
        clearTimeout(timer);
        globalThis.Worker = previousWorker;
        fs.rmSync(directory, { recursive: true, force: true });
    }
});
