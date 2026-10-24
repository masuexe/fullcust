import rawCards from "./data/bn6-modcards.json";
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

export const BN6_MOD_CARDS: ModCard[] = rawCards as ModCard[];
export const BN6_MOD_CARDS_MAP = new Map<string, ModCard>(
    BN6_MOD_CARDS.map(c => [c.id, c])
);

export const BN6_MAX_MOD_MB = 80;

export function getModCard(id: string): ModCard | undefined {
    return BN6_MOD_CARDS_MAP.get(id);
}

export function getCardDisplayName(card: ModCard, lang: Lang): string {
    if (lang === "zh" && card.nameZh) return card.nameZh;
    if (lang === "ja" && card.nameJa) return card.nameJa;
    return card.name;
}

export interface DeckStats {
    totalMb: number;
    isOverCapacity: boolean;
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
    movePanel?: string;
    chipRecovery?: number;
    firstBarrier?: number | string;
    tripleBuster?: boolean;
}

export function computeDeckStats(cardIds: string[]): DeckStats {
    let totalMb = 0;
    const stats = {
        hp: 0,
        hpPercent: 0,
        attack: 0,
        attackMult: 1,
        rapid: 0,
        charge: 0,
        custom: 0,
        megaFolder: 0,
        gigaFolder: 0,
    };

    const abilitiesSet = new Set<string>();
    const disabledSet = new Set<string>();

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
        const card = BN6_MOD_CARDS_MAP.get(cid);
        if (!card) continue;

        totalMb += card.mb;

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
        if (card.chipRecovery !== undefined) chipRecovery = card.chipRecovery;
        if (card.firstBarrier !== undefined) firstBarrier = card.firstBarrier;
        if (card.tripleBuster !== undefined) tripleBuster = card.tripleBuster;

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

    return {
        totalMb,
        isOverCapacity: totalMb > BN6_MAX_MOD_MB,
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
        movePanel,
        chipRecovery,
        firstBarrier,
        tripleBuster,
    };
}
