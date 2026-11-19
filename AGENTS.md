# AGENTS.md

Operational rules for working in `fullcust`. See also `LESSONS.md`.

## 1. Local Gate & CI Parity

Run the unified gate before every commit or PR:

```bash
npm run gate   # or: pnpm gate
```

`gate` runs `tsc --noEmit && node tests/run.cjs && vite build` — the exact same check suite executed by `.github/workflows/deploy.yml`. Do not report work as complete until `gate` passes on the final state.

## 2. Sibling Sweep (Solvers & Optimizers)

This codebase has multiple solver and optimizer entrypoints that share constraint, glitch, and placement semantics:

- Core backtracking & worker: `solver.ts`, `worker.ts`, `async-solver.ts`
- Policy & beam/display solving: `optimizer.ts`
- Search variants & corpus: `exhaustive-optimizer.ts`, `feasible-optimizer.ts`, `local-optimizer.ts`, `build-corpus.ts`
- Shared rules & evaluation: `effects.ts`, `problem.ts`, `panel-effects.ts`, `modcards.ts`

**Rule:** Whenever you fix or add a constraint, glitch, bug-tolerance rule, or placement rule in one solver, you **must** sweep all sibling solvers/optimizers (and `worker.ts` / `index.tsx` if policy context is involved) to ensure consistent behavior, and cover the alignment with regression tests in `tests/*.test.cjs`.

## 3. Parallel Development via `git worktree`

- **Never** copy the repository directory to work on another branch or feature.
- Use `git worktree` for parallel branches:
  ```bash
  git worktree add ../fullcust-<feature> -b feat/<feature>
  ```
- Clean up finished worktrees with `git worktree remove ../fullcust-<feature>`.

## 4. Narrow Changes & Commit Verification Trail

- Keep changes narrowly scoped to the task. Do not mix large structural refactors (such as moving root `.ts`/`.tsx` files into `src/`) with feature or bugfix work.
- Do not leave dirty/untracked files across unrelated tasks; commit or stash cleanly before starting new work.
- Include a `Verified:` section in commit message bodies listing the exact commands run and their observed results (e.g., `npm run gate: pass (375/375 tests)`).
