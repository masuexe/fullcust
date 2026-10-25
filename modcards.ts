import bn6Cards from "./data/bn6-modcards.json";
import bn5Cards from "./data/bn5-modcards.json";
import bn4Cards from "./data/bn4-modcards.json";
import { Lang } from "./i18n";

export interface ModCardStats {
    hp?: number;
    hpPercent?: number;
    attack?: number;
    attackMult?: number;
    rapid?: number;
    charge?: number;
    custom?: number;
    megaFolder?: number;
    gigaFolder?: number;
    soulTime?: number;
}

export interface ModCardBug {
    raw: string;
    type: string;
    level?: number | null;
    name: { en: string; ja: string; zh: string };
    description: { en: string; ja: string; zh: string };
}

export interface ModCard {
    id: string;
    cardNo: number;
    name: string;
    nameZh: string;
    nameJa: string;
    mb: number;
    slot?: "0A" | "0B" | "0C" | "0D" | "0E" | "0F" | string;
    part?: string;
    soul?: string;
    posRaw: string[];
    negRaw: string[];
    stats: ModCardStats;
    abilities: string[];
    disabledAbilities: string[];
    disabledBLeft?: boolean;
    disabledBusterAddition?: boolean;
    disabledChargeAddition?: boolean;
    disabledChipRecovery?: boolean;
    body?: "Normal" | "Fire" | "Aqua" | "Elec" | "Wood" | string;
    gauge?: "fast" | "slow" | "normal";
    bButton?: string;
    bPwrAtk?: string;
    bLeft?: string;
    busterAddition?: string;
    chargeAddition?: string;
    movePanel?: string;
    chipRecovery?: number;
    firstBarrier?: number | string;
    tripleBuster?: boolean;
    repairs: string[];
    bugs: ModCardBug[];
}

export const BN6_MOD_CARDS: ModCard[] = bn6Cards as ModCard[];
export const BN6_MOD_CARDS_MAP = new Map<string, ModCard>(
    BN6_MOD_CARDS.map(c => [c.id, c])
);

export const BN5_MOD_CARDS: ModCard[] = bn5Cards as ModCard[];
export const BN5_MOD_CARDS_MAP = new Map<string, ModCard>(
    BN5_MOD_CARDS.map(c => [c.id, c])
);

export const BN4_MOD_CARDS: ModCard[] = bn4Cards as ModCard[];
export const BN4_MOD_CARDS_MAP = new Map<string, ModCard>(
    BN4_MOD_CARDS.map(c => [c.id, c])
);

export const BN6_MAX_MOD_MB = 80;
export const BN5_MAX_MOD_MB = 80;

export function getModCards(gameId: string = "bn6"): ModCard[] {
    if (gameId === "bn4") return BN4_MOD_CARDS;
    if (gameId === "bn5") return BN5_MOD_CARDS;
    return BN6_MOD_CARDS;
}

export function getModCard(id: string, gameId?: string): ModCard | undefined {
    if (gameId === "bn4") return BN4_MOD_CARDS_MAP.get(id);
    if (gameId === "bn5") return BN5_MOD_CARDS_MAP.get(id);
    if (gameId === "bn6") return BN6_MOD_CARDS_MAP.get(id);
    return BN6_MOD_CARDS_MAP.get(id) || BN5_MOD_CARDS_MAP.get(id) || BN4_MOD_CARDS_MAP.get(id);
}

export function getCardDisplayName(card: ModCard, lang: Lang): string {
    if (lang === "zh" && card.nameZh) return card.nameZh;
    if (lang === "ja" && card.nameJa) return card.nameJa;
    return card.name;
}

export interface DeckStats {
    totalMb: number;
    isOverCapacity: boolean;
    slotsUsed?: string[];
    hasSlotConflict?: boolean;
    soul?: string;
    stats: {
        hp: number;
        hpPercent: number;
        attack: number;
        attackMult: number;
        rapid: number;
        charge: number;
        custom: number;
        megaFolder: number;
        gigaFolder: number;
        soulTime?: number;
    };
    activeAbilities: string[];
    disabledAbilities: string[];
    activeBugs: {
        sourceCardId: string;
        sourceCardName: { en: string; ja: string; zh: string };
        bug: ModCardBug;
    }[];
    repairedBugs: string[];
    body?: string;
    gauge?: "fast" | "slow" | "normal";
    bButton?: string;
    bPwrAtk?: string;
    bLeft?: string;
    busterAddition?: string;
    chargeAddition?: string;
    invalidatedBusterAddition?: string;
    invalidatedChargeAddition?: string;
    movePanel?: string;
    chipRecovery?: number;
    firstBarrier?: number | string;
    tripleBuster?: boolean;
}

