<!-- reviewed-through: 02634ec (2026-11-20) -->

# LESSONS.md

Engineering lessons learned in `fullcust`.

## Promotion Rule (3-Day Rule)

- Record concrete mistakes, cross-cutting gotchas, and non-obvious invariants here with a date and commit reference.
- When a lesson proves durable across **3+ days** of work or recurs in multiple commits, promote it to a permanent rule in `AGENTS.md` or encode it as an automated test in `tests/`.
- Update the `reviewed-through:` cursor on line 1 whenever recent commits are audited into this file.

## Lessons

### [2026-11-20] Sweep every sibling solver when fixing constraints or glitches (`f2fb004`, `11849bb`, `02634ec`)
- **Symptom:** Fixing a required-bug check, support-bug glitch, `minSoulTime` bound, or placement hygiene rule in only one optimizer left other search paths (`solver.ts`, `feasible-optimizer.ts`, `exhaustive-optimizer.ts`, `local-optimizer.ts`, `build-corpus.ts`) accepting invalid builds or missing valid ones.
- **Rule:** Put shared validity/scoring logic in `effects.ts` / `optimizer.ts` and sweep all sibling solvers + add a cross-solver test in `tests/`.

### [2026-11-20] Keep policy context explicit between UI and worker (`173a217`, `02634ec`)
- **Symptom:** Calling raw `solve()` in `worker.ts` without `WorkerPolicyContext` caused UI-displayed layouts to ignore bug policies, placement hygiene, and effective in-battle bug rules.
- **Rule:** Never duplicate solver/rule logic in `index.tsx`; pass explicit `WorkerPolicyContext` through `async-solver.ts` -> `worker.ts` -> `solveForDisplay()` so UI display and optimizer share the same source of truth.

### [2026-11-20] Use `git worktree` instead of copying repository directories (`../fullcust-folder-constraints`)
- **Symptom:** Copying the repo into a sibling directory (`../fullcust-folder-constraints`) left `feat/folder-capacity-constraints` (`bfff877`) stranded 10+ commits behind `main` without shared git objects or easy rebasing.
- **Rule:** Always use `git worktree add` for parallel feature branches so all branches share one `.git` history and can be rebased/merged cleanly.
