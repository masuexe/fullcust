import type { Lang } from "./i18n";

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
