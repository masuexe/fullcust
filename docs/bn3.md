# BN3 / EXE3 support

## Data sources

- [The Rockman EXE Zone: NaviCustomizer (MMBN3), revision 25485](https://www.therockmanexezone.com/wiki/index.php?title=NaviCustomizer_%28MMBN3%29&oldid=25485): part diagrams, colors, compression, and Style compatibility.
- [Tango's original BN3 data research](https://github.com/tangobattle/tango/blob/main/tango-gamesupport-bn3-dataview/src/rom/navicust.rs): original program template identifiers. The companion [ROM data reader](https://github.com/tangobattle/tango/blob/main/tango-gamesupport-bn3-dataview/src/rom/mod.rs) documents color and bitmap encoding. No Tango implementation code is included in this project.
- [Capcom's original Japanese manual, hosted by Nintendo](https://www.nintendo.co.jp/data/software/manual/man_PBQJ_00.pdf): the game's NaviCustomizer rules.
- [Estil's original NaviCust setup guide](https://gamefaqs.gamespot.com/gba/915457-mega-man-battle-network-3-blue-version/faqs/44175): expansion sizes and the restriction to one Error Code at a time.

The catalog contains 50 program templates and 65 color variants on a 5×5 shape canvas. It includes programs from both White / Blue (EXE3 / EXE3 Black), including programs obtainable through trading. The orange BrakChrg variant is the temporary ModTools demonstration part, not a normal inventory reward. Inventory quantities and acquisition requirements are not enforced.

## Layout and compatibility

The board can be 4×4, 5×4, or 5×5, with no out-of-bounds placement. The command line is row 2, counting from zero. Each shape has separate compressed and uncompressed masks. BN3 compression cannot be undone in-game; select the state that matches your inventory.

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

Save the source HTML and run the standard-library-only importer from the repository root:

```sh
curl -fsSL 'https://www.therockmanexezone.com/wiki/index.php?title=NaviCustomizer_%28MMBN3%29&oldid=25485' -o /tmp/bn3.html
python3 scripts/import-bn3.py --html /tmp/bn3.html
pnpm test
```

The diagrams mark occupied cells with a block and cells removed by compression with 50% opacity. The importer preserves the 5×5 coordinates, treats nested texture elements as part of their enclosing cell, and creates one record per listed color. It rejects unexpected catalogs, ambiguous cells, and malformed dimensions. Review source changes before updating the dataset; do not infer BN3 shapes from later games.
