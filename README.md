# fullcust

An automatic NaviCust layout solver for BN3 / EXE3, BN4 / EXE4, BN5 / EXE5, and BN6 / EXE6.

## Local development

Use Node.js 22 and pnpm 10:

```sh
pnpm install --frozen-lockfile
pnpm dev
```

## GitHub Pages deployment

This project uses Vite to compile TypeScript. GitHub Pages must publish the built `dist/` directory. Publishing the repository root makes the browser load `index.tsx` directly, causing a module MIME type error and a blank page.

1. In the repository's **Settings → Pages → Build and deployment → Source**, select **GitHub Actions**.
2. Push changes to `.github/workflows/deploy.yml` to `main`. The workflow installs dependencies, runs validation and `pnpm build`, and publishes `dist/`.
3. To redeploy manually, open **Actions → Deploy → Run workflow** and select `main`.
4. After deployment succeeds, open the site. Its HTML should reference `./assets/index-*.js` as the module entry instead of `index.tsx`.

Vite's `base: "./"` allows the built site to run under the `/fullcust/` subpath.

## Game data and shared layouts

- `games.ts` registers game names, data loaders, grid sizes for each expansion level, and defaults. BN6 grid dimensions include the out-of-bounds area; UI labels show the inner dimensions.
- BN3 includes Style color compatibility and an optional ModTools allowance for one incompatible part. See [BN3 data sources and support scope](docs/bn3.md).
- `game-data.ts` validates JSON colors, part variants, shapes, and grid settings, then converts them into solver data. To add a game, add its data and register it here. Any new rules require a separate implementation.
- Different color variants of a program can share the original numeric `id`. Stable part identifiers use `game:originalID:colorName` (for example, `bn6:1:red`), so translations and part ordering do not affect identity.
- New shared links use the `v: 2` format, recording the game, stable part identifiers, and spinner settings keyed by color name. The solver still uses array indices internally.
- For games with Style color restrictions, shared links also store the Style (`t`) and ModTools setting (`m`).
- `data/legacy-catalogs.json` preserves the original part and color ordering for old links. **Do not reorder or regenerate this file to match updated part lists.** Valid old links migrate automatically. Invalid links or references to removed parts display an error and let the user start a new layout.

ROM hack imports and a custom part editor are not yet implemented.

## Continuous build search

Auto-Fill runs in a dedicated Web Worker with no overall time limit. It streams the best valid layout found so far. **Stop search & keep best** terminates the worker immediately and retains that exact layout for viewing and export. Changing the input parts or game settings cancels the previous search rather than applying a result to different inputs.

`optimizer-worker.ts` first runs a constraint-directed pass in `feasible-optimizer.ts`: it branches on missing requirements with the fewest suppliers and tries sources covering multiple requirements, without adding optional HP fillers. A valid first solution is streamed immediately. The bounded heuristic in `optimizer.ts` adds beneficial NC parts. In automatic card mode, `local-optimizer.ts` then tries card insertions, replacements, removals, and loading orders, streaming each strictly better valid result. It can rebuild automatic NC parts from the user's fixed core when new cards supply their effects. Keep/none modes preserve the selected card policy. MB is a capacity limit rather than an optimization reward. The early passes have scheduling budgets but never establish infeasibility or end the overall search; `exhaustive-optimizer.ts` continues afterward without a deadline.

Iterative deepening in the exhaustive pass covers part combinations, color variants, repeated copies, compression choices, and legal card loading orders under the application's capacity, slot, Style, and bug rules. Ranking changes traversal order only. Invalid intermediate bug states are not discarded: later additions such as BugStop, same-color neighbors, or card repairs may make a complete build valid. Core parts and their explicit constraints remain fixed. Chip Recovery contributes to required ability checks only while enabled, respecting later disabling and re-enabling cards.

Only completed exhaustive search can report that no valid build exists or that the best result is proven. Manual cancellation without a result does not establish infeasibility. Large searches, especially automatic card selection, can take a very long time; the current best remains available throughout the search. The bounds and proofs apply to the rules modeled by the application.

Optimization has two strict priority orders: HP then Attack (default), or Attack then HP. After all required conditions are satisfied, the second stat is considered only when the first ties. There is no weighted tradeoff between them and no balanced mode. Rapid, Charge, Custom, and other desired minima belong in the requirements; extra values do not override HP/Attack priorities. The same comparison is used by beam search, local improvements, worker updates, and exhaustive search. Card/part heuristic scores only influence search order.

