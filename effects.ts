import { getPartName, Lang } from "./i18n";
import { computeDeckStats, getCardDisplayName, getModCard, ModCardBug } from "./modcards";
import { BugPolicy, BugTolerance, DEFAULT_BUG_POLICY } from "./problem";
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
    baseHp: number;
    finalHp: number;
    hp: number;
    hpPercent: number;
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
    // Mod card integration
    modMbUsed?: number;
    modCardCount?: number;
    modBody?: string;
    modGauge?: "fast" | "slow" | "normal";
    modBButton?: string;
    modBPwrAtk?: string;
    modBLeft?: string;
    modBusterAddition?: string;
    modChargeAddition?: string;
    invalidatedBusterAddition?: string;
    invalidatedChargeAddition?: string;
    modChipRecovery?: number;
    modFirstBarrier?: number | string;
    modTripleBuster?: boolean;
    modSoul?: string;
    modSlotsUsed?: string[];
    modBugCount?: number;
    repairedBugs?: string[];
    disabledAbilitiesFromCards?: string[];
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

export const BN5_PART_EFFECTS: Record<number, PartEffect> = {
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
    14: { abilities: ["sneakRun"] },
    15: { abilities: ["oilBody"] },
    16: { abilities: ["fish"] },
    17: { abilities: ["battery"] },
    18: { abilities: ["jungle"] },
    19: { abilities: ["collect"] },
    20: { abilities: ["millions"] },
    21: { abilities: ["humor"] },
    22: { abilities: ["poem"] },
    23: { abilities: ["slipRunner"] },
    24: { abilities: ["autoHeal"] },
    25: { attack: 3, rapid: 3, charge: 3 },
    26: { abilities: ["superArmor", "underShirt", "floatShoes", "airShoes"] },
    28: { abilities: ["bugStop"] },
    29: { abilities: ["soulClean"] },
    30: { abilities: ["rush"] },
    31: { abilities: ["beat"] },
    32: { abilities: ["tango"] },
    35: { attack: 1 },
    36: { rapid: 1 },
    37: { charge: 1 },
    39: { attackMax: true },
    40: { rapidMax: true },
    41: { chargeMax: true },
    42: { hp: 50 },
    43: { hp: 100 },
    44: { hp: 200 },
    45: { hp: 300 },
    46: { hp: 400 },
    47: { hp: 500 },
};

export const BN4_PART_EFFECTS: Record<number, PartEffect> = {
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
    14: { abilities: ["sneakRun"] },
    15: { abilities: ["oilBody"] },
    16: { abilities: ["fish"] },
    17: { abilities: ["battery"] },
    18: { abilities: ["jungle"] },
    19: { abilities: ["collect"] },
    20: { abilities: ["humor"] },
    21: { attack: 3, rapid: 3, charge: 3 },
    22: { abilities: ["superArmor", "underShirt", "floatShoes", "airShoes"] },
    23: { abilities: ["superArmor", "underShirt", "floatShoes", "airShoes", "shield"], custom: 1, megaFolder: 1 },
    24: { abilities: ["bugStop"] },
    25: { abilities: ["soulClean"] },
    26: { abilities: ["rush"] },
    27: { abilities: ["beat"] },
    28: { abilities: ["tango"] },
    34: { attack: 1 },
    35: { rapid: 1 },
    36: { charge: 1 },
    37: { attackMax: true },
    38: { rapidMax: true },
    39: { chargeMax: true },
    41: { hp: 50 },
    42: { hp: 100 },
    43: { hp: 200 },
    44: { hp: 300 },
    45: { hp: 400 },
    46: { hp: 500 },
};

export const BN3_PART_EFFECTS: Record<number, PartEffect> = {
    1: { abilities: ["superArmor"] },
    10: { custom: 1 },
    11: { custom: 2 },
    12: { megaFolder: 1 },
    13: { megaFolder: 2 },
    15: { abilities: ["shield"] },
    16: { abilities: ["reflect"] },
    18: { abilities: ["floatShoes"] },
    19: { abilities: ["antiDamage"] },
    23: { abilities: ["sneakRun"] },
    24: { abilities: ["oilBody"] },
    25: { abilities: ["fish"] },
    26: { abilities: ["battery"] },
    27: { abilities: ["jungle"] },
    28: { abilities: ["collect"] },
    29: { abilities: ["airShoes"] },
    30: { abilities: ["underShirt"] },
    32: { abilities: ["rush"] },
    33: { abilities: ["beat"] },
    34: { abilities: ["tango"] },
    36: { hp: 100 },
    37: { hp: 200 },
    38: { hp: 300 },
    39: { hp: 500 },
    41: { attack: 1 },
    42: { rapid: 1 },
    43: { charge: 1 },
    44: { abilities: ["bugStop"] },
    45: { abilities: ["humor"] },
    47: { attackMax: true, rapidMax: true, chargeMax: true },
    48: { gigaFolder: 1 },
    49: { abilities: ["superArmor", "underShirt", "floatShoes", "airShoes", "shield"], custom: 1, megaFolder: 1 },
};

export const GAME_EFFECTS: Record<string, Record<number, PartEffect>> = {
    bn3: BN3_PART_EFFECTS,
    bn4: BN4_PART_EFFECTS,
    bn5: BN5_PART_EFFECTS,
    bn6: BN6_PART_EFFECTS,
};

export function getPartEffect(gameId: string, partId: number): PartEffect | undefined {
    return GAME_EFFECTS[gameId]?.[partId];
}

export function computeBuildStats(
    gameId: string,
    partIds: number[],
    modCardIds?: string[],
    baseHp: number = 1000
): BuildStats {
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

    const ncHp = hp;
    let runningHp = baseHp + ncHp;
    let hpPercent = 0;
    let modMbUsed: number | undefined;
    let modCardCount: number | undefined;
    let modBody: string | undefined;
    let modGauge: "fast" | "slow" | "normal" | undefined;
    let modBButton: string | undefined;
    let modBPwrAtk: string | undefined;
    let modBLeft: string | undefined;
    let modBusterAddition: string | undefined;
    let modChargeAddition: string | undefined;
    let invalidatedBusterAddition: string | undefined;
    let invalidatedChargeAddition: string | undefined;
    let modChipRecovery: number | undefined;
    let modFirstBarrier: number | string | undefined;
    let modTripleBuster: boolean | undefined;
    let modSoul: string | undefined;
    let modSlotsUsed: string[] | undefined;
    let modBugCount: number | undefined;
    let repairedBugs: string[] | undefined;
    let disabledAbilitiesFromCards: string[] | undefined;

    let baseAttack = attackMax ? 5 : (1 + attackBonus);
    let baseRapid = rapidMax ? 5 : (1 + rapidBonus);
    let baseCharge = chargeMax ? 5 : (1 + chargeBonus);

    if ((gameId === "bn4" || gameId === "bn5" || gameId === "bn6") && modCardIds && modCardIds.length > 0) {
        const deck = computeDeckStats(modCardIds, gameId);
        modMbUsed = deck.totalMb;
        modCardCount = modCardIds.length;
        modBugCount = deck.activeBugs.length;
        hp += deck.stats.hp;
        hpPercent = deck.stats.hpPercent;

        if (deck.stats.attackMult > 1) {
            baseAttack *= deck.stats.attackMult;
        }
        baseAttack += deck.stats.attack;
        baseRapid += deck.stats.rapid;
        baseCharge += deck.stats.charge;
        customBonus += deck.stats.custom;
        megaFolderBonus += deck.stats.megaFolder;
        gigaFolderBonus += deck.stats.gigaFolder;

        for (const ab of deck.activeAbilities) {
            abilitySet.add(ab);
        }
        const stripped: string[] = [];
        for (const dab of deck.disabledAbilities) {
            if (abilitySet.has(dab)) {
                stripped.push(dab);
            }
            abilitySet.delete(dab);
        }
        if (stripped.length > 0) {
            disabledAbilitiesFromCards = stripped;
        }

        modBody = deck.body;
        modGauge = deck.gauge;
        modBButton = deck.bButton;
        modBPwrAtk = deck.bPwrAtk;
        modBLeft = deck.bLeft;
        modBusterAddition = deck.busterAddition;
        modChargeAddition = deck.chargeAddition;
        invalidatedBusterAddition = deck.invalidatedBusterAddition;
        invalidatedChargeAddition = deck.invalidatedChargeAddition;
        modChipRecovery = deck.chipRecovery;
        modFirstBarrier = deck.firstBarrier;
        modTripleBuster = deck.tripleBuster;
        modSoul = deck.soul;
        modSlotsUsed = deck.slotsUsed;
        repairedBugs = deck.repairedBugs;
    }

    if ((gameId === "bn4" || gameId === "bn5" || gameId === "bn6") && modCardIds && modCardIds.length > 0) {
        for (const cid of modCardIds) {
            const card = getModCard(cid, gameId);
            if (!card) continue;
            if (card.stats.hp) {
                runningHp += card.stats.hp;
            }
            if (card.stats.hpPercent) {
                runningHp = Math.floor(runningHp * (1 + card.stats.hpPercent / 100));
            }
        }
    }
    const finalHp = Math.max(1, runningHp);

    const attack = Math.max(1, Math.min(5, baseAttack));
    const rapid = Math.max(1, Math.min(5, baseRapid));
    const charge = Math.max(1, Math.min(5, baseCharge));
    const custom = numberOpen ? 10 : Math.max(5, Math.min(10, 5 + customBonus));
    const megaFolder = Math.max(0, 5 + megaFolderBonus);
    const gigaFolder = Math.max(0, 1 + gigaFolderBonus);

    return {
        baseHp,
        finalHp,
        hp,
        hpPercent,
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
        modMbUsed,
        modCardCount,
        modBody,
        modGauge,
        modBButton,
        modBPwrAtk,
        modBLeft,
        modBusterAddition,
        modChargeAddition,
        invalidatedBusterAddition,
        invalidatedChargeAddition,
        modChipRecovery,
        modFirstBarrier,
        modTripleBuster,
        modSoul,
        modSlotsUsed,
        modBugCount,
        repairedBugs,
        disabledAbilitiesFromCards,
    };
}

