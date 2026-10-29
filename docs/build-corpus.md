# Known-build search

The solver first checks a compact library of known builds, then continues its existing optimization and complete search. This is a deterministic warm start. It does not train a language model or replace constraint validation.

## Coverage

The library covers BN6, BN5, BN4 and BN3. The files are `data/bn6-build-seeds.json` (146 builds), `data/bn5-build-seeds.json` (81 builds), `data/bn4-build-seeds.json` (20 builds) and `data/bn3-build-seeds.json` (10 builds).

The BN3 shapes come from the official ROM part tables, not the TREZ wiki diagrams. The wiki diagrams put 17 variants at a different offset inside the 5x5 canvas. With wiki shapes, 6 otherwise valid saves failed grid reconstruction. With ROM shapes they reconstruct exactly.

## Sources

The library was built from the user's save folders. The sources are `25年EXE对战构筑包.7z`, `EXE网战中心特供存档包24版.rar` and the Tango save folder `d:/tango/saves`. The folders contain duplicate copies of the same builds. The importer canonicalizes part order and removes duplicates, so one build appears once.

A full scan of 517 save files found 212 BN6, 166 BN5, 35 BN4 and 21 BN3 saves. The importer accepted the builds that reproduce the standard part catalog and the stored grid. Many saves were empty story saves or duplicate copies. The remaining 83 files were not detected: they belong to unsupported games (EXE1, EXE2, EXE4.5, BN5DS, Star Force), or they come from ROM hacks with a different part catalog.

One save can fail NC record or grid reconstruction. Failure here does not establish that a save is invalid in every game modification.

## Save-format corrections

BN4 patch cards use six addresses 0A to 0F. Address 0F is reserved for PET screen colors. Each address holds one card. The BN4 card dataset had 23 wrong address values. The importer now uses the official address for each card. This correction removed all BN4 import failures.

BN3 stores a part id as (template id * 4) + color-variant index. BN3 also stores the per-part compression flag in the general flag bit array. The exporter wrote the raw template id and the wrong flag location. The exporter now writes the correct id and flag bit. The BN3 reader tries the flag bits first, then searches other compression choices until the records reproduce the stored grid.

The save records use 25 part slots and the grid stores the original slot index plus one. A slot can be empty between two used slots. The reader now compares each occupied cell with its original slot index. The earlier compacted comparison rejected valid saves that had an empty slot.

## Stored data

Each file stores only part IDs, colors, placements, compression and ordered card IDs. The files do not store original save bytes, player data, source filenames or modified base HP. The application recomputes NC abilities from actual command-line contact. It does not trust imported cached combat flags.

Every lookup rechecks the current game's part catalog, selected core parts and placement restrictions, rotation settings, grid, ordered card mode, capacity, bug policy and all requested effects. It uses the user's current base HP. Duplicate core parts are matched as distinct placements. A library miss never proves infeasibility. The scan has a 100 ms scheduling budget, reports valid matches immediately, and does not restrict the subsequent complete search.

## Importing a save folder

Use the batch importer to scan a folder tree. It detects the game from each save and appends unique builds to the matching corpus file:

```sh
node scripts/import-build-corpus-all.cjs /path/to/saves          # dry run, prints a report
node scripts/import-build-corpus-all.cjs /path/to/saves --write  # append unique builds
npm test
```

To import one game only, use the single-game importer with the game ID:

```sh
node scripts/import-build-corpus.cjs bn6 /path/to/extracted/bn6 data/bn6-build-seeds.json
node scripts/import-build-corpus.cjs bn5 /path/to/new/bn5 data/bn5-build-seeds.json data/bn5-build-seeds.json
```

To append a batch and keep the current library, pass the existing corpus as the fourth argument. The importer reads that file before it writes the output. A second import of the same batch adds no duplicates.

The importers read 32/64 KB GBA battery saves for BN3, BN4, BN5 and BN6. They validate the checksum and header. They match the native JP or canonicalized NC records against the stored grid. They are not a UI importer for emulator save states. They validate geometry and card capacity before they record samples.

The benchmark prints library first-match time, whole-library lookup time, independent first-solution-pass time, and HP. These local measurements exclude Worker startup, rendering and later optimization. They are not predictions for all requests. The library can provide a stronger first result even when the independent first-solution pass is already quick.

```sh
node scripts/benchmark-build-corpus.cjs bn5
```
