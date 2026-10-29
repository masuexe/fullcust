import type { Data } from "./game-data";
import { emptyProblem, Problem } from "./problem";
import { applySaveMask, computeRawChecksum } from "./save-exporter";
import { getModCards, computeDeckStats } from "./modcards";
import { isSolutionGeometryValid, placeAll, Requirement, Solution } from "./solver";

export interface ReadSaveResult {
    problem: Problem;
    solution: Solution;
    variant: string;
    region: "JP" | "US";
}

function readU32(buf: Uint8Array, offset: number): number {
    return (buf[offset] | (buf[offset + 1] << 8) | (buf[offset + 2] << 16) | (buf[offset + 3] << 24)) >>> 0;
}

function readHeader(buf: Uint8Array, offset: number, length = 20): string {
    return String.fromCharCode(...buf.subarray(offset, offset + length));
}

/**
 * Resolve a raw save part id to a part index in the current dataset.
 * BN4-6 encode the part as (template id * 4 + color-variant index); the
 * dataset lists the variants of one template in that same order.
 */
function partIndexForRawId(data: Data, rawId: number): number | undefined {
    const id = Math.floor(rawId / 4), variantIndex = rawId % 4;
    const matches = data.partMetas
        .map((meta, index) => ({ meta, index }))
        .filter(entry => entry.meta.id === id);
    return (matches[variantIndex] ?? matches[0])?.index;
}

interface ParsedParts {
    requirements: Requirement[];
    solution: Solution;
    slots: number[];
}

interface PartSlotLayout {
    col: number;
    row: number;
    rotation: number;
    compressed: (offset: number, rawId: number) => boolean;
}

function parsePartSlots(
    data: Data,
    buf: Uint8Array,
    partsOffset: number,
    centerOffset: number,
    layout: PartSlotLayout,
): ParsedParts {
    const requirements: Requirement[] = [];
    const solution: Solution = [];
    const slots: number[] = [];
    for (let slot = 0; slot < 25; slot++) {
        const offset = partsOffset + slot * 8;
        const rawId = buf[offset];
        if (!rawId) continue;
        const partIndex = partIndexForRawId(data, rawId);
        if (partIndex === undefined) throw new Error(`Unknown part id ${rawId} in save`);
        requirements.push({
            partIndex,
            constraint: { onCommandLine: null, compressed: null, minBugLevel: 0, maxBugLevel: Infinity },
        });
        slots.push(slot);
        solution.push({
            loc: {
                position: { x: buf[offset + layout.col] - centerOffset, y: buf[offset + layout.row] - centerOffset },
                rotation: buf[offset + layout.rotation],
            },
            compressed: layout.compressed(offset, rawId),
        });
    }
    return { requirements, solution, slots };
}

function finish(data: Data, requirements: Requirement[], solution: Solution, slotIndices: number[],
    grid: Uint8Array, gridSize: number, cards: string[], variant: string, region: "JP" | "US"): ReadSaveResult {
    if (computeDeckStats(cards, data.gameId).isOverCapacity) throw new Error(`Patch cards exceed capacity for ${data.gameId}`);
    const problem = emptyProblem(data);
    problem.modCards = cards;
    problem.requirements = requirements;
    if (requirements.length === 0) return { problem, solution, variant, region };
    if (!isSolutionGeometryValid(data.parts, problem.requirements, solution, data.gridSettings)) {
        throw new Error("NaviCust records do not produce valid geometry");
    }
    const cells = placeAll(data.parts, problem.requirements, solution, data.gridSettings);
    for (let i = 0; i < gridSize * gridSize; i++) {
        const expected = cells[i] === null ? 0 : slotIndices[cells[i] as number] + 1;
        if (expected !== grid[i]) throw new Error("NaviCust records do not reproduce the stored grid");
    }
    return { problem, solution, variant, region };
}

function readModCardNumbers(data: Data, numbers: number[], gameId: string): string[] {
    const cards: string[] = [];
    const catalog = getModCards(gameId);
    for (const number of numbers) {
        if (number === 0xff || number === 0) continue;
        const card = catalog.find(c => c.cardNo === number);
        if (!card) throw new Error(`Unknown ${gameId} patch card ${number}`);
        cards.push(card.id);
    }
    return cards;
}

