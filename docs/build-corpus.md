# Known-build search

The solver first checks a compact library of known BN6 builds, then continues its existing optimization and complete search. This is a deterministic warm start. It does not train a language model or replace constraint validation.

The user supplied `25年EXE对战构筑包.7z`. Its 209 battery saves span multiple games. The BN6 subset contains 91 saves with recognized JP/US headers and valid checksums. The importer accepted 80: four were empty; after canonicalizing part order and removing duplicates, 70 nonempty layouts remain. Ten saves failed NC record/grid reconstruction and one exceeded 80 MB. Those eleven are excluded; failure here does not establish that a save is invalid in every game modification.

Only part IDs, colors, placements, compression and ordered card IDs are stored in `data/bn6-build-seeds.json` (about 19 KB). Original save bytes, player data, source filenames and modified base HP are not included. NC abilities are recomputed from actual command-line contact; imported cached combat flags are not trusted.

Each lookup rechecks the current game's part catalog, selected core parts and placement restrictions, rotation settings, grid, ordered card mode, capacity, bug policy and all requested effects. It uses the user's current base HP. Duplicate core parts are matched as distinct placements. A library miss never proves infeasibility. The scan has a 100 ms scheduling budget, reports valid matches immediately, and does not restrict the subsequent complete search.

The initial library covers only BN6 and known layouts. It cannot promise a quick first result for arbitrary new combinations. Future improvements can add small edits around retrieved builds and use measured search outcomes to prioritize branches. Such ranking must leave the complete fallback available.

To regenerate, first extract the BN6 saves into a temporary directory, then run:

```sh
node scripts/import-build-corpus.cjs /path/to/extracted/bn6 data/bn6-build-seeds.json
npm test
node scripts/benchmark-build-corpus.cjs
```

The offline reader currently accepts 32/64 KB BN6 GBA battery saves, validates checksum and header, and matches native JP or canonicalized NC records against the stored grid. It is not a UI importer for emulator save states. It validates geometry and card capacity before recording samples.

The benchmark prints library first-match time, whole-library lookup time, independent first-solution-pass time, and HP for three concrete cases. These local measurements exclude Worker startup, rendering and later optimization; they are not predictions for all requests. The library can provide a stronger first result even when the independent first-solution pass is already quick.