export const ABILITY_NAMES: Record<string, { en: string; ja: string; zh: string }> = {
    allGuard: { en: "All Guard", ja: "オールガード", zh: "全御防御" },
    fullSynchro: { en: "FullSynchro", ja: "フルシンクロ", zh: "完全同步" },
    statusGuard: { en: "StatusGuard", ja: "ステータスガード", zh: "状态守护" },
    firstBarrier200: { en: "FirstBarrier200", ja: "ファーストバリア200", zh: "初始防护罩200" },
    batteryMode: { en: "Battery", ja: "バッテリーモード", zh: "电池模式" },
    soulClean: { en: "SoulCleaner", ja: "ソウルクリーナー", zh: "灵魂净化" },
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

export interface ConstraintOption {
    id: string;
    name: { en: string; ja: string; zh: string };
}

export const BN6_SPECIAL_CS_OPTIONS: ConstraintOption[] = [
    { id: "ChargeShot", name: { en: "Standard ChargeShot (No Special CS)", ja: "通常チャージショット（特殊CSなし）", zh: "标准集气射击 (禁用特殊CS)" } },
    // 射击 / 枪炮类
    { id: "Cannon", name: { en: "CS: Cannon (CanGard)", ja: "CS: キャノン（キャノガード）", zh: "CS: 加农炮 (CanGard / 加农防卫弹)" } },
    { id: "M-Cannon", name: { en: "CS: M-Cannon (Canodumb)", ja: "CS: Mキャノン（キャノーダム）", zh: "CS: M加农炮 (Canodumb / 加农弹)" } },
    { id: "Spreader", name: { en: "CS: Spreader (Kettle)", ja: "CS: ショットガン（ヤカーン）", zh: "CS: 散射枪 (Spreader / 沸水壶)" } },
    { id: "BubbleSpread", name: { en: "CS: BubbleSpread (Puffy)", ja: "CS: バブルスプレッド（プクール）", zh: "CS: 泡沫散射 (BubbleSpread / 河豚尔)" } },
    { id: "WideShot", name: { en: "CS: WideShot (DiveMan)", ja: "CS: ワイドショット（ダイブマン）", zh: "CS: 广域射击 (WideShot / 潜水人)" } },
    { id: "CornShot", name: { en: "CS: CornShot (BombCorn)", ja: "CS: コーンショット（ボムコーン）", zh: "CS: 玉米射击 (BombCorn / 炸弹玉米)" } },
    { id: "MachineGun", name: { en: "CS: MachineGun (Gunner)", ja: "CS: ガンナー（ガンナー）", zh: "CS: 气力机枪 (MachineGun / 枪手)" } },
    { id: "CircleGun", name: { en: "CS: CircleGun (SearchMan)", ja: "CS: サークルガン（サーチマン）", zh: "CS: 旋转枪 (CircleGun / 侦察人)" } },
    { id: "SuperVulcan", name: { en: "CS: SuperVulcan (SoulBattler)", ja: "CS: スーパーバルカン（ソウルバトラー）", zh: "CS: 超级火神炮 (SuperVulcan / 魂斗士改装)" } },
    { id: "ShootingBuster", name: { en: "CS: Shooting Buster (BassBX / BassCross)", ja: "CS: シューティングバスター（フォルテBX / フォルテクロス）", zh: "CS: 疾风射击 (Shooting Buster / 佛鲁迪BX)" } },
    { id: "Gun del Sol", name: { en: "CS: Gun del Sol (Django)", ja: "CS: ガン・デル・ソル（ジャンゴ）", zh: "CS: 太阳枪 (Gun del Sol / 强戈)" } },
    // 近战 / 剑类
    { id: "LongSword", name: { en: "CS: LongSword (ShadowMan)", ja: "CS: ロングソード（シャドーマン）", zh: "CS: 长剑 (LongSword / 阴影人)" } },
    { id: "WideSword", name: { en: "CS: WideSword (SlashMan)", ja: "CS: ワイドソード（スラッシュマン）", zh: "CS: 宽剑 (WideSword / 利爪人)" } },
    { id: "ElecSword", name: { en: "CS: ElecSword (ThunderMan)", ja: "CS: エレキソード（サンダーマン）", zh: "CS: 电力剑 (ElecSword / 闪电人)" } },
    { id: "BambooSword", name: { en: "CS: BambooSword (KendoMan)", ja: "CS: バンブーソード（ケンドーマン）", zh: "CS: 竹剑 (BambooSword / 剑道人)" } },
    { id: "StepSword", name: { en: "CS: StepSword (BeastMan)", ja: "CS: フミコミザン（ビーストマン）", zh: "CS: 接近斩 (StepSword / 野兽人)" } },
    { id: "DarkSword", name: { en: "CS: DarkSword (DarkMega)", ja: "CS: ダークソード（ダークロックマン）", zh: "CS: 黑暗剑 (DarkSword / 黑暗洛克人)" } },
    { id: "Z Saber", name: { en: "CS: Z Saber (Zero)", ja: "CS: Zセイバー（ロックマンゼロ）", zh: "CS: Z光剑 (Z Saber / 洛克人ZERO)" } },
    { id: "Lance", name: { en: "CS: BambooLance (Kilby)", ja: "CS: バンブーランス（キルブー）", zh: "CS: 竹枪 (Lance / 杀人竹)" } },
    { id: "Yo-Yo", name: { en: "CS: Yo-Yo (CutMan)", ja: "CS: ヨーヨー（カットマン）", zh: "CS: 溜溜球 (Yo-Yo / 剪刀人)" } },
    { id: "DrillArm", name: { en: "CS: DrillArm (GroundMan)", ja: "CS: ドリルアーム（グランドマン）", zh: "CS: 钻椎臂 (DrillArm / 地面人)" } },
    // 元素 / 场地 / 风雷类
    { id: "Tornado", name: { en: "CS: Tornado (AirMan)", ja: "CS: トルネード（エアーマン）", zh: "CS: 龙卷风 (Tornado / 空气人)" } },
    { id: "WindRacket", name: { en: "CS: WindRacket (TenguMan)", ja: "CS: フウジンラケット（テングマン）", zh: "CS: 风神球拍 (WindRacket / 天狗人)" } },
    { id: "Thunder", name: { en: "CS: Thunder (CloudMan)", ja: "CS: サンダー（クラウドマン）", zh: "CS: 雷击 (Thunder / 云人)" } },
    { id: "DollThunder", name: { en: "CS: DollThunder (ScarCrow)", ja: "CS: ドールサンダー（カカジー）", zh: "CS: 稻草雷 (DollThunder / 稻草吉)" } },
    { id: "ElecPulse", name: { en: "CS: ElecPulse (PulseBulb)", ja: "CS: エレキパルス（パルフォロン）", zh: "CS: 电力脉冲 (ElecPulse / 帕尔佛龙)" } },
    { id: "FireBurn", name: { en: "CS: FireBurn (OldStove)", ja: "CS: ファイアバーン（ダルスト）", zh: "CS: 地狱燃烧者 (FireBurn / 达摩斯托)" } },
    { id: "BlizzardBall", name: { en: "CS: BlizzardBall (BlizMan)", ja: "CS: ブリザード（ブリザードマン）", zh: "CS: 暴风雪 (BlizzardBall / 暴风雪人)" } },
    { id: "IceCube", name: { en: "CS: IceCube (ColdBear)", ja: "CS: アイスキューブ（コールドベア）", zh: "CS: 冰块 (IceCube / 冷漠熊)" } },
    { id: "IceSeed", name: { en: "CS: IceSeed (IceMan)", ja: "CS: アイスシード（アイスマン）", zh: "CS: 冰之种子 (IceSeed / 冰冻人)" } },
    { id: "GrassSeed", name: { en: "CS: GrassSeed (KillPlant)", ja: "CS: クサシード（キルプラント）", zh: "CS: 草地种子 (GrassSeed / 杀手植物)" } },
    { id: "SandWorm", name: { en: "CS: SandWorm (SnakeArm)", ja: "CS: スナーム（スナーム）", zh: "CS: 沙虫 (SandWorm / 石纳姆)" } },
    // 炸弹类
    { id: "BlackBomb", name: { en: "CS: BlackBomb (Volcano)", ja: "CS: ブラックボム（ボルカノ）", zh: "CS: 黑色炸弹 (BlackBomb / 火山炮)" } },
    { id: "BigBomb", name: { en: "CS: BigBomb (NapalmMan)", ja: "CS: ビッグボム（ナパームマン）", zh: "CS: 大型炸弹 (BigBomb / 烧夷弹人)" } },
    { id: "TimeBomb", name: { en: "CS: TimeBomb (Handi)", ja: "CS: タイムボム（ハンディース）", zh: "CS: 定时炸弹 (TimeBomb / 手迪斯)" } },
    { id: "FlashBomb", name: { en: "CS: FlashBomb (BigHat)", ja: "CS: フラッシュボム（グラサン）", zh: "CS: 闪光炸弹 (FlashBomb / 墨镜)" } },
    // 特殊 / 战术类
    { id: "V-Doll", name: { en: "CS: V-Doll (DarkMan)", ja: "CS: ブードゥー（ダークマン）", zh: "CS: 替身人偶 (V-Doll / 黑暗人)" } },
    { id: "Invisible", name: { en: "CS: Invisible (Shadow / Momogra)", ja: "CS: インビジブル（ダークシャドー / モモグラン）", zh: "CS: 隐身 (Invisible / 暗影 / 鼹地鼠)" } },
    { id: "PanelGrab", name: { en: "CS: PanelGrab (Slimer)", ja: "CS: エリアスチール（ジェライム）", zh: "CS: 地面窃取 (PanelGrab / 胶莱姆)" } },
    { id: "GrabBanish", name: { en: "CS: GrabBanish (JudgeMan)", ja: "CS: スチールパニシュ（ジャッジマン）", zh: "CS: 偷窃惩罚 (GrabBanish / 审判人)" } },
    { id: "Blood Rain", name: { en: "CS: Blood Rain (Count)", ja: "CS: ブラッドレイン（ハクシャク）", zh: "CS: 血雨 (Blood Rain / 伯爵)" } },
    { id: "HelzRolling", name: { en: "CS: HelzRolling (BassCross Falzar)", ja: "CS: ヘルズローリング（フォルテクロス ファルザー）", zh: "CS: 地狱转轮 (HelzRolling / 佛鲁迪Cross)" } },
];

export const BN5_SPECIAL_CS_OPTIONS: ConstraintOption[] = [
    { id: "ChargeShot", name: { en: "Standard ChargeShot (No Special CS)", ja: "通常チャージショット（特殊CSなし）", zh: "标准集气射击 (禁用特殊CS)" } },
    { id: "Invisible", name: { en: "CS: Invisible (Ghost)", ja: "CS: インビジブル（ゴースラー）", zh: "CS: 隐身 (Ghost / 幽灵怪)" } },
    { id: "LongSword", name: { en: "CS: LongSword (Swordy)", ja: "CS: ロングソード（スウォーデン）", zh: "CS: 长剑 (Swordy / 剑士怪)" } },
    { id: "WideSword", name: { en: "CS: WideSword (Mayl's Custom)", ja: "CS: ワイドソード（美露改装）", zh: "CS: 宽剑 (Mayl's Custom / 美露改装)" } },
    { id: "WideBlade", name: { en: "CS: WideBlade (SharkMan)", ja: "CS: ワイドブレード（ブルース）", zh: "CS: 宽刃剑 (SharkMan / 鲨鱼人)" } },
    { id: "SamuraiSword", name: { en: "CS: SamuraiSword (Champy)", ja: "CS: サムライソード（ザエモン）", zh: "CS: 武士剑 (Champy / 拳击怪)" } },
    { id: "CrescentKunai", name: { en: "CS: CrescentKunai (Z-Mon-Mon)", ja: "CS: クレセントクナイ（ゲニン）", zh: "CS: 弦月苦无 (Z-Mon-Mon / 骨爪怪)" } },
    { id: "DarkSword", name: { en: "CS: DarkSword (NebulaGray)", ja: "CS: ダークソード（ネビュラグレイ）", zh: "CS: 黑暗剑 (NebulaGray / 星云灰烬)" } },
    { id: "ThunderBall", name: { en: "CS: ThunderBall (Billy)", ja: "CS: サンダーボール（ビリー）", zh: "CS: 雷球 (Billy / 雷球怪)" } },
    { id: "HeatShot", name: { en: "CS: HeatShot (GreenGrumble)", ja: "CS: ヒートショット（ガルー）", zh: "CS: 热量射击 (GreenGrumble / 绿怪兽)" } },
    { id: "FireArm", name: { en: "CS: FireArm (HeatMan)", ja: "CS: ファイアアーム（ファイアマン）", zh: "CS: 火焰喷射 (HeatMan / 热量人)" } },
    { id: "Bubbler", name: { en: "CS: Bubbler (Drain)", ja: "CS: バブラー（エビロン）", zh: "CS: 气泡射击 (Drain / 蚊子怪)" } },
    { id: "WideShot", name: { en: "CS: WideShot (VacuumFan)", ja: "CS: ワイドショット（ゲイラーク）", zh: "CS: 广域射击 (VacuumFan / 吸尘机)" } },
    { id: "CircleGun", name: { en: "CS: CircleGun (Roll)", ja: "CS: サークルガン（サーキラー）", zh: "CS: 旋转枪 (Roll / 萝露)" } },
    { id: "PulseBeam", name: { en: "CS: PulseBeam (BurnerMan / NumberMan)", ja: "CS: パルスビーム（シェードマン / パルスバット）", zh: "CS: 脉冲光束 (BurnerMan / NumberMan)" } },
    { id: "ColonelCannon", name: { en: "CS: ColonelCannon (Serenade)", ja: "CS: カーネルキャノン（カーネル）", zh: "CS: 卡奈尔加农 (Serenade / 小夜曲)" } },
    { id: "CannonBall", name: { en: "CS: CannonBall (Powie)", ja: "CS: ホウガン（ハルドボルズ）", zh: "CS: 炮丸 (Powie / 重压锤)" } },
    { id: "MiniBomb", name: { en: "CS: MiniBomb (Bunny)", ja: "CS: ミニボム（カブタンク）", zh: "CS: 迷你炸弹 (Bunny / 电兔怪)" } },
    { id: "BlackBomb", name: { en: "CS: BlackBomb (BombMan)", ja: "CS: ブラックボム（ボンバーマン）", zh: "CS: 黑色炸弹 (BombMan / 炸弹人)" } },
    { id: "DrillArm", name: { en: "CS: DrillArm (GutsMan / DesertMan)", ja: "CS: ドリルアーム（ドリクロール / ドリルマン）", zh: "CS: 钻椎臂 (GutsMan / DesertMan)" } },
    { id: "Tornado", name: { en: "CS: Tornado (DethFire)", ja: "CS: トルネード（ファンカー）", zh: "CS: 龙卷风 (DethFire / 烈火怪)" } },
    { id: "AirHockey", name: { en: "CS: AirHockey (Apparun)", ja: "CS: エアホッケー（ダーマ）", zh: "CS: 气垫曲棍球 (Apparun / 白幽灵)" } },
    { id: "Yo-Yo", name: { en: "CS: Yo-Yo (Marina)", ja: "CS: ヨーヨー（ヨーヨット）", zh: "CS: 溜溜球 (Marina / 海妖怪)" } },
    { id: "Boomerang", name: { en: "CS: Boomerang (WindBox)", ja: "CS: ブーメラン（ラウンダ）", zh: "CS: 回旋镖 (WindBox / 吹风机)" } },
    { id: "RabidRing", name: { en: "CS: RabidRing (Momogra)", ja: "CS: ラビリング（ラビリー）", zh: "CS: 兔耳光环 (Momogra / 地鼠怪)" } },
    { id: "Vacuum", name: { en: "CS: Vacuum (Boomer)", ja: "CS: スイコミ（スーンハーク）", zh: "CS: 抽风吸引 (Boomer / 回旋镖怪)" } },
    { id: "Shield", name: { en: "CS: Shield (Puffy)", ja: "CS: シールド（バジリコ）", zh: "CS: 盾防 (Puffy / 河豚怪)" } },
    { id: "Reflect", name: { en: "CS: Reflect (Serenade Rare)", ja: "CS: リフレクト（セレナード）", zh: "CS: 反射盾 (Serenade Rare / 小夜曲特典)" } },
    { id: "OceanSeed", name: { en: "CS: OceanSeed (FlashMan)", ja: "CS: オーシャンシード（アクアマン）", zh: "CS: 海洋种子 (FlashMan / 闪光人)" } },
    { id: "Poltergeist", name: { en: "CS: Poltergeist (JunkMan)", ja: "CS: ポルターガイスト（ジャンクマン）", zh: "CS: 念动力 (JunkMan / 废铁人)" } },
    { id: "ShootingBuster", name: { en: "CS: ShootingBuster (BassCross ProtoMan)", ja: "CS: シューティングバスター（フォルテクロス ブルース版）", zh: "CS: 疾风射击 (BassCross 布鲁斯版)" } },
    { id: "HellsRolling", name: { en: "CS: HellsRolling (BassCross Colonel)", ja: "CS: ヘルズローリング（フォルテクロス カーネル版）", zh: "CS: 地狱转轮 (BassCross 卡奈尔版)" } },
];

export const BN4_SPECIAL_CS_OPTIONS: ConstraintOption[] = [
    { id: "Cannon", name: { en: "CS: Cannon", ja: "CS: キャノン", zh: "CS: 加农炮" } },
    { id: "MiniBomb", name: { en: "CS: MiniBomb", ja: "CS: ミニボム", zh: "CS: 迷你炸弹" } },
    { id: "HeatShot", name: { en: "CS: HeatShot", ja: "CS: ヒートショット", zh: "CS: 热量射击" } },
    { id: "BubbleShot", name: { en: "CS: BubbleShot", ja: "CS: バブルショット", zh: "CS: 水泡射击" } },
    { id: "ThunderBall", name: { en: "CS: ThunderBall", ja: "CS: サンダーボール", zh: "CS: 雷球" } },
    { id: "Sword", name: { en: "CS: Sword", ja: "CS: ソード", zh: "CS: 剑" } },
    { id: "WideSword", name: { en: "CS: WideSword", ja: "CS: ワイドソード", zh: "CS: 宽剑" } },
    { id: "LongSword", name: { en: "CS: LongSword", ja: "CS: ロングソード", zh: "CS: 长剑" } },
    { id: "WideBlade", name: { en: "CS: WideBlade", ja: "CS: ワイドブレード", zh: "CS: 宽刃剑" } },
    { id: "LongBlade", name: { en: "CS: LongBlade", ja: "CS: ロングブレード", zh: "CS: 长刃剑" } },
    { id: "SpreadGun", name: { en: "CS: SpreadGun", ja: "CS: スプレッドガン", zh: "CS: 扩散枪" } },
    { id: "WideShot", name: { en: "CS: WideShot", ja: "CS: ワイドショット", zh: "CS: 广域射击" } },
    { id: "WideShot2", name: { en: "CS: WideShot2", ja: "CS: ワイドショット2", zh: "CS: 广域射击2" } },
    { id: "WideShot3", name: { en: "CS: WideShot3", ja: "CS: ワイドショット3", zh: "CS: 广域射击3" } },
    { id: "Blizzard", name: { en: "CS: Blizzard", ja: "CS: ブリザード", zh: "CS: 暴风雪" } },
    { id: "HeatBreath", name: { en: "CS: HeatBreath", ja: "CS: ヒートブレス", zh: "CS: 烈焰吐息" } },
    { id: "ElecShock", name: { en: "CS: ElecShock", ja: "CS: エレキショック", zh: "CS: 电击" } },
    { id: "WoodPowder", name: { en: "CS: WoodPowder", ja: "CS: ウッディパウダー", zh: "CS: 树木粉末" } },
    { id: "DarkHole", name: { en: "CS: DarkHole", ja: "CS: ダークホール", zh: "CS: 暗黑洞" } },
    { id: "RabidRing", name: { en: "CS: RabidRing", ja: "CS: ラビリング", zh: "CS: 兔耳光环" } },
    { id: "SandRing", name: { en: "CS: SandRing", ja: "CS: サンドリング", zh: "CS: 沙之环" } },
    { id: "EnergyBomb", name: { en: "CS: EnergyBomb", ja: "CS: エナジーボム", zh: "CS: 能量炸弹" } },
    { id: "MegaEnergyBomb", name: { en: "CS: MegaEnergyBomb", ja: "CS: メガエナジーボム", zh: "CS: 大型能量炸弹" } },
    { id: "CannonBall", name: { en: "CS: CannonBall", ja: "CS: ホウガン", zh: "CS: 炮丸" } },
    { id: "BugBomb", name: { en: "CS: BugBomb", ja: "CS: バグボム", zh: "CS: BUG炸弹" } },
    { id: "WindRacket", name: { en: "CS: WindRacket", ja: "CS: フウジンラケット", zh: "CS: 风神球拍" } },
    { id: "PanelReturn", name: { en: "CS: PanelReturn", ja: "CS: パネルリターン", zh: "CS: 面板复原" } },
    { id: "PanelRepair", name: { en: "CS: PanelRepair", ja: "CS: リペアー", zh: "CS: 地面修复" } },
    { id: "TripleCrack", name: { en: "CS: TripleCrack", ja: "CS: トリプルクラック", zh: "CS: 三重砸裂" } },
    { id: "CopyDamage", name: { en: "CS: CopyDamage", ja: "CS: コピーダメージ", zh: "CS: 复制伤害" } },
    { id: "FullCustom", name: { en: "CS: FullCustom", ja: "CS: チャージフルカスタム", zh: "CS: 完全客制化" } },
];

export function getSpecialCsOptions(gameId: string): ConstraintOption[] {
    if (gameId === "bn5") return BN5_SPECIAL_CS_OPTIONS;
    if (gameId === "bn4") return BN4_SPECIAL_CS_OPTIONS;
    return BN6_SPECIAL_CS_OPTIONS;
}

export const SPECIAL_CS_OPTIONS = BN6_SPECIAL_CS_OPTIONS;

export const BN6_BLEFT_OPTIONS: ConstraintOption[] = [
    { id: "AntiDamage", name: { en: "B+Left: AntiDamage (ShadowMan)", ja: "B+左: カワリミ（シャドーマン）", zh: "B+左: 替身魔术 (AntiDamage / 阴影人)" } },
    { id: "Reflect", name: { en: "B+Left: Reflect (JapanMan / Punk)", ja: "B+左: リフレクト（ヤマトマン / パンク）", zh: "B+左: 反射盾 (Reflect / 大和人 / 庞克)" } },
    { id: "Shield", name: { en: "B+Left: Shield (Kettle / Mettaur)", ja: "B+左: シールド（ヤカーン / メットール）", zh: "B+左: 盾 (Shield / 沸水壶 / 钢盔怪)" } },
    { id: "Magnetize", name: { en: "B+Left: Magnetize (MagnetMan)", ja: "B+左: マグネット（マグネットマン）", zh: "B+左: 定身 (Magnetize / 磁铁人)" } },
    { id: "Fan", name: { en: "B+Left: Fan (WindMan)", ja: "B+左: スイコミ（ウインドマン）", zh: "B+左: 抽风机 (Fan / 风人)" } },
    { id: "Meteor3", name: { en: "B+Left: Meteor3 (PlanetMan)", ja: "B+左: メテオ3（プラネットマン）", zh: "B+左: 流星3 (Meteor3 / 行星人)" } },
    { id: "RiskyHoney", name: { en: "B+Left: RiskyHoney (HoneyBomber)", ja: "B+左: リスキーハニー（ハニーボマー）", zh: "B+左: 危险蜂蜜 (RiskyHoney / 蜜蜂)" } },
    { id: "MachineSword", name: { en: "B+Left: MachineSword (Colonel)", ja: "B+左: マシンソード（カーネル）", zh: "B+左: 机器剑 (MachineSword / 卡奈尔)" } },
];

export const BN5_BLEFT_OPTIONS: ConstraintOption[] = [
    { id: "Shield", name: { en: "B+Left: Shield (WindBox / SharkMan)", ja: "B+左: シールド（ラウンダ / ブルース）", zh: "B+左: 盾 (Shield / 吹风机 / 鲨鱼人)" } },
    { id: "CurseShield", name: { en: "B+Left: CurseShield (Cactikil)", ja: "B+左: カーズシールド（カーズ）", zh: "B+左: 诅咒护盾 (CurseShield / 仙人掌)" } },
    { id: "MetGuard", name: { en: "B+Left: MetGuard (Mettaur)", ja: "B+左: メットガード（メットール）", zh: "B+左: 钢盔防御 (MetGuard / 钢盔怪)" } },
];

export const BN4_BLEFT_OPTIONS: ConstraintOption[] = [
    { id: "AirShot", name: { en: "B+Left: AirShot", ja: "B+左: エアシュート", zh: "B+左: 空气枪" } },
    { id: "BugBomb", name: { en: "B+Left: BugBomb", ja: "B+左: バグボム", zh: "B+左: BUG炸弹" } },
    { id: "CrackOut", name: { en: "B+Left: CrackOut", ja: "B+左: クラックアウト", zh: "B+左: 砸裂地面" } },
    { id: "DoubleCrack", name: { en: "B+Left: DoubleCrack", ja: "B+左: ダブルクラック", zh: "B+左: 双重砸裂" } },
    { id: "TripleCrack", name: { en: "B+Left: TripleCrack", ja: "B+左: トリプルクラック", zh: "B+左: 三重砸裂" } },
    { id: "MegaEnergyBomb", name: { en: "B+Left: MegaEnergyBomb", ja: "B+左: メガエナジーボム", zh: "B+左: 大型能量炸弹" } },
    { id: "Recover10", name: { en: "B+Left: Recover10", ja: "B+左: リカバリー10", zh: "B+左: 回复10" } },
    { id: "PanelReturn", name: { en: "B+Left: PanelReturn", ja: "B+左: パネルリターン", zh: "B+左: 面板复原" } },
    { id: "NorthWind", name: { en: "B+Left: NorthWind", ja: "B+左: スーパーキタカゼ", zh: "B+左: 北风" } },
    { id: "BambooLance", name: { en: "B+Left: BambooLance", ja: "B+左: バンブーランス", zh: "B+左: 竹枪" } },
];

export function getBLeftOptions(gameId: string): ConstraintOption[] {
    if (gameId === "bn5") return BN5_BLEFT_OPTIONS;
    if (gameId === "bn4") return BN4_BLEFT_OPTIONS;
    return BN6_BLEFT_OPTIONS;
}

export const BLEFT_OPTIONS = BN6_BLEFT_OPTIONS;

export const BN6_BBUTTON_OPTIONS: ConstraintOption[] = [
    { id: "none", name: { en: "Standard Buster (No Weapon Override)", ja: "通常バスター（武器上書きなし）", zh: "标准洛克炮 (禁用武器覆盖)" } },
    { id: "Sword", name: { en: "B: Sword (Shadow / Zero)", ja: "B: ソード（シャドー / ゼロ）", zh: "B: 剑 (Sword / 暗影 / ZERO)" } },
    { id: "MiniBomb", name: { en: "B: MiniBomb (Beetle)", ja: "B: ミニボム（ビートル）", zh: "B: 迷你炸弹 (MiniBomb / 甲虫)" } },
    { id: "CrackShot", name: { en: "B: CrackShot (PlanetMan)", ja: "B: クラックショット（プラネットマン）", zh: "B: 裂缝射击 (CrackShot / 行星人)" } },
    { id: "Meteor1", name: { en: "B: Meteor1 (MetFire)", ja: "B: メテオ1（メットファイア）", zh: "B: 流星1 (Meteor1 / 头盔火)" } },
    { id: "Vulcan", name: { en: "B: Vulcan (BowlMan)", ja: "B: バルカン（ボウルマン）", zh: "B: 火神炮 (Vulcan / 保龄球人)" } },
];

export const BN5_BBUTTON_OPTIONS: ConstraintOption[] = [
    { id: "none", name: { en: "Standard Buster (No Weapon Override)", ja: "通常バスター（武器上書きなし）", zh: "标准洛克炮 (禁用武器覆盖)" } },
    { id: "Buster", name: { en: "B: Buster", ja: "B: バスター", zh: "B: 洛克炮" } },
    { id: "Sword", name: { en: "B: Sword", ja: "B: ソード", zh: "B: 剑" } },
    { id: "MiniBomb", name: { en: "B: MiniBomb", ja: "B: ミニボム", zh: "B: 迷你炸弹" } },
    { id: "CrackOut", name: { en: "B: CrackOut", ja: "B: クラックアウト", zh: "B: 砸裂地面" } },
];

export const BN4_BBUTTON_OPTIONS: ConstraintOption[] = [
    { id: "none", name: { en: "Standard Buster (No Weapon Override)", ja: "通常バスター（武器上書きなし）", zh: "标准洛克炮 (禁用武器覆盖)" } },
    { id: "MetGuard", name: { en: "B: MetGuard", ja: "B: メットガード", zh: "B: 钢盔防御" } },
    { id: "CrackOut", name: { en: "B: CrackOut", ja: "B: クラックアウト", zh: "B: 砸裂地面" } },
    { id: "Reflect", name: { en: "B: Reflect", ja: "B: リフレクト", zh: "B: 反射盾" } },
    { id: "Flower", name: { en: "B: Flower", ja: "B: フラワー", zh: "B: 花朵" } },
    { id: "WaterGun", name: { en: "B: WaterGun", ja: "B: ウォーターガン", zh: "B: 水枪" } },
    { id: "MiniBomb", name: { en: "B: MiniBomb", ja: "B: ミニボム", zh: "B: 迷你炸弹" } },
];

export function getBButtonOptions(gameId: string): ConstraintOption[] {
    if (gameId === "bn5") return BN5_BBUTTON_OPTIONS;
    if (gameId === "bn4") return BN4_BBUTTON_OPTIONS;
    return BN6_BBUTTON_OPTIONS;
}

export const BBUTTON_OPTIONS = BN6_BBUTTON_OPTIONS;

export const BN6_CORE_ABILITY_OPTIONS: ConstraintOption[] = [
    { id: "superArmor", name: { en: "SuperArmor", ja: "スーパーアーマー", zh: "超级装甲" } },
    { id: "airShoes", name: { en: "AirShoes", ja: "エアシューズ", zh: "飞行鞋" } },
    { id: "floatShoes", name: { en: "FloatShoes", ja: "フロートシューズ", zh: "漂浮鞋" } },
    { id: "underShirt", name: { en: "UnderShirt", ja: "アンダーシャツ", zh: "紧身衣" } },
    { id: "statusGuard", name: { en: "StatusGuard", ja: "ステータスガード", zh: "状态守护" } },
    { id: "firstBarrier", name: { en: "FirstBarrier", ja: "ファーストバリア", zh: "初始防护罩" } },
    { id: "firstBarrier200", name: { en: "FirstBarrier 200", ja: "ファーストバリア200", zh: "初始防护罩200" } },
    { id: "chipRecovery", name: { en: "ChipRecovery", ja: "チップリカバリー", zh: "芯片回复" } },
    { id: "chipShuffle", name: { en: "ChipShuffle", ja: "サーチシャッフル", zh: "随机切换" } },
    { id: "rush", name: { en: "Rush Support", ja: "ラッシュサポート", zh: "莱西支援" } },
    { id: "beat", name: { en: "Beat Support", ja: "ビートサポート", zh: "比特支援" } },
    { id: "tango", name: { en: "Tango Support", ja: "タンゴサポート", zh: "探戈支援" } },
];

export const BN5_CORE_ABILITY_OPTIONS: ConstraintOption[] = [
    { id: "superArmor", name: { en: "SuperArmor", ja: "スーパーアーマー", zh: "超级装甲" } },
    { id: "airShoes", name: { en: "AirShoes", ja: "エアシューズ", zh: "飞行鞋" } },
    { id: "floatShoes", name: { en: "FloatShoes", ja: "フロートシューズ", zh: "漂浮鞋" } },
    { id: "underShirt", name: { en: "UnderShirt", ja: "アンダーシャツ", zh: "紧身衣" } },
    { id: "statusGuard", name: { en: "StatusGuard", ja: "ステータスガード", zh: "状态守护" } },
    { id: "firstBarrier", name: { en: "FirstBarrier", ja: "ファーストバリア", zh: "初始防护罩" } },
    { id: "firstBarrier200", name: { en: "FirstBarrier 200", ja: "ファーストバリア200", zh: "初始防护罩200" } },
    { id: "autoHeal", name: { en: "AutoHeal", ja: "セルフリカバリー", zh: "自我回复" } },
    { id: "bugStop", name: { en: "BugStop", ja: "バグストッパー", zh: "BUG停止器" } },
    { id: "rush", name: { en: "Rush Support", ja: "ラッシュサポート", zh: "莱西支援" } },
    { id: "beat", name: { en: "Beat Support", ja: "ビートサポート", zh: "比特支援" } },
    { id: "tango", name: { en: "Tango Support", ja: "タンゴサポート", zh: "探戈支援" } },
];

export const BN4_CORE_ABILITY_OPTIONS: ConstraintOption[] = [
    { id: "firstBarrier", name: { en: "FirstBarrier", ja: "ファーストバリア", zh: "初始防护罩" } },
    { id: "firstBarrier200", name: { en: "FirstBarrier 200", ja: "ファーストバリア200", zh: "初始防护罩200" } },
    { id: "fullSynchro", name: { en: "FullSynchro", ja: "フルシンクロ", zh: "完全同步" } },
    { id: "allGuard", name: { en: "All Guard", ja: "オールガード", zh: "全御防御" } },
    { id: "rush", name: { en: "Rush Support", ja: "ラッシュサポート", zh: "莱西支援" } },
    { id: "beat", name: { en: "Beat Support", ja: "ビートサポート", zh: "比特支援" } },
    { id: "tango", name: { en: "Tango Support", ja: "タンゴサポート", zh: "探戈支援" } },
];

export function getCoreAbilityOptions(gameId: string): ConstraintOption[] {
    if (gameId === "bn5") return BN5_CORE_ABILITY_OPTIONS;
    if (gameId === "bn4") return BN4_CORE_ABILITY_OPTIONS;
    return BN6_CORE_ABILITY_OPTIONS;
}

export const CORE_ABILITY_OPTIONS = BN6_CORE_ABILITY_OPTIONS;

export const CHARGE_ADDITION_OPTIONS: ConstraintOption[] = [
    { id: "Paralyze", name: { en: "CS: Paralyze (ToadMan)", ja: "CS: 麻痺（トードマン）", zh: "CS: 麻痹 (Paralyze / 青蛙人)" } },
    { id: "Confusion", name: { en: "CS: Confusion (Punk / Skarab)", ja: "CS: 混乱（パンク / スカラビア）", zh: "CS: 混乱 (Confusion / 庞克 / 骷髅比亚)" } },
    { id: "Freeze", name: { en: "CS: Freeze (ColdMan)", ja: "CS: 凍結（コールドマン）", zh: "CS: 冻结 (Freeze / 寒冷人)" } },
    { id: "Bubble", name: { en: "CS: Bubble (StarFish)", ja: "CS: 泡（ヒトデスタ）", zh: "CS: 泡沫 (Bubble / 海星星)" } },
    { id: "Break element", name: { en: "CS: Break Element (Armadill)", ja: "CS: ブレイク属性（アルマン）", zh: "CS: 破防 (Break / 犰狳)" } },
    { id: "Pull", name: { en: "CS: Pull (MagTect)", ja: "CS: 引き寄せ（マグテクト）", zh: "CS: 吸引 (Pull / 磁侦特)" } },
    { id: "Grass Panel", name: { en: "CS: Grass Panel (WuNote / PlantMan)", ja: "CS: 草むらパネル（ウドノート / プラントマン）", zh: "CS: 草地 (Grass / 音符木头 / 植物人)" } },
    { id: "Ice Panel", name: { en: "CS: Ice Panel (ElmntMan)", ja: "CS: 氷パネル（エレメントマン）", zh: "CS: 冰面 (Ice / 元素人)" } },
    { id: "Left Arrow Panel", name: { en: "CS: Left Arrow (VideoMan)", ja: "CS: 左矢印パネル（ビデオマン）", zh: "CS: 左箭头 (Left Arrow / 影像人)" } },
    { id: "Right Arrow Panel", name: { en: "CS: Right Arrow (Magneakr)", ja: "CS: 右矢印パネル（マグニッカー）", zh: "CS: 右箭头 (Right Arrow / 磁蝗虫)" } },
    { id: "HP Bug LV1", name: { en: "CS: HP Bug LV1 (SkullMan)", ja: "CS: HPバグLV1（スカルマン）", zh: "CS: HP BUG (SkullMan / 骷髅人)" } },
    { id: "Chip Destruction", name: { en: "CS: Chip Destruction (LarkMan)", ja: "CS: チップ破壊（スワローマン）", zh: "CS: 芯片破坏 (LarkMan / 飞燕人)" } },
    { id: "Instant Delete", name: { en: "CS: Instant Delete (EraseMan)", ja: "CS: 即死（キラーマン）", zh: "CS: 即死/扣血 (EraseMan / 杀手人)" } },
];

export const BUSTER_ADDITION_OPTIONS: ConstraintOption[] = [
    { id: "1 square knock back", name: { en: "Knockback 1 Square (BomBoy)", ja: "1マスノックバック（ボムボーイ）", zh: "击退 1 格 (1 square knock back / 炸弹小弟)" } },
    { id: "Knock back all the way", name: { en: "Knockback to Edge (AirMan)", ja: "端までノックバック（エアーマン）", zh: "击退到底 (Knock back all / 气力人)" } },
    { id: "Cracked Panel", name: { en: "Cracked Panel (DustMan / Twisty)", ja: "ヒビパネル（ダストマン / ツイスティ）", zh: "裂地面 (Cracked Panel / 尘埃人 / 扭扭虫)" } },
    { id: "Grass Panel", name: { en: "Grass Panel (Shrubby / ElmntMan)", ja: "草むらパネル（シュラッキー / エレメントマン）", zh: "草地面 (Grass Panel / 灌木怪 / 元素人)" } },
    { id: "Ice Panel", name: { en: "Ice Panel (FreezeMn)", ja: "氷パネル（フリーズマン）", zh: "冰地面 (Ice Panel / 冷冻人)" } },
    { id: "Swamp Panel", name: { en: "Swamp Panel (MistMan / DarkMega)", ja: "沼パネル（ミストマン / ダークロックマン）", zh: "毒沼面 (Swamp Panel / 雾人 / 黑暗洛克人)" } },
];

export const BODY_OPTIONS: ConstraintOption[] = [
    { id: "Normal", name: { en: "Normal Body", ja: "ノーマルボディ", zh: "一般躯体 (Normal)" } },
    { id: "Fire", name: { en: "Fire Body", ja: "ヒートボディ", zh: "火之躯体 (Fire)" } },
    { id: "Aqua", name: { en: "Aqua Body", ja: "アクアボディ", zh: "水之躯体 (Aqua)" } },
    { id: "Elec", name: { en: "Elec Body", ja: "エレキボディ", zh: "雷之躯体 (Elec)" } },
    { id: "Wood", name: { en: "Wood Body", ja: "ウッドボディ", zh: "木之躯体 (Wood)" } },
];

export const GAUGE_OPTIONS: ConstraintOption[] = [
    { id: "fast", name: { en: "FastGauge", ja: "クイックゲージ", zh: "快速量表 (FastGauge)" } },
    { id: "slow", name: { en: "SlowGauge", ja: "ヘビーゲージ", zh: "缓慢量表 (SlowGauge)" } },
    { id: "normal", name: { en: "NormalGauge", ja: "ノーマルゲージ", zh: "普通量表 (NormalGauge)" } },
];

export interface BugSpecOption {
    id: string;
    name: { en: string; ja: string; zh: string };
    desc: { en: string; ja: string; zh: string };
}

export const BUG_SPEC_OPTIONS: BugSpecOption[] = [
    {
        id: "movement",
        name: { en: "Movement Warp", ja: "移動バグ", zh: "边界瞬移 BUG" },
        desc: { en: "Warps to screen edge on move", ja: "移動時に最端マスへワープ", zh: "移动时直接瞬移至边缘格子" },
    },
    {
        id: "custom",
        name: { en: "Custom Screen -1", ja: "カスタム減少", zh: "改装视窗减少 BUG" },
        desc: { en: "Reduces initial chip selection by 1", ja: "カスタム画面の選択枠-1", zh: "选芯片视窗每回合少选 1 枚" },
    },
    {
        id: "battleHp",
        name: { en: "Battle HP Leak", ja: "HP減少バグ", zh: "战斗 HP 流失 BUG" },
        desc: { en: "Steadily loses HP during combat", ja: "戦闘中にHPが継続減少", zh: "战斗中自身 HP 持续流失" },
    },
    {
        id: "buster",
        name: { en: "Buster Blank", ja: "空打ちバグ", zh: "普通射击空包弹 BUG" },
        desc: { en: "Buster shots may misfire or blank", ja: "射撃が不発またはチャージ暴発", zh: "普通射击有几率卡壳打出空包弹" },
    },
    {
        id: "customHp",
        name: { en: "Custom Menu HP Drain", ja: "カスタム画面HP減少", zh: "选卡菜单 HP 流失 BUG" },
        desc: { en: "Loses HP while selecting chips", ja: "カスタム画面を開いている間HP減少", zh: "在芯片选择菜单中停留时持续扣血" },
    },
    {
        id: "panel",
        name: { en: "Panel Break / Poison", ja: "パネル変化バグ", zh: "面板变化 / 破裂 BUG" },
        desc: { en: "Cracks or poisons stepped/initial panels", ja: "歩行時や開始時にパネルがヒビ・毒沼化", zh: "走过地板开裂或开局场地变为毒沼" },
    },
    {
        id: "status",
        name: { en: "Status Abnormality", ja: "状態異常バグ", zh: "战斗状态异常 BUG" },
        desc: { en: "Starts combat confused, blind, or flashing", ja: "戦闘開始時に混乱・盲目等の異常", zh: "开局处于混乱、失明或闪烁等异常" },
    },
    {
        id: "emotion",
        name: { en: "Emotion / Humor Bug", ja: "感情・ユーモアバグ", zh: "情绪 / 幽默感 BUG" },
        desc: { en: "Uncontrolled emotional shifts or jokes", ja: "感情が不安/怒り暴走、または被弾時ギャグ", zh: "情绪极度动摇/愤怒，或受击时讲冷笑话" },
    },
];

export const FORBIDDEN_BUG_OPTIONS: ConstraintOption[] = BUG_SPEC_OPTIONS;

export function normalizeBugType(type: string): string {
    const t = type.toLowerCase();
    if (t === "involuntarymove" || t === "player" || t === "movement") return "movement";
    if (t === "damagebattlehp" || t === "battlehp") return "battleHp";
    if (t === "customdamage" || t === "customhp") return "customHp";
    if (t === "damageconfusion" || t === "status" || t === "colorstatus") return "status";
    if (t === "panelset" || t === "poisonwalk" || t === "panel") return "panel";
    if (t === "customscreenminus" || t === "custom") return "custom";
    if (t === "buster") return "buster";
    if (t === "emotion") return "emotion";
    return type;
}

export function findPartIndexByAbility(data: { gameId: string; partMetas: { id: number; name: string }[] }, ability: string): number {
    const effects = GAME_EFFECTS[data.gameId];
    if (!effects) return -1;
    for (let idx = 0; idx < data.partMetas.length; idx++) {
        const meta = data.partMetas[idx];
        const eff = effects[meta.id];
        if (eff && eff.abilities && eff.abilities.includes(ability)) {
            return idx;
        }
    }
    return -1;
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
    isModCardBug?: boolean;
    sourceCardName?: string;
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
    modCardBugs?: {
        cardId: string;
        cardName: string;
        bug: ModCardBug;
    }[];
    repairedBugsNotice?: string[];
}

export function analyzeSolutionBugs(
    gameId: string,
    partMetas: { id: number; name: string; nameJa?: string; nameZh?: string; isSolid: boolean; color: number }[],
    requirements: Requirement[],
    cells: (number | null)[],
    gridSettings: GridSettings,
    lang: Lang,
    modCardIds?: string[]
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
        violationCount: number;
    }[] = [];

    for (const d of reqDetails) {
        const causes: BugCause[] = [];
        let violationCount = 0;

        if (d.partMeta.isSolid && !d.onCommandLine) {
            causes.push("solidNotOnCommandLine");
            violationCount += 1;
        }
        if (!d.partMeta.isSolid && d.onCommandLine) {
            causes.push("plusOnCommandLine");
            violationCount += 1;
        }
        if (d.adjacentSameColoredPlacements.size > 0) {
            causes.push("adjacentSameColor");
            violationCount += d.adjacentSameColoredPlacements.size;
        }
        if (d.outOfBounds) {
            causes.push("outOfBounds");
            violationCount += 1;
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
                violationCount,
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
        const totalViolations = group.reduce((sum, g) => sum + g.violationCount, 0);

        const level = Math.max(1, totalViolations);
        const maxDefinedLevel = bugDef?.levels
            ? Math.max(...Object.keys(bugDef.levels).map(Number))
            : 1;
        const effectiveLevel = Math.min(level, maxDefinedLevel);

        const levelMechanics =
            bugDef?.levels?.[effectiveLevel]?.[lang] ??
            bugDef?.mechanics[lang] ??
            "";
        const titleWithLevel = bugDef?.levels ? `${baseTitle} (Lv${effectiveLevel})` : baseTitle;

        activeBugs.push({
            bugType: bugType as BugType,
            level: effectiveLevel,
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
                level: effectiveLevel,
                bugTitle: titleWithLevel,
                bugMechanics: levelMechanics,
                causes: g.causes,
            });
        }
    }

    const colorDef = gameDefs["colorStatus"] ?? GAME_BUG_DEFINITIONS["bn6"]["colorStatus"];
    const colorBugTitle = colorDef?.title[lang];
    const colorBugMechanics = colorDef?.mechanics[lang];

    let finalActiveBugs = activeBugs;
    let modCardBugsList: { cardId: string; cardName: string; bug: ModCardBug }[] | undefined;
    let repairedBugsNotice: string[] | undefined;

    if ((gameId === "bn4" || gameId === "bn5" || gameId === "bn6") && modCardIds && modCardIds.length > 0) {
        const deck = computeDeckStats(modCardIds, gameId);
        repairedBugsNotice = deck.repairedBugs;

        // If card has Repair, remove corresponding NaviCust active bugs
        if (deck.repairedBugs.length > 0) {
            finalActiveBugs = finalActiveBugs.filter(ab => {
                for (const rep of deck.repairedBugs) {
                    const normRep = rep.toLowerCase();
                    const bType = ab.bugType.toLowerCase();
                    if (normRep.includes("battle hp") && bType === "battlehp") return false;
                    if (normRep.includes("movement") && bType === "movement") return false;
                    if (normRep.includes("buster blank") && bType === "buster") return false;
                    if (normRep.includes("custom damage") && bType === "customdamage") return false;
                    if ((normRep.includes("custom hp") || normRep.includes("custom screen hp")) && bType === "customhp") return false;
                    if (normRep.includes("panel") && bType === "panel") return false;
                    if (normRep.includes("status") && bType === "status") return false;
                    if (normRep.includes("emotion") && bType === "emotion") return false;
                    if (normRep.includes("damage") && bType.includes("damage")) return false;
                }
                return true;
            });
        }

        // Mod card bugs are NOT neutralized by BugStop!
        if (deck.activeBugs.length > 0) {
            modCardBugsList = [];
            for (const entry of deck.activeBugs) {
                const card = getModCard(entry.sourceCardId, gameId);
                const cardDisplayName = card ? getCardDisplayName(card, lang) : entry.sourceCardId;
                modCardBugsList.push({
                    cardId: entry.sourceCardId,
                    cardName: cardDisplayName,
                    bug: entry.bug,
                });

                finalActiveBugs.push({
                    bugType: entry.bug.type as BugType,
                    level: entry.bug.level ?? 1,
                    title: `[${cardDisplayName}] ${entry.bug.name[lang]}`,
                    mechanics: entry.bug.description[lang],
                    parts: [],
                    isModCardBug: true,
                    sourceCardName: cardDisplayName,
                });
            }
        }
    }

    const hasBugs = finalActiveBugs.length > 0 || tooManyColors || (bugs.length > 0 && !bugStopActive);

    return {
        hasBugs,
        bugStopActive,
        bugs,
        activeBugs: finalActiveBugs,
        tooManyColors,
        colorBugTitle,
        colorBugMechanics,
        distinctColorCount: distinctColors.size,
        modCardBugs: modCardBugsList,
        repairedBugsNotice,
    };
}