/** Read BN6 GBA battery saves. Input is never modified; cached abilities are not trusted. */
export function readBn6Save(bytes: Uint8Array, data: Data): ReadSaveResult {
    if (data.gameId !== "bn6" || ![0x8000, 0x10000].includes(bytes.length)) throw new Error("Unsupported BN6 battery save format");
    const raw = Uint8Array.from(bytes.subarray(0x100, 0x6810));
    applySaveMask(raw, 0x1064);
    const view = new DataView(raw.buffer);
    const header = String.fromCharCode(...raw.subarray(0x1c70, 0x1c84));
    if (!/^REXE6 [GF] 200(?:50924a JP|60110a US)$/.test(header)) throw new Error("Unrecognized BN6 save header");
    const variant = header[6] === "G" ? "gregar" : "falzar";
    const checksum = (computeRawChecksum(raw, 0x1c6c) + (variant === "gregar" ? 0x72 : 0x18)) >>> 0;
    if (view.getUint32(0x1c6c, true) !== checksum) throw new Error("BN6 save checksum mismatch");
    const cardCount = raw[0x65f0];
    if (cardCount > 32) throw new Error("Unsupported patch card count");
    const cards = [];
    for (let i = 0; i < cardCount; i++) {
        const number = raw[0x6620 + i];
        if (number & 0x80) continue; // Stored cards can be switched off.
        const card = getModCards("bn6").find(c => c.cardNo === number);
        if (!card) throw new Error("Unknown BN6 patch card");
        cards.push(card.id);
    }
    if (computeDeckStats(cards, "bn6").isOverCapacity) throw new Error("Patch cards exceed 80 MB");
    // Tango may canonicalize JP offsets; accept only an offset set whose records
    // reproduce the stored grid exactly, rather than guessing from a filename.
    for (const jp of header.endsWith("JP") ? [true, false] : [false]) {
        const problem = emptyProblem(data);
        problem.modCards = cards;
        const partsOffset = jp ? 0x4150 : 0x4190;
        const gridOffset = jp ? 0x410c : 0x414c;
        const solution: Solution = [];
        let unknown = false;
        for (let slot = 0; slot < 25; slot++) {
            const offset = partsOffset + slot * 8, rawId = raw[offset];
            if (!rawId) continue;
            const id = Math.floor(rawId / 4), variantIndex = rawId % 4;
            const partIndex = data.partMetas.map((meta, i) => ({ meta, i })).filter(p => p.meta.id === id)[variantIndex]?.i;
            if (partIndex === undefined || raw[offset + 5] > 3 || raw[offset + 6] > 1) { unknown = true; break; }
            problem.requirements.push({ partIndex, constraint: { onCommandLine: null, compressed: null, minBugLevel: 0, maxBugLevel: Infinity } });
            solution.push({ loc: { position: { x: raw[offset + 3] - 3, y: raw[offset + 4] - 3 }, rotation: raw[offset + 5] }, compressed: raw[offset + 6] === 1 });
        }
        if (unknown || !isSolutionGeometryValid(data.parts, problem.requirements, solution, data.gridSettings)) continue;
        const cells = placeAll(data.parts, problem.requirements, solution, data.gridSettings);
        if (!cells.every((cell, i) => (cell === null ? 0 : cell + 1) === raw[gridOffset + i])) continue;
        return { problem, solution, variant, region: header.endsWith("JP") ? "JP" : "US" };
    }
    throw new Error("NC records do not reproduce a valid stored grid");
}

