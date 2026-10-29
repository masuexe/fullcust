# Bug catalog audit

The October 2026 audit checks the existing BN3–6 NC mappings and BN4–6 card catalog against the configurable bug list. BN5/6 card bug and repair categories were checked against N1GPedia and BWiki. These are the approved references for card effects; TREZ is not used. Positive and negative columns are read separately, and notes can identify a beneficial effect as a bug. Attack effects that inflict a bug on the opponent are not self-inflicted bugs.

## Separate effects

| Rule key | Effect | Scope |
| --- | --- | --- |
| `customDamage` | Fixed damage when opening the Custom Screen | BN5 NC and cards; BN6 cards |
| `customHp` | Continuous HP drain while the Custom Screen is open | NC/card sources according to game |
| `custom` | Chip-choice slot reduction | BN3/BN6 NC mappings |
| `damageHp` | Damage increases Battle HP Bug level up to Lv7 | BN6 HP NC parts and cards |
| `battleHp` | Continuous battle HP drain | NC/cards |
| `damageConfusion` | Damage triggers confusion | BN5/6 cards |
| `damageBlind` | Damage triggers blindness | BN5 cards |
| `status` | Battle-start status disorder | Game-dependent NC/card sources |
| `panelSet` | Battle-start panel change: player-side normal panels become Cracked (Lv1) or Swamp (Lv2) | BN3 NC (Set programs) |
| `poisonWalk` | Panels MegaMan steps off become Poison during battle | BN3 NC (GigaFolder1) |

Previously, normalization merged `customDamage` into `customHp`, `damageBattleHp` into `battleHp`, and `damageConfusion` into `status`. BN5 card entry damage was labeled `custom`, while on-hit statuses used the unconfigurable `damage` key. BN5's NC `custom` mapping already described entry damage; it now uses `customDamage` consistently.

Existing shared links remain readable. BN5 legacy `custom` rules migrate to `customDamage` in both policy and constraints; an explicit new `customDamage` value takes precedence. BN6 `custom` remains chip-slot loss. Other stored keys remain unchanged. New categories are independent and default to forbidden, so allowing menu HP drain no longer implicitly allows Custom Screen entry damage. Entry damage is not automatically treated as benign menu drain. Required rules check the actual distinct effect.

BN3 previously mapped both panel mechanisms to one broad `panel` rule. The battle-start panel change (`panelSet`) and the poison step bug (`poisonWalk`) are now separate keys. A legacy broad `panel` rule still matches both, and a broad forbidden `panel` entry expands to both keys. BN3 has no bug-repair cards, so no repair mapping is needed.

Some keys are levels of one in-game bug. The Modified Shot Bug (`chargeCube`, `chargeWater`, `chargeFlower`), the Weakened Buster Bug (`busterBlank1`, `busterBlank2`, `busterGuard`), the BN3 Player Movement Bug, and the BN4 Player Bug can each occur at only one level. The UI allows one Required key in each group. Selecting another required variant changes the previous one to Allowed. Constraint projection applies the same rule to older saved layouts, so the worker never receives contradictory requirements. Allowed rules can still list several variants, because they mean "any of these is acceptable".

The UI also exposes previously modeled NC categories that had no tolerance row: modified charge shots, encounters, support failure, Zenny-only rewards, slow Custom Gauge, and automatic chip use. (The HubBatch Max HP halved penalty in BN3 and BN4 is directly computed into build HP stats rather than exposed as a bug tolerance option). Availability is filtered by game. No new combat scoring weights are introduced.

## Corrected card omissions

| Card | Missing self effect |
| --- | --- |
| `136-B002` | Emotion Window Bug; malformed Japanese text prevented recognition |
| `136-A017` | Move Holy is beneficial but still counts as a repairable/overwritable panel bug, as explicitly noted by BWiki |
| `137-A003` | Moving off panels may create ice (1/4) |
| `137-A016` | Moving off panels may create grass (1/4) |
| `137-B016` | Moving off panels may create grass (1/4) |
| `137-B045` | Moving off panels may create ice (1/8) |
| `137-B043` | Normal B may unexpectedly fire a charge shot (1/8), despite repairing blank shots |

Terrain changes retain their existing `movePanel` field and now also participate in `panel` bug rules. The Buster option and card explanation cover both blanks and accidental charge shots. TopMan's repair applies before its replacement effect is recorded, so the latter is not silently erased by the same card.

