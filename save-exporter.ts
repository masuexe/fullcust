import type { Data } from "./game-data";
import { computeBuildStats, getActivePartIds } from "./effects";
import { getModCard } from "./modcards";
import type { Problem } from "./problem";
import { placeAll, type Solution } from "./solver";

export interface SaveEdition {
    id: string;
    gameId: "bn3" | "bn4" | "bn5" | "bn6";
    nameEn: string;
    nameJa: string;
    nameZh: string;
    romType: "JP" | "US";
    variant: "gregar" | "falzar" | "protoman" | "colonel" | "redsun" | "bluemoon" | "white" | "blue";
    rawPath: string;
    defaultFilename: string;
}

export const SAVE_EDITIONS: SaveEdition[] = [
    // BN6
    {
        id: "bn6_gregar_jp",
        gameId: "bn6",
        nameEn: "Cybeast Gregar (JP)",
        nameJa: "電脳獣グレイガ（日本版）",
        nameZh: "电脑兽 格雷加（日版）",
        romType: "JP",
        variant: "gregar",
        rawPath: "saves/bn6/g_jp.raw",
        defaultFilename: "Rockman_EXE6_Gregar_JP.sav",
    },
    {
        id: "bn6_falzar_jp",
        gameId: "bn6",
        nameEn: "Cybeast Falzar (JP)",
        nameJa: "電脳獣ファルザー（日本版）",
        nameZh: "电脑兽 法萨尔（日版）",
        romType: "JP",
        variant: "falzar",
        rawPath: "saves/bn6/f_jp.raw",
        defaultFilename: "Rockman_EXE6_Falzar_JP.sav",
    },
    {
        id: "bn6_gregar_us",
        gameId: "bn6",
        nameEn: "Cybeast Gregar (US)",
        nameJa: "Cybeast Gregar（北米版）",
        nameZh: "电脑兽 格雷加（美版）",
        romType: "US",
        variant: "gregar",
        rawPath: "saves/bn6/g_us.raw",
        defaultFilename: "MegaMan_BattleNetwork6_Gregar_US.sav",
    },
    {
        id: "bn6_falzar_us",
        gameId: "bn6",
        nameEn: "Cybeast Falzar (US)",
        nameJa: "Cybeast Falzar（北米版）",
        nameZh: "电脑兽 法萨尔（美版）",
        romType: "US",
        variant: "falzar",
        rawPath: "saves/bn6/f_us.raw",
        defaultFilename: "MegaMan_BattleNetwork6_Falzar_US.sav",
    },

    // BN5
    {
        id: "bn5_protoman_jp",
        gameId: "bn5",
        nameEn: "Team ProtoMan (JP)",
        nameJa: "チーム・オブ・ブルース（日本版）",
        nameZh: "布鲁斯小队（日版）",
        romType: "JP",
        variant: "protoman",
        rawPath: "saves/bn5/light_protoman_jp.raw",
        defaultFilename: "Rockman_EXE5_Team_ProtoMan_JP.sav",
    },
    {
        id: "bn5_colonel_jp",
        gameId: "bn5",
        nameEn: "Team Colonel (JP)",
        nameJa: "チーム・オブ・カーネル（日本版）",
        nameZh: "卡尼尔小队（日版）",
        romType: "JP",
        variant: "colonel",
        rawPath: "saves/bn5/light_colonel_jp.raw",
        defaultFilename: "Rockman_EXE5_Team_Colonel_JP.sav",
    },
    {
        id: "bn5_protoman_us",
        gameId: "bn5",
        nameEn: "Team ProtoMan (US)",
        nameJa: "Team ProtoMan（北米版）",
        nameZh: "布鲁斯小队（美版）",
        romType: "US",
        variant: "protoman",
        rawPath: "saves/bn5/light_protoman_us.raw",
        defaultFilename: "MegaMan_BattleNetwork5_Team_ProtoMan_US.sav",
    },
    {
        id: "bn5_colonel_us",
        gameId: "bn5",
        nameEn: "Team Colonel (US)",
        nameJa: "Team Colonel（北米版）",
        nameZh: "卡尼尔小队（美版）",
        romType: "US",
        variant: "colonel",
        rawPath: "saves/bn5/light_colonel_us.raw",
        defaultFilename: "MegaMan_BattleNetwork5_Team_Colonel_US.sav",
    },

    // BN4
    {
        id: "bn4_redsun_jp",
        gameId: "bn4",
        nameEn: "Red Sun (JP)",
        nameJa: "トーナメント レッドサン（日本版）",
        nameZh: "锦标赛 红日（日版）",
        romType: "JP",
        variant: "redsun",
        rawPath: "saves/bn4/light_hp_1000_rs_jp.raw",
        defaultFilename: "Rockman_EXE4_Red_Sun_JP.sav",
    },
    {
        id: "bn4_bluemoon_jp",
        gameId: "bn4",
        nameEn: "Blue Moon (JP)",
        nameJa: "トーナメント ブルームーン（日本版）",
        nameZh: "锦标赛 蓝月（日版）",
        romType: "JP",
        variant: "bluemoon",
        rawPath: "saves/bn4/light_hp_1000_bm_jp.raw",
        defaultFilename: "Rockman_EXE4_Blue_Moon_JP.sav",
    },
    {
        id: "bn4_redsun_us",
        gameId: "bn4",
        nameEn: "Red Sun (US)",
        nameJa: "Red Sun（北米版）",
        nameZh: "红日（美版）",
        romType: "US",
        variant: "redsun",
        rawPath: "saves/bn4/light_hp_1000_rs_us.raw",
        defaultFilename: "MegaMan_BattleNetwork4_Red_Sun_US.sav",
    },
    {
        id: "bn4_bluemoon_us",
        gameId: "bn4",
        nameEn: "Blue Moon (US)",
        nameJa: "Blue Moon（北米版）",
        nameZh: "蓝月（美版）",
        romType: "US",
        variant: "bluemoon",
        rawPath: "saves/bn4/light_hp_1000_bm_us.raw",
        defaultFilename: "MegaMan_BattleNetwork4_Blue_Moon_US.sav",
    },

    // BN3
    {
        id: "bn3_white",
        gameId: "bn3",
        nameEn: "White Version",
        nameJa: "ホワイト版",
        nameZh: "白版（通常版）",
        romType: "JP",
        variant: "white",
        rawPath: "saves/bn3/white.raw",
        defaultFilename: "Rockman_EXE3_White.sav",
    },
    {
        id: "bn3_blue",
        gameId: "bn3",
        nameEn: "Blue / Black Version",
        nameJa: "ブラック版（海外Blue版）",
        nameZh: "黑版（EXE3 Black / 蓝版）",
        romType: "JP",
        variant: "blue",
        rawPath: "saves/bn3/blue.raw",
        defaultFilename: "Rockman_EXE3_Black.sav",
    },
];

