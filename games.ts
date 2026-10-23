import legacyCatalogs from "./data/legacy-catalogs.json";
import { DatasetOptions, parseGameData } from "./game-data";

export interface GameDefinition extends DatasetOptions {
    label: string;
    load: () => Promise<unknown>;
}

const standardSizes = [
    { height: 4, width: 4, label: "4×4" },
    { height: 4, width: 5, label: "5×4" },
    { height: 5, width: 5, label: "5×5" },
];

export const games: GameDefinition[] = [
    {
        id: "bn6",
        label: "bn6・exe6",
        load: () => import("./data/bn6.json").then(module => module.default),
        gridSizes: standardSizes.map(size => ({ ...size, height: size.height + 2, width: size.width + 2 })),
        defaultExpansion: 2,
        legacyCatalog: legacyCatalogs.bn6,
    },
    {
        id: "bn5",
        label: "bn5・exe5",
        load: () => import("./data/bn5.json").then(module => module.default),
        gridSizes: standardSizes,
        defaultExpansion: 2,
        legacyCatalog: legacyCatalogs.bn5,
    },
    {
        id: "bn4",
        label: "bn4・exe4",
        load: () => import("./data/bn4.json").then(module => module.default),
        gridSizes: standardSizes,
        defaultExpansion: 2,
        legacyCatalog: legacyCatalogs.bn4,
    },
];

export const defaultGameId = "bn6";

export function findGame(id: string): GameDefinition | undefined {
    return games.find(game => game.id === id);
}

export async function loadGame(game: GameDefinition) {
    return parseGameData(await game.load(), game);
}
