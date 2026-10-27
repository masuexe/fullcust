import type { Data } from "./game-data";
import { emptyProblem } from "./problem";
import { applySaveMask, computeRawChecksum } from "./save-exporter";
import { getModCards, computeDeckStats } from "./modcards";
import { isSolutionGeometryValid, placeAll, Solution } from "./solver";

/** Read BN6 GBA battery saves. Input is never modified; cached abilities are not trusted. */
export function readBn6Save(bytes: Uint8Array, data: Data) {
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
        // Reuse the layout at the requesting user's base HP, rather than copying
        // altered HP or cached combat flags from source saves.
        return { problem, solution, variant, region: header.endsWith("JP") ? "JP" : "US" };
    }
    throw new Error("NC records do not reproduce a valid stored grid");
}
