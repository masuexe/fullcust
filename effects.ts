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
    | "buster"
    | "battleHp"
    | "custom"
    | "panel"
    | "emotion"
    | "encounter"
    | "support"
    | "colorStatus";

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

export const BUG_DEFINITIONS: Record<BugType, {
    title: { en: string; ja: string; zh: string };
    mechanics: { en: string; ja: string; zh: string };
}> = {
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
};

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

export function tBugTitle(bugType: BugType, lang: Lang): string {
    const entry = BUG_DEFINITIONS[bugType];
    return entry ? entry.title[lang] : bugType;
}

export function tBugMechanics(bugType: BugType, lang: Lang): string {
    const entry = BUG_DEFINITIONS[bugType];
    return entry ? entry.mechanics[lang] : bugType;
}

export interface AnalyzedBug {
    partIndex: number;
    partId: number;
    partName: string;
    bugType: BugType;
    causes: BugCause[];
}

export interface SolutionBugAnalysis {
    hasBugs: boolean;
    bugStopActive: boolean;
    bugs: AnalyzedBug[];
    tooManyColors: boolean;
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
    const bugStopDetail = reqDetails.find(d => d.partMeta.id === 31);
    if (bugStopDetail) {
        const isBugStopBugged =
            !bugStopDetail.onCommandLine ||
            bugStopDetail.outOfBounds ||
            bugStopDetail.adjacentSameColoredPlacements.size > 0;
        if (!isBugStopBugged) {
            bugStopActive = true;
        }
    }

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
            const bugType = BN6_PART_BUG_TYPES[d.partMeta.id] ?? "battleHp";
            bugs.push({
                partIndex: d.partIndex,
                partId: d.partMeta.id,
                partName: getPartName(d.partMeta, lang),
                bugType,
                causes,
            });
        }
    }

    const hasBugs = bugs.length > 0 || tooManyColors;

    return {
        hasBugs,
        bugStopActive,
        bugs,
        tooManyColors,
        distinctColorCount: distinctColors.size,
    };
}
