import { findKnownBuild } from "./build-corpus";
import { compareBuildStats, optimizeBuild, OptimizeOptions, OptimizeResult } from "./optimizer";
import { searchBuilds, SearchProgress } from "./exhaustive-optimizer";
import { findFeasibleBuild } from "./feasible-optimizer";
import { colorCompatibility } from "./compatibility";
import { improveBuildLocally } from "./local-optimizer";
import { createSearchActivity, SearchActivity } from "./search-activity";

export type OptimizerRequest = Omit<OptimizeOptions, "timeoutMs" | "beamWidth" | "onSearchWork">;
export type OptimizerResponse =
    | ({ type: "progress" } & SearchProgress & { activity: SearchActivity })
    | ({ type: "done" } & SearchProgress & { activity: SearchActivity })
    | { type: "error"; message: string };

self.onmessage = (event: MessageEvent<OptimizerRequest>) => {
    try {
        let best: OptimizeResult | null = null;
        let checkedBuilds = 0;
        const activity = createSearchActivity(snapshot => self.postMessage({
            type: "progress", checkedBuilds, best, activity: snapshot,
        } as OptimizerResponse));
        const publish = (type: "progress" | "done", progress: SearchProgress) => {
            best = progress.best;
            checkedBuilds = progress.checkedBuilds;
            self.postMessage({ ...progress, type, activity: activity.snapshot() } as OptimizerResponse);
        };
        const options = { ...event.data, onSearchWork: activity.onSearchWork };
        const until = (deadline: number) => () => { activity.tick(); return Date.now() >= deadline; };
        activity.setStage("library");
        const libraryDeadline = Date.now() + 100;
        best = findKnownBuild({ ...options, shouldStop: until(libraryDeadline),
            onImprove: next => publish("progress", { checkedBuilds: 0, best: next }) });
        // First satisfy the requested specs, without spending space/MB on HP.
        // This scheduling budget never ends the overall search or proves failure.
        const deadline = Date.now() + 1000;
        if (!best) {
            activity.setStage("feasible");
            best = findFeasibleBuild({ ...options, shouldStop: until(deadline) });
            if (best) publish("progress", { checkedBuilds: 0, best });
        }

        // Improve the first feasible build locally before starting the complete
        // search. Keep its cards and requirements so all mandatory specs survive.
        activity.setStage("improve");
        const baseline = best;
        const improved = optimizeBuild({
            ...options,
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
            publish("progress", { checkedBuilds: 0, best });
            activity.setStage("local");
            const localDeadline = Date.now() + 1500;
            best = improveBuildLocally({ ...options, initialBest: best,
                shouldStop: until(localDeadline),
                onImprove: next => publish("progress", { checkedBuilds: 0, best: next }),
            });
        }
        activity.setStage("exhaustive");
        const result = searchBuilds({
            ...options,
            initialBest: best,
            onProgress: progress => publish("progress", progress),
        });
        publish("done", result);
    } catch (error) {
        self.postMessage({ type: "error", message: error instanceof Error ? error.message : String(error) } as OptimizerResponse);
    }
};