/**
 * Determines whether a bug is considered benign (minor enough to accept for stat gain in Netplay).
 * - customhp: Menu HP drain Lv1 (only drains while selecting chips in custom screen)
 * - buster: Buster blank Lv1 (minor rate of blank shots)
 * - emotion: Emotion chaos Lv1 (cycles emotion)
 */
export function isBenignBug(bugType: string, level: number): boolean {
    const norm = bugType.toLowerCase();
    if (norm === "customhp" && level <= 1) return true;
    if (norm === "buster" && level <= 1) return true;
    if (norm === "emotion" && level <= 1) return true;
    return false;
}

/**
 * Returns only the bugs that actually take effect in battle, accounting for BugStop neutralization.
 * If BugStop is active, all NaviCust placement bugs are absorbed and do NOT affect MegaMan in battle.
 * Mod Card bugs are NOT neutralized by BugStop.
 */
export function getEffectiveInBattleBugs(analysis: SolutionBugAnalysis): ActiveBugEffect[] {
    if (analysis.bugStopActive) {
        return (analysis.activeBugs || []).filter(b => b.isModCardBug);
    }
    return analysis.activeBugs || [];
}

/**
 * Evaluates whether a solution's bug analysis satisfies the given BugPolicy, forbidden bugs, or bug rules.
 */