/** Read BN5 GBA battery saves. */
export function readBn5Save(bytes: Uint8Array, data: Data): ReadSaveResult {
    if (data.gameId !== "bn5" || bytes.length < 0x100 + 0x7c14) throw new Error("Unsupported BN5 battery save format");
    const raw = Uint8Array.from(bytes.subarray(0x100, 0x100 + 0x7c14));
    applySaveMask(raw, 0x1a34);
    if (readU32(raw, 0x1a30) !== 0) throw new Error("Unsupported BN5 save shift");
    const header = readHeader(raw, 0x29e0);
    const variants: Record<string, string> = {
        "REXE5TOB 20041104 JP": "protoman", "REXE5TOK 20041104 JP": "colonel",
        "REXE5TOB 20041006 US": "protoman", "REXE5TOK 20041006 US": "colonel",
    };
    const variant = variants[header];
    if (!variant) throw new Error(`Unrecognized BN5 save header: ${JSON.stringify(header)}`);
    const add = variant === "protoman" ? 0x72 : 0x18;
    if (readU32(raw, 0x29dc) !== ((computeRawChecksum(raw, 0x29dc) + add) >>> 0)) throw new Error("BN5 save checksum mismatch");
    const cardCount = raw[0x79a0];
    if (cardCount > 32) throw new Error("Unsupported patch card count");
    const numbers: number[] = [];
    for (let i = 0; i < cardCount; i++) {
        const number = raw[0x79d0 + i];
        if (!(number & 0x80)) numbers.push(number);
    }
    const cards = readModCardNumbers(data, numbers, "bn5");
    const parsed = parsePartSlots(data, raw, 0x4d6c, 2, {
        col: 2, row: 3, rotation: 4, compressed: offset => raw[offset + 5] === 1,
    });
    return finish(data, parsed.requirements, parsed.solution, parsed.slots, raw.subarray(0x4d48, 0x4d48 + 25), 5,
        cards, variant, header.endsWith("JP") ? "JP" : "US");
}

/** Read BN4 GBA battery saves, including the shiftable save region. */
export function readBn4Save(bytes: Uint8Array, data: Data): ReadSaveResult {
    if (data.gameId !== "bn4" || bytes.length < 0x73d2) throw new Error("Unsupported BN4 battery save format");
    const buf = Uint8Array.from(bytes.subarray(0, 0x73d2));
    applySaveMask(buf, 0x1554);
    const shift = readU32(buf, 0x1550);
    if (shift > 0x1fc || (shift & 3) !== 0) throw new Error("Unsupported BN4 save shift");
    const header = readHeader(buf, shift + 0x2208);
    if (header !== "ROCKMANEXE4 20031022") throw new Error(`Unrecognized BN4 save header: ${JSON.stringify(header)}`);
    const expected = readU32(buf, shift + 0x21e8);
    const rawSum = computeRawChecksum(buf, shift + 0x21e8);
    const diff = (x: number) => (expected - x) >>> 0;
    let variant: string | undefined;
    let region: "JP" | "US" | undefined;
    if (diff(rawSum) === 0x16) { variant = "redsun"; region = "US"; }
    else if (diff(rawSum) === 0x22) { variant = "bluemoon"; region = "US"; }
    else if (diff((rawSum - buf[0]) >>> 0) === 0x16) { variant = "redsun"; region = "JP"; }
    else if (diff((rawSum - buf[0]) >>> 0) === 0x22) { variant = "bluemoon"; region = "JP"; }
    if (!variant || !region) throw new Error("BN4 save checksum mismatch");
    if (shift > 0) {
        buf.copyWithin(0x2130, 0x2130 + shift, 0x5e20 + shift);
        buf.fill(0, 0x5e20, 0x5e20 + shift);
        buf.fill(0, 0x1550, 0x1554);
    }
    // BN4 stores one card number per slot in 0x464c; 0xff marks an empty slot and
    // values >= NUM_PATCH_CARD4S (134) are disabled cards that live in 0x4653.
    const NUM_PATCH_CARD4S = 134;
    const numbers: number[] = [];
    for (let slot = 0; slot < 6; slot++) {
        const number = buf[0x464c + slot];
        if (number < NUM_PATCH_CARD4S) numbers.push(number);
    }
    // Slot 0F holds cosmetic "PET Color" cards, not a functional patch-card slot.
    // BN4 has five functional patch-card slots (0A-0E); drop the cosmetic slot so the
    // build corpus matches the application's five-slot model.
    const cards = readModCardNumbers(data, numbers, "bn4")
        .filter(id => getModCards("bn4").find(card => card.id === id)?.slot !== "0F");
    const parsed = parsePartSlots(data, buf, 0x4564, 2, {
        col: 2, row: 3, rotation: 4, compressed: offset => buf[offset + 5] === 1,
    });
    return finish(data, parsed.requirements, parsed.solution, parsed.slots, buf.subarray(0x4540, 0x4540 + 25), 5,
        cards, variant, region);
}

