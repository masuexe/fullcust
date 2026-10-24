import { getPartName, Lang } from "./i18n";
import type { GridSettings, Requirement } from "./solver";

export interface PartEffect {
    hp?: number;
    attack?: number;
    rapid?: number;
    charge?: number;
    attackMax?: boolean;
    rapidMax?: boolean;
    chargeMax?: boolean;
    custom?: number;
    numberOpen?: boolean;
    megaFolder?: number;
    gigaFolder?: number;
    abilities?: string[];
}

export interface BuildStats {
    hp: number;
    attack: number;
    rapid: number;
    charge: number;
    attackMax: boolean;
    rapidMax: boolean;
    chargeMax: boolean;
    custom: number;
    megaFolder: number;
    gigaFolder: number;
    abilities: string[];
}

export const BN6_PART_EFFECTS: Record<number, PartEffect> = {
    1: { abilities: ["superArmor"] },
    2: { custom: 1 },
    3: { custom: 2 },
    4: { megaFolder: 1 },
    5: { megaFolder: 2 },
    6: { gigaFolder: 1 },
    7: { abilities: ["firstBarrier"] },
    8: { abilities: ["shield"] },
    9: { abilities: ["reflect"] },
    10: { abilities: ["antiDamage"] },
    11: { abilities: ["floatShoes"] },
    12: { abilities: ["airShoes"] },
    13: { abilities: ["underShirt"] },
    14: { abilities: ["chipShuffle"] },
    15: { numberOpen: true },
    16: { abilities: ["sneakRun"] },
    17: { abilities: ["oilBody"] },
    18: { abilities: ["fish"] },
    19: { abilities: ["battery"] },
    20: { abilities: ["jungle"] },
    21: { abilities: ["collect"] },
    22: { abilities: ["millions"] },
    23: { abilities: ["humor"] },
    24: { abilities: ["poem"] },
    25: { abilities: ["slipRunner"] },
    26: { abilities: ["autoHeal"] },
    27: { attack: 3, rapid: 3, charge: 3 },
    28: { abilities: ["superArmor", "underShirt", "floatShoes", "airShoes"] },
    29: { custom: 1, megaFolder: 1 },
    30: { custom: 2, megaFolder: 2 },
    31: { abilities: ["bugStop"] },
    32: { abilities: ["rush"] },
    33: { abilities: ["beat"] },
    34: { abilities: ["tango"] },
    35: { attack: 1 },
    36: { rapid: 1 },
    37: { charge: 1 },
    38: { attackMax: true },
    39: { rapidMax: true },
    40: { chargeMax: true },
    41: { hp: 50 },
    42: { hp: 100 },
    43: { hp: 200 },
    44: { hp: 300 },
    45: { hp: 400 },
    46: { hp: 500 },
};

export const GAME_EFFECTS: Record<string, Record<number, PartEffect>> = {
    bn6: BN6_PART_EFFECTS,
};

export function getPartEffect(gameId: string, partId: number): PartEffect | undefined {
    return GAME_EFFECTS[gameId]?.[partId];
}

export function computeBuildStats(gameId: string, partIds: number[]): BuildStats {
    let hp = 0;
    let attackBonus = 0;
    let rapidBonus = 0;
    let chargeBonus = 0;
    let attackMax = false;
    let rapidMax = false;
    let chargeMax = false;
    let customBonus = 0;
    let numberOpen = false;
    let megaFolderBonus = 0;
    let gigaFolderBonus = 0;
    const abilitySet = new Set<string>();

    const effectsTable = GAME_EFFECTS[gameId];
    if (effectsTable) {
        for (const pid of partIds) {
            const effect = effectsTable[pid];
            if (!effect) continue;

            if (effect.hp) hp += effect.hp;
            if (effect.attack) attackBonus += effect.attack;
            if (effect.rapid) rapidBonus += effect.rapid;
            if (effect.charge) chargeBonus += effect.charge;
            if (effect.attackMax) attackMax = true;
            if (effect.rapidMax) rapidMax = true;
            if (effect.chargeMax) chargeMax = true;
            if (effect.custom) customBonus += effect.custom;
            if (effect.numberOpen) numberOpen = true;
            if (effect.megaFolder) megaFolderBonus += effect.megaFolder;
            if (effect.gigaFolder) gigaFolderBonus += effect.gigaFolder;

            if (effect.abilities) {
                for (const ab of effect.abilities) {
                    abilitySet.add(ab);
                }
            }
        }
    }

    const attack = attackMax ? 5 : Math.min(5, 1 + attackBonus);
    const rapid = rapidMax ? 5 : Math.min(5, 1 + rapidBonus);
    const charge = chargeMax ? 5 : Math.min(5, 1 + chargeBonus);
    const custom = numberOpen ? 10 : Math.min(10, 5 + customBonus);
    const megaFolder = 5 + megaFolderBonus;
    const gigaFolder = 1 + gigaFolderBonus;

    return {
        hp,
        attack,
        rapid,
        charge,
        attackMax: attack === 5,
        rapidMax: rapid === 5,
        chargeMax: charge === 5,
        custom,
        megaFolder,
        gigaFolder,
        abilities: Array.from(abilitySet).sort(),
    };
}

export const ABILITY_NAMES: Record<string, { en: string; ja: string; zh: string }> = {
    superArmor: { en: "SuperArmor", ja: "スーパーアーマー", zh: "超级装甲" },
    floatShoes: { en: "FloatShoes", ja: "フロートシューズ", zh: "漂浮鞋" },
    airShoes: { en: "AirShoes", ja: "エアシューズ", zh: "飞行鞋" },
    underShirt: { en: "UnderShirt", ja: "アンダーシャツ", zh: "紧身衣" },
    shield: { en: "Shield", ja: "シールド", zh: "盾" },
    reflect: { en: "Reflect", ja: "リフレクト", zh: "反射" },
    antiDamage: { en: "AntiDamage", ja: "カワリミマジック", zh: "替身魔术" },
    firstBarrier: { en: "FirstBarrier", ja: "ファーストバリア", zh: "初始防护罩" },
    autoHeal: { en: "AutoHeal", ja: "セルフリカバリー", zh: "自我回复" },
    slipRunner: { en: "SlipRunner", ja: "スリップランナー", zh: "滑步跑者" },
    bugStop: { en: "BugStop", ja: "バグストッパー", zh: "BUG停止器" },
    rush: { en: "Rush", ja: "ラッシュサポート", zh: "莱西支援" },
    beat: { en: "Beat", ja: "ビートサポート", zh: "比特支援" },
    tango: { en: "Tango", ja: "タンゴサポート", zh: "探戈支援" },
    chipShuffle: { en: "ChipShuffle", ja: "サーチシャッフル", zh: "随机切换" },
    sneakRun: { en: "SneakRun", ja: "シノビダッシュ", zh: "忍术冲刺" },
    collect: { en: "Collect", ja: "コレクターズアイ", zh: "收藏家之眼" },
    millions: { en: "Millions", ja: "ミリオネア", zh: "百万富翁" },
    oilBody: { en: "OilBody", ja: "オイルボディ", zh: "油性体质" },
    fish: { en: "Fish", ja: "アイムフィッシュ", zh: "我是鱼" },
    battery: { en: "Battery", ja: "バッテリーモード", zh: "电池模式" },
    jungle: { en: "Jungle", ja: "ジャングルランド", zh: "丛林地带" },
    humor: { en: "Humor", ja: "ユーモアセンス", zh: "幽默感" },
    poem: { en: "Poem", ja: "リズミカルポエム", zh: "节奏诗歌" },
};

export function tAbility(ability: string, lang: Lang): string {
    const entry = ABILITY_NAMES[ability];
    return entry ? entry[lang] : ability;
}

