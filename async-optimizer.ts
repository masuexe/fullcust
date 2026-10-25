import type { OptimizerRequest, OptimizerResponse } from "./optimizer-worker";

/** Terminating the worker interrupts even a synchronous, deeply nested solve. */
export default class AsyncOptimizer {
    private worker: Worker;
    private active = true;

    constructor(options: OptimizerRequest, onMessage: (message: OptimizerResponse) => void) {
        this.worker = new Worker(new URL("./optimizer-worker.ts", import.meta.url), { type: "module" });
        this.worker.onmessage = (event: MessageEvent<OptimizerResponse>) => {
            if (!this.active) return;
            if (event.data.type !== "progress") this.stop();
            onMessage(event.data);
        };
        this.worker.onerror = event => {
            if (!this.active) return;
            this.stop();
            onMessage({ type: "error", message: event.message });
        };
        try {
            this.worker.postMessage(options);
        } catch (error) {
            this.stop();
            throw error;
        }
    }

    stop() {
        this.active = false;
        this.worker.onmessage = null;
        this.worker.onerror = null;
        this.worker.terminate();
    }
}
