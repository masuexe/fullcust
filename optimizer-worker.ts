import { compareBuildStats, optimizeBuild, OptimizeOptions } from "./optimizer";
import { searchBuilds, SearchProgress } from "./exhaustive-optimizer";
import { findFeasibleBuild } from "./feasible-optimizer";
import { colorCompatibility } from "./compatibility";
import { improveBuildLocally } from "./local-optimizer";

export type OptimizerRequest = Omit<OptimizeOptions, "timeoutMs" | "beamWidth">;
export type OptimizerResponse =
    | ({ type: "progress" } & SearchProgress)
    | ({ type: "done" } & SearchProgress)
    | { type: "error"; message: string };

self.onmessage = (event: MessageEvent<OptimizerRequest>) => {
    try {
        // First satisfy the requested specs, without spending space/MB on HP.
        // This scheduling budget never ends the overall search or proves failure.
        const deadline = Date.now() + 1000;
        let best = findFeasibleBuild({ ...event.data, shouldStop: () => Date.now() >= deadline });
        if (best) self.postMessage({ type: "progress", checkedBuilds: 0, best } as OptimizerResponse);

        // Improve the first feasible build locally before starting the complete
        // search. Keep its cards and requirements so all mandatory specs survive.
        const baseline = best;
        const improved = optimizeBuild({
            ...event.data,
            problem: baseline?.problem ?? event.data.problem,
            modCardMode: baseline ? "keep" : event.data.modCardMode,
            timeoutMs: 500,
        });
        if (improved && !colorCompatibility(event.data.data, improved.problem).error &&
            (!best || compareBuildStats(improved.stats, best.stats, event.data.target ?? "max_hp") > 0)) {
            best = {
                ...improved,
                addedPartIndices: [...(baseline?.addedPartIndices ?? []), ...improved.addedPartIndices],
                addedCardIds: event.data.modCardMode === "auto" ? improved.problem.modCards : [],
            };
        }
        if (best) {
            self.postMessage({ type: "progress", checkedBuilds: 0, best } as OptimizerResponse);
            const localDeadline = Date.now() + 1500;
            best = improveBuildLocally({ ...event.data, initialBest: best,
                shouldStop: () => Date.now() >= localDeadline,
                onImprove: next => self.postMessage({ type: "progress", checkedBuilds: 0, best: next } as OptimizerResponse),
            });
        }
        const result = searchBuilds({
            ...event.data,
            initialBest: best,
            onProgress: progress => self.postMessage({ type: "progress", ...progress } as OptimizerResponse),
        });
        self.postMessage({ type: "done", ...result } as OptimizerResponse);
    } catch (error) {
        self.postMessage({ type: "error", message: error instanceof Error ? error.message : String(error) } as OptimizerResponse);
    }
};
