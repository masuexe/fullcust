import * as array2d from "./array2d";

export interface Part {
    isSolid: boolean;
    color: number;
    compressedMask: array2d.Array2D<boolean>;
    uncompressedMask: array2d.Array2D<boolean>;
}

export interface Constraint {
    compressed: boolean | null;
    onCommandLine: boolean | null;
    minBugLevel: number;
    maxBugLevel: number;
}

export interface Requirement {
    partIndex: number;
    constraint: Constraint;
}

export interface GridSettings {
    height: number;
    width: number;
    hasOob: boolean;
    commandLineRow: number;
}

export interface Position {
    x: number;
    y: number;
}

export interface Location {
    position: Position;
    rotation: number;
}

export interface Placement {
    loc: Location;
    compressed: boolean;
}

export type Solution = Placement[];

enum Cell {
    Forbidden = -2,
    Empty = -1,
}

const NEIGHBOR_DXS = [-1, 1, 0, 0];
const NEIGHBOR_DYS = [0, 0, -1, 1];

function arrayCountTrue(arr: boolean[]): number {
    let n = 0;
    for (const v of arr) {
        if (v) {
            n += 1;
        }
    }
    return n;
}

function arrayAny(arr: boolean[]): boolean {
    for (const v of arr) {
        if (v) {
            return true;
        }
    }
    return false;
}

function arrayBooleanToNumber(arr: boolean[]): number[] {
    const out = new Array(arr.length);
    for (let i = 0; i < arr.length; ++i) {
        out[i] = +arr[i];
    }
    return out;
}

function trim(arr2d: array2d.Array2D<boolean>): array2d.Array2D<boolean> {
    let left = 0;
    for (; left < arr2d.ncols; ++left) {
        if (arrayAny(array2d.col(arr2d, left))) {
            break;
        }
    }

    let top = 0;
    for (; top < arr2d.nrows; ++top) {
        if (arrayAny(array2d.row(arr2d, top))) {
            break;
        }
    }

    let right = arr2d.ncols - 1;
    for (; right >= 0; --right) {
        if (arrayAny(array2d.col(arr2d, right))) {
            break;
        }
    }
    ++right;

    let bottom = arr2d.nrows - 1;
    for (; bottom >= 0; --bottom) {
        if (arrayAny(array2d.row(arr2d, bottom))) {
            break;
        }
    }
    ++bottom;

    const nrows = bottom - top;
    const ncols = right - left;

    return array2d.subarray(arr2d, top, left, nrows, ncols);
}

class Grid {
    hasOob: boolean;
    commandLineRow: number;
    cells: array2d.Array2D<number>;

    constructor(settings: GridSettings) {
        this.hasOob = settings.hasOob;
        this.commandLineRow = settings.commandLineRow;
        this.cells = array2d.full<number>(
            Cell.Empty,
            settings.height,
            settings.width
        );
        if (this.hasOob) {
            this.cells[0 * settings.width + 0] = Cell.Forbidden;
            this.cells[0 * settings.width + (settings.width - 1)] =
                Cell.Forbidden;
            this.cells[
                (settings.height - 1) * settings.width + (settings.width - 1)
            ] = Cell.Forbidden;
            this.cells[(settings.height - 1) * settings.width + 0] =
                Cell.Forbidden;
        }
    }

    canPlace(mask: array2d.Array2D<boolean>, pos: Position) {
        let srcTop = 0;
        let dstTop = 0;
        if (pos.y < 0) {
            srcTop = -pos.y;
        } else {
            dstTop = pos.y;
        }

        let srcLeft = 0;
        let dstLeft = 0;
        if (pos.x < 0) {
            srcLeft = -pos.x;
        } else {
            dstLeft = pos.x;
        }

        // Check if the source mask isn't getting clipped.
        for (let y = 0; y < mask.nrows; ++y) {
            for (let x = 0; x < mask.ncols; ++x) {
                if (
                    x >= srcLeft &&
                    y >= srcTop &&
                    x < mask.ncols - dstLeft &&
                    y < mask.nrows - dstTop
                ) {
                    continue;
                }

                if (mask[y * mask.ncols + x]) {
                    return false;
                }
            }
        }

        for (let y = 0; y < mask.nrows - srcTop; ++y) {
            for (let x = 0; x < mask.ncols - srcLeft; ++x) {
                const srcX = x + srcLeft;
                const srcY = y + srcTop;
                const dstX = x + dstLeft;
                const dstY = y + dstTop;

                if (!mask[srcY * mask.ncols + srcX]) {
                    continue;
                }

                if (dstX >= this.cells.ncols || dstY >= this.cells.nrows) {
                    return false;
                }

                const gridCellsIdx = dstY * this.cells.ncols + dstX;
                if (this.cells[gridCellsIdx] != Cell.Empty) {
                    return false;
                }
            }
        }

        return true;
    }