The build constraints accept numeric Buster minima, for example `minBusterStats: { attack: 8, rapid: 2, charge: 5 }` (shared links: `bc.bm`). Every selected threshold is checked against final stats after NC and card effects. The UI exposes Attack thresholds through 10 for BN5/6, and Rapid/Charge through 5. NC contributions remain capped at 5 before card modifiers. BN6 card bonuses can raise Attack above 5; BN5's doubled Attack and BN6 card-enhanced Attack can reach 10. BN5/6 exported cached Attack values are no longer truncated to level 5. Legacy `requiredMaxBusterStats` / `bc.bs` selections remain supported as minimum 5, so builds exceeding 5 are also accepted. If old and new constraints are both supplied, the stronger minimum applies.

Attack-limit references: [eXiXdXo's original BN6 card-effect guide](https://gamefaqs.gamespot.com/ps4/371763-mega-man-battle-network-legacy-collection/faqs/78192/introeffect-descriptions), [TheStarLion's BN5 card-effect guide](https://gamefaqs.gamespot.com/gba/924452-mega-man-battle-network-5-team-protoman/faqs/56607), and [a player's BN6 test of NC Attack 5 plus Needler yielding Attack 6](https://gamefaqs.gamespot.com/boards/371743-mega-man-battle-network-legacy-collection/80424895?page=2). The existing BN3/4 Buster stat model is unchanged.

Chip Recovery can require a minimum tier of 10, 20, 30, or 40 HP through `minChipRecovery` (shared links: `bc.cr`). A 30-HP minimum accepts a final active value of 30 or 40 HP. Card values do not add together: loading order and disabling effects determine the final recovery value, which is rechecked for every published improvement.

`minCustom` specifies a minimum configured chip-choice count from 5 through 10 (shared links: `bc.cm`). The unmodified baseline is 5. NC bonuses, NumberOpen, and card bonuses/penalties determine the final count; negative card effects can lower it below the baseline and require compensation even for a minimum of 5. The constraint is checked in first-solution search, local improvement, exhaustive search, and result cleanup. It remains separate from in-battle Custom bugs, which can be forbidden through the bug rules if required. Search ordering prioritizes Custom providers, and partial +1/+2 improvements remain available until the threshold is reached.

Body preferences use an allow-list: `allowedBodies: ["Normal", "Fire", "Elec"]` accepts any of those final body elements and excludes Aqua and Wood. The UI offers independent checkboxes, with all five selected by default. The final body after card loading order is checked in every search phase; a deck with no body-changing card counts as Normal. Intermediate forbidden elements can still be overwritten by a later allowed element. Shared links store the list as `bc.ab`, and legacy `requiredBody` / `bc.bd` values remain supported as single-element requirements. If both constraints are supplied, their intersection applies. An empty list or a conflicting intersection is infeasible and is detected before deck enumeration.

Local NC improvement also tries removing each automatically added part and refilling the freed cells. A temporary loss of HP or other score is allowed inside this trial, but only a valid improvement is published. User-selected core parts and their explicit placement constraints remain fixed. Rebuilding from the core remains a separate way to replace multiple automatic parts.

Completed builds also remove automatic pure-ability parts whose full effects are already covered. For example, BodyPack covers SuprArmr, UnderShirt, AirShoes, and FloatShoes, so redundant automatic copies can be removed before filling the freed cells. Cleanup preserves every final ability/stat, the selected bug policy, required bugs, and retained parts' individual bug-level constraints. When objective scores and final stats both tie, fewer occupied cells are preferred, so removing redundancy does not require an immediate HP gain. Effective bonuses outside the optimization target, such as Rapid in an HP search, are not discarded merely to win this tie-break. This normalization applies only to valid completed builds; intermediate search states remain available for BugStop or adjacency requirements.

## Validation

```sh
pnpm typecheck
pnpm test
pnpm build
```

Tests cover data validation, shared link migration, part and color reordering, BN3 Style and ModTools restrictions, and layout regressions. `tests/solver-baseline.json` records solution counts and hashes of the complete results for 24 BN4–6 scenarios using the data conversion logic from before the refactor. These scenarios cover grid expansion, rotation, compression, same-color adjacency, and bug constraints. BN3 tests also check reference masks, board boundaries, command-line constraints, and optional compression. The deployment workflow checks types and runs tests before building and publishing.

## Documentation language

Write all repository documentation in English. This policy applies to documentation, independently of the application's UI languages.

BN6 HP+50 through HP+500 parts produce **both** `battleHp` and `damageHp` when bugged. Damage HP Bug raises Battle HP Bug by one level when a damaging hit causes flinching or Drag, up to Lv7. SuperArmor can prevent the flinch trigger; it does not remove the bug. The two types have independent tolerance rules; allowing only Battle HP does not allow bugged HP parts unless the remaining bug is neutralized. Effective BugStop absorbs both NC bugs. This correction does not change the HP/Attack priority order or simulate combat HP loss. It applies to BN6 only; BN3–5 mappings remain unchanged. Source: [N1GPedia HP parts](https://wiki.n1gp.net/HP_NaviCust_part_series_%28BN6%29).