export type BugType =
    | "movement"
    | "status"
    | "player"
    | "involuntaryMove"
    | "buster"
    | "charge"
    | "battleHp"
    | "custom"
    | "customHp"
    | "panel"
    | "panelSet"
    | "poisonWalk"
    | "chipAutoFire"
    | "resultZenny"
    | "gaugeSlow"
    | "hpCut"
    | "customScreenMinus"
    | "emotion"
    | "encounter"
    | "support"
    | "colorStatus";

export interface BugDefinition {
    title: { en: string; ja: string; zh: string };
    mechanics: { en: string; ja: string; zh: string };
    levels?: Record<number, { en: string; ja: string; zh: string }>;
}

export const BN3_PART_BUG_TYPES: Record<number, BugType> = {
    1: "involuntaryMove", // SprArmor
    2: "buster",          // BrakBust
    3: "charge",          // BrakChrg
    4: "panelSet",        // SetGreen
    5: "panelSet",        // SetIce
    6: "panelSet",        // SetLava
    7: "panelSet",        // SetSand
    8: "panelSet",        // SetMetal
    9: "panelSet",        // SetHoly
    10: "customHp",       // Custom1
    11: "customHp",       // Custom2
    12: "customHp",       // MegFldr1
    13: "customHp",       // MegFldr2
    14: "involuntaryMove", // Block
    15: "involuntaryMove", // Shield
    16: "involuntaryMove", // Reflect
    17: "involuntaryMove", // ShdwShoe
    18: "involuntaryMove", // FlotShoe
    19: "involuntaryMove", // AntiDmg
    20: "battleHp",       // Press
    21: "battleHp",       // EngyChng
    22: "battleHp",       // Alpha
    23: "encounter",      // SneakRun
    24: "encounter",      // OilBody
    25: "encounter",      // Fish
    26: "encounter",      // Battery
    27: "encounter",      // Jungle
    28: "resultZenny",    // Collect
    29: "involuntaryMove", // AirShoes
    30: "involuntaryMove", // UnderSht
    31: "gaugeSlow",      // FstGauge
    32: "support",        // Rush
    33: "support",        // Beat
    34: "support",        // Tango
    35: "charge",         // WeapLV+1
    36: "battleHp",       // HP+100
    37: "battleHp",       // HP+200
    38: "battleHp",       // HP+300
    39: "battleHp",       // HP+500
    40: "customHp",       // Reg+5
    41: "buster",         // Atk+1
    42: "buster",         // Speed+1
    43: "buster",         // Charge+1
    44: "emotion",        // BugStop
    45: "emotion",        // Humor
    46: "battleHp",       // BlckMind
    47: "chipAutoFire",   // BustrMAX
    48: "poisonWalk",     // GigFldr1
    49: "hpCut",          // HubBatc
    50: "customScreenMinus", // DarkLcns
};

export const BN4_PART_BUG_TYPES: Record<number, BugType> = {
    1: "player",   // SprArmr (TREZ Player Bug: Lv1 Confuse 10s, Lv2 Always moves front, Lv3 Always moves back)
    2: "customHp", // Custom1 (HP drops while in Custom Screen)
    3: "customHp", // Custom2
    4: "customHp", // MegFldr1
    5: "customHp", // MegFldr2
    6: "customHp", // GigFldr1
    7: "player",   // FstBarr
    8: "player",   // Shield
    9: "player",   // Reflect
    10: "player",  // AntiMagc
    11: "panel",   // FlotShoe (stepped on panels become crack / hole / poison)
    12: "panel",   // AirShoes
    13: "player",  // UnderSht
    14: "encounter", // SneakRun
    15: "encounter", // OilBody
    16: "encounter", // Fish
    17: "encounter", // Battery
    18: "encounter", // Jungle
    19: "support", // Collect
    20: "emotion", // Humor
    21: "buster",  // BustPack
    22: "player",  // BodyPack
    23: "hpCut",   // HubBatc
    24: "emotion", // BugStop
    25: "player",  // SoulClen
    26: "support", // Rush
    27: "support", // Beat
    28: "support", // Tango
    34: "buster",  // Attack+1
    35: "buster",  // Speed+1
    36: "buster",  // Charge+1
    37: "buster",  // AttckMAX
    38: "buster",  // SpeedMAX
    39: "buster",  // ChargMAX
    41: "battleHp", // HP+50
    42: "battleHp", // HP+100
    43: "battleHp", // HP+200
    44: "battleHp", // HP+300
    45: "battleHp", // HP+400
    46: "battleHp", // HP+500
};

export const BN5_PART_BUG_TYPES: Record<number, BugType> = {
    1: "movement",  // SprArmr (Movement warp introduced here in BN5!)
    2: "custom",    // Custom1
    3: "custom",    // Custom2
    4: "custom",    // MegFldr1
    5: "custom",    // MegFldr2
    6: "custom",    // GigFldr1
    7: "movement",  // FstBarr
    8: "movement",  // Shield
    9: "movement",  // Reflect
    10: "movement", // AntiDmg
    11: "panel",    // FlotShoe
    12: "panel",    // AirShoes
    13: "movement", // UnderSht
    14: "encounter", // SneakRun
    15: "encounter", // OilBody
    16: "encounter", // Fish
    17: "encounter", // Battery
    18: "encounter", // Jungle
    19: "encounter", // Collect
    20: "encounter", // Millions
    21: "emotion",  // Humor
    22: "emotion",  // Chivalry
    23: "movement", // AutoRun
    24: "panel",    // AutoHeal
    25: "buster",   // BustPack
    26: "movement", // BodyPack
    28: "emotion",  // BugStop
    29: "emotion",  // SoulClen
    30: "support",  // Rush
    31: "support",  // Beat
    32: "support",  // Tango
    35: "buster",   // Attck+1
    36: "buster",   // Speed+1
    37: "buster",   // Charge+1
    38: "emotion",  // SoulT+1
    39: "buster",   // AttckMAX
    40: "buster",   // SpeedMAX
    41: "buster",   // ChargMAX
    42: "battleHp", // HP+50
    43: "battleHp", // HP+100
    44: "battleHp", // HP+200
    45: "battleHp", // HP+300
    46: "battleHp", // HP+400
    47: "battleHp", // HP+500
};

export const BN6_PART_BUG_TYPES: Record<number, BugType> = {
    // Movement Bug
    1: "movement",   // SuprArmr
    7: "movement",   // FstBarr
    8: "movement",   // Shield
    9: "movement",   // Reflect
    10: "movement",  // AntiDmg
    13: "movement",  // UnderSht
    28: "movement",  // BodyPack
    // Custom Bug
    2: "custom",     // Custom1
    3: "custom",     // Custom2
    4: "custom",     // MegFldr1
    5: "custom",     // MegFldr2
    6: "custom",     // GigFldr1
    14: "custom",    // ChpShufl
    15: "custom",    // NumbrOpn
    29: "custom",    // FldrPak1
    30: "custom",    // FldrPak2
    // Panel Bug
    11: "panel",     // FlotShoe
    12: "panel",     // AirShoes
    25: "panel",     // SlipRunr
    26: "panel",     // AutoHeal
    // Buster Bug
    27: "buster",    // BustPack
    35: "buster",    // Attack+1
    36: "buster",    // Speed+1
    37: "buster",    // Charge+1
    38: "buster",    // AttckMAX
    39: "buster",    // SpeedMAX
    40: "buster",    // ChargMAX
    // Battle HP Bug
    41: "battleHp",  // HP+50
    42: "battleHp",  // HP+100
    43: "battleHp",  // HP+200
    44: "battleHp",  // HP+300
    45: "battleHp",  // HP+400
    46: "battleHp",  // HP+500
    // Encounter Bug
    16: "encounter", // SneakRun
    17: "encounter", // OilBody
    18: "encounter", // Fish
    19: "encounter", // Battery
    20: "encounter", // Jungle
    21: "encounter", // Collect
    22: "encounter", // Millions
    // Emotion Bug
    23: "emotion",   // Humor
    24: "emotion",   // Poem
    // Support Bug
    32: "support",   // Rush
    33: "support",   // Beat
    34: "support",   // Tango
    // BugStop
    31: "emotion",   // BugStop improper placement triggers emotion bug
};