export function isSolutionAcceptable(
    analysis: SolutionBugAnalysis,
    policy: BugPolicy = DEFAULT_BUG_POLICY,
    forbiddenBugs?: string[],
    bugRules?: Partial<Record<string, BugTolerance>>
): boolean {
    // 1. Color limit check: >4 colors is always an illegal build on GBA
    if (analysis.tooManyColors) {
        return false;
    }

    // 2. Get the bugs that actually affect MegaMan in battle (after BugStop absorption)
    const effectiveBugs = getEffectiveInBattleBugs(analysis);

    // 3. If explicit bugRules are specified (or present in policy.customRules), apply tri-state logic
    const activeRules: Partial<Record<string, BugTolerance>> | undefined =
        bugRules || policy.customRules;

    if (activeRules !== undefined || policy.type === "custom") {
        const rules = activeRules || {};
        // Every bug in effectiveBugs must not be forbidden
        for (const bug of effectiveBugs) {
            const norm = normalizeBugType(bug.bugType);
            const rule = rules[norm] ?? rules[bug.bugType] ?? "forbidden";
            if (rule === "forbidden") return false;
            if (rule === "allowed_lv1" && bug.level > 1) return false;
        }

        // Every required bug must be present in effectiveBugs with level >= 1
        for (const [bugType, tolerance] of Object.entries(rules)) {
            if (tolerance === "required") {
                const norm = normalizeBugType(bugType).toLowerCase();
                const found = effectiveBugs.some(
                    b => normalizeBugType(b.bugType).toLowerCase() === norm && b.level >= 1
                );
                if (!found) return false;
            }
        }
        return true;
    }

    // 4. If explicit forbiddenBugs are specified (legacy constraint format)
    if (forbiddenBugs && forbiddenBugs.length > 0) {
        const hasForbidden = effectiveBugs.some(b => {
            const norm = normalizeBugType(b.bugType).toLowerCase();
            return forbiddenBugs.some(fb => normalizeBugType(fb).toLowerCase() === norm);
        });
        if (hasForbidden) return false;

        // When explicit forbidden bugs are provided, other bugs that are benign or standard buster/emotion are tolerated
        return effectiveBugs.every(b => {
            const norm = normalizeBugType(b.bugType).toLowerCase();
            return norm === "buster" || norm === "customhp" || norm === "emotion" || isBenignBug(norm, b.level);
        });
    }

    if (policy.type === "no_bugs") {
        // Must have zero effective bugs in battle!
        return effectiveBugs.length === 0;
    }

    if (policy.type === "benign_allowed") {
        // Every effective bug must be benign
        return effectiveBugs.every(b => isBenignBug(b.bugType, b.level));
    }

    return true;
}