export function computeDeckStats(cardIds: string[], gameId: string = "bn6"): DeckStats {
    let totalMb = 0;
    const stats: DeckStats["stats"] = {
        hp: 0,
        hpPercent: 0,
        attack: 0,
        attackMult: 1,
        rapid: 0,
        charge: 0,
        custom: 0,
        megaFolder: 0,
        gigaFolder: 0,
        soulTime: 0,
    };

    const abilitiesSet = new Set<string>();
    const disabledSet = new Set<string>();
    const slotsUsed: string[] = [];
    const seenSlots = new Set<string>();
    let hasSlotConflict = false;
    let soul: string | undefined;

    type DeckBugEntry = {
        sourceCardId: string;
        sourceCardName: { en: string; ja: string; zh: string };
        bug: ModCardBug;
    };

    let deckBugs: DeckBugEntry[] = [];
    const repairedBugsSet = new Set<string>();

    let body: string | undefined;
    let gauge: "fast" | "slow" | "normal" | undefined;
    let bButton: string | undefined;
    let bPwrAtk: string | undefined;
    let bLeft: string | undefined;
    let busterAddition: string | undefined;
    let chargeAddition: string | undefined;
    let movePanel: string | undefined;
    let chipRecovery: number | undefined;
    let firstBarrier: number | string | undefined;
    let tripleBuster: boolean | undefined;

    for (const cid of cardIds) {
        const card = getModCard(cid, gameId);
        if (!card) continue;

        totalMb += card.mb;
        if (card.slot) {
            slotsUsed.push(card.slot);
            if (seenSlots.has(card.slot)) {
                hasSlotConflict = true;
            }
            seenSlots.add(card.slot);
        }
        if (card.soul) soul = card.soul;

        // Stats accumulate
        if (card.stats.hp) stats.hp += card.stats.hp;
        if (card.stats.hpPercent) stats.hpPercent += card.stats.hpPercent;
        if (card.stats.attack) stats.attack += card.stats.attack;
        if (card.stats.attackMult) stats.attackMult = Math.max(stats.attackMult, card.stats.attackMult);
        if (card.stats.rapid) stats.rapid += card.stats.rapid;
        if (card.stats.charge) stats.charge += card.stats.charge;
        if (card.stats.custom) stats.custom += card.stats.custom;
        if (card.stats.megaFolder) stats.megaFolder += card.stats.megaFolder;
        if (card.stats.gigaFolder) stats.gigaFolder += card.stats.gigaFolder;
        if (card.stats.soulTime) stats.soulTime = (stats.soulTime || 0) + card.stats.soulTime;

        // Abilities
        if (card.abilities) {
            for (const ab of card.abilities) {
                abilitiesSet.add(ab);
                disabledSet.delete(ab);
            }
        }
        if (card.disabledAbilities) {
            for (const dab of card.disabledAbilities) {
                abilitiesSet.delete(dab);
                disabledSet.add(dab);
            }
        }

        // Body, gauge, special B moves: later card overwrites earlier ones
        if (card.body !== undefined) body = card.body;
        if (card.gauge !== undefined) gauge = card.gauge;
        if (card.bButton !== undefined) bButton = card.bButton;
        if (card.bPwrAtk !== undefined) bPwrAtk = card.bPwrAtk;
        if (card.bLeft !== undefined) bLeft = card.bLeft;
        if (card.busterAddition !== undefined) busterAddition = card.busterAddition;
        if (card.chargeAddition !== undefined) chargeAddition = card.chargeAddition;
        if (card.movePanel !== undefined) movePanel = card.movePanel;
        if (card.chipRecovery !== undefined) {
            chipRecovery = card.chipRecovery;
            if (chipRecovery > 0) {
                abilitiesSet.add("chipRecovery");
                disabledSet.delete("chipRecovery");
            } else {
                abilitiesSet.delete("chipRecovery");
            }
        }
        if (card.firstBarrier !== undefined) firstBarrier = card.firstBarrier;
        if (card.tripleBuster !== undefined) tripleBuster = card.tripleBuster;

        // Handle negative disable attributes from cards
        if (card.disabledBLeft) bLeft = undefined;
        if (card.disabledChargeAddition) chargeAddition = undefined;
        if (card.disabledBusterAddition) busterAddition = undefined;
        if (card.disabledChipRecovery) {
            chipRecovery = undefined;
            abilitiesSet.delete("chipRecovery");
            disabledSet.add("chipRecovery");
        }

        // Add card bugs
        if (card.bugs) {
            for (const b of card.bugs) {
                deckBugs.push({
                    sourceCardId: card.id,
                    sourceCardName: {
                        en: card.name,
                        ja: card.nameJa,
                        zh: card.nameZh,
                    },
                    bug: b,
                });
            }
        }

        // Repairs: cancel bugs from earlier cards and record for NaviCust bug cancellation
        if (card.repairs) {
            for (const rep of card.repairs) {
                repairedBugsSet.add(rep);
                const normRep = rep.toLowerCase();

                deckBugs = deckBugs.filter(entry => {
                    const bType = entry.bug.type.toLowerCase();
                    const bRaw = entry.bug.raw.toLowerCase();

                    if (normRep.includes("battle hp") && (bType === "battlehp" || bRaw.includes("battle hp"))) return false;
                    if (normRep.includes("movement") && (bType === "movement" || bRaw.includes("movement"))) return false;
                    if (normRep.includes("buster blank") && (bType === "buster" || bRaw.includes("buster blank"))) return false;
                    if (normRep.includes("custom damage") && (bType === "customdamage" || bRaw.includes("custom damage"))) return false;
                    if ((normRep.includes("custom hp") || normRep.includes("custom screen hp")) && (bType === "customhp" || bRaw.includes("custom hp"))) return false;
                    if (normRep.includes("panel") && (bType === "panel" || bRaw.includes("panel"))) return false;
                    if (normRep.includes("status") && (bType === "status" || bRaw.includes("status"))) return false;
                    if (normRep.includes("emotion") && (bType === "emotion" || bRaw.includes("emotion"))) return false;
                    if (normRep.includes("damage") && (bType.includes("damage") || bRaw.includes("damage"))) return false;

                    return true;
                });
            }
        }
    }

    const isOverCapacity = gameId === "bn4"
        ? hasSlotConflict || cardIds.length > 5
        : totalMb > 80;

    // Interaction check 1: ChargeShot addition only applies when final CS is standard ChargeShot (or default buster CS).
    // If bPwrAtk is modified into a special weapon (e.g. DollThunder, CornShot, etc.), chargeAddition is invalidated!
    let invalidatedChargeAddition: string | undefined;
    if (bPwrAtk && bPwrAtk.toLowerCase() !== "chargeshot") {
        if (chargeAddition) {
            invalidatedChargeAddition = chargeAddition;
            chargeAddition = undefined;
        }
    }

    // Interaction check 2: Buster addition applies to normal buster bullets AND tripleBuster (which fires 3 normal buster bullets).
    // Only if bButton is explicitly overridden with a weapon (e.g. Sword, MiniBomb, CrackShot, Meteor1), busterAddition is invalidated!
    let invalidatedBusterAddition: string | undefined;
    if (bButton) {
        if (busterAddition) {
            invalidatedBusterAddition = busterAddition;
            busterAddition = undefined;
        }
    }

    return {
        totalMb,
        isOverCapacity,
        slotsUsed,
        hasSlotConflict,
        soul,
        stats,
        activeAbilities: Array.from(abilitiesSet).sort(),
        disabledAbilities: Array.from(disabledSet).sort(),
        activeBugs: deckBugs,
        repairedBugs: Array.from(repairedBugsSet),
        body,
        gauge,
        bButton,
        bPwrAtk,
        bLeft,
        busterAddition,
        chargeAddition,
        invalidatedBusterAddition,
        invalidatedChargeAddition,
        movePanel,
        chipRecovery,
        firstBarrier,
        tripleBuster,
    };
}