BWiki lists Custom HP Lv3 for Number (`137-A014`), JapanMan (`137-A042`), Totem (`137-B017`), and Gregar (`137-C009`), and Lv1 for NapalmMan (`137-B038`). The Lv3 records are retained, and NapalmMan is corrected to Lv1. Unverified frame intervals or BN5 damage amounts are not inferred from other sources.

## Repairs and loading order

NC and card analysis share `repairsBugType`. Custom Damage repair only clears entry damage, Custom HP repair only clears menu drain, and Battle HP repair does not silently clear the separate damage-triggered HP effect. Damage Bug repair targets the on-hit family rather than every effect with the word “damage.” Status repair does not clear on-hit confusion.

Repairs affect earlier card effects, then the current card's own effects are applied. BN5/6 retain the later card for the same recorded bug type. BN4 retains its existing separate loading path. BugStop continues to neutralize NC placement bugs, while card bugs remain subject to their own rules. The BugStop first-solution preference tests NC restrictions rather than being triggered solely by card-only restrictions.

## Evidence and limits

[The checked category fixture](../tests/fixtures/modcard-bug-audit.json) records bug/repair sets independently of the application catalog. Regression tests compare every audited row, cover all recorded NC/card bug types, exercise independent required/forbidden checks and search, and verify repair/loading order. The fixture checks categories, not every probability or numeric tier.

The approved pages disagree on several records. Existing N1GPedia-compatible behavior is retained for these cases, with the BWiki alternative stored in the fixture rather than silently discarded:

| Card | N1GPedia / retained behavior | BWiki alternative |
| --- | --- | --- |
| Kilby `137-B016` | Move Grass debuff | Grass Buster positive effect |
| StoneMan `137-B031` | Move Crack debuff | Battle HP Lv2 |
| ColorMan `137-B032` | Status Bug debuff | Battle HP Lv2 |

Other numeric and ability values outside this category audit have not received a complete review. In particular, a category-level fixture is not a claim that every combat trigger or version-specific interaction is fully simulated.

Sources:

- [N1GPedia BN6 patch cards](https://wiki.n1gp.net/Patch_Cards_(BN6))
- [BWiki BN6 patch cards](https://wiki.biligame.com/wavebattlenetwork/%E6%B4%9B%E5%85%8B%E4%BA%BAEXE6/%E6%94%B9%E9%80%A0%E5%8D%A1)
- [N1GPedia BN5 patch cards](https://wiki.n1gp.net/Patch_Cards_(BN5))
- [BWiki BN5 patch cards](https://wiki.biligame.com/wavebattlenetwork/%E6%B4%9B%E5%85%8B%E4%BA%BAEXE5/%E6%94%B9%E9%80%A0%E5%8D%A1)

## BN6 terrain rules and color overflow

BN6 terrain effects now have separate final-policy keys: `panelGrass`, `panelIce`, and `panelCrack`. `movement` remains boundary warp. Each terrain key has its own forbidden/allowed/required control; a required grass effect does not allow ice, cracking, or warp. With no cards, only cracking is available. These controls describe the chance to change terrain after movement, not a guarantee that every step changes it.

Raw source card entries keep the audited `panel` category. Final analysis classifies the surviving panel write by its source. Later panel cards overwrite earlier panel effects, and Panel Bug repairs clear earlier terrain effects. The displayed `movePanel` value is derived from the surviving effect, so a repaired or overwritten grass effect cannot satisfy a requirement. This follows the approved [BWiki BN6 card table](https://wiki.biligame.com/wavebattlenetwork/%E6%B4%9B%E5%85%8B%E4%BA%BAEXE6/%E6%94%B9%E9%80%A0%E5%8D%A1).

Legacy broad `panel` rules remain readable. Explicit subtype rules override the broad default. Broad allowed/forbidden defaults expand into individual UI controls; a legacy broad required rule retains its original “any terrain bug” meaning, rather than requiring all subtypes simultaneously.

In BN4–6, five and six colors produce configurable NC `colorStatus` levels 1 and 2 (normalized to `status` for existing settings), instead of being rejected before search. On-line BugStop suppresses NC color overflow along with other NC bugs, while card bugs retain their separate policies. Sources: [BN6 Bugs](https://wiki.n1gp.net/Bugs_%28BN6%29), [BN6 BugStop](https://wiki.n1gp.net/Bug_Stop_%28BN6%29).

## Result Bug (Collect / Millions)

In BN4–6, improper placement of Collect and Millions programs produces the Result Bug (`resultZenny`), where battle rewards drop only Zenny instead of chips. Because this bug carries no in-combat debuff during NetBattles, it is treated as a benign non-combat bug and defaults to allowed in the BN5 and BN6 optimizer configurations.