export const GAME_PART_BUG_TYPES: Record<string, Record<number, BugType>> = {
    bn3: BN3_PART_BUG_TYPES,
    bn4: BN4_PART_BUG_TYPES,
    bn5: BN5_PART_BUG_TYPES,
    bn6: BN6_PART_BUG_TYPES,
};

export const GAME_BUG_DEFINITIONS: Record<string, Record<string, BugDefinition>> = {
    bn6: {
        movement: {
            title: {
                en: "Movement Warp Bug",
                ja: "移動バグ",
                zh: "边界移动 BUG",
            },
            mechanics: {
                en: "Moving in combat immediately warps MegaMan to the furthest edge of that direction, ignoring obstacles and holes.",
                ja: "移動時にその方向の最端マスへワープします（障害物や穴を無視）。",
                zh: "战斗中移动时直接瞬移至该移动方向的最边缘格子，忽略途中障碍与空洞。",
            },
        },
        buster: {
            title: {
                en: "Buster Blank Bug",
                ja: "空打ちバグ",
                zh: "空包弹 BUG",
            },
            mechanics: {
                en: "Normal buster shots have a chance to click without firing, and may occasionally misfire into an accidental charge shot.",
                ja: "通常バスターが不発（空打ち）になり、時折チャージショットが誤暴発します。",
                zh: "普通射击有几率卡壳不发射子弹，偶发误触发集气射击。",
            },
            levels: {
                1: {
                    en: "Normal buster: 6/16 Blank, 1/16 ChargeShot, 9/16 Normal Shot.",
                    ja: "通常バスター：6/16 空撃ち、1/16 チャージ暴発、9/16 通常弾。",
                    zh: "普通射击：6/16 空包弹，1/16 误暴发集气射击，9/16 正常射击。",
                },
                2: {
                    en: "Normal buster: 10/16 Blank, 2/16 ChargeShot, 4/16 Normal Shot.",
                    ja: "通常バスター：10/16 空撃ち、2/16 チャージ暴発、4/16 通常弾。",
                    zh: "普通射击：10/16 空包弹，2/16 误暴发集气射击，4/16 正常射击。",
                },
                3: {
                    en: "Normal buster: 13/16 Blank, 3/16 ChargeShot, 0/16 Normal Shot (no normal shots).",
                    ja: "通常バスター：13/16 空撃ち、3/16 チャージ暴発、0/16 通常弾（普通弾が出なくなります）。",
                    zh: "普通射击：13/16 空包弹，3/16 误暴发集气射击，0/16 正常射击（完全无法打出普通子弹）。",
                },
            },
        },
        battleHp: {
            title: {
                en: "Battle HP Bug (HP Leak)",
                ja: "HP減少バグ",
                zh: "战斗HP BUG",
            },
            mechanics: {
                en: "MegaMan's HP steadily drains during battle (accelerates when flinching).",
                ja: "戦闘中にHPが一定フレームごとに減少し続けます（被ダメージ硬直時に加速）。",
                zh: "战斗中 HP 持续流失扣减（受到硬直伤害时扣血加速）。",
            },
            levels: {
                1: {
                    en: "Drops 1 HP every 40 frames in battle (accelerates when flinching).",
                    ja: "戦闘中、40フレーム毎にHPが1減少します（被ダメージ硬直時に加速）。",
                    zh: "战斗中每 40 帧流失 1 HP（受到硬直伤害时扣血加速）。",
                },
                2: {
                    en: "Drops 1 HP every 35 frames in battle.",
                    ja: "戦闘中、35フレーム毎にHPが1減少します。",
                    zh: "战斗中每 35 帧流失 1 HP。",
                },
                3: {
                    en: "Drops 1 HP every 30 frames in battle.",
                    ja: "戦闘中、30フレーム毎にHPが1減少します。",
                    zh: "战斗中每 30 帧流失 1 HP。",
                },
            },
        },
        custom: {
            title: {
                en: "Custom Screen Bug",
                ja: "カスタムバグ",
                zh: "改装视窗 BUG",
            },
            mechanics: {
                en: "Opening the Custom Screen reduces the number of available chips by 1 per turn after a threshold.",
                ja: "一定ターン後、カスタム画面を開くたびに選択可能なチップ数が毎ターン1枚減少します（最低2枚）。",
                zh: "指定回合后，每次打开自定义视窗可选芯片数逐回合减少 1 枚（最低保留 2 枚）。",
            },
            levels: {
                1: {
                    en: "From 4th turn onward, available custom chips decrease by 1 per turn (minimum 2 chips).",
                    ja: "戦闘4ターン目以降、選択可能チップ数が毎ターン1枚減少（最低2枚）。",
                    zh: "战斗第 4 回合起，打开自定义视窗可选芯片逐回合减少 1 枚（最低保留 2 枚）。",
                },
                2: {
                    en: "From 3rd turn onward, available custom chips decrease by 1 per turn (minimum 2 chips).",
                    ja: "戦闘3ターン目以降、選択可能チップ数が毎ターン1枚減少（最低2枚）。",
                    zh: "战斗第 3 回合起，打开自定义视窗可选芯片逐回合减少 1 枚（最低保留 2 枚）。",
                },
                3: {
                    en: "From 2nd turn onward, available custom chips decrease by 1 per turn (minimum 2 chips).",
                    ja: "戦闘2ターン目以降、選択可能チップ数が毎ターン1枚減少（最低2枚）。",
                    zh: "战斗第 2 回合起，打开自定义视窗可选芯片逐回合减少 1 枚（最低保留 2 枚）。",
                },
            },
        },
        panel: {
            title: {
                en: "Panel Break Bug",
                ja: "パネルヒビバグ",
                zh: "地面 BUG",
            },
            mechanics: {
                en: "Moving off a panel has a chance (25% to 50%) to crack it.",
                ja: "移動したマスにヒビが入ります（25%〜50%確率）。",
                zh: "移动离开面板时有 25%~50% 几率使踩过的面板开裂。",
            },
            levels: {
                1: {
                    en: "Moving off a panel has 2/8 (25%) chance of cracking it.",
                    ja: "移動時に2/8（25%）の確率で足元のパネルにヒビが入ります。",
                    zh: "移动离开面板时有 2/8 (25%) 几率使踩过的面板开裂。",
                },
                2: {
                    en: "Moving off a panel has 3/8 (37.5%) chance of cracking it.",
                    ja: "移動時に3/8（37.5%）の確率で足元のパネルにヒビが入ります。",
                    zh: "移动离开面板时有 3/8 (37.5%) 几率使踩过的面板开裂。",
                },
                3: {
                    en: "Moving off a panel has 4/8 (50%) chance of cracking it.",
                    ja: "移動時に4/8（50%）の確率で足元のパネルにヒビが入ります。",
                    zh: "移动离开面板时有 4/8 (50%) 几率使踩过的面板开裂。",
                },
            },
        },
        emotion: {
            title: {
                en: "Emotion Window Bug",
                ja: "ココロウインドウバグ",
                zh: "心灵之窗 BUG",
            },
            mechanics: {
                en: "In base form with Beast Counter > 0, the Emotion Window constantly cycles between Normal, Tired, Angry, and Full Synchro every 60 frames.",
                ja: "ノーマル状態でビーストカウンターが0より大きい時、ココロウインドウが60フレーム毎に通常・疲労・怒り・フルシンクロをランダムに推移します。",
                zh: "Base 状态且兽化计数器大于 0 时，心灵之窗每 60 帧在普通/疲惫/愤怒/Full Synchro 之间随机循环切换。",
            },
        },
        encounter: {
            title: {
                en: "Encounter Bug",
                ja: "エンカウントバグ",
                zh: "遇敌率 BUG",
            },
            mechanics: {
                en: "Virus encounter rates in network areas increase drastically, inverting the normal reduction effect.",
                ja: "電脳空間でのウイルスエンカウント率が大幅に上昇します。",
                zh: "网络地图中的病毒遭遇频率大幅提高。",
            },
        },
        support: {
            title: {
                en: "Support Failure Bug",
                ja: "サポート不発バグ",
                zh: "支援失效 BUG",
            },
            mechanics: {
                en: "Support program fails to trigger during NetBattles.",
                ja: "通信対戦時にサポートプログラムが発動しません。",
                zh: "通信对战时支援程序无法触发。",
            },
        },
        colorStatus: {
            title: {
                en: "Color Overflow Bug",
                ja: "カラーオーバーバグ",
                zh: "颜色超限 BUG",
            },
            mechanics: {
                en: "Using 5 or more colors causes MegaMan to start battles with a random brief status (Confusion, Blindness, Invincibility, or Flashing).",
                ja: "5色以上使用した場合、戦闘開始時にランダムで短時間の状態異常（混乱、ブラインド、無敵、点滅）が付与されます。",
                zh: "使用 5 种及以上颜色时，战斗开始瞬间随机陷入短暂的异常状态（混乱、目盲、无敌或闪烁）。",
            },
            levels: {
                1: {
                    en: "Starts battles with random brief status for 5 seconds.",
                    ja: "戦闘開始時に5秒間ランダムな状態異常が付与されます。",
                    zh: "战斗开始瞬间随机陷入短暂异常状态持续 5 秒。",
                },
                2: {
                    en: "Starts battles with random brief status for 10 seconds.",
                    ja: "戦闘開始時に10秒間ランダムな状態異常が付与されます。",
                    zh: "战斗开始瞬间随机陷入短暂异常状态持续 10 秒。",
                },
            },
        },
    },
    bn5: {
        movement: {
            title: {
                en: "Movement Warp Bug",
                ja: "移動バグ",
                zh: "边界移动 BUG",
            },
            mechanics: {
                en: "Moving in combat immediately warps MegaMan to the furthest edge of that direction.",
                ja: "移動時にその方向の最端マスへワープ移動します。",
                zh: "战斗中移动时直接瞬移至该移动方向的最边缘格子。",
            },
        },
        buster: {
            title: {
                en: "Buster Blank Bug",
                ja: "空打ちバグ",
                zh: "空包弹 BUG",
            },
            mechanics: {
                en: "Normal buster shot: 4/16 Blank, 2/16 ChargeShot, 10/16 Normal Shot.",
                ja: "通常バスター：4/16 空撃ち、2/16 チャージ暴発、10/16 通常弾。",
                zh: "普通射击：4/16 空包弹，2/16 误暴发集气射击，10/16 正常射击。",
            },
        },
        battleHp: {
            title: {
                en: "Battle HP Bug",
                ja: "HP減少バグ",
                zh: "战斗HP BUG",
            },
            mechanics: {
                en: "HP steadily drains during battle.",
                ja: "戦闘中にHPが減少し続けます。",
                zh: "战斗中 HP 持续流失。",
            },
            levels: {
                1: {
                    en: "Drops 1 HP every 40 frames in battle.",
                    ja: "戦闘中、40フレーム毎にHPが1減少します。",
                    zh: "战斗中每 40 帧流失 1 HP。",
                },
                2: {
                    en: "Drops 1 HP every 35 frames in battle.",
                    ja: "戦闘中、35フレーム毎にHPが1減少します。",
                    zh: "战斗中每 35 帧流失 1 HP。",
                },
                3: {
                    en: "Drops 1 HP every 30 frames in battle.",
                    ja: "戦闘中、30フレーム毎にHPが1減少します。",
                    zh: "战斗中每 30 帧流失 1 HP。",
                },
            },
        },
        custom: {
            title: {
                en: "Custom Damage Bug",
                ja: "カスタムダメージバグ",
                zh: "改装伤害 BUG",
            },
            mechanics: {
                en: "Opening the Custom Screen costs HP each time.",
                ja: "カスタム画面を開くたびにHPを失います。",
                zh: "每次打开自定义视窗扣除 HP。",
            },
            levels: {
                1: {
                    en: "Opening the Custom Window costs 20 HP each time.",
                    ja: "カスタム画面を開くたびに20 HPを失います。",
                    zh: "每次打开自定义视窗扣除 20 HP。",
                },
                2: {
                    en: "Opening the Custom Window costs 40 HP each time.",
                    ja: "カスタム画面を開くたびに40 HPを失います。",
                    zh: "每次打开自定义视窗扣除 40 HP。",
                },
                3: {
                    en: "Opening the Custom Window costs 80 HP each time.",
                    ja: "カスタム画面を開くたびに80 HPを失います。",
                    zh: "每次打开自定义视窗扣除 80 HP。",
                },
            },
        },
        panel: {
            title: {
                en: "Panel Break Bug",
                ja: "パネルヒビバグ",
                zh: "地面 BUG",
            },
            mechanics: {
                en: "Moving off panels has a chance to crack or break them.",
                ja: "移動したマスにヒビが入ったり穴が空きます。",
                zh: "移动踩过的面板开裂或破损。",
            },
            levels: {
                1: {
                    en: "Moving off a panel has 1/4 (25%) chance of cracking it.",
                    ja: "移動時に1/4（25%）の確率で足元のパネルにヒビが入ります。",
                    zh: "移动离开面板时有 1/4 (25%) 几率使面板开裂。",
                },
                2: {
                    en: "Moving off a panel has 1/2 (50%) chance of cracking it.",
                    ja: "移動時に1/2（50%）の確率で足元のパネルにヒビが入ります。",
                    zh: "移动离开面板时有 1/2 (50%) 几率使面板开裂。",
                },
                3: {
                    en: "Moving off a panel always (100%) cracks it.",
                    ja: "移動時に必ず足元のパネルにヒビが入ります（100%）。",
                    zh: "移动离开面板时必定使面板开裂（100%）。",
                },
            },
        },
        emotion: {
            title: {
                en: "Emotion Window Bug",
                ja: "ココロバグ",
                zh: "心灵之窗 BUG",
            },
            mechanics: {
                en: "Emotion window rapidly fluctuates between emotional states.",
                ja: "ココロウィンドウの状態が激しく変動します。",
                zh: "心灵状态随机剧烈波动。",
            },
        },
        encounter: {
            title: {
                en: "Encounter Bug",
                ja: "エンカウントバグ",
                zh: "遇敌率 BUG",
            },
            mechanics: {
                en: "Virus encounter rates in network areas increase.",
                ja: "ウイルスエンカウント率が上昇します。",
                zh: "网络地图中的病毒遭遇频率提高。",
            },
        },
        support: {
            title: {
                en: "Support Failure Bug",
                ja: "サポート不発バグ",
                zh: "支援失效 BUG",
            },
            mechanics: {
                en: "Support programs fail to activate in battle.",
                ja: "サポートプログラムが発動しません。",
                zh: "支援程序在战斗中无法正常触发。",
            },
        },
        colorStatus: {
            title: {
                en: "Color Overflow Bug",
                ja: "カラーオーバーバグ",
                zh: "颜色超限 BUG",
            },
            mechanics: {
                en: "Using 5 or more colors triggers status anomalies and emotion fluctuations.",
                ja: "5色以上使用した場合、状態異常やココロバグが発生します。",
                zh: "超过 4 色时引发状态异常与心灵波动。",
            },
        },
    },
    bn4: {
        player: {
            title: {
                en: "Player Bug",
                ja: "プレイヤーバグ",
                zh: "玩家行动 BUG",
            },
            mechanics: {
                en: "MegaMan involuntarily moves or starts with status disorder (no boundary warp).",
                ja: "勝手に移動したり戦闘開始時に状態異常になります（ワープ移動はありません）。",
                zh: "受到装甲/防御零件违规影响：战斗中不受控制地自动移动或陷入状态异常（无边界瞬移）。",
            },
            levels: {
                1: {
                    en: "Starts battle in Confused status for 10 seconds.",
                    ja: "戦闘開始時に10秒間混乱状態になります。",
                    zh: "战斗开始时短暂陷入混乱状态持续 10 秒。",
                },
                2: {
                    en: "MegaMan involuntarily always moves forward during battle.",
                    ja: "戦闘中、勝手に前進（前移動）し続けます。",
                    zh: "战斗中不受控制地持续向前移动（会向前走）。",
                },
                3: {
                    en: "MegaMan involuntarily always moves backward during battle.",
                    ja: "戦闘中、勝手に後退（後ろ移動）し続けます。",
                    zh: "战斗中不受控制地持续向后退（会向后走）。",
                },
            },
        },
        status: {
            title: {
                en: "Player Bug",
                ja: "プレイヤーバグ",
                zh: "玩家行动 BUG",
            },
            mechanics: {
                en: "MegaMan involuntarily moves or starts with status disorder (no boundary warp).",
                ja: "勝手に移動したり戦闘開始時に状態異常になります（ワープ移動はありません）。",
                zh: "受到装甲/防御零件违规影响：战斗中不受控制地自动移动或陷入状态异常（无边界瞬移）。",
            },
            levels: {
                1: {
                    en: "Starts battle in Confused status for 10 seconds.",
                    ja: "戦闘開始時に10秒間混乱状態になります。",
                    zh: "战斗开始时短暂陷入混乱状态持续 10 秒。",
                },
                2: {
                    en: "MegaMan involuntarily always moves forward during battle.",
                    ja: "戦闘中、勝手に前進（前移動）し続けます。",
                    zh: "战斗中不受控制地持续向前移动（会向前走）。",
                },
                3: {
                    en: "MegaMan involuntarily always moves backward during battle.",
                    ja: "戦闘中、勝手に後退（後ろ移動）し続けます。",
                    zh: "战斗中不受控制地持续向后退（会向后走）。",
                },
            },
        },
        customHp: {
            title: {
                en: "Custom Screen HP Drain Bug",
                ja: "カスタム中HP減少バグ",
                zh: "改装界面HP流失 BUG",
            },
            mechanics: {
                en: "MegaMan's HP steadily drops while on the Custom Screen selecting chips (does not reduce chip quantity).",
                ja: "カスタム画面でチップ選択中、HPが継続して減少し続けます（チップ枚数は減少しません）。",
                zh: "打开自定义视窗选芯片时，HP持续快速流失扣减（不会减少可选芯片数量）。",
            },
            levels: {
                1: {
                    en: "HP drops 1 every 6 frames while on the Custom Screen.",
                    ja: "カスタム画面でチップ選択中、6フレーム毎にHPが1減少します。",
                    zh: "打开自定义视窗选芯片时，每 6 帧流失 1 HP。",
                },
                2: {
                    en: "HP drops 1 every 4 frames while on the Custom Screen.",
                    ja: "カスタム画面でチップ選択中、4フレーム毎にHPが1減少します。",
                    zh: "打开自定义视窗选芯片时，每 4 帧流失 1 HP。",
                },
                3: {
                    en: "HP drops 1 every 3 frames while on the Custom Screen.",
                    ja: "カスタム画面でチップ選択中、3フレーム毎にHPが1減少します。",
                    zh: "打开自定义视窗选芯片时，每 3 帧流失 1 HP。",
                },
            },
        },
        panel: {
            title: {
                en: "Panel Bug",
                ja: "移動パネルバグ",
                zh: "移动面板改变 BUG",
            },
            mechanics: {
                en: "The panel MegaMan steps off becomes a different panel type.",
                ja: "移動した足元のパネルがヒビ・穴・毒沼パネルに変化します。",
                zh: "移动离开的面板有几率变为开裂、孔洞或毒沼。",
            },
            levels: {
                1: {
                    en: "Stepping off a panel turns it into a Cracked panel.",
                    ja: "移動して離れたマスがヒビパネルに変化します。",
                    zh: "移动离开的面板会变为开裂面板。",
                },
                2: {
                    en: "Stepping off a panel turns it into a Hole panel.",
                    ja: "移動して離れたマスが穴パネルに変化します。",
                    zh: "移动离开的面板会变为孔洞。",
                },
                3: {
                    en: "Stepping off a panel turns it into a Swamp panel.",
                    ja: "移動して離れたマスが毒沼パネルに変化します。",
                    zh: "移动离开的面板会变为毒沼。",
                },
            },
        },
        buster: {
            title: {
                en: "Buster Blank Bug",
                ja: "空打ちバグ",
                zh: "空包弹 BUG",
            },
            mechanics: {
                en: "Normal buster shot has a chance of firing blanks.",
                ja: "通常バスターが一定確率で不発（空撃ち）になります。",
                zh: "普通射击有几率卡壳不发射子弹（空包弹）。",
            },
            levels: {
                1: {
                    en: "Normal buster shot has 2/8 (25%) chance of firing blanks.",
                    ja: "通常バスターが2/8（25%）の確率で空撃ちになります。",
                    zh: "普通射击有 2/8 (25%) 几率卡壳不发射子弹（空包弹）。",
                },
                2: {
                    en: "Normal buster shot has 4/8 (50%) chance of firing blanks.",
                    ja: "通常バスターが4/8（50%）の確率で空撃ちになります。",
                    zh: "普通射击有 4/8 (50%) 几率卡壳不发射子弹（空包弹）。",
                },
                3: {
                    en: "Normal buster shot has 5/8 (62.5%) chance of firing blanks.",
                    ja: "通常バスターが5/8（62.5%）の確率で空撃ちになります。",
                    zh: "普通射击有 5/8 (62.5%) 几率卡壳不发射子弹（空包弹）。",
                },
            },
        },
        battleHp: {
            title: {
                en: "Battle HP Bug (HP Leak)",
                ja: "HP減少バグ",
                zh: "战斗HP BUG",
            },
            mechanics: {
                en: "MegaMan's HP steadily drains throughout the battle.",
                ja: "戦闘中、一定間隔でHPが減少し続けます。",
                zh: "战斗中 HP 以固定频率持续流失扣减。",
            },
            levels: {
                1: {
                    en: "HP drops 1 every 10 frames steadily in battle.",
                    ja: "戦闘中、10フレーム毎にHPが1減少します。",
                    zh: "战斗中每 10 帧流失 1 HP。",
                },
                2: {
                    en: "HP drops 1 every 6 frames steadily in battle.",
                    ja: "戦闘中、6フレーム毎にHPが1減少します。",
                    zh: "战斗中每 6 帧流失 1 HP。",
                },
                3: {
                    en: "HP drops 1 every 3 frames steadily in battle.",
                    ja: "戦闘中、3フレーム毎にHPが1減少します。",
                    zh: "战斗中每 3 帧流失 1 HP。",
                },
            },
        },
        encounter: {
            title: {
                en: "Encounter Bug",
                ja: "エンカウントバグ",
                zh: "遇敌率 BUG",
            },
            mechanics: {
                en: "Encounter programs fail and wild virus encounter rates increase.",
                ja: "ウイルスエンカウント率が上昇します。",
                zh: "网络地图中的病毒遭遇频率大幅提高。",
            },
        },
        resultZenny: {
            title: {
                en: "Battle Result Bug",
                ja: "報酬ゼニー固定バグ",
                zh: "战斗结算金币 BUG",
            },
            mechanics: {
                en: "You only receive Zennys as Battle Rewards.",
                ja: "戦闘リザルト報酬がゼニーのみになりチップが出なくなります。",
                zh: "战斗胜利后结算奖励只掉落金币，无法获得芯片。",
            },
        },
        support: {
            title: {
                en: "Support Failure Bug",
                ja: "サポート不発バグ",
                zh: "支援失效 BUG",
            },
            mechanics: {
                en: "Support program fails to trigger in battle.",
                ja: "サポートプログラムが発動しなくなります。",
                zh: "支援程序在战斗中无法正常触发。",
            },
        },
        emotion: {
            title: {
                en: "Humor Bug",
                ja: "ユーモアバグ",
                zh: "幽默感 BUG",
            },
            mechanics: {
                en: "MegaMan speaks random jokes upon taking damage.",
                ja: "被ダメージ時に勝手にギャグを発言します。",
                zh: "受到伤害时会不受控制地随机说出冷笑话。",
            },
        },
        hpCut: {
            title: {
                en: "Max HP Halved",
                ja: "HP半減",
                zh: "最大HP减半",
            },
            mechanics: {
                en: "HubBatch built-in handicap: Permanently halves MegaMan's maximum HP.",
                ja: "サイトバッチ固有ペナルティ：最大HPが永続的に半分になります。",
                zh: "彩斗修正档固有效果：最大生命值永久减半。",
            },
        },
        colorStatus: {
            title: {
                en: "Color Bug",
                ja: "カラーバグ",
                zh: "颜色超限 BUG",
            },
            mechanics: {
                en: "Using 5 colors causes Level 1 Player & Custom HP Bugs (Confused for 10s & HP drain in custom screen); 6 colors causes Level 2 (Always moves front & faster HP drain).",
                ja: "5色使用でLv1プレイヤーバグ（10秒混乱）およびカスタム中HP減少が発生し、6色使用でLv2（勝手に前進・HP減少加速）が発生します。",
                zh: "使用 5 色触发 Lv1 玩家行动与改装界面 HP 流失（混乱 10 秒）；使用 6 色触发 Lv2（持续向前走与加速流失）。",
            },
        },
    },
    bn3: {
        involuntaryMove: {
            title: {
                en: "Player Movement Bug",
                ja: "プレイヤー移動バグ",
                zh: "自动移动与混乱 BUG",
            },
            mechanics: {
                en: "MegaMan involuntarily always moves during battle (no boundary warp).",
                ja: "戦闘中、勝手に移動し続けます（ワープ移動はありません）。",
                zh: "受到装甲/防御/鞋类零件违规影响：战斗中不受控制地自动移动或陷入混乱（无边界瞬移）。",
            },
            levels: {
                1: {
                    en: "MegaMan involuntarily always moves Up during battle.",
                    ja: "戦闘中、勝手に上へ移動し続けます。",
                    zh: "战斗中不受控制地持续向上移动（会向上走）。",
                },
                2: {
                    en: "MegaMan involuntarily always moves Down during battle.",
                    ja: "戦闘中、勝手に下へ移動し続けます。",
                    zh: "战斗中不受控制地持续向下移动（会向下走）。",
                },
                3: {
                    en: "MegaMan is permanently Confused during battle.",
                    ja: "戦闘中、永続的に混乱状態になります。",
                    zh: "战斗中处于永续混乱状态。",
                },
            },
        },
        customHp: {
            title: {
                en: "Custom Screen HP Drain Bug",
                ja: "カスタム中HP減少バグ",
                zh: "改装界面HP流失 BUG",
            },
            mechanics: {
                en: "MegaMan's HP steadily drops in the custom screen.",
                ja: "カスタム画面を開いている間、HPが減少し続けます。",
                zh: "受到改装零件违规影响：打开自定义视窗选芯片时，HP持续快速流失扣减。",
            },
            levels: {
                1: {
                    en: "HP drops 1 every 31 frames while in the Custom Screen.",
                    ja: "カスタム画面を開いている間、31フレーム毎にHPが1減少します。",
                    zh: "打开自定义视窗选芯片时，每 31 帧流失 1 HP。",
                },
                2: {
                    en: "HP drops 1 every 16 frames while in the Custom Screen.",
                    ja: "カスタム画面を開いている間、16フレーム毎にHPが1減少します。",
                    zh: "打开自定义视窗选芯片时，每 16 帧流失 1 HP。",
                },
                3: {
                    en: "HP drops 1 every 8 frames while in the Custom Screen.",
                    ja: "カスタム画面を開いている間、8フレーム毎にHPが1減少します。",
                    zh: "打开自定义视窗选芯片时，每 8 帧流失 1 HP。",
                },
            },
        },
        panelSet: {
            title: {
                en: "Battle Panel Change Bug",
                ja: "パネル変化バグ",
                zh: "面板状态改变 BUG",
            },
            mechanics: {
                en: "When battle starts, all normal panels on player's side become a certain panel type.",
                ja: "戦闘開始時に自エリアのノーマルパネルが変化します。",
                zh: "受到面板设置零件违规影响：己方区域普通面板变为开裂或毒沼。",
            },
            levels: {
                1: {
                    en: "Starts battle with all player panels Cracked.",
                    ja: "戦闘開始時に自エリアの全ノーマルパネルがヒビパネルに変化します。",
                    zh: "战斗开始时己方区域所有普通面板变为开裂面板。",
                },
                2: {
                    en: "Starts battle with all player panels Swamp.",
                    ja: "戦闘開始時に自エリアの全ノーマルパネルが毒沼パネルに変化します。",
                    zh: "战斗开始时己方区域所有普通面板变为毒沼。",
                },
            },
        },
        buster: {
            title: {
                en: "Weakened Buster Bug",
                ja: "バスター異常バグ",
                zh: "射击异常 BUG",
            },
            mechanics: {
                en: "Firing blanks affects both normal and charge shots, or turns into Guard.",
                ja: "バスターが空撃ちになり、重度になると通常バスターがメットガードに変化します。",
                zh: "射击有几率卡壳，甚至普通射击变为防护罩（MetGuard）。",
            },
            levels: {
                1: {
                    en: "1/4 (25%) chance of firing blanks for normal shot and charge shot.",
                    ja: "通常射撃およびチャージ射撃が1/4の確率で空撃ちになります。",
                    zh: "普通射击与集气射击均有 1/4 几率卡壳（空包弹）。",
                },
                2: {
                    en: "1/2 (50%) chance of firing blanks.",
                    ja: "射撃が1/2の確率で空撃ちになります。",
                    zh: "射击有 1/2 几率卡壳（空包弹）。",
                },
                3: {
                    en: "For the first 15 shots, normal buster shot becomes Guard (MetGuard).",
                    ja: "戦闘開始から最初の15発、通常バスターがメットガードになります。",
                    zh: "开局前 15 发普通射击直接变为防护罩（MetGuard）。",
                },
            },
        },
        charge: {
            title: {
                en: "Modified Shot Bug",
                ja: "ため撃ち異常バグ",
                zh: "集气射击异常 BUG",
            },
            mechanics: {
                en: "B Button charge attack changes into a different object.",
                ja: "チャージ射撃が別の技に変化します。",
                zh: "受到集气零件违规影响：集气射击变为石块、水枪或花束。",
            },
            levels: {
                1: {
                    en: "Charge shot summons a Rock Cube one panel ahead.",
                    ja: "チャージ射撃が目の前にストーンキューブを生成する技に変化します。",
                    zh: "集气射击变为在正前方生成石块（Rock Cube）。",
                },
                2: {
                    en: "Charge shot shoots a Water Gun one panel ahead (100 damage).",
                    ja: "チャージ射撃が目の前1マスの水鉄砲（100ダメージ）に変化します。",
                    zh: "集气射击变为正前方 1 格的水枪（威力 100）。",
                },
                3: {
                    en: "Charge shot produces a Magic Flower (does nothing).",
                    ja: "チャージ射撃が花束（効果なし）に変化します。",
                    zh: "集气射击变为魔术花束（无伤害无效果）。",
                },
            },
        },
        battleHp: {
            title: {
                en: "Battle HP Drain Bug",
                ja: "HP減少バグ",
                zh: "战斗HP BUG",
            },
            mechanics: {
                en: "MegaMan's HP steadily drops during battle.",
                ja: "戦闘中にHPが減少し続けます。",
                zh: "受到HP零件违规影响：战斗中 HP 持续流失。",
            },
            levels: {
                1: {
                    en: "Drops 1 HP every 30 frames in battle.",
                    ja: "戦闘中、30フレーム毎にHPが1減少します。",
                    zh: "战斗中每 30 帧流失 1 HP。",
                },
                2: {
                    en: "Drops 1 HP every 16 frames in battle.",
                    ja: "戦闘中、16フレーム毎にHPが1減少します。",
                    zh: "战斗中每 16 帧流失 1 HP。",
                },
                3: {
                    en: "Drops 1 HP every 8 frames in battle.",
                    ja: "戦闘中、8フレーム毎にHPが1減少します。",
                    zh: "战斗中每 8 帧流失 1 HP。",
                },
            },
        },
        encounter: {
            title: {
                en: "Encounter Bug",
                ja: "エンカウントバグ",
                zh: "遇敌率 BUG",
            },
            mechanics: {
                en: "Viruses appear more frequently.",
                ja: "ウイルスエンカウント率が上昇します。",
                zh: "网络地图中的病毒遭遇频率大幅提高。",
            },
        },
        support: {
            title: {
                en: "Support Failure Bug",
                ja: "サポート不発バグ",
                zh: "支援失效 BUG",
            },
            mechanics: {
                en: "Support programs fail to trigger in NetBattles.",
                ja: "対戦時にサポートプログラムが発動しません。",
                zh: "支援程序在通信对战中无法触发。",
            },
        },
        resultZenny: {
            title: {
                en: "Zenny Only Bug",
                ja: "報酬ゼニー固定バグ",
                zh: "战斗结算金币 BUG",
            },
            mechanics: {
                en: "Collect program violation: Battle rewards exclusively drop Zenny instead of chips.",
                ja: "コレクターズアイ違反：戦闘リザルト報酬がゼニーのみになりチップが出なくなります。",
                zh: "受到收藏家之眼违规影响：战斗胜利后结算奖励只掉落金币，无法获得芯片。",
            },
        },
        gaugeSlow: {
            title: {
                en: "Custom Gauge Bug",
                ja: "ヘビーゲージバグ",
                zh: "改装量表变慢 BUG",
            },
            mechanics: {
                en: "Custom gauge automatically has the SlowGauge effect.",
                ja: "カスタムゲージが自動的にヘビーゲージ状態になります。",
                zh: "受到快速量表违规影响：战斗中自定义量表充能速度大幅减慢（重力计状态）。",
            },
        },
        chipAutoFire: {
            title: {
                en: "Chip Auto-Fire Bug",
                ja: "チップ自動使用バグ",
                zh: "芯片自动打出 BUG",
            },
            mechanics: {
                en: "BusterMAX built-in bug: Selected chips are automatically and involuntarily fired upon entering battle.",
                ja: "バスターMAX固有バグ：選択したチップが戦闘開始時に勝手に使われてしまいます。",
                zh: "子弹MAX固有效果：战斗开始时选中的芯片会自动被强制打出。",
            },
        },
        poisonWalk: {
            title: {
                en: "Poison Step Bug",
                ja: "毒沼歩行バグ",
                zh: "毒沼足迹 BUG",
            },
            mechanics: {
                en: "GigaFolder1 program violation: Every panel stepped on permanently turns into a Poison panel.",
                ja: "ギガフォルダ1違反：移動して通過したパネルがすべて毒沼パネルに変化します。",
                zh: "受到GIGA文件1违规影响：走过的面板全部变成毒沼。",
            },
        },
        hpCut: {
            title: {
                en: "Max HP Halved",
                ja: "HP半減",
                zh: "最大HP减半",
            },
            mechanics: {
                en: "HubBatch built-in handicap: Permanently halves MegaMan's maximum HP.",
                ja: "サイトバッチ固有ペナルティ：最大HPが永続的に半分になります。",
                zh: "彩斗修正档固有效果：最大生命值永久减半。",
            },
        },
        customScreenMinus: {
            title: {
                en: "Custom Screen Minus Bug",
                ja: "カスタム枚数減少バグ",
                zh: "自定义芯片减少 BUG",
            },
            mechanics: {
                en: "DarkLicense program violation: Reduces initial custom screen chip selection by 1.",
                ja: "ダークライセンス違反：カスタム画面で最初に選べるチップ枚数が1枚減少します。",
                zh: "受到黑暗执照违规影响：自定义视窗初始可选芯片数量减少 1 枚。",
            },
        },
        emotion: {
            title: {
                en: "Humor Bug",
                ja: "ユーモアバグ",
                zh: "幽默感 BUG",
            },
            mechanics: {
                en: "MegaMan speaks random jokes upon taking damage.",
                ja: "被ダメージ時に勝手にギャグを発言します。",
                zh: "受到伤害时会不受控制地随机说出冷笑话。",
            },
        },
    },
};