export interface AbilitySearchDefinition {
    key: string;
    name: { en: string; ja: string; zh: string };
    synonyms: string[];
    grants: (card: ModCard) => boolean;
    removes: (card: ModCard) => boolean;
}

export const ABILITY_SEARCH_DEFS: AbilitySearchDefinition[] = [
    {
        key: "superArmor",
        name: { en: "SuperArmor", ja: "スーパーアーマー", zh: "超级装甲" },
        synonyms: [
            "superarmor",
            "super armor",
            "armor",
            "超级装甲",
            "超甲",
            "霸体",
            "无硬直",
            "スーパーアーマー",
            "アーマー",
        ],
        grants: c =>
            (c.abilities || []).includes("superArmor") ||
            (c.posRaw || []).some(p => p.toLowerCase().includes("superarmor") || p.includes("スーパーアーマー")),
        removes: c =>
            (c.disabledAbilities || []).includes("superArmor") ||
            (c.negRaw || []).some(n => n.toLowerCase().includes("superarmor") || n.includes("スーパーアーマー")),
    },
    {
        key: "floatShoes",
        name: { en: "FloatShoes", ja: "フロートシューズ", zh: "漂浮鞋" },
        synonyms: [
            "floatshoes",
            "float shoes",
            "float",
            "漂浮鞋",
            "浮空鞋",
            "浮空",
            "フロートシューズ",
            "フロート",
        ],
        grants: c =>
            (c.abilities || []).includes("floatShoes") ||
            (c.posRaw || []).some(p => p.toLowerCase().includes("floatshoes") || p.includes("フロートシューズ")),
        removes: c =>
            (c.disabledAbilities || []).includes("floatShoes") ||
            (c.negRaw || []).some(n => n.toLowerCase().includes("floatshoes") || n.includes("フロートシューズ")),
    },
    {
        key: "airShoes",
        name: { en: "AirShoes", ja: "エアシューズ", zh: "飞行鞋" },
        synonyms: [
            "airshoes",
            "air shoes",
            "飞行鞋",
            "空中鞋",
            "飞鞋",
            "エアシューズ",
        ],
        grants: c =>
            (c.abilities || []).includes("airShoes") ||
            (c.posRaw || []).some(p => p.toLowerCase().includes("airshoes") || p.includes("エアシューズ") || p.includes("エアーシューズ")),
        removes: c =>
            (c.disabledAbilities || []).includes("airShoes") ||
            (c.negRaw || []).some(n => n.toLowerCase().includes("airshoes") || n.includes("エアシューズ")),
    },
    {
        key: "underShirt",
        name: { en: "UnderShirt", ja: "アンダーシャツ", zh: "危机守护(锁血)" },
        synonyms: [
            "undershirt",
            "under shirt",
            "紧身衣",
            "锁血",
            "危机守护",
            "不死",
            "アンダーシャツ",
        ],
        grants: c =>
            (c.abilities || []).includes("underShirt") ||
            (c.posRaw || []).some(p => p.toLowerCase().includes("undershirt") || p.includes("アンダーシャツ")),
        removes: c =>
            (c.disabledAbilities || []).includes("underShirt") ||
            (c.negRaw || []).some(n => n.toLowerCase().includes("undershirt") || n.includes("アンダーシャツ")),
    },
    {
        key: "statusGuard",
        name: { en: "StatusGuard", ja: "ステータスガード", zh: "状态守护" },
        synonyms: [
            "statusguard",
            "status guard",
            "状态守护",
            "异常防护",
            "防状态",
            "ステータスガード",
        ],
        grants: c =>
            (c.abilities || []).includes("statusGuard") ||
            (c.posRaw || []).some(p => p.toLowerCase().includes("statusguard") || p.includes("ステータスガード")),
        removes: c =>
            (c.disabledAbilities || []).includes("statusGuard") ||
            (c.negRaw || []).some(n => n.toLowerCase().includes("statusguard") || n.includes("ステータスガード")),
    },
    {
        key: "firstBarrier",
        name: { en: "FirstBarrier", ja: "ファーストバリア", zh: "初始防护罩" },
        synonyms: [
            "firstbarrier",
            "first barrier",
            "barrier",
            "初始防护罩",
            "开局护盾",
            "防护罩",
            "ファーストバリア",
            "バリア",
            "泡泡膜",
            "bubblewrap",
        ],
        grants: c =>
            (c.abilities || []).includes("firstBarrier") ||
            (c.abilities || []).includes("firstBarrier100") ||
            (c.abilities || []).includes("firstBarrier200") ||
            !!c.firstBarrier ||
            (c.posRaw || []).some(
                p =>
                    p.toLowerCase().includes("firstbarrier") ||
                    p.toLowerCase().includes("firstbubblewrap") ||
                    p.toLowerCase().includes("first lifeaura") ||
                    p.includes("ファーストバリア") ||
                    p.includes("ファーストバブルラップ") ||
                    p.includes("ファーストドリームオーラ")
            ),
        removes: c =>
            (c.disabledAbilities || []).includes("firstBarrier") ||
            (c.negRaw || []).some(n => n.toLowerCase().includes("firstbarrier") || n.includes("ファーストバリア")),
    },
    {
        key: "busterAddition",
        name: { en: "Buster Addition", ja: "バスター追加", zh: "普通射击追加" },
        synonyms: [
            "buster addition",
            "busteraddition",
            "普通射击追加",
            "射击追加",
            "バスター追加",
        ],
        grants: c =>
            !!c.busterAddition ||
            (c.posRaw || []).some(p => p.toLowerCase().includes("buster addition") || p.includes("バスターで")),
        removes: c =>
            !!c.disabledBusterAddition ||
            (c.negRaw || []).some(n => n.toLowerCase().includes("buster addition") || n.includes("バスターの追加効果をOFF")),
    },
    {
        key: "chargeAddition",
        name: { en: "Charge Addition", ja: "チャージ追加", zh: "蓄力追加" },
        synonyms: [
            "charge addition",
            "chargeaddition",
            "chargeshot addition",
            "蓄力追加",
            "集气追加",
            "チャージ追加",
        ],
        grants: c =>
            !!c.chargeAddition ||
            (c.posRaw || []).some(
                p =>
                    p.toLowerCase().includes("charge addition") ||
                    p.toLowerCase().includes("chargeshot addition") ||
                    p.includes("チャージショットに") ||
                    p.includes("チャージショットで")
            ),
        removes: c =>
            !!c.disabledChargeAddition ||
            (c.negRaw || []).some(
                n =>
                    n.toLowerCase().includes("charge addition") ||
                    n.toLowerCase().includes("chargeshot addition") ||
                    n.includes("チャージショットの追加効果をOFF")
            ),
    },
    {
        key: "bLeft",
        name: { en: "B+Left", ja: "B+左", zh: "B+左" },
        synonyms: ["b+left", "b+左", "b左"],
        grants: c =>
            !!c.bLeft ||
            (c.posRaw || []).some(p => p.toLowerCase().includes("b+left") || p.includes("B+左で")),
        removes: c =>
            !!c.disabledBLeft ||
            (c.negRaw || []).some(n => n.toLowerCase().includes("b+left") || n.includes("B+左をOFF")),
    },
    {
        key: "chipRecovery",
        name: { en: "Chip Recovery", ja: "チップリカバリー", zh: "芯片回复" },
        synonyms: ["chip recovery", "chiprecovery", "芯片回复", "チップリカバリー"],
        grants: c =>
            !!c.chipRecovery ||
            (c.posRaw || []).some(p => p.toLowerCase().includes("chip recovery") || p.includes("チップ使用時にリカバリー")),
        removes: c =>
            !!c.disabledChipRecovery ||
            (c.negRaw || []).some(n => n.toLowerCase().includes("chip recovery") || n.includes("チップ使用時にリカバリーをOFF")),
    },
];

