export type SearchStage = "library" | "feasible" | "improve" | "local" | "exhaustive";

export interface SearchActivity {
    stage: SearchStage;
    elapsedMs: number;
    candidateChecks: number;
    placementAttempts: number;
}

/** Worker-local counters. Revisited candidates count again; totals are not unique builds. */
export function createSearchActivity(report: (activity: SearchActivity) => void, now = Date.now) {
    const started = now();
    let lastReport = started;
    let stage: SearchStage = "feasible";
    let candidateChecks = 0;
    let placementAttempts = 0;
    const snapshot = (): SearchActivity => ({ stage, elapsedMs: Math.max(0, now() - started), candidateChecks, placementAttempts });
    const tick = (force = false) => {
        if (force || now() - lastReport >= 1000) {
            const activity = snapshot();
            lastReport = started + activity.elapsedMs;
            report(activity);
        }
    };
    return {
        snapshot,
        tick,
        setStage(next: SearchStage) { stage = next; tick(true); },
        onSearchWork(kind: "candidate" | "placement") {
            if (kind === "candidate") candidateChecks++;
            else placementAttempts++;
            // Avoid reading the clock for every cell-placement attempt.
            if (kind === "candidate" || placementAttempts % 256 === 0) tick();
        },
    };
}