    placeNoCheck(
        mask: array2d.Array2D<boolean>,
        pos: Position,
        reqIdx: number
    ) {
        let srcTop = 0;
        let dstTop = 0;
        if (pos.y < 0) {
            srcTop = -pos.y;
        } else {
            dstTop = pos.y;
        }

        let srcLeft = 0;
        let dstLeft = 0;
        if (pos.x < 0) {
            srcLeft = -pos.x;
        } else {
            dstLeft = pos.x;
        }

        // Actually do the placement...
        for (let y = 0; y < mask.nrows - srcTop; ++y) {
            for (let x = 0; x < mask.ncols - srcLeft; ++x) {
                const srcX = x + srcLeft;
                const srcY = y + srcTop;
                const dstX = x + dstLeft;
                const dstY = y + dstTop;

                if (!mask[srcY * mask.ncols + srcX]) {
                    continue;
                }

                if (dstX >= this.cells.ncols || dstY >= this.cells.nrows) {
                    continue;
                }

                this.cells[dstY * this.cells.ncols + dstX] = reqIdx;
            }
        }
    }
}

interface Candidate {
    placement: Placement;
    // Grid cell indices this placement covers.
    cellIndices: number[];
    // Bug level of this placement alone (out of bounds + solidness), excluding same-color adjacency bugs.
    baseBugLevel: number;
}

function encodeMaskToString(mask: array2d.Array2D<boolean>): string {
    return String.fromCharCode(
        mask.nrows,
        mask.ncols,
        ...arrayBooleanToNumber(mask)
    );
}