export const BUG_DEFINITIONS: Record<string, BugDefinition> = GAME_BUG_DEFINITIONS["bn6"];

export type BugCause =
    | "solidNotOnCommandLine"
    | "plusOnCommandLine"
    | "adjacentSameColor"
    | "outOfBounds"
    | "tooManyColors";

export const CAUSE_DESCRIPTIONS: Record<BugCause, { en: string; ja: string; zh: string }> = {
    solidNotOnCommandLine: {
        en: "Solid program does not cross the Command Line",
        ja: "プログラムパーツがコマンドライン上にありません",
        zh: "实体程序未跨过命令行",
    },
    plusOnCommandLine: {
        en: "Plus part placed on the Command Line",
        ja: "プラスパーツがコマンドライン上に接触しています",
        zh: "增强零件接触了命令行",
    },
    adjacentSameColor: {
        en: "Adjacent to same-colored part",
        ja: "同色パーツが隣接しています",
        zh: "同色零件边缘相邻",
    },
    outOfBounds: {
        en: "Placed outside the main grid",
        ja: "パーツが枠外にはみ出しています",
        zh: "零件超出主网格边缘",
    },
    tooManyColors: {
        en: "Using more than 4 colors on the grid",
        ja: "使用している色が4色を超えています",
        zh: "棋盘使用的颜色超过了4种",
    },
};

