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
    1: "status",   // SprArmr (No movement warp in BN4! Status bug: initial confusion / auto forward/backward move)
    2: "customHp", // Custom1 (HP drains while in custom screen)
    3: "customHp", // Custom2
    4: "customHp", // MegFldr1
    5: "customHp", // MegFldr2
    6: "customHp", // GigFldr1
    7: "status",   // FstBarr
    8: "status",   // Shield
    9: "status",   // Reflect
    10: "status",  // AntiMagc
    11: "panel",   // FlotShoe (stepped on panels become crack / hole / poison)
    12: "panel",   // AirShoes
    13: "status",  // UnderSht
    14: "encounter", // SneakRun
    15: "encounter", // OilBody
    16: "encounter", // Fish
    17: "encounter", // Battery
    18: "encounter", // Jungle
    19: "support", // Collect
    20: "emotion", // Humor
    21: "buster",  // BustPack
    22: "status",  // BodyPack
    23: "hpCut",   // HubBatc
    24: "emotion", // BugStop
    25: "status",  // SoulClen
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
        },
        battleHp: {
            title: {
                en: "Battle HP Bug (HP Leak)",
                ja: "HP減少バグ",
                zh: "战斗HP BUG",
            },
            mechanics: {
                en: "MegaMan's HP steadily drains during battle (1 HP every 40 to 10 frames depending on level; accelerates when flinching).",
                ja: "戦闘中にHPが一定フレームごとに減少し続けます（被ダメージ硬直時に加速）。",
                zh: "战斗中 HP 以固定帧率持续扣减 1 HP，受到硬直伤害时扣血加速。",
            },
        },
        custom: {
            title: {
                en: "Custom Screen Bug",
                ja: "カスタムバグ",
                zh: "改装视窗 BUG",
            },
            mechanics: {
                en: "After turn 4 (or earlier at higher bug levels), opening the Custom Screen reduces the number of available chips by 1 per turn (minimum 2 chips).",
                ja: "戦闘開始から一定ターン後、カスタム画面を開くたびに選択可能なチップ数が毎ターン1枚減少します（最低2枚）。",
                zh: "战斗指定回合后，每次打开自定义视窗可选芯片数逐回合减少 1 枚（最低保留 2 枚）。",
            },
        },
        panel: {
            title: {
                en: "Panel Break Bug",
                ja: "パネルヒビバグ",
                zh: "地面 BUG",
            },
            mechanics: {
                en: "Moving off a panel has a chance (25% to 50%) to crack it. Stepping off an already cracked panel destroys it completely.",
                ja: "移動したマスにヒビが入ります（25%〜50%確率）。ヒビパネルから離れると完全に穴が空きます。",
                zh: "移动离开面板时有 25%~50% 几率使踩过的面板开裂（离开已开裂面板会使其完全破损洞穿）。",
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
                en: "Normal buster shots have a chance to click without firing.",
                ja: "通常バスターが一定確率で空撃ちになります。",
                zh: "普通射击有几率卡壳不发射子弹。",
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
        },
        custom: {
            title: {
                en: "Custom Screen Bug",
                ja: "カスタムバグ",
                zh: "改装视窗 BUG",
            },
            mechanics: {
                en: "Opening the Custom Screen reduces the number of available chips.",
                ja: "カスタム画面で選択可能なチップ枚数が減少します。",
                zh: "战斗中每次打开自定义视窗可选芯片数逐回合减少。",
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
        status: {
            title: {
                en: "Status & Involuntary Move Bug",
                ja: "ステータスバグ",
                zh: "状态异常与自动移动 BUG",
            },
            mechanics: {
                en: "Armor/defense program violation: Starts battles with brief Confusion, or involuntarily steps forward/backward during battle (no boundary warp).",
                ja: "アーマー・防御系違反：戦闘開始時に初期混乱、または戦闘中に勝手に前進・後退します（ワープ移動はありません）。",
                zh: "受到装甲/防御零件违规影响：战斗开始时短暂陷入混乱，或在战斗中不受控制地自动向前/向后移动（无边界瞬移）。",
            },
        },
        customHp: {
            title: {
                en: "Custom Screen HP Drain Bug",
                ja: "カスタム中HP減少バグ",
                zh: "改装界面HP流失 BUG",
            },
            mechanics: {
                en: "Custom program violation: HP drains continuously while the Custom Screen is open selecting chips (does not reduce chip quantity).",
                ja: "カスタム系違反：カスタム画面でチップを選択中、HPが継続して減少し続けます（チップ枚数は減少しません）。",
                zh: "受到改装零件违规影响：打开自定义视窗选芯片时，HP持续快速流失扣减（不会减少可选芯片数量）。",
            },
        },
        panel: {
            title: {
                en: "Moving Panel Bug",
                ja: "移動パネルバグ",
                zh: "移动面板改变 BUG",
            },
            mechanics: {
                en: "Shoes program violation: Stepping off panels causes them to crack, turn into holes, or turn into poison panels.",
                ja: "シューズ系違反：移動した足元のパネルがヒビ・穴・毒沼パネルに変化します。",
                zh: "受到鞋类零件违规影响：移动离开面板时，踩过的格子有几率开裂、变为孔洞或变为毒沼。",
            },
        },
        buster: {
            title: {
                en: "Buster Blank Bug",
                ja: "空打ちバグ",
                zh: "空包弹 BUG",
            },
            mechanics: {
                en: "Buster program violation: Normal buster shots have a chance to click without firing.",
                ja: "バスター系違反：通常バスターが一定確率で不発（空撃ち）になります。",
                zh: "受到射击零件违规影响：普通射击有几率卡壳不发射子弹。",
            },
        },
        battleHp: {
            title: {
                en: "Battle HP Bug (HP Leak)",
                ja: "HP減少バグ",
                zh: "战斗HP BUG",
            },
            mechanics: {
                en: "HP program violation: MegaMan's HP steadily drains throughout the battle.",
                ja: "HP系違反：戦闘中、一定間隔でHPが減少し続けます。",
                zh: "受到HP零件违规影响：战斗中 HP 以固定频率持续流失扣减。",
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
                en: "Color Overflow Bug",
                ja: "カラーオーバーバグ",
                zh: "颜色超限 BUG",
            },
            mechanics: {
                en: "Using 5 or more colors combines Custom Screen HP Drain with Status/Involuntary movement.",
                ja: "5色以上使用した場合、カスタム中HP減少とステータスバグが複合して発生します。",
                zh: "使用 5 种及以上颜色时，复合触发改装界面HP流失与状态异常/自动移动。",
            },
        },
    },
    bn3: {
        involuntaryMove: {
            title: {
                en: "Drift & Confusion Bug",
                ja: "勝手に移動・混乱バグ",
                zh: "自动漂移与混乱 BUG",
            },
            mechanics: {
                en: "Armor/defense/shoes violation: Automatically drifts Up, drifts Down, or becomes Confused (no boundary warp).",
                ja: "アーマー・防御・シューズ系違反：勝手に上へ移動、下へ移動、または混乱状態になります（ワープ移動はありません）。",
                zh: "受到装甲/防御/鞋类零件违规影响：战斗中不受控制地自动向上漂移、自动向下漂移，严重时陷入混乱状态（无边界瞬移）。",
            },
        },
        customHp: {
            title: {
                en: "Custom Screen HP Drain Bug",
                ja: "カスタム中HP減少バグ",
                zh: "改装界面HP流失 BUG",
            },
            mechanics: {
                en: "Custom programs violation: HP rapidly drains while the custom screen is open selecting chips.",
                ja: "カスタム系違反：カスタム画面を開いている間、HPが減少し続けます。",
                zh: "受到改装零件违规影响：打开自定义视窗选芯片时，HP持续快速流失扣减。",
            },
        },
        panelSet: {
            title: {
                en: "Panel State Bug",
                ja: "パネル変化バグ",
                zh: "面板状态改变 BUG",
            },
            mechanics: {
                en: "Set panel program violation: Player territory normal panels turn into Cracked or Poison panels.",
                ja: "セットパネル系違反：自エリアのノーマルパネルがヒビや毒沼パネルに変化します。",
                zh: "受到面板设置零件违规影响：己方区域普通面板变为裂地或毒沼。",
            },
        },
        buster: {
            title: {
                en: "Buster Malfunction Bug",
                ja: "バスター異常バグ",
                zh: "射击异常 BUG",
            },
            mechanics: {
                en: "Buster program violation: Normal shots blank/misfire; at higher levels, normal shot turns into MetGuard.",
                ja: "バスター系違反：バスターが空撃ちになり、重度になると通常バスターがメットガードに変化します。",
                zh: "受到飞弹零件违规影响：射击卡壳，甚至普通射击变为防护罩（MetGuard）。",
            },
        },
        charge: {
            title: {
                en: "Charge Shot Bug",
                ja: "ため撃ち異常バグ",
                zh: "集气射击异常 BUG",
            },
            mechanics: {
                en: "Charge program violation: Charge shot turns into StoneCube, WaterGun, or Flower Bouquet.",
                ja: "ため撃ち系違反：チャージショットが目の前のキューブ、水鉄砲、または花束に変化します。",
                zh: "受到集气零件违规影响：集气射击变为石块、水枪或花束。",
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
                zh: "受到HP零件违规影响：战斗中 HP 持续流失。",
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
                en: "Heavy Gauge Bug",
                ja: "ヘビーゲージバグ",
                zh: "改装量表变慢 BUG",
            },
            mechanics: {
                en: "FastGauge program violation: Custom gauge fills significantly slower (HeavyGauge effect).",
                ja: "クイックゲージ違反：カスタムゲージの充填速度が著しく低下します（ヘビーゲージ化）。",
                zh: "受到快速量表违规影响：战斗中自定义量表充能速度大幅减慢（重力计状态）。",
            },
        },
        chipAutoFire: {
            title: {
                en: "Chip Auto-Fire Bug",
                ja: "チップ自動使用バグ",
                zh: "芯片自动触发 BUG",
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

export interface AnalyzedBug {
    partIndex: number;
    partId: number;
    partName: string;
    bugType: BugType;
    bugTitle: string;
    bugMechanics: string;
    causes: BugCause[];
}

export interface SolutionBugAnalysis {
    hasBugs: boolean;
    bugStopActive: boolean;
    bugs: AnalyzedBug[];
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

    const bugs: AnalyzedBug[] = [];
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
            const bugDef = gameDefs[bugType] ?? GAME_BUG_DEFINITIONS["bn6"][bugType];
            const bugTitle = bugDef?.title[lang] ?? bugType;
            const bugMechanics = bugDef?.mechanics[lang] ?? "";

            bugs.push({
                partIndex: d.partIndex,
                partId: d.partMeta.id,
                partName: getPartName(d.partMeta, lang),
                bugType,
                bugTitle,
                bugMechanics,
                causes,
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
        tooManyColors,
        colorBugTitle,
        colorBugMechanics,
        distinctColorCount: distinctColors.size,
    };
}