export function* solve(
    parts: Part[],
    requirements: Requirement[],
    gridSettings: GridSettings,
    spinnableColors: boolean[]
): Iterable<Solution> {
    if (gridSettings.commandLineRow > gridSettings.height) {
        return;
    }

    // Very cheap check to see if this is even solvable at all.
    if (!requirementsAreAdmissible(parts, requirements, gridSettings)) {
        return;
    }

    const candidates = new Array<[number, Candidate[]]>(requirements.length);
    for (let i = 0; i < requirements.length; ++i) {
        const req = requirements[i];
        const part = parts[req.partIndex];
        candidates[i] = [
            i,
            candidatesForPart(
                part,
                gridSettings,
                req.constraint,
                spinnableColors[part.color] || false
            ),
        ];
    }

    // Heuristic: fit hard to fit blocks first, then easier ones.
    //
    // If two blocks are just as hard to fit, make sure to group ones of the same type together.
    candidates.sort(([i, a], [j, b]) => {
        const cmp = a.length - b.length;
        if (cmp != 0) {
            return cmp;
        }
        return i - j;
    });

    const grid = new Grid(gridSettings);
    const cells = grid.cells;
    const ncols = cells.ncols;
    const nrows = cells.nrows;

    const isBorder = new Array<boolean>(cells.length);
    for (let i = 0; i < cells.length; ++i) {
        const x = i % ncols;
        const y = (i - x) / ncols;
        isBorder[i] = x === 0 || y === 0 || x === ncols - 1 || y === nrows - 1;
    }

    const reqColors = new Array<number>(requirements.length);
    const reqMaxBugLevels = new Array<number>(requirements.length);
    for (let i = 0; i < requirements.length; ++i) {
        reqColors[i] = parts[requirements[i].partIndex].color;
        reqMaxBugLevels[i] = requirements[i].constraint.maxBugLevel;
    }

    // Base bug level of each placed requirement: only meaningful while the requirement is on the grid.
    const placedBaseBugLevels = new Array<number>(requirements.length).fill(0);

    // Part index (offset by 1, so empty cells are 0) per grid cell, maintained incrementally so visited grids can be keyed cheaply.
    const partCells = new Array<number>(cells.length).fill(0);

    function candidateFits(candidate: Candidate, reqIdx: number): boolean {
        const cellIndices = candidate.cellIndices;

        for (let i = 0; i < cellIndices.length; ++i) {
            if (cells[cellIndices[i]] !== Cell.Empty) {
                return false;
            }
        }

        // Same-colored adjacent blocks bug both blocks, and placing more blocks never removes a bug.
        // So if this placement is already known to push any block past its maximum bug level, nothing
        // we place later can fix it: prune the whole subtree immediately.
        let adjacent = false;
        for (let i = 0; i < cellIndices.length; ++i) {
            const idx = cellIndices[i];
            const x = idx % ncols;
            const y = (idx - x) / ncols;
            for (let d = 0; d < 4; ++d) {
                const x2 = x + NEIGHBOR_DXS[d];
                const y2 = y + NEIGHBOR_DYS[d];
                if (x2 < 0 || x2 >= ncols || y2 < 0 || y2 >= nrows) {
                    continue;
                }
                const idx2 = y2 * ncols + x2;

                const neighborReqIdx = cells[idx2];
                if (neighborReqIdx < 0) {
                    continue;
                }
                if (reqColors[neighborReqIdx] !== reqColors[reqIdx]) {
                    continue;
                }

                // Ignore touching in out of bounds regions.
                if (grid.hasOob && isBorder[idx] && isBorder[idx2]) {
                    continue;
                }

                adjacent = true;
                if (
                    placedBaseBugLevels[neighborReqIdx] + 1 >
                    reqMaxBugLevels[neighborReqIdx]
                ) {
                    return false;
                }
            }
        }
        if (adjacent && candidate.baseBugLevel + 1 > reqMaxBugLevels[reqIdx]) {
            return false;
        }

        return true;
    }

    const visited = new Set();

    for (const raw of (function* helper(
        candidateIdx: number
    ): Iterable<{ reqIdx: number; placement: Placement }[]> {
        if (candidateIdx === candidates.length) {
            yield [];
            return;
        }

        const [reqIdx, cands] = candidates[candidateIdx];
        const partCellValue = requirements[reqIdx].partIndex + 1;

        for (const candidate of cands) {
            if (!candidateFits(candidate, reqIdx)) {
                continue;
            }

            const cellIndices = candidate.cellIndices;
            for (let i = 0; i < cellIndices.length; ++i) {
                cells[cellIndices[i]] = reqIdx;
                partCells[cellIndices[i]] = partCellValue;
            }
            placedBaseBugLevels[reqIdx] = candidate.baseBugLevel;

            const gridByParts = String.fromCharCode(...partCells);
            if (!visited.has(gridByParts)) {
                visited.add(gridByParts);

                for (const solution of helper(candidateIdx + 1)) {
                    solution.push({ reqIdx, placement: candidate.placement });
                    if (
                        candidateIdx === candidates.length - 1 &&
                        !solutionIsAdmissible(parts, requirements, grid)
                    ) {
                        continue;
                    }
                    yield solution;
                }
            }

            for (let i = 0; i < cellIndices.length; ++i) {
                cells[cellIndices[i]] = Cell.Empty;
                partCells[cellIndices[i]] = 0;
            }
        }
    })(0)) {
        raw.sort(({ reqIdx: i }, { reqIdx: j }) => i - j);
        const solution = new Array(raw.length);
        for (let i = 0; i < raw.length; ++i) {
            solution[i] = raw[i].placement;
        }
        yield solution;
    }
}

function requirementsAreAdmissible(
    parts: Part[],
    requirements: Requirement[],
    gridSettings: GridSettings
) {
    // Mandatory check: blocks required to be on the command line must be less than or equal to the number of columns.
    let commandLineParts = 0;
    for (const req of requirements) {
        if (req.constraint.onCommandLine) {
            ++commandLineParts;
        }
    }
    if (commandLineParts > gridSettings.width) {
        return false;
    }

    // Mandatory check: total number of squares must be less than the total allowed space.
    let occupiedSquares = 0;
    for (const req of requirements) {
        const part = parts[req.partIndex];
        const compressedSquares = arrayCountTrue(part.compressedMask);
        const uncompressedSquares = arrayCountTrue(part.uncompressedMask);
        occupiedSquares += req.constraint.compressed === null
            ? Math.min(compressedSquares, uncompressedSquares)
            : req.constraint.compressed ? compressedSquares : uncompressedSquares;
    }
    const availableSquares =
        gridSettings.width * gridSettings.height -
        (gridSettings.hasOob ? 4 : 0);
    if (occupiedSquares > availableSquares) {
        return false;
    }

    return true;
}

interface PlacementDetail {
    outOfBounds: boolean;
    onCommandLine: boolean;
    adjacentSameColoredPlacements: Set<number>;
}