// Helper to compute raw sum checksum excluding checksum bytes
export function computeRawChecksum(buf: Uint8Array, checksumOffset: number): number {
    let sum = 0;
    for (let i = 0; i < buf.length; i++) {
        if (i < checksumOffset || i >= checksumOffset + 4) {
            sum = (sum + buf[i]) >>> 0;
        }
    }
    return sum;
}

// In-place masking function matching GBA Battle Network save format
export function applySaveMask(buf: Uint8Array, maskOffset: number): void {
    const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    const maskWord = view.getUint32(maskOffset, true);
    const maskByte = maskWord & 0xff;
    for (let i = 0; i < buf.length; i++) {
        buf[i] ^= maskByte;
    }
    view.setUint32(maskOffset, maskWord, true);
}

// Convert part color name to ROM raw color byte
export function colorNameToRaw(colorName: string): number {
    switch (colorName.toLowerCase()) {
        case "white": return 1;
        case "yellow": return 2;
        case "pink": return 3;
        case "red": return 4;
        case "blue": return 5;
        case "green": return 6;
        default: return 0;
    }
}

export interface BuildSaveOptions {
    edition: SaveEdition;
    templateBytes: Uint8Array;
    problem: Problem;
    solution?: Solution;
    data: Data;
}

/**
 * Builds a complete 64KB GBA SRAM .sav file with the NaviCust solution and Mod Cards installed.
 */