/** Read BN3 GBA battery saves. BN3 has no patch cards. */
export function readBn3Save(bytes: Uint8Array, data: Data): ReadSaveResult {
    if (data.gameId !== "bn3" || bytes.length < 0x57b0) throw new Error("Unsupported BN3 battery save format");
    const buf = Uint8Array.from(bytes.subarray(0, 0x57b0));
    const header = readHeader(buf, 0x1e00);
    if (header !== "ROCKMANEXE3 20021002" && header !== "BBN3 v0.5.0 20021002") {
        throw new Error(`Unrecognized BN3 save header: ${JSON.stringify(header)}`);
    }
    const stored = readU32(buf, 0x1dd8);
    const rawSum = computeRawChecksum(buf, 0x1dd8);
    const diff = (stored - rawSum) >>> 0;
    const variant = diff === 0x16 ? "white" : diff === 0x22 ? "blue" : undefined;
    if (!variant) throw new Error("BN3 save checksum mismatch");
    // BN3 stores the part compression flag in a flag bit array, but modified ROMs move it.
    // Read the part records and the stored grid, then choose a compression assignment that
    // reproduces the grid. The stored flag bits are only a preferred first guess.
    const slots: { partIndex: number; x: number; y: number; rotation: number; rawId: number; s: number }[] = [];
    for (let slot = 0; slot < 25; slot++) {
        const offset = 0x1300 + slot * 8;
        const rawId = buf[offset];
        if (!rawId) continue;
        const partIndex = partIndexForRawId(data, rawId);
        if (partIndex === undefined) throw new Error(`Unknown part id ${rawId} in save`);
        slots.push({ partIndex, x: buf[offset + 2] - 2, y: buf[offset + 3] - 2, rotation: buf[offset + 4], rawId, s: slot });
    }
    const grid = buf.subarray(0x1d90, 0x1d90 + 25);
    if (slots.length > 16) throw new Error("BN3 save has too many parts to validate");
    const flagGuess = slots.map(slotEntry => {
        const bit = 0x02e0 + (slotEntry.rawId & 0xff);
        const byte = buf[0x0030 + (bit >> 3)];
        return byte !== undefined && ((byte >> (7 - (bit & 7))) & 1) === 1;
    });
    const total = 1 << slots.length;
    for (let attempt = 0; attempt < total; attempt++) {
        // Try the stored flag vector first, then the remaining assignments.
        const mask = attempt === 0 ? flagGuess.reduce((acc, bit, i) => acc | (bit ? 1 << i : 0), 0) : attempt;
        const requirements: Requirement[] = [];
        const solution: Solution = [];
        for (let i = 0; i < slots.length; i++) {
            const slotEntry = slots[i];
            requirements.push({
                partIndex: slotEntry.partIndex,
                constraint: { onCommandLine: null, compressed: null, minBugLevel: 0, maxBugLevel: Infinity },
            });
            solution.push({
                loc: { position: { x: slotEntry.x, y: slotEntry.y }, rotation: slotEntry.rotation },
                compressed: ((mask >> i) & 1) === 1,
            });
        }
        if (!isSolutionGeometryValid(data.parts, requirements, solution, data.gridSettings)) continue;
        const cells = placeAll(data.parts, requirements, solution, data.gridSettings);
        if (!cells.every((cell, i) => (cell === null ? 0 : slots[cell].s + 1) === grid[i])) continue;
        const problem = emptyProblem(data);
        problem.requirements = requirements;
        return { problem, solution, variant, region: "JP" };
    }
    throw new Error("NaviCust records do not reproduce a valid stored grid");
}

/** Read a battery save for the given dataset's game. */
export function readBatterySave(bytes: Uint8Array, data: Data): ReadSaveResult {
    switch (data.gameId) {
        case "bn6": return readBn6Save(bytes, data);
        case "bn5": return readBn5Save(bytes, data);
        case "bn4": return readBn4Save(bytes, data);
        case "bn3": return readBn3Save(bytes, data);
        default: throw new Error(`No save reader for ${data.gameId}`);
    }
}