function resolvePlacementDetails(
    parts: Part[],
    requirements: Requirement[],
    grid: Grid
) {
    const placementDetails: PlacementDetail[] = new Array(requirements.length);
    for (let i = 0; i < requirements.length; ++i) {
        placementDetails[i] = {
            outOfBounds: false,
            onCommandLine: false,
            adjacentSameColoredPlacements: new Set(),
        };
    }

    for (let y = 0; y < grid.cells.nrows; ++y) {
        for (let x = 0; x < grid.cells.ncols; ++x) {
            const reqIdx = grid.cells[y * grid.cells.ncols + x];
            if (reqIdx < 0) {
                continue;
            }
            const req = requirements[reqIdx];
            const part = parts[req.partIndex];

            const placementDetail = placementDetails[reqIdx];

            // Optional admissibility: check if a block has/doesn't have any out of bounds parts.
            if (
                grid.hasOob &&
                (x === 0 ||
                    y === 0 ||
                    x === grid.cells.ncols - 1 ||
                    y === grid.cells.nrows - 1)
            ) {
                placementDetail.outOfBounds = true;
            }

            // Optional admissibility: check if a block is/isn't on the command line.
            if (y === grid.commandLineRow) {
                placementDetail.onCommandLine = true;
            }

            // Optional admissibility: check if same-colored blocks are appropriately touching/not touching.
            for (let d = 0; d < 4; ++d) {
                const x2 = x + NEIGHBOR_DXS[d];
                const y2 = y + NEIGHBOR_DYS[d];
                if (
                    x2 < 0 ||
                    x2 >= grid.cells.ncols ||
                    y2 < 0 ||
                    y2 >= grid.cells.nrows
                ) {
                    continue;
                }

                // Ignore touching in out of bounds regions.
                if (
                    grid.hasOob &&
                    (x == 0 ||
                        y == 0 ||
                        x == grid.cells.ncols - 1 ||
                        y == grid.cells.nrows - 1) &&
                    (x2 == 0 ||
                        y2 == 0 ||
                        x2 == grid.cells.ncols - 1 ||
                        y2 == grid.cells.nrows - 1)
                ) {
                    continue;
                }

                const neigborReqIdx = grid.cells[y2 * grid.cells.ncols + x2];
                if (neigborReqIdx < 0) {
                    continue;
                }

                const neigborReq = requirements[neigborReqIdx];
                const neighborPart = parts[neigborReq.partIndex];

                if (
                    neigborReqIdx != reqIdx &&
                    neighborPart.color === part.color
                ) {
                    placementDetail.adjacentSameColoredPlacements.add(
                        neigborReqIdx
                    );
                    break;
                }
            }
        }
    }

    return placementDetails;
}

function solutionIsAdmissible(
    parts: Part[],
    requirements: Requirement[],
    grid: Grid
) {
    const placementDetails = resolvePlacementDetails(parts, requirements, grid);

    for (let i = 0; i < placementDetails.length; ++i) {
        const placementDetail = placementDetails[i];
        const req = requirements[i];
        const part = parts[req.partIndex];

        const bugLevel =
            +placementDetail.outOfBounds +
            +(part.isSolid === !placementDetail.onCommandLine) +
            placementDetail.adjacentSameColoredPlacements.size;

        if (
            bugLevel > req.constraint.maxBugLevel ||
            bugLevel < req.constraint.minBugLevel
        ) {
            return false;
        }
    }

    return true;
}

function candidatesForPart(
    part: Part,
    gridSettings: GridSettings,
    constraint: Constraint,
    spinnable: boolean
): Candidate[] {
    const candidates: Candidate[] = [];
    const partMasks =
        constraint.compressed === false
            ? [{ mask: part.uncompressedMask, compressed: false }]
            : constraint.compressed ||
              array2d.equal(part.compressedMask, part.uncompressedMask)
            ? [{ mask: part.compressedMask, compressed: true }]
            : [
                  { mask: part.compressedMask, compressed: true },
                  { mask: part.uncompressedMask, compressed: false },
              ];
    for (const { mask: partMask, compressed } of partMasks) {
        for (const {
            loc,
            cellIndices,
            baseBugLevel,
        } of placementLocationsForMask(
            partMask,
            part.isSolid,
            gridSettings,
            constraint.onCommandLine,
            constraint.maxBugLevel,
            spinnable
        )) {
            candidates.push({
                placement: { loc, compressed },
                cellIndices,
                baseBugLevel,
            });
        }
    }
    return candidates;
}

