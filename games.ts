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
    {
        id: "bn3",
        label: "bn3・exe3",
        load: () => import("./data/bn3.json").then(module => module.default),
        gridSizes: standardSizes,
        defaultExpansion: 2,
        styleColorRules: {
            baseColors: ["white", "pink", "yellow"],
            styles: [
                { id: "normal", label: "Normal・ノーマル・一般型态", extraColor: null },
                { id: "guts", label: "Guts・ガッツ・气力型态", extraColor: "red" },
                { id: "custom", label: "Custom・カスタム・改装型态", extraColor: "blue" },
                { id: "team", label: "Team・ブラザー・兄弟型态", extraColor: "green" },
                { id: "shield", label: "Shield・シールド・盾型态", extraColor: "blue" },
                { id: "ground", label: "Ground・グランド・地面型态", extraColor: "green" },
                { id: "shadow", label: "Shadow・シャドー・阴影型态", extraColor: "red" },
                { id: "bug", label: "Bug・バグ・BUG 型态", extraColor: "gray" },
            ],
            defaultStyle: "normal",
            maxModToolsParts: 1,
        },
    },
];

export const defaultGameId = "bn6";

export function findGame(id: string): GameDefinition | undefined {
    return games.find(game => game.id === id);
}

export async function loadGame(game: GameDefinition) {
    return parseGameData(await game.load(), game);
}
