import { GridSettings, Part, Requirement, Solution, solve } from "./solver";
import { PolicySolveOptions, solveForDisplay } from "./optimizer";

export type WorkerPolicyContext = Omit<
    PolicySolveOptions,
    "requirements" | "gridSettings" | "spinnableColors" | "shouldStop"
>;

export type Request =
    | { type: "next" }
    | {
          type: "init";
          args: {
              parts: Part[];
              requirements: Requirement[];
              gridSettings: GridSettings;
              spinnableColors: boolean[];
              policyContext?: WorkerPolicyContext;
          };
      };

export type Response =
    | { type: "ready" }
    | ({ type: "next" } & ({ done: true } | { done: false; value: Solution }))
    | { type: "error"; reason: String };

let it: Iterator<Solution> | null = null;

self.onmessage = function (e: MessageEvent<Request>) {
    console.time(e.data.type);
    switch (e.data.type) {
        case "init": {
            const { parts, requirements, gridSettings, spinnableColors, policyContext } =
                e.data.args;
            it = (policyContext
                ? solveForDisplay({ ...policyContext, requirements, gridSettings, spinnableColors })
                : solve(parts, requirements, gridSettings, spinnableColors, undefined, true, undefined, true)
            )[Symbol.iterator]();
            break;
        }

        case "next": {
            if (it === null) {
                self.postMessage({
                    type: "error",
                    reason: "solver not initialized",
                });
                break;
            }
            const r = it.next();
            self.postMessage({ type: "next", ...r } as Response);
            break;
        }
    }
    console.timeEnd(e.data.type);
};

self.postMessage({ type: "ready" } as Response);