export function tBugCause(cause: BugCause, lang: Lang): string {
    const entry = CAUSE_DESCRIPTIONS[cause];
    return entry ? entry[lang] : cause;
}

export function tBugTitle(bugType: BugType | string, lang: Lang, gameId: string = "bn6"): string {
    const entry = GAME_BUG_DEFINITIONS[gameId]?.[bugType] ?? GAME_BUG_DEFINITIONS["bn6"]?.[bugType];
    return entry ? entry.title[lang] : bugType;
}

export function tBugMechanics(bugType: BugType | string, lang: Lang, gameId: string = "bn6"): string {
    const entry = GAME_BUG_DEFINITIONS[gameId]?.[bugType] ?? GAME_BUG_DEFINITIONS["bn6"]?.[bugType];
    return entry ? entry.mechanics[lang] : bugType;
}

export interface ActiveBugEffect {
    bugType: BugType;
    level: number;
    title: string;
    mechanics: string;
    parts: {
        partIndex: number;
        partId: number;
        partName: string;
        causes: BugCause[];
    }[];
}

export interface AnalyzedBug {
    partIndex: number;
    partId: number;
    partName: string;
    bugType: BugType;
    level: number;
    bugTitle: string;
    bugMechanics: string;
    causes: BugCause[];
}

export interface SolutionBugAnalysis {
    hasBugs: boolean;
    bugStopActive: boolean;
    bugs: AnalyzedBug[];
    activeBugs: ActiveBugEffect[];
    tooManyColors: boolean;
    colorBugTitle?: string;
    colorBugMechanics?: string;
    distinctColorCount: number;
}

