# BN3 / EXE3 support

## Data sources

- The official BN3 ROM part tables: the JP White/Blue (`exe3.gba`, `exe3b.gba`) and US White/Blue (`bn3.gba`, `bn3b.gba`) `ncp_data` tables. The importer reads the 5x5 uncompressed and compressed bitmaps, the color byte and the solid flag for every part.
- [The Rockman EXE Zone: NaviCustomizer (MMBN3)](https://www.rockmanexezone.com/wiki/index.php?title=NaviCustomizer_%28MMBN3%29): part names, color variants, Style compatibility, and program template order.
- [Tango's original BN3 data research](https://github.com/tangobattle/tango/blob/main/tango-gamesupport-bn3-dataview/src/rom/navicust.rs): original program template identifiers. The companion [ROM data reader](https://github.com/tangobattle/tango/blob/main/tango-gamesupport-bn3-dataview/src/rom/mod.rs) documents color and bitmap encoding. No Tango implementation code is included in this project.
- [Capcom's original Japanese manual, hosted by Nintendo](https://www.nintendo.co.jp/data/software/manual/man_PBQJ_00.pdf): the game's NaviCustomizer rules.
- [Estil's original NaviCust setup guide](https://gamefaqs.gamespot.com/gba/915457-mega-man-battle-network-3-blue-version/faqs/44175): expansion sizes and the restriction to one Error Code at a time.

The catalog contains 50 program templates and 65 color variants on a 5x5 shape canvas. It includes programs from both White / Blue (EXE3 / EXE3 Black), including programs obtainable through trading. The orange BrakChrg variant is the temporary ModTools demonstration part, not a normal inventory reward. Inventory quantities and acquisition requirements are not enforced.

The TREZ wiki diagrams agree with the ROM for 48 of the 65 variants. For 17 variants the wiki draws the shape at a different position inside the 5x5 canvas, or draws a different compressed shape. The game uses the ROM bitmap and centers the full 5x5 canvas on the saved position. A wiki shape therefore places the part one cell away from the game. The dataset uses the ROM bitmaps for all shapes. Names and colors still come from the wiki.

## Layout and compatibility

The board can be 4x4, 5x4, or 5x5, with no out-of-bounds placement. The command line is row 2, counting from zero. Each shape has separate compressed and uncompressed masks. BN3 compression cannot be undone in-game; select the state that matches your inventory.

All Styles accept white, pink, and yellow. The selected Style may add one color:

| Style | Additional color |
| --- | --- |
| Normal | None |
| Guts, Shadow | Red |
| Custom, Shield | Blue |
| Team, Ground | Green |
| Bug | Gray |

Purple and orange are incompatible with every Style. Enabling ModTools permits one incompatible part, requiring its in-game Error Code. A second incompatible part is rejected even if it has the same color as the first. This check happens before the placement worker starts because moving the parts cannot change their color compatibility.

Style and ModTools settings are included in shared layouts. BN3 uses the current versioned link format; there are no preexisting unversioned BN3 links to migrate.

## Scope

This is a layout planner. Bug constraints count placement violations, rather than simulating combat effects. Intrinsic program effects and bugs, BugStop, Style abilities, Extra Codes, and the actual Error Code entry process are not simulated. The planner does not filter programs by edition or verify which programs and spinners the player owns.

## Rebuilding the dataset

Place the four ROM files in one directory. Then rebuild the shapes from the ROM part tables:

```sh
python3 scripts/import-bn3-rom.py --rom-dir ../gba/roms
pnpm test
```

The script reads the `ncp_data` table from each ROM, checks that the four versions agree, and writes the 5x5 masks into `data/bn3.json`. It keeps the existing names, Chinese names, colors and part order. It reports every changed variant.

The HTML importer `scripts/import-bn3.py` can rebuild the name and color catalog from the TREZ wiki page. Do not use it for shapes. The wiki diagrams are not the ROM bitmaps for 17 variants.