function placementLocationsForMask(
    mask: array2d.Array2D<boolean>,
    isSolid: boolean,
    gridSettings: GridSettings,
    onCommandLine: boolean | null,
    maxBugLevel: number,
    spinnable: boolean
) {
    const locations: {
        loc: Location;
        cellIndices: number[];
        baseBugLevel: number;
    }[] = [];
    for (const {
        position,
        cellIndices,
        baseBugLevel,
    } of placementPositionsForMask(
        mask,
        isSolid,
        gridSettings,
        onCommandLine,
        maxBugLevel
    )) {
        locations.push({
            loc: { position, rotation: 0 },
            cellIndices,
            baseBugLevel,
        });
    }

    if (spinnable) {
        const knownMasks = new Set();
        knownMasks.add(encodeMaskToString(trim(mask)));

        for (let i = 1; i < 4; ++i) {
            mask = array2d.rot90(mask);
            const knownMask = encodeMaskToString(trim(mask));
            if (knownMasks.has(knownMask)) {
                break;
            }
            knownMasks.add(knownMask);

            for (const {
                position,
                cellIndices,
                baseBugLevel,
            } of placementPositionsForMask(
                mask,
                isSolid,
                gridSettings,
                onCommandLine,
                maxBugLevel
            )) {
                locations.push({
                    loc: { position, rotation: i },
                    cellIndices,
                    baseBugLevel,
                });
            }
        }
    }

    return locations;
}

function placementPositionsForMask(
    mask: array2d.Array2D<boolean>,
    isSolid: boolean,
    gridSettings: GridSettings,
    onCommandLine: boolean | null,
    maxBugLevel: number
) {
    const positions: {
        position: Position;
        cellIndices: number[];
        baseBugLevel: number;
    }[] = [];

    const grid = new Grid(gridSettings);
    const ncols = grid.cells.ncols;
    const nrows = grid.cells.nrows;

    for (let y = -mask.nrows + 1; y < mask.nrows; ++y) {
        for (let x = -mask.ncols + 1; x < mask.ncols; ++x) {
            const pos = { x, y };
            if (!grid.canPlace(mask, pos)) {
                continue;
            }
            grid.placeNoCheck(mask, pos, 0);

            // Collect the grid cells this placement covers, restoring the grid to empty as we go.
            const cellIndices: number[] = [];
            for (let i = 0; i < grid.cells.length; ++i) {
                if (grid.cells[i] === 0) {
                    cellIndices.push(i);
                    grid.cells[i] = Cell.Empty;
                }
            }

            let outOfBounds = false;
            let placedOnCommandLine = false;
            let isAllOob = true;
            for (const idx of cellIndices) {
                const cellX = idx % ncols;
                const cellY = (idx - cellX) / ncols;
                if (
                    cellX === 0 ||
                    cellY === 0 ||
                    cellX === ncols - 1 ||
                    cellY === nrows - 1
                ) {
                    // Optional admissibility: check if the block is appropriately in/out of bounds.
                    if (grid.hasOob) {
                        outOfBounds = true;
                    }
                } else {
                    isAllOob = false;
                }

                // Optional admissibility: check if the block is appropriately on/off the command line.
                if (cellY === grid.commandLineRow) {
                    placedOnCommandLine = true;
                }
            }

            // Mandatory admissibility: ensure not everything is out of bounds.
            if (grid.hasOob && isAllOob) {
                continue;
            }

            if (onCommandLine !== null && onCommandLine !== placedOnCommandLine) {
                continue;
            }

            // It is not possible to tell if the bug level is less than the minimum bug level, because we might see more bugs later due to adjacent colors.
            // So here, we only check if we have too many bugs.
            const baseBugLevel =
                +outOfBounds + +(isSolid === !placedOnCommandLine);
            if (baseBugLevel > maxBugLevel) {
                continue;
            }

            positions.push({ position: pos, cellIndices, baseBugLevel });
        }
    }

    return positions;
}

export function placeAll(
    parts: Part[],
    requirements: Requirement[],
    placements: Placement[],
    gridSettings: GridSettings
): (number | null)[] {
    const grid = new Grid(gridSettings);
    const cells = new Array(grid.cells.length);

    for (let i = 0; i < placements.length; ++i) {
        const req = requirements[i];
        const placement = placements[i];
        const part = parts[req.partIndex];
        let mask = placement.compressed
            ? part.compressedMask
            : part.uncompressedMask;
        for (let j = 0; j < placement.loc.rotation; ++j) {
            mask = array2d.rot90(mask);
        }
        grid.placeNoCheck(mask, placement.loc.position, i);
    }

    for (let i = 0; i < grid.cells.length; ++i) {
        cells[i] = grid.cells[i] < 0 ? null : grid.cells[i];
    }
    return cells;
}