export function analyzeSolutionBugs(
    gameId: string,
    partMetas: { id: number; name: string; nameJa?: string; nameZh?: string; isSolid: boolean; color: number }[],
    requirements: Requirement[],
    cells: (number | null)[],
    gridSettings: GridSettings,
    lang: Lang
): SolutionBugAnalysis {
    const ncols = gridSettings.width;
    const nrows = gridSettings.height;
    const oob = gridSettings.hasOob;
    const cmdLine = gridSettings.commandLineRow;

    const NEIGHBOR_DXS = [0, 1, 0, -1];
    const NEIGHBOR_DYS = [-1, 0, 1, 0];

    const reqDetails = requirements.map((req, idx) => ({
        reqIdx: idx,
        partIndex: req.partIndex,
        partMeta: partMetas[req.partIndex],
        onCommandLine: false,
        outOfBounds: false,
        adjacentSameColoredPlacements: new Set<number>(),
    }));

    for (let y = 0; y < nrows; y++) {
        for (let x = 0; x < ncols; x++) {
            const reqIdx = cells[y * ncols + x];
            if (reqIdx == null || reqIdx < 0) continue;
            const detail = reqDetails[reqIdx];
            if (!detail) continue;

            if (y === cmdLine) {
                detail.onCommandLine = true;
            }

            if (oob && (x === 0 || y === 0 || x === ncols - 1 || y === nrows - 1)) {
                detail.outOfBounds = true;
            }

            for (let d = 0; d < 4; d++) {
                const x2 = x + NEIGHBOR_DXS[d];
                const y2 = y + NEIGHBOR_DYS[d];
                if (x2 < 0 || x2 >= ncols || y2 < 0 || y2 >= nrows) continue;
                if (oob && (x === 0 || y === 0 || x === ncols - 1 || y === nrows - 1) &&
                    (x2 === 0 || y2 === 0 || x2 === ncols - 1 || y2 === nrows - 1)) {
                    continue;
                }

                const nReqIdx = cells[y2 * ncols + x2];
                if (nReqIdx == null || nReqIdx < 0 || nReqIdx === reqIdx) continue;
                const nDetail = reqDetails[nReqIdx];
                if (!nDetail) continue;

                if (detail.partMeta.color === nDetail.partMeta.color) {
                    detail.adjacentSameColoredPlacements.add(nReqIdx);
                }
            }
        }
    }

    const distinctColors = new Set<number>();
    for (const d of reqDetails) {
        distinctColors.add(d.partMeta.color);
    }
    const tooManyColors = (gameId === "bn4" || gameId === "bn5" || gameId === "bn6") && distinctColors.size > 4;

    let bugStopActive = false;
    const bugStopDetail = reqDetails.find(d => {
        const name = d.partMeta.name;
        const id = d.partMeta.id;
        return name.includes("BugStop") ||
            (gameId === "bn3" && id === 44) ||
            (gameId === "bn4" && id === 24) ||
            (gameId === "bn5" && id === 28) ||
            (gameId === "bn6" && id === 31);
    });
    if (bugStopDetail) {
        const isBugStopBugged =
            !bugStopDetail.onCommandLine ||
            bugStopDetail.outOfBounds ||
            bugStopDetail.adjacentSameColoredPlacements.size > 0;
        if (!isBugStopBugged) {
            bugStopActive = true;
        }
    }

    const gameBugMap = GAME_PART_BUG_TYPES[gameId] ?? BN6_PART_BUG_TYPES;
    const gameDefs = GAME_BUG_DEFINITIONS[gameId] ?? GAME_BUG_DEFINITIONS["bn6"];

    // 1. Identify all bugged parts and their individual causes
    const buggedReqs: {
        reqIdx: number;
        partIndex: number;
        partId: number;
        partName: string;
        bugType: BugType;
        causes: BugCause[];
    }[] = [];

    for (const d of reqDetails) {
        const causes: BugCause[] = [];

        if (d.partMeta.isSolid && !d.onCommandLine) {
            causes.push("solidNotOnCommandLine");
        }
        if (!d.partMeta.isSolid && d.onCommandLine) {
            causes.push("plusOnCommandLine");
        }
        if (d.adjacentSameColoredPlacements.size > 0) {
            causes.push("adjacentSameColor");
        }
        if (d.outOfBounds) {
            causes.push("outOfBounds");
        }

        if (causes.length > 0) {
            const bugType = gameBugMap[d.partMeta.id] ?? "battleHp";
            buggedReqs.push({
                reqIdx: d.reqIdx,
                partIndex: d.partIndex,
                partId: d.partMeta.id,
                partName: getPartName(d.partMeta, lang),
                bugType,
                causes,
            });
        }
    }

    // 2. Group bugged parts by bugType to compute the stack/level
    const bugTypeGroups = new Map<string, typeof buggedReqs>();
    for (const br of buggedReqs) {
        let list = bugTypeGroups.get(br.bugType);
        if (!list) {
            list = [];
            bugTypeGroups.set(br.bugType, list);
        }
        list.push(br);
    }

    const activeBugs: ActiveBugEffect[] = [];
    const bugs: AnalyzedBug[] = [];

    for (const [bugType, group] of bugTypeGroups.entries()) {
        const bugDef = gameDefs[bugType] ?? GAME_BUG_DEFINITIONS["bn6"][bugType];
        const baseTitle = bugDef?.title[lang] ?? bugType;
        const count = group.length;

        const level = Math.max(1, count);
        const maxDefinedLevel = bugDef?.levels
            ? Math.max(...Object.keys(bugDef.levels).map(Number))
            : 1;
        const effectiveLevel = Math.min(level, maxDefinedLevel);

        const levelMechanics =
            bugDef?.levels?.[effectiveLevel]?.[lang] ??
            bugDef?.mechanics[lang] ??
            "";
        const titleWithLevel = bugDef?.levels ? `${baseTitle} (Lv${level})` : baseTitle;

        activeBugs.push({
            bugType: bugType as BugType,
            level,
            title: titleWithLevel,
            mechanics: levelMechanics,
            parts: group.map((g) => ({
                partIndex: g.partIndex,
                partId: g.partId,
                partName: g.partName,
                causes: g.causes,
            })),
        });

        for (const g of group) {
            bugs.push({
                partIndex: g.partIndex,
                partId: g.partId,
                partName: g.partName,
                bugType: g.bugType,
                level,
                bugTitle: titleWithLevel,
                bugMechanics: levelMechanics,
                causes: g.causes,
            });
        }
    }

    const colorDef = gameDefs["colorStatus"] ?? GAME_BUG_DEFINITIONS["bn6"]["colorStatus"];
    const colorBugTitle = colorDef?.title[lang];
    const colorBugMechanics = colorDef?.mechanics[lang];

    const hasBugs = bugs.length > 0 || tooManyColors;

    return {
        hasBugs,
        bugStopActive,
        bugs,
        activeBugs,
        tooManyColors,
        colorBugTitle,
        colorBugMechanics,
        distinctColorCount: distinctColors.size,
    };
}