export interface ModCardSearchResult {
    matchedAbility?: {
        key: string;
        name: string;
    };
    grantingCards: ModCard[];
    removingCards: ModCard[];
    otherCards: ModCard[];
    allCards: ModCard[];
}

export function searchModCards(
    query: string,
    categoryFilter: string,
    lang: Lang = "zh",
    gameId: string = "bn6"
): ModCardSearchResult {
    const q = (query || "").trim().toLowerCase();
    const allCardsList = getModCards(gameId);

    // 1. Filter by category
    const baseCards = allCardsList.filter(c => {
        if (gameId === "bn4") {
            if (categoryFilter === "slot0A" && c.slot !== "0A") return false;
            if (categoryFilter === "slot0B" && c.slot !== "0B") return false;
            if (categoryFilter === "slot0C" && c.slot !== "0C") return false;
            if (categoryFilter === "slot0D" && c.slot !== "0D") return false;
            if (categoryFilter === "slot0E" && c.slot !== "0E") return false;
            if (categoryFilter === "slot0F" && c.slot !== "0F") return false;
            if (categoryFilter === "part1" && c.part !== "part1") return false;
            if (categoryFilter === "part2" && c.part !== "part2") return false;
            if (categoryFilter === "part3" && c.part !== "part3") return false;
            if (categoryFilter === "part4" && c.part !== "part4") return false;
            if (categoryFilter === "souls" && !c.soul) return false;
            if (categoryFilter === "promo" && c.part !== "promo") return false;
        } else if (gameId === "bn5") {
            if (categoryFilter === "part1" && (c.cardNo < 1 || c.cardNo > 50)) return false;
            if (categoryFilter === "part2" && (c.cardNo < 51 || c.cardNo > 100)) return false;
            if (categoryFilter === "promo" && c.cardNo < 101) return false;
        } else {
            if (categoryFilter === "part1" && (c.cardNo < 1 || c.cardNo > 53)) return false;
            if (categoryFilter === "part2" && (c.cardNo < 54 || c.cardNo > 106)) return false;
            if (categoryFilter === "promo" && c.cardNo < 107) return false;
        }
        return true;
    });

    if (!q) {
        return {
            allCards: baseCards,
            grantingCards: [],
            removingCards: [],
            otherCards: baseCards,
        };
    }

    // 2. Check if query matches a known ability definition
    const matchedDef = ABILITY_SEARCH_DEFS.find(def =>
        def.synonyms.some(s => {
            const ls = s.toLowerCase();
            return ls === q || q.includes(ls) || ls.includes(q);
        })
    );

    if (matchedDef) {
        const grantingCards: ModCard[] = [];
        const removingCards: ModCard[] = [];
        const otherCards: ModCard[] = [];

        baseCards.forEach(c => {
            const isGrant = matchedDef.grants(c);
            const isRemove = matchedDef.removes(c);

            if (isGrant) {
                grantingCards.push(c);
            } else if (isRemove) {
                removingCards.push(c);
            } else {
                const nameMatch =
                    (c.name || "").toLowerCase().includes(q) ||
                    (c.nameZh || "").toLowerCase().includes(q) ||
                    (c.nameJa || "").toLowerCase().includes(q) ||
                    (c.id || "").toLowerCase().includes(q);
                if (nameMatch) {
                    otherCards.push(c);
                }
            }
        });

        const allCards = [...grantingCards, ...removingCards, ...otherCards];
        return {
            matchedAbility: {
                key: matchedDef.key,
                name: matchedDef.name[lang] || matchedDef.name.en,
            },
            grantingCards,
            removingCards,
            otherCards,
            allCards,
        };
    }

    // 3. General query matching
    const allCards = baseCards.filter(c => {
        const nameMatch =
            (c.name || "").toLowerCase().includes(q) ||
            (c.nameZh || "").toLowerCase().includes(q) ||
            (c.nameJa || "").toLowerCase().includes(q) ||
            (c.id || "").toLowerCase().includes(q);
        const posMatch = (c.posRaw || []).some(p => p.toLowerCase().includes(q));
        const negMatch = (c.negRaw || []).some(n => n.toLowerCase().includes(q));

        // Elements
        let elemMatch = false;
        if (["水", "水属性", "aqua"].includes(q) && c.body === "Aqua") elemMatch = true;
        if (["火", "火属性", "fire"].includes(q) && c.body === "Fire") elemMatch = true;
        if (["木", "木属性", "wood"].includes(q) && c.body === "Wood") elemMatch = true;
        if (["电", "电属性", "雷", "雷属性", "elec"].includes(q) && c.body === "Elec") elemMatch = true;

        // Gauges
        let gaugeMatch = false;
        if (["快速量表", "快量表", "fastgauge"].includes(q) && c.gauge === "fast") gaugeMatch = true;
        if (["慢速量表", "慢量表", "slowgauge", "重力量表"].includes(q) && c.gauge === "slow") gaugeMatch = true;

        // Bugs & Repairs
        const bugMatch = (c.bugs || []).some(
            b =>
                (b.name.zh && b.name.zh.toLowerCase().includes(q)) ||
                (b.name.en && b.name.en.toLowerCase().includes(q)) ||
                (b.name.ja && b.name.ja.toLowerCase().includes(q))
        );
        const repairMatch =
            (c.repairs || []).some(r => r.toLowerCase().includes(q)) ||
            (["修复", "修bug", "repair"].includes(q) && (c.repairs || []).length > 0);

        return nameMatch || posMatch || negMatch || elemMatch || gaugeMatch || bugMatch || repairMatch;
    });

    return {
        allCards,
        grantingCards: [],
        removingCards: [],
        otherCards: allCards,
    };
}