export function buildGbaSave(options: BuildSaveOptions): Uint8Array {
    const { edition, templateBytes, problem, solution, data } = options;
    if (solution && solution.length !== problem.requirements.length) {
        throw new Error("The NaviCust solution does not match the selected parts.");
    }
    if (solution && solution.length > 25) {
        throw new Error("A save supports at most 25 installed NaviCust parts.");
    }
    const hasSolution = solution !== undefined && solution.length > 0;

    // Clone template buffer
    const buf = new Uint8Array(templateBytes.length);
    buf.set(templateBytes);
    const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);

    const gameId = edition.gameId;
    const isJp = edition.romType === "JP";

    // Templates contain native WRAM, unlike Tango's internal US-canonicalized buffer.
    // A JP game header with US NC offsets makes Tango shift the NC data a second
    // time: the color bar still works, but the part records and grid no longer agree.
    // The game also reads its cached abilities from the native stats offset.
    const bn6GridOffset = isJp ? 0x410c : 0x414c;
    const bn6PartsOffset = isJp ? 0x4150 : 0x4190;
    const bn6NaviStatsOffset = isJp ? 0x478c : 0x47cc;
    const bn6AnticheatOffset = isJp ? 0x4ff8 : 0x5038;

    // 1. Process NaviCust Installation
    if (hasSolution && solution) {
        const placements = solution;
        const requirements = problem.requirements;

        // Occupancy grid via placeAll
        const occupancy = placeAll(data.parts, requirements, placements, data.gridSettings);

        // A. Materialized Grid
        if (gameId === "bn6") {
            const gridOffset = bn6GridOffset;
            buf.fill(0, gridOffset, gridOffset + 0x44);
            for (let i = 0; i < 49 && i < occupancy.length; i++) {
                const cell = occupancy[i];
                buf[gridOffset + i] = cell !== null ? (cell + 1) : 0;
            }
        } else if (gameId === "bn5") {
            const gridOffset = 0x4d48;
            buf.fill(0, gridOffset, gridOffset + 0x24);
            for (let i = 0; i < 25 && i < occupancy.length; i++) {
                const cell = occupancy[i];
                buf[gridOffset + i] = cell !== null ? (cell + 1) : 0;
            }
        } else if (gameId === "bn4") {
            const gridOffset = 0x4540;
            buf.fill(0, gridOffset, gridOffset + 0x24);
            for (let i = 0; i < 25 && i < occupancy.length; i++) {
                const cell = occupancy[i];
                buf[gridOffset + i] = cell !== null ? (cell + 1) : 0;
            }
        } else if (gameId === "bn3") {
            const gridOffset = 0x1d90;
            buf.fill(0, gridOffset, gridOffset + 25);
            for (let i = 0; i < 25 && i < occupancy.length; i++) {
                const cell = occupancy[i];
                buf[gridOffset + i] = cell !== null ? (cell + 1) : 0;
            }
        }

        // B. Parts Array
        const partsOffset = gameId === "bn6" ? bn6PartsOffset
            : gameId === "bn5" ? 0x4d6c
            : gameId === "bn4" ? 0x4564
            : 0x1300; // bn3

        // Clear 25 slots
        buf.fill(0, partsOffset, partsOffset + 25 * 8);

        for (let i = 0; i < placements.length && i < 25; i++) {
            const req = requirements[i];
            const meta = data.partMetas[req.partIndex];
            const p = placements[i];

            let rawId: number;
            if (gameId === "bn3") {
                rawId = meta.id;
                if (p.compressed) {
                    const flagBit = 0x02e0 + rawId;
                    const byteIdx = flagBit >> 3;
                    const bitMask = 1 << (flagBit & 7);
                    if (byteIdx < buf.length) {
                        buf[byteIdx] |= bitMask;
                    }
                }
            } else {
                // In BN4, BN5, BN6, rawId = (part.id * 4) + variant_index
                let variantIdx = 0;
                for (let prev = 0; prev < req.partIndex; prev++) {
                    if (data.partMetas[prev].id === meta.id) {
                        variantIdx++;
                    }
                }
                rawId = (meta.id * 4) + variantIdx;
            }

            const slotOffset = partsOffset + i * 8;
            if (gameId === "bn6") {
                const col = p.loc.position.x + 3;
                const row = p.loc.position.y + 3;
                buf[slotOffset + 0] = rawId & 0xff;
                buf[slotOffset + 1] = 0;
                buf[slotOffset + 2] = 0;
                buf[slotOffset + 3] = col & 0xff;
                buf[slotOffset + 4] = row & 0xff;
                buf[slotOffset + 5] = p.loc.rotation & 0xff;
                buf[slotOffset + 6] = p.compressed ? 1 : 0;
                buf[slotOffset + 7] = 0;
            } else if (gameId === "bn5" || gameId === "bn4") {
                const col = p.loc.position.x + 2;
                const row = p.loc.position.y + 2;
                buf[slotOffset + 0] = rawId & 0xff;
                buf[slotOffset + 1] = 0;
                buf[slotOffset + 2] = col & 0xff;
                buf[slotOffset + 3] = row & 0xff;
                buf[slotOffset + 4] = p.loc.rotation & 0xff;
                buf[slotOffset + 5] = p.compressed ? 1 : 0;
                buf[slotOffset + 6] = 0;
                buf[slotOffset + 7] = 0;
            } else {
                // BN3
                const col = p.loc.position.x + 2;
                const row = p.loc.position.y + 2;
                buf[slotOffset + 0] = rawId & 0xff;
                buf[slotOffset + 1] = 0;
                buf[slotOffset + 2] = col & 0xff;
                buf[slotOffset + 3] = row & 0xff;
                buf[slotOffset + 4] = p.loc.rotation & 0xff;
                buf[slotOffset + 5] = 0;
                buf[slotOffset + 6] = 0;
                buf[slotOffset + 7] = 0;
            }
        }

        // C. Color Bar (distinct colors in placement order, up to 6 colors)
        if (gameId === "bn6" || gameId === "bn5" || gameId === "bn4") {
            const colorBarOffset = gameId === "bn6" ? 0x90 : gameId === "bn5" ? 0x1e8 : 0x190;
            buf.fill(0, colorBarOffset, colorBarOffset + 6);
            const placedColors: number[] = [];
            for (let i = 0; i < placements.length; i++) {
                const req = requirements[i];
                const part = data.parts[req.partIndex];
                const rawColor = colorNameToRaw(data.colors[part.color] || "");
                if (rawColor > 0 && !placedColors.includes(rawColor)) {
                    placedColors.push(rawColor);
                }
            }
            for (let slot = 0; slot < 6 && slot < placedColors.length; slot++) {
                buf[colorBarOffset + slot] = placedColors[slot];
            }
        }
    } else {
        // Clear NaviCust grid if no solution
        if (gameId === "bn6") {
            buf.fill(0, bn6GridOffset, bn6GridOffset + 0x44);
            buf.fill(0, bn6PartsOffset, bn6PartsOffset + 25 * 8);
            buf.fill(0, 0x90, 0x90 + 6);
        } else if (gameId === "bn5") {
            buf.fill(0, 0x4d48, 0x4d48 + 0x24);
            buf.fill(0, 0x4d6c, 0x4d6c + 25 * 8);
            buf.fill(0, 0x1e8, 0x1e8 + 6);
        } else if (gameId === "bn4") {
            buf.fill(0, 0x4540, 0x4540 + 0x24);
            buf.fill(0, 0x4564, 0x4564 + 25 * 8);
            buf.fill(0, 0x190, 0x190 + 6);
        } else if (gameId === "bn3") {
            buf.fill(0, 0x1d90, 0x1d90 + 25);
            buf.fill(0, 0x1300, 0x1300 + 25 * 8);
        }
    }

    // 2. Mod Cards Injection
    const modCards = problem.modCards || [];
    if (gameId === "bn6") {
        buf[0x65f0] = modCards.length & 0xff;
        buf.fill(0, 0x6620, 0x6620 + 32);
        for (let slot = 0; slot < modCards.length && slot < 32; slot++) {
            const card = getModCard(modCards[slot], "bn6");
            if (card) {
                buf[0x6620 + slot] = card.cardNo & 0x7f;
            }
        }
        // Anti-cheat table
        const mask = edition.variant === "gregar" ? 0x43 : 0x8d;
        for (let id = 0; id < 0x200; id++) {
            buf[bn6AnticheatOffset + id] = buf[0x0670 + id] ^ mask;
        }
    } else if (gameId === "bn5") {
        buf[0x79a0] = modCards.length & 0xff;
        buf.fill(0, 0x79d0, 0x79d0 + 32);
        for (let slot = 0; slot < modCards.length && slot < 32; slot++) {
            const card = getModCard(modCards[slot], "bn5");
            if (card) {
                buf[0x79d0 + slot] = card.cardNo & 0x7f;
            }
        }
        // Anti-cheat table
        const mask = edition.variant === "protoman" ? 0x43 : 0x8d;
        for (let id = 0; id < 0x200; id++) {
            buf[0x60dc + id] = buf[0x1220 + id] ^ mask;
        }
    } else if (gameId === "bn4") {
        // BN4 slots 0A through 0F (6 slots)
        buf.fill(0xff, 0x464c, 0x464c + 6);
        buf.fill(0xff, 0x4653, 0x4653 + 6);
        for (const cardId of modCards) {
            const card = getModCard(cardId, "bn4");
            if (card && card.slot) {
                const slotIdx = parseInt(card.slot.substring(1), 16) - 10;
                if (slotIdx >= 0 && slotIdx < 6) {
                    buf[0x464c + slotIdx] = card.cardNo & 0xff;
                }
            }
        }
        // Anti-cheat table
        const mask = edition.variant === "redsun" ? 0x43 : 0x31;
        for (let id = 0; id < 0x100; id++) {
            buf[0x5d14 + id] = buf[0x03d0 + id] ^ mask;
        }
    }

    // 3. Synchronize In-Game Navi Stats Block
    // In GBA Battle Network games, battles read the cached in-memory/SRAM status block.
    // If this is not updated to match the installed parts, MegaMan enters battle with 1000 HP,
    // Buster level 1, and no NaviCust abilities until the player visits the NC screen and clicks RUN.
    const partIds = hasSolution && solution ? getActivePartIds(data.partMetas, problem.requirements,
        placeAll(data.parts, problem.requirements, solution, data.gridSettings), data.gridSettings) : [];
    const stats = computeBuildStats(gameId, partIds, problem.modCards, problem.baseHp ?? 1000);

    if (gameId === "bn6") {
        // Buster stats are zero-based; card-enhanced Attack can reach level 10.
        buf[bn6NaviStatsOffset + 0x01] = Math.max(0, Math.min(9, stats.attack - 1));
        buf[bn6NaviStatsOffset + 0x02] = Math.max(0, Math.min(4, stats.rapid - 1));
        buf[bn6NaviStatsOffset + 0x03] = Math.max(0, Math.min(4, stats.charge - 1));

        // B+Left ability: Shield 0x3b, Reflect 0x8b, AntiDamage 0x3d
        let bLeft = 0xff;
        if (stats.modBLeft === "shield" || stats.abilities.includes("shield")) {
            bLeft = 0x3b;
        } else if (stats.modBLeft === "reflect" || stats.abilities.includes("reflect")) {
            bLeft = 0x8b;
        } else if (stats.modBLeft === "antiDamage" || stats.abilities.includes("antiDamage")) {
            bLeft = 0x3d;
        }
        buf[bn6NaviStatsOffset + 0x07] = bLeft;

        // Custom window: clamped 5..10
        buf[bn6NaviStatsOffset + 0x0a] = Math.max(2, Math.min(10, stats.custom));
        // Folder limits: mega 0..10, giga 0..10
        buf[bn6NaviStatsOffset + 0x0b] = Math.max(0, Math.min(10, stats.megaFolder));
        buf[bn6NaviStatsOffset + 0x0c] = Math.max(0, Math.min(10, stats.gigaFolder));

        // RUN caches these flags in NaviStats; writing the grid alone does not
        // activate them. Keep absent abilities clear instead of inheriting the template.
        const abilityOffsets: [string, number][] = [
            ["floatShoes", 0x1b], ["airShoes", 0x1c], ["underShirt", 0x1d],
            ["sneakRun", 0x1e], ["bugStop", 0x1f], ["superArmor", 0x23],
            ["humor", 0x25], ["millions", 0x33], ["slipRunner", 0x35],
            ["autoHeal", 0x36], ["poem", 0x5f], ["chipShuffle", 0x60],
        ];
        for (const [ability, offset] of abilityOffsets) {
            buf[bn6NaviStatsOffset + offset] = stats.abilities.includes(ability) ? 1 : 0;
        }
        buf[bn6NaviStatsOffset + 0x06] = (stats.abilities.includes("firstBarrier") || stats.abilities.includes("firstBarrier100") || stats.abilities.includes("firstBarrier200") || stats.abilities.includes("firstDreamAura") || stats.modFirstBarrier) ? 1 : 0;
        buf[bn6NaviStatsOffset + 0x0d] = (stats.abilities.includes("rush") ? 1 : 0)
            | (stats.abilities.includes("beat") ? 2 : 0)
            | (stats.abilities.includes("tango") ? 4 : 0);
        buf[bn6NaviStatsOffset + 0x26] = stats.abilities.includes("collect") ? 2 : 0;
        const encounterAbilities: [string, number][] = [
            ["oilBody", 2], ["fish", 4], ["battery", 8], ["jungle", 16],
        ];
        buf[bn6NaviStatsOffset + 0x27] = encounterAbilities.find(([ability]) =>
            stats.abilities.includes(ability))?.[1] ?? 0x1f;
        buf[bn6NaviStatsOffset + 0x61] = partIds.includes(15) ? 1 : 0;

        // HP stats
        view.setUint16(bn6NaviStatsOffset + 0x3e, stats.baseHp, true);
        view.setUint16(bn6NaviStatsOffset + 0x40, stats.finalHp, true);
        view.setUint16(bn6NaviStatsOffset + 0x42, stats.finalHp, true);

        // Chip recovery
        view.setUint16(bn6NaviStatsOffset + 0x50, stats.modChipRecovery ?? 0, true);
    } else if (gameId === "bn5") {
        const bn5NaviStatsOffset = 0x52a8;

        // Buster stats are zero-based; doubled Attack can reach level 10.
        buf[bn5NaviStatsOffset + 0x01] = Math.max(0, Math.min(9, stats.attack - 1));
        buf[bn5NaviStatsOffset + 0x02] = Math.max(0, Math.min(4, stats.rapid - 1));
        buf[bn5NaviStatsOffset + 0x03] = Math.max(0, Math.min(4, stats.charge - 1));

        // First barrier
        buf[bn5NaviStatsOffset + 0x06] = (stats.abilities.includes("firstBarrier") || stats.abilities.includes("firstBarrier100") || stats.abilities.includes("firstBarrier200") || stats.abilities.includes("firstDreamAura") || stats.modFirstBarrier) ? 1 : 0;

        // B+Left ability: Shield 0x3b, Reflect 0x8b, AntiDamage 0x3d, None 0xff
        let bLeft = 0xff;
        if (stats.modBLeft === "shield" || stats.abilities.includes("shield")) {
            bLeft = 0x3b;
        } else if (stats.modBLeft === "reflect" || stats.abilities.includes("reflect")) {
            bLeft = 0x8b;
        } else if (stats.modBLeft === "antiDamage" || stats.abilities.includes("antiDamage")) {
            bLeft = 0x3d;
        }
        buf[bn5NaviStatsOffset + 0x07] = bLeft;

        // Custom window: clamped 5..10
        buf[bn5NaviStatsOffset + 0x0a] = Math.max(2, Math.min(10, stats.custom));
        // Folder limits: mega 0..10, giga 0..10
        buf[bn5NaviStatsOffset + 0x0b] = Math.max(0, Math.min(10, stats.megaFolder));
        buf[bn5NaviStatsOffset + 0x0c] = Math.max(0, Math.min(10, stats.gigaFolder));

        // Support navis
        buf[bn5NaviStatsOffset + 0x0d] = (stats.abilities.includes("rush") ? 1 : 0)
            | (stats.abilities.includes("beat") ? 2 : 0)
            | (stats.abilities.includes("tango") ? 4 : 0);

        // Ability flags
        const bn5AbilityOffsets: [string[], number][] = [
            [["floatShoes"], 0x1b],
            [["airShoes"], 0x1c],
            [["underShirt"], 0x1d],
            [["sneakRun"], 0x1e],
            [["bugStop"], 0x1f],
            [["superArmor"], 0x23],
            [["humor"], 0x25],
            [["millions"], 0x33],
            [["slipRunner", "autoRun"], 0x35],
            [["autoHeal"], 0x36],
            [["chivalry"], 0x5e],
            [["poem"], 0x5f],
            [["soulClean", "soulCleanse"], 0x60],
        ];
        for (const [abs, offset] of bn5AbilityOffsets) {
            buf[bn5NaviStatsOffset + offset] = abs.some(a => stats.abilities.includes(a)) ? 1 : 0;
        }
        buf[bn5NaviStatsOffset + 0x26] = stats.abilities.includes("collect") ? 2 : 0;
        const encounterAbilities: [string, number][] = [
            ["oilBody", 2], ["fish", 4], ["battery", 8], ["jungle", 16],
        ];
        buf[bn5NaviStatsOffset + 0x27] = encounterAbilities.find(([ability]) =>
            stats.abilities.includes(ability))?.[1] ?? 0x1f;

        // HP stats (0x52a8 + 0x3e = 0x52e6 base max HP, 0x52e8 current HP, 0x52ea effective max HP)
        view.setUint16(bn5NaviStatsOffset + 0x3e, stats.baseHp, true);
        view.setUint16(bn5NaviStatsOffset + 0x40, stats.finalHp, true);
        view.setUint16(bn5NaviStatsOffset + 0x42, stats.finalHp, true);
        view.setUint16(bn5NaviStatsOffset + 0x44, 1000, true);

        // Chip recovery
        view.setUint16(bn5NaviStatsOffset + 0x50, stats.modChipRecovery ?? 0, true);
    } else if (gameId === "bn4") {
        // Overworld HP (current HP at 0x21c8, effective max HP at 0x21ca)
        view.setUint16(0x21c8, stats.finalHp, true);
        view.setUint16(0x21ca, stats.finalHp, true);

        // In-Battle Player Navi Record at 0x4ea0 (Slot 1)
        const bn4NaviOffset = 0x4ea0;

        // Abilities at +0x01..+0x04
        buf[bn4NaviOffset + 0x01] = stats.abilities.includes("superArmor") ? 1 : 0;
        buf[bn4NaviOffset + 0x02] = stats.abilities.includes("floatShoes") ? 1 : 0;
        buf[bn4NaviOffset + 0x03] = stats.abilities.includes("airShoes") ? 1 : 0;
        buf[bn4NaviOffset + 0x04] = stats.abilities.includes("underShirt") ? 1 : 0;

        // Buster stats: 0-based in GBA memory (0..4 for level 1..5)
        buf[bn4NaviOffset + 0x05] = Math.max(0, Math.min(4, stats.attack - 1));
        buf[bn4NaviOffset + 0x06] = Math.max(0, Math.min(4, stats.rapid - 1));
        buf[bn4NaviOffset + 0x07] = Math.max(0, Math.min(4, stats.charge - 1));

        // B+Left ability: Shield 0x25, Reflect 0x26, AntiMagic 0x27, None 0xff
        let bLeft = 0xff;
        if (stats.modBLeft === "shield" || stats.abilities.includes("shield")) {
            bLeft = 0x25;
        } else if (stats.modBLeft === "reflect" || stats.abilities.includes("reflect")) {
            bLeft = 0x26;
        } else if (stats.modBLeft === "antiDamage" || stats.modBLeft === "antiMagic" ||
                   stats.abilities.includes("antiDamage") || stats.abilities.includes("antiMagic")) {
            bLeft = 0x27;
        }
        buf[bn4NaviOffset + 0x0c] = bLeft;

        // Custom window: clamped 5..8
        buf[bn4NaviOffset + 0x12] = Math.max(2, Math.min(8, stats.custom));
        // Folder limits: mega 0..10, giga 0..10
        buf[bn4NaviOffset + 0x13] = Math.max(0, Math.min(10, stats.megaFolder));
        buf[bn4NaviOffset + 0x14] = Math.max(0, Math.min(10, stats.gigaFolder));

        // Other abilities
        buf[bn4NaviOffset + 0x16] = stats.abilities.includes("sneakRun") ? 1 : 0;

        // Encounter element (oilBody: 2, fish: 3, battery: 4, jungle: 5, default: 0x1f)
        const bn4EncounterAbilities: [string, number][] = [
            ["oilBody", 2], ["fish", 3], ["battery", 4], ["jungle", 5],
        ];
        buf[bn4NaviOffset + 0x17] = bn4EncounterAbilities.find(([ability]) =>
            stats.abilities.includes(ability))?.[1] ?? 0x1f;

        buf[bn4NaviOffset + 0x19] = stats.abilities.includes("collect") ? 1 : 0;
        buf[bn4NaviOffset + 0x1c] = stats.abilities.includes("humor") ? 1 : 0;
        buf[bn4NaviOffset + 0x1d] = stats.abilities.includes("bugStop") ? 1 : 0;
        buf[bn4NaviOffset + 0x1e] = (stats.abilities.includes("soulClean") || stats.abilities.includes("soulCleanse")) ? 1 : 0;
        buf[bn4NaviOffset + 0x21] = (stats.abilities.includes("firstBarrier") || stats.abilities.includes("firstBarrier100") || stats.abilities.includes("firstBarrier200") || stats.abilities.includes("firstDreamAura") || stats.modFirstBarrier) ? 1 : 0;

        // HPs in battle record
        view.setUint16(bn4NaviOffset + 0x30, stats.baseHp, true);
        view.setUint16(bn4NaviOffset + 0x32, stats.finalHp, true);
        view.setUint16(bn4NaviOffset + 0x34, stats.finalHp, true);
        view.setUint16(bn4NaviOffset + 0x36, stats.finalHp, true);
    } else if (gameId === "bn3") {
        const hpMemCount = Math.max(0, Math.min(45, Math.floor((stats.baseHp - 100) / 20)));
        buf[0x1a20] = hpMemCount;
    }

    // 4. Rebuild Checksum
    if (gameId === "bn6") {
        const variantAdd = edition.variant === "gregar" ? 0x72 : 0x18;
        const cs = (computeRawChecksum(buf, 0x1c6c) + variantAdd) >>> 0;
        view.setUint32(0x1c6c, cs, true);
    } else if (gameId === "bn5") {
        const variantAdd = edition.variant === "protoman" ? 0x72 : 0x18;
        const cs = (computeRawChecksum(buf, 0x29dc) + variantAdd) >>> 0;
        view.setUint32(0x29dc, cs, true);
    } else if (gameId === "bn4") {
        const variantAdd = edition.variant === "redsun" ? 0x16 : 0x22;
        const cs = (computeRawChecksum(buf, 0x21e8) + variantAdd - (isJp ? buf[0] : 0)) >>> 0;
        view.setUint32(0x21e8, cs, true);
    } else if (gameId === "bn3") {
        const variantAdd = edition.variant === "white" ? 0x16 : 0x22;
        const cs = (computeRawChecksum(buf, 0x1dd8) + variantAdd) >>> 0;
        view.setUint32(0x1dd8, cs, true);
    }

    // 5. Create 64KB SRAM Dump with Mask
    const sram = new Uint8Array(0x10000);
    const startOffset = (gameId === "bn3" || gameId === "bn4") ? 0 : 0x0100;
    sram.set(buf, startOffset);

    if (gameId === "bn6") {
        applySaveMask(sram.subarray(0x0100, 0x0100 + buf.length), 0x1064);
    } else if (gameId === "bn5") {
        applySaveMask(sram.subarray(0x0100, 0x0100 + buf.length), 0x1a34);
    } else if (gameId === "bn4") {
        applySaveMask(sram.subarray(0, buf.length), 0x1554);
    }
    // BN3 has no masking and starts at offset 0

    return sram;
}

/**
 * Triggers a download of a Uint8Array binary file in the browser.
 */
export function downloadSaveFile(data: Uint8Array, filename: string): void {
    const blob = new Blob([data.buffer as ArrayBuffer], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * Fetches the raw template bytes for an edition.
 */
export async function fetchSaveTemplate(edition: SaveEdition): Promise<Uint8Array> {
    let url = edition.rawPath;
    if (typeof window !== "undefined") {
        const base = document.baseURI || window.location.href;
        url = new URL(edition.rawPath, base).href;
    }
    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`Failed to load save template: ${edition.rawPath} (${res.statusText})`);
    }
    const arrayBuffer = await res.arrayBuffer();
    return new Uint8Array(arrayBuffer);
}
