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

## Validation

```sh
pnpm typecheck
pnpm test
pnpm build
```

Tests cover data validation, shared link migration, part and color reordering, BN3 Style and ModTools restrictions, and layout regressions. `tests/solver-baseline.json` records solution counts and hashes of the complete results for 24 BN4–6 scenarios using the data conversion logic from before the refactor. These scenarios cover grid expansion, rotation, compression, same-color adjacency, and bug constraints. BN3 tests also check reference masks, board boundaries, command-line constraints, and optional compression. The deployment workflow checks types and runs tests before building and publishing.

## Documentation language

Write all repository documentation in English. This policy applies to documentation, independently of the application's UI languages.
