export type Lang = "en" | "ja" | "zh";

export const translations = {
    titleSub: {
        en: "navicust autolayout",
        ja: "ナビカスタマイザー自動配置",
        zh: "领航员个人化装置自动配置",
    },
    style: {
        en: "Style",
        ja: "スタイル",
        zh: "型态",
    },
    modTools: {
        en: "ModTools: allow one incompatible part",
        ja: "改造ツール：非対応パーツ1個まで",
        zh: "改造工具：允许1个非对应程序",
    },
    compatibleColors: {
        en: "Compatible colors",
        ja: "対応色",
        zh: "对应颜色",
    },
    incompatibleParts: {
        en: "Incompatible parts",
        ja: "使用不可パーツ",
        zh: "不可用程序",
    },
    requiresErrorCode: {
        en: "Requires an Error Code",
        ja: "エラーコードが必要",
        zh: "需要改造码",
    },
    bn3CompressionWarning: {
        en: "BN3 compression is permanent in-game; choose the state you own.",
        ja: "ゲーム内の圧縮は元に戻せません。",
        zh: "游戏内压缩程序后无法复原，请选择实际持有的状态。",
    },
    pickPart: {
        en: "Pick a part",
        ja: "パートを選択",
        zh: "选择程序",
    },
    incompatibleWithStyle: {
        en: "Incompatible with Style",
        ja: "このスタイルでは使用不可",
        zh: "当前型态无法使用",
    },
    incompatibleDropdownSuffix: {
        en: " ⚠️ (Incompatible with Style)",
        ja: " ⚠️ (このスタイルでは使用不可)",
        zh: " ⚠️ (当前型态无法使用)",
    },
    incompatibleBadgeTitle: {
        en: "Incompatible with the selected Style",
        ja: "このスタイルでは使えない色です",
        zh: "当前型态无法使用此颜色",
    },
    requiresErrorCodeBadgeTitle: {
        en: "Requires ModTools Error Code",
        ja: "改造ツールのエラーコードが必要です",
        zh: "需要改造工具改造码",
    },
    requiresErrorCodeBadge: {
        en: "Requires Error Code",
        ja: "要エラーコード",
        zh: "需改造码",
    },
    onCommandLine: {
        en: "on command line",
        ja: "コマンドライン上",
        zh: "位于命令行上",
    },
    minBugs: {
        en: "min bugs",
        ja: "最小バグ数",
        zh: "最小 BUG 数",
    },
    maxBugs: {
        en: "max bugs",
        ja: "最大バグ数",
        zh: "最大 BUG 数",
    },
    compress: {
        en: "compress",
        ja: "圧縮",
        zh: "压缩",
    },
    extraSettings: {
        en: "Extra settings",
        ja: "追加設定",
        zh: "追加设置",
    },
    expansionMemory: {
        en: "Expansion memory",
        ja: "拡張メモリ",
        zh: "扩展内存",
    },
    spin: {
        en: "spin",
        ja: "スピン",
        zh: "旋转",
    },
    reset: {
        en: "Reset",
        ja: "リセット",
        zh: "重置",
    },
    noSolutions: {
        en: "No solutions found",
        ja: "解決が発見されなかった",
        zh: "未找到可行的配置方案",
    },
    selectPartsToSolve: {
        en: "Select parts from the left to start solving",
        ja: "解決を開始するために、左面からパートを選択ください",
        zh: "请在左侧选择程序以开始配置",
    },
    loadGameError: {
        en: "Unable to load game data. Please reload the page.",
        ja: "データを読み込めません。再読み込みしてください。",
        zh: "无法加载游戏数据，请刷新页面。",
    },
    sharedLayoutError: {
        en: "This shared layout is invalid or unavailable for this game.",
        ja: "共有データが無効、またはこのゲームに対応していません。",
        zh: "此分享配置无效或不适用于当前游戏。",
    },
    startNewLayout: {
        en: "Start a new layout",
        ja: "新規作成",
        zh: "开始新配置",
    },
    unknownGame: {
        en: "Unknown game",
        ja: "不明なゲーム",
        zh: "未知游戏",
    },
    constraintMaybe: {
        en: "🤷 maybe",
        ja: "🤷 任意",
        zh: "🤷 任意",
    },
    constraintMustNot: {
        en: "❌ must not",
        ja: "❌ 不要",
        zh: "❌ 禁止",
    },
    constraintMust: {
        en: "✅ must",
        ja: "✅ 必要",
        zh: "✅ 必须",
    },
    tabSetup: {
        en: "Setup",
        ja: "設定",
        zh: "设置",
    },
    tabSolutions: {
        en: "Solutions",
        ja: "配置結果",
        zh: "配置结果",
    },
    viewSolutions: {
        en: "View Solutions",
        ja: "配置結果を見る",
        zh: "查看配置结果",
    },
    backToSetup: {
        en: "Back to Setup",
        ja: "設定に戻る",
        zh: "返回设置",
    },
    themeSwitchToLight: {
        en: "Switch to light mode",
        ja: "ライトモードに切り替え",
        zh: "切换为浅色模式",
    },
    themeSwitchToDark: {
        en: "Switch to dark mode",
        ja: "ダークモードに切り替え",
        zh: "切换为深色模式",
    },
    buildStatsPlanned: {
        en: "Potential stats (programs must touch the command line)",
        ja: "配置前の能力（プログラムはコマンドラインへの接触が必要）",
        zh: "配置预期属性（程序部件须接触横线才能生效）",
    },
    buildStats: {
        en: "Equipped Stats & Abilities",
        ja: "装備ステータス・能力",
        zh: "当前配置属性与能力",
    },
    statAttack: {
        en: "Attack",
        ja: "アタック",
        zh: "攻击",
    },
    statRapid: {
        en: "Speed",
        ja: "ラピッド",
        zh: "连射",
    },
    statCharge: {
        en: "Charge",
        ja: "チャージ",
        zh: "集气",
    },
    statCustom: {
        en: "Custom",
        ja: "カスタム",
        zh: "芯片选择",
    },
    statMega: {
        en: "Mega",
        ja: "メガ",
        zh: "MEGA",
    },
    statGiga: {
        en: "Giga",
        ja: "ギガ",
        zh: "GIGA",
    },
    solution: {
        en: "Solution",
        ja: "配置案",
        zh: "方案",
    },
    noBugs: {
        en: "No Bugs",
        ja: "バグなし",
        zh: "无 Bug",
    },
    bugsDetected: {
        en: "mechanics change(s)",
        ja: "件の仕様変更（バグ）",
        zh: "处 Bug 机制改变",
    },
    bugStopActive: {
        en: "BugStop Active (Neutralized)",
        ja: "バグストッパー有効（無効化済み）",
        zh: "已由 BUG停止器 中和",
    },
    bugStopNeutralizedNotice: {
        en: "BugStop is properly installed: all bugs listed below are neutralized in combat.",
        ja: "バグストッパーが正常に配置されているため、以下のバグ効果はすべて戦闘中に無効化されます。",
        zh: "已正常安装 BUG停止器，以下所有 Bug 机制在战斗中已被中和消除。",
    },
    bugOrigin: {
        en: "Origin",
        ja: "原因",
        zh: "起因",
    },
    bugMechanics: {
        en: "In-game Mechanics",
        ja: "戦闘仕様・効果",
        zh: "游戏内机制效果",
    },
    modCards: {
        en: "Patch Cards (Mod Cards)",
        ja: "改造カード",
        zh: "改造卡",
    },
    modCapacity: {
        en: "Patch Card Capacity",
        ja: "改造カード容量",
        zh: "改造卡容量",
    },
    modCardsDeck: {
        en: "Equipped Cards",
        ja: "装備カード",
        zh: "已装备卡片",
    },
    addModCard: {
        en: "Add Patch Card",
        ja: "カードを追加",
        zh: "添加改造卡",
    },
    removeCard: {
        en: "Remove",
        ja: "外す",
        zh: "卸下",
    },
    moveUp: {
        en: "Move Up",
        ja: "上へ",
        zh: "上移",
    },
    moveDown: {
        en: "Move Down",
        ja: "下へ",
        zh: "下移",
    },
    clearAllCards: {
        en: "Clear All Cards",
        ja: "すべて外す",
        zh: "清空改造卡",
    },
    capacityExceeded: {
        en: "Capacity exceeded 80 MB limit",
        ja: "容量制限 (80 MB) を超えています",
        zh: "已超过 80 MB 容量上限",
    },
    noCardsEquipped: {
        en: "No Patch Cards equipped.",
        ja: "改造カードは装備されていません。",
        zh: "未装备改造卡。",
    },
    cardOrderHint: {
        en: "Lower cards overwrite conflicting effects of upper cards.",
        ja: "下位のカードは上位のカードと競合する効果を上書きします。",
        zh: "下方的卡片会覆盖上方卡片的冲突效果。",
    },
    searchCards: {
        en: "Search card name or effect...",
        ja: "カード名や効果で検索...",
        zh: "搜索卡片名称或效果...",
    },
    allCardCategories: {
        en: "All Categories",
        ja: "すべてのカテゴリ",
        zh: "全部类别",
    },
    part1Cards: {
        en: "Part 1",
        ja: "第1弾",
        zh: "第1弹",
    },
    part2Cards: {
        en: "Part 2",
        ja: "第2弾",
        zh: "第2弹",
    },
    part3Cards: {
        en: "Part 3",
        ja: "第3弾",
        zh: "第3弹",
    },
    part4Cards: {
        en: "Part 4",
        ja: "第4弾",
        zh: "第4弹",
    },
    soulUnisons: {
        en: "Soul Unisons",
        ja: "ソウルユニゾン",
        zh: "灵魂共鸣",
    },
    slot: {
        en: "Slot",
        ja: "アドレス",
        zh: "槽位",
    },
    slots: {
        en: "Slots",
        ja: "スロット",
        zh: "槽位",
    },
    cardCategory: {
        en: "Category",
        ja: "区分",
        zh: "类别",
    },
    slot0A: {
        en: "Slot 0A",
        ja: "アドレス 0A",
        zh: "槽位 0A",
    },
    slot0B: {
        en: "Slot 0B",
        ja: "アドレス 0B",
        zh: "槽位 0B",
    },
    slot0C: {
        en: "Slot 0C",
        ja: "アドレス 0C",
        zh: "槽位 0C",
    },
    slot0D: {
        en: "Slot 0D",
        ja: "アドレス 0D",
        zh: "槽位 0D",
    },
    slot0E: {
        en: "Slot 0E",
        ja: "アドレス 0E",
        zh: "槽位 0E",
    },
    slot0F: {
        en: "Slot 0F (Palette)",
        ja: "アドレス 0F (カラーのみ)",
        zh: "槽位 0F (改颜色/无属性)",
    },
    bn4SlotLimit: {
        en: "Max 1 card per slot (0A~0E, max 5 cards)",
        ja: "アドレスごとに1枚 (0A〜0E、最大5枚)",
        zh: "每个槽位最多1张 (0A~0E，最多5张)",
    },
    promoCards: {
        en: "Promotional & Special",
        ja: "プロモ・特殊",
        zh: "特典与特殊卡",
    },
    posEffects: {
        en: "Positive Effects",
        ja: "プラス効果",
        zh: "正面效果",
    },
    negEffects: {
        en: "Drawbacks & Bugs",
        ja: "マイナス効果・バグ",
        zh: "负面效果与 BUG",
    },
    equippedCardsCount: {
        en: "Cards Equipped",
        ja: "装備数",
        zh: "已装备数",
    },
    cardSource: {
        en: "Patch Card",
        ja: "改造カード",
        zh: "改造卡",
    },
    modCardBugs: {
        en: "Patch Card Bug",
        ja: "改造カードバグ",
        zh: "改造卡 BUG",
    },
    grantAbilityGroup: {
        en: "🟢 Grants / Provides (ON)",
        ja: "🟢 アビリティ付与 (ON)",
        zh: "🟢 提供 / 赋予能力 (ON)",
    },
    removeAbilityGroup: {
        en: "🔴 Disables / Removes (OFF)",
        ja: "🔴 アビリティ消失・解除 (OFF)",
        zh: "🔴 移除 / 禁用能力 (OFF)",
    },
    otherMatchingCards: {
        en: "Other Matching Cards",
        ja: "その他の一致カード",
        zh: "其它匹配卡片",
    },
    removesEquippedAbilityWarning: {
        en: "Warning: Equipping this card will remove your active",
        ja: "注意：このカードを装備すると現在有効なアビリティが消失します：",
        zh: "注意：装备此卡将移除你当前生效的",
    },
    quickFilterSuperArmor: {
        en: "SuperArmor",
        ja: "Sアーマー",
        zh: "超级装甲",
    },
    quickFilterAirShoes: {
        en: "AirShoes",
        ja: "エアシューズ",
        zh: "飞行鞋",
    },
    quickFilterFloatShoes: {
        en: "FloatShoes",
        ja: "フロート",
        zh: "漂浮鞋",
    },
    quickFilterUnderShirt: {
        en: "UnderShirt",
        ja: "Uシャツ",
        zh: "紧身衣",
    },
    ncNoBugs: {
        en: "NC Bug-Free",
        ja: "NCバグなし",
        zh: "NC无Bug",
    },
    ncBugs: {
        en: "NC Bug(s)",
        ja: "件のNCバグ",
        zh: "处 NC Bug",
    },
    ncBugDetailsHeader: {
        en: "NaviCust Placement",
        ja: "ナビカス配置",
        zh: "领航员个人化装置配置",
    },
    ncNoBugsNotice: {
        en: "This layout produces no NaviCust placement bugs.",
        ja: "この配置によるナビカスバグは発生していません。",
        zh: "此方案未产生任何 NC 摆放 Bug。",
    },
    modCardBugsHeader: {
        en: "Patch Card Bugs (Not neutralized by BugStop)",
        ja: "改造カードバグ（バグストッパー無効）",
        zh: "改造卡自带 Bug（不受 BugStop 影响）",
    },
    modCardBugCount: {
        en: "Card Bug",
        ja: "改造カードバグ",
        zh: "改造卡Bug",
    },
    modCardBugNotice: {
        en: "From equipped Patch Cards, applies to all layouts.",
        ja: "装備中の改造カードによるもので、全配置共通です。",
        zh: "来自已装备的改造卡，所有方案通用（不受NC拼图影响）。",
    },
    modCardRepairsHeader: {
        en: "Patch Card Repairs",
        ja: "改造カード修復",
        zh: "改造卡修复",
    },
    baseHp: {
        en: "Initial HP",
        ja: "初期HP",
        zh: "初始 HP",
    },
    finalHp: {
        en: "Final HP",
        ja: "最終HP",
        zh: "最终 HP",
    },
    baseHpHelp: {
        en: "Default 1000 (standard endgame/PvP). Used to compute final build HP.",
        ja: "デフォルト1000（対戦・終盤基準）。最終HPの算出に使用されます。",
        zh: "默认为 1000（标准终盘/对战基准）。用于计算 Build 的最终总 HP。",
    },
    resetBaseHp: {
        en: "Reset to 1000 HP",
        ja: "1000 HPにリセット",
        zh: "重置为 1000 HP",
    },
    buildLibrary: {
        en: "Build Library",
        ja: "マイビルド",
        zh: "构筑管理",
    },
    saveBuild: {
        en: "Save Current Build",
        ja: "現在のビルドを保存",
        zh: "保存当前构筑",
    },
    buildName: {
        en: "Build Name",
        ja: "ビルド名",
        zh: "构筑名称",
    },
    loadBuild: {
        en: "Load",
        ja: "読み込む",
        zh: "载入",
    },
    deleteBuild: {
        en: "Delete",
        ja: "削除",
        zh: "删除",
    },
    exportJson: {
        en: "Export JSON File",
        ja: "JSON書き出し",
        zh: "导出 JSON 文件",
    },
    copyJson: {
        en: "Copy JSON",
        ja: "JSONをコピー",
        zh: "复制 JSON",
    },
    importBuild: {
        en: "Import Build",
        ja: "ビルド読み込み",
        zh: "导入构筑",
    },
    uploadFile: {
        en: "Upload File (.json)",
        ja: "ファイル選択 (.json)",
        zh: "上传文件 (.json)",
    },
    pasteJsonOrLink: {
        en: "Paste Build JSON or Share URL",
        ja: "JSONまたは共有URLを貼り付け",
        zh: "粘贴构筑 JSON 或分享链接",
    },
    importSuccess: {
        en: "Build imported successfully!",
        ja: "ビルドを読み込みました！",
        zh: "构筑载入成功！",
    },
    importError: {
        en: "Failed to import build: invalid format",
        ja: "読み込みに失敗しました：無効な形式",
        zh: "载入失败：格式无效",
    },
    buildSaved: {
        en: "Build saved to local library!",
        ja: "ビルドを保存しました！",
        zh: "构筑已保存到本地库！",
    },
    communityPresets: {
        en: "Community Presets",
        ja: "おすすめプリセット",
        zh: "精选预设构筑",
    },
    mySavedBuilds: {
        en: "My Saved Builds",
        ja: "保存したビルド",
        zh: "我的保存构筑",
    },
    noSavedBuilds: {
        en: "No saved builds for this game yet.",
        ja: "このゲームの保存済みビルドはありません。",
        zh: "当前游戏暂无保存的构筑。",
    },
    exportSav: {
        en: "💾 Export .sav File",
        ja: "💾 .sav セーブ書き出し",
        zh: "💾 导出 .sav 存档",
    },
    exportSavDesc: {
        en: "Export a 100% completed GBA .sav save file with your solved NaviCust layout and Mod Cards injected.",
        ja: "完成した配置と改造カードを注入した100%全収集GBAセーブデータを生成します。エミュレータや実機ですぐプレイ可能！",
        zh: "一键导出注入了当前拼放方案与改造卡的 100% 全收集 GBA .sav 存档，可直接在 mGBA、烧录卡等载入游玩！",
    },
    selectEdition: {
        en: "Select Game Edition",
        ja: "ゲームバージョンを選択",
        zh: "选择游戏版本",
    },
    downloadSavBtn: {
        en: "Download .sav File",
        ja: ".sav ファイルをダウンロード",
        zh: "下载 .sav 存档文件",
    },
    saveCreditTitle: {
        en: "100% Save Template Credits:",
        ja: "全収集セーブデータ提供：",
        zh: "全收集存档模板致谢：",
    },
    saveCreditBody: {
        en: "100% completed save templates courtesy of ore4545 and the Tango (N1GP) project.",
        ja: "全収集セーブデータテンプレートは ore4545 氏 および Tango (N1GP) プロジェクトより提供されています。",
        zh: "全收集存档模板由 ore4545 与 Tango (N1GP) 项目制作提供，特此致谢！",
    },
    modCardRegionNotice: {
        en: "Note: Mod Cards (改造カード) were an e-Reader feature on Japanese cartridges. For English ROMs, use an e-Reader patch or play with Japanese ROMs.",
        ja: "注意：改造カードは日本版e-Reader機能です。北米版ROM等で使用する場合は改造カードパッチや日本版ROMをご利用ください。",
        zh: "说明：改造卡为日版 GBA e-Reader 刷卡功能。若在美版 ROM 运行，推荐搭配改造卡解锁补丁或日版 ROM。",
    },
    close: {
        en: "Close",
        ja: "閉じる",
        zh: "关闭",
    },
    copied: {
        en: "Copied!",
        ja: "コピーしました！",
        zh: "已复制！",
    },
    exportBuildWithSolutionNotice: {
        en: "Solution placements will be included in the exported build.",
        ja: "配置結果もビルドデータに含まれます。",
        zh: "当前拼放结果将一并保存在构筑数据中。",
    },
    autoOptimizeTitle: {
        en: "Auto-Fill & Maximize",
        ja: "自動補完＆最大化",
        zh: "自动补全与最大化",
    },
    autoOptimizeDesc: {
        en: "Automatically pack the remaining grid with optimal HP and Buster parts while respecting your Bug policy.",
        ja: "選択したパーツを維持したまま、バグ方針に従って空きマスを最大HPやステータスパーツで自動補完します。",
        zh: "保持当前选定的核心部件不变，在所选 Bug 策略约束下自动用最高收益的 HP / 属性零件填满剩余格子。",
    },
    autoOptimizeBtn: {
        en: "✨ Auto-Fill Grid",
        ja: "✨ 残りマスを自動補完",
        zh: "✨ 自动补全剩余网格",
    },
    optimizing: {
        en: "Optimizing...",
        ja: "最適化中...",
        zh: "正在计算最优补全方案...",
    },
    optTarget: {
        en: "Optimization Goal",
        ja: "優先ステータス",
        zh: "优化偏好",
    },
    targetMaxHp: {
        en: "❤️ HP → Attack (default)",
        ja: "❤️ HP → 攻撃力（既定）",
        zh: "❤️ HP → 攻击（默认）",
    },
    targetMaxAttack: {
        en: "💥 Attack → HP",
        ja: "💥 攻撃力 → HP",
        zh: "💥 攻击 → HP",
    },
    optTargetDesc: {
        en: "All requirements must be met. Compare the first stat, then the second only when tied. Set minimum Rapid, Charge, and Custom values in the requirements below.",
        ja: "すべての条件を満たした上で、先の値を優先し、同値なら次の値を比較します。連射・チャージ・カスタムの最低値は下の条件で指定できます。",
        zh: "先满足全部条件，再优先比较前一项，相同时比较后一项。连射、集气和改装数量等最低值可在下方条件中设置。",
    },
    bugPolicyTitle: {
        en: "Bug Policy in Battle",
        ja: "実戦バグ許容方針",
        zh: "实战 Bug 容忍偏好",
    },
    policyNoBugs: {
        en: "🛡️ Pure / Zero Bugs (Recommended)",
        ja: "🛡️ バグなし（実質デメリット0・推奨）",
        zh: "🛡️ 纯净无 BUG（实战 0 负面效果・推荐）",
    },
    policyNoBugsDesc: {
        en: "Zero negative bugs in combat. If BugStop is equipped, placement rules are fully unlocked; otherwise strictly compliant.",
        ja: "実戦でのバグデメリットゼロ。バグストッパーがあれば配置制限完全解除、なければ厳格にルールを遵守します。",
        zh: "战斗中 0 实际负面效果。若包含 BUG停止器 则完全放开摆放限制，否则严格遵守按线摆放。",
    },
    policyBenign: {
        en: "⚔️ Allow Benign Bugs (Menu HP drain)",
        ja: "⚔️ 軽微なバグ許容（カスタム画面HP減少など）",
        zh: "⚔️ 允许良性微瑕（选卡菜单扣血等）",
    },
    policyBenignDesc: {
        en: "Tolerates minor Custom Screen HP drain Lv1 or blank buster shots to squeeze in larger HP parts without BugStop.",
        ja: "バグストッパーなしでも高HPパーツを詰め込むため、カスタム画面HP減少Lv1や空撃ちなどの軽微なバグを許容します。",
        zh: "在无 BUG停止器 的情况下，允许承受选卡菜单扣血 Lv1 等微弱代价，以强行塞入超大 HP 部件。",
    },
    optSuccessNotice: {
        en: "Successfully optimized build!",
        ja: "自動補完が完了しました！",
        zh: "已成功补全构筑！",
    },
    optNoSolution: {
        en: "Search exhausted: no build satisfies all current constraints.",
        ja: "探索完了：現在のすべての条件を満たす構成はありません。",
        zh: "已穷尽搜索：不存在满足当前全部约束的构筑。",
    },
    optStopSearch: {
        en: "Stop search & keep best", ja: "探索を停止して最良の結果を保存", zh: "停止搜索并保留最佳结果",
    },
    optSearchingFeasible: {
        en: "Searching for a valid build… No time limit; you can stop at any time.",
        ja: "条件を満たす構成を探索中…時間制限はありません。いつでも停止できます。",
        zh: "正在搜索合法构筑……无时间限制，可随时停止。",
    },
    optSearchingBetter: {
        en: "Valid build found. Searching for improvements…", ja: "有効な構成が見つかりました。さらに探索中…", zh: "已找到合法构筑，正在继续搜索更优结果……",
    },
    optStageLibrary: {
        en: "Checking known builds against your requirements", ja: "既知の構成が条件を満たすか確認中", zh: "正在检查已知构筑是否满足当前要求",
    },
    optStageFeasible: {
        en: "Selecting candidates to meet your requirements", ja: "条件を満たす候補を選択中", zh: "正在选择满足要求的候选组合",
    },
    optStageImprove: {
        en: "Searching candidate builds and layouts", ja: "候補構成と配置を探索中", zh: "正在搜索候选构筑及布局",
    },
    optStageLocal: {
        en: "Trying part and card changes to improve the result", ja: "パーツやカードの変更で改善を試行中", zh: "正在尝试增减、替换部件及卡片以改进结果",
    },
    optStageExhaustive: {
        en: "Systematically searching combinations and layouts", ja: "組み合わせと配置を網羅的に探索中", zh: "正在系统搜索组合及布局",
    },
    optElapsed: {
        en: "Elapsed", ja: "経過時間", zh: "已用时间",
    },
    optCandidateChecks: {
        en: "Candidate checks (includes repeats)", ja: "候補確認回数（再確認を含む）", zh: "候选组合检查次数（含重复）",
    },
    optPlacementAttempts: {
        en: "Part placement attempts", ja: "パーツ配置の試行回数", zh: "部件摆放尝试次数",
    },
    optCheckedBuilds: {
        en: "Part combinations checked", ja: "確認済みパーツ構成", zh: "已检查部件组合",
    },
    optCurrentBest: {
        en: "Best build so far", ja: "現在の最良の構成", zh: "当前最佳构筑",
    },
    optStoppedWithResult: {
        en: "Search stopped. Best build saved; optimality is not proven.",
        ja: "探索を停止し、最良の構成を保存しました。最適性は未確認です。",
        zh: "已停止搜索并保留最佳构筑，尚未证明它是最优解。",
    },
    optStoppedNoResult: {
        en: "Search stopped before finding a valid build. This does not prove it is impossible.",
        ja: "有効な構成が見つかる前に停止しました。不可能と確定したわけではありません。",
        zh: "已停止，尚未找到合法构筑；这不代表无解。",
    },
    optInputsChanged: {
        en: "Inputs changed. Previous search stopped; start a new search.",
        ja: "条件が変更されたため、前の探索を停止しました。再度探索してください。",
        zh: "输入已更改，旧搜索已停止，请重新搜索。",
    },
    optSearchComplete: {
        en: "Search exhausted. Best build saved.", ja: "全探索が完了し、最良の構成を保存しました。", zh: "已穷尽搜索并保留最佳构筑。",
    },
    optAddedParts: {
        en: "Added Parts",
        ja: "追加されたパーツ",
        zh: "自动添加的部件",
    },
    optModCardModeTitle: {
        en: "Battle Format & Mod Cards",
        ja: "レギュレーション・改造カード",
        zh: "对战环境规制与改造卡",
    },
    optModCardNone: {
        en: "🚫 No Mod Cards (Standard / N1GP Format)",
        ja: "🚫 改造カードなし（No-Mod 規制）",
        zh: "🚫 纯净无改造卡（No-Mod 规制）",
    },
    optModCardNoneDesc: {
        en: "Strictly excludes all Mod Cards. Optimizes NaviCust grid purely from program parts.",
        ja: "改造カードを一切使用せず、ナビカスタマイザーパーツのみで限界まで最適化します。",
        zh: "适用于无卡标准对战，严禁任何改造卡，纯靠 NaviCust 优化极限数值。",
    },
    optModCardAuto: {
        en: "🎴 Auto-Pick Best Mod Cards (All-in-One Optimization)",
        ja: "🎴 最強の改造カードを自動選定（カード＋NC統合最適化）",
        zh: "🎴 自动挑选最强改造卡（卡片＋NC 全自动联合优化）",
    },
    optModCardAutoDesc: {
        en: "Automatically selects highest-value cards (e.g. HP+25%, abilities) within the MB / slot limit, then packs the NaviCust grid around them.",
        ja: "容量上限内で最強の改造カード（HP+25%やアビリティ）を自動選定し、ナビカスと相乗効果を発揮させます。",
        zh: "在容量上限内自动挑选最高收益的改造卡（如 HP+25% / 强力被动），再联合优化 NC 网格形成极限构筑。",
    },
    optModCardKeep: {
        en: "🎴 Keep Selected Mod Cards (Fill NC Only)",
        ja: "🎴 現在選択中の改造カードを維持（ナビカスのみ補完）",
        zh: "🎴 保持当前已选改造卡（仅自动补全 NC 网格）",
    },
    optModCardKeepDesc: {
        en: "Preserves your current Mod Card deck and only optimizes the remaining NaviCust grid.",
        ja: "手動で選んだ改造カードをそのまま維持し、空いているナビカス盤面のみを自動補完します。",
        zh: "以您当前已选的改造卡为基础，仅自动补全剩余的 NaviCust 格子。",
    },
    optAddedModCards: {
        en: "Auto-Equipped Mod Cards",
        ja: "自動装備された改造カード",
        zh: "自动配备的改造卡",
    },
    collapse: {
        en: "Collapse",
        ja: "折りたたむ",
        zh: "折叠",
    },
    expand: {
        en: "Expand",
        ja: "展開",
        zh: "展开",
    },
    buildConstraintsTitle: {
        en: "Target Abilities & Battle Specifications",
        ja: "必須能力・バトル仕様指定",
        zh: "指定必须能力与对战规格",
    },
    buildConstraintsDesc: {
        en: "Declaratively specify mandatory abilities (from Mod Cards or NaviCust), special charge shot, B+Left moves, and strictly forbidden bugs.",
        ja: "カードまたはナビカスのいずれからでも、必須アビリティ、CS、B+左、禁止バグを宣言的に指定して最適化します。",
        zh: "不论通过改造卡还是导航安装盘，声明必须拥有的被动能力、特殊蓄力射击、B+左动作及严格禁止的 BUG。",
    },
    reqAbilitiesTitle: {
        en: "Required Abilities (Any Form)",
        ja: "必須アビリティ（形態不問）",
        zh: "必须能力（来源不限）",
    },
    reqMaxBusterStatsTitle: {
        en: "Required max Buster stats", ja: "バスター性能の最大値を必須にする", zh: "洛克炮属性必须满级",
    },
    minBusterStatsTitle: {
        en: "Minimum Buster stats", ja: "バスター性能の最低値", zh: "洛克炮属性最低值",
    },
    minBusterStatsDesc: {
        en: "Each selected minimum must hold after NC and card effects. BN5/6 cards can raise Attack up to 10; Rapid and Charge remain capped at 5.",
        ja: "ナビカスと改造カード適用後の最低値を指定します。BN5/6ではカードでアタックを最大10まで強化できます。ラピッドとチャージは最大5です。",
        zh: "按部件与改造卡叠加后的最终数值判断。EXE5/6 可通过相应改造卡把攻击提高至 10，连射和集气上限仍为 5。",
    },
    minChipRecoveryTitle: {
        en: "Minimum Chip Recovery", ja: "チップリカバリーの最低回復量", zh: "芯片回复最低值",
    },
    minCustomTitle: {
        en: "Minimum Custom (chip choices)", ja: "カスタムの最低選択枚数", zh: "改装（选卡数量）最低值",
    },
    minCustomDesc: {
        en: "Base chip choices are 5. Apply the minimum to final build stats after NC/card bonuses and penalties; in-battle Custom bugs are controlled separately by Bug Rules.",
        ja: "基本は5枚です。ナビカス・改造カードの加減算後の構成値で判定します。戦闘中のカスタムバグはバグ条件で別途指定します。",
        zh: "基础选卡数为 5，按部件与改造卡加减后的构筑数值判断。战斗中减少选卡数的 Custom BUG 可在 Bug 规则中另行禁止。",
    },
    minCustomStandardBaseline: {
        en: "Standard Baseline", ja: "標準ベースライン", zh: "标准保底",
    },
    minCustomNumberOpen: {
        en: "NumberOpen", ja: "ナンバーオープン", zh: "数字开启",
    },
    minCustomMaxOpen: {
        en: "Max Open", ja: "全開", zh: "全开",
    },
    minChipRecoveryDesc: {
        en: "The final active recovery amount must meet this minimum, including after later improvements.",
        ja: "最終的に有効な回復量の下限です。以降の改善でもこの条件を維持します。",
        zh: "按最终生效的回复量判断；后续改进也必须保持此下限。",
    },
    reqMaxBusterStatsDesc: {
        en: "Select any stats that must reach Lv5 after NaviCust and Mod Card effects. The optimization goal still applies to valid builds.",
        ja: "ナビカスと改造カードの効果適用後にLv5を必須とする項目を選択します。条件を満たす構成で最適化を続けます。",
        zh: "可多选。所选属性在部件与改造卡效果叠加后必须达到 Lv5，再按优化目标寻找更优构筑。",
    },
    reqSpecialMoveTitle: {
        en: "Special Charge Shot (CS)",
        ja: "特殊チャージショット（CS）",
        zh: "特殊蓄力射击（CS）",
    },
    reqBLeftTitle: {
        en: "B + Left Move",
        ja: "B＋左コマンド技",
        zh: "B＋左指令技",
    },
    reqBButtonTitle: {
        en: "B-Button Weapon Override",
        ja: "Bボタン通常ショット（武器上書き）",
        zh: "B钮普通攻击（武器覆盖）",
    },
    reqChargeAdditionTitle: {
        en: "ChargeShot Addition",
        ja: "CS付加効果",
        zh: "集气射击附加效果",
    },
    glitch100ChargeAdditionTitle: {
        en: "100% Trigger (ChargeShot Addition Glitch)",
        ja: "100%発動（CS追加効果バグ）",
        zh: "100% 必定触发（CS附加漏洞）",
    },
    glitch100ChargeAdditionDesc: {
        en: "Requires Default ChargeShot (B PwrAtk: ChargeShot) alongside CS Addition to exploit the game glitch and guarantee 100% proc rate.",
        ja: "通常チャージショット（BためうちでCS）と併用することで、CS追加効果が100%の確率で発動するゲームの仕様・バグを利用します。",
        zh: "利用改造卡附带通常蓄力炮（BためうちでCS）时导致蓄力追加效果 100% 必定触发的游戏漏洞。",
    },
    glitch100Tag: {
        en: "100% Glitch",
        ja: "100%バグ発動",
        zh: "100% 漏洞触发",
    },
    reqBusterAdditionTitle: {
        en: "Buster Addition",
        ja: "バスター付加効果",
        zh: "洛克炮附加效果",
    },
    reqMovePanelTitle: {
        en: "Move Panel Effect",
        ja: "移動時パネル効果",
        zh: "移动变地效果",
    },
    reqMovePanelDesc: {
        en: "Select allowed move panel effects and crack levels. Unchecked effects are rejected.",
        ja: "移動時に発生する足元のパネル変化効果・ヒビ割れ確率を選択します。未選択の効果は除外されます。",
        zh: "选择允许的走地效果与地面碎裂等级。未勾选的效果将被排除。",
    },
    allowedMovePanelsHelperAny: {
        en: "No terrain selected: any panel change is allowed.",
        ja: "未選択：すべてのパネル変化を許可します。",
        zh: "未选择：允许出现任意变地效果。",
    },
    allowedMovePanelsHelperRestricted: {
        en: "Only selected panel changes (or absorbed by BugStop) are allowed.",
        ja: "選択されたパネル変化（またはバグストッパーによる無効化）のみを許可します。",
        zh: "仅允许出现已勾选的地面（或被 BUG停止器 消除）。",
    },
    clearToAllowAny: {
        en: "Clear (Allow Any)",
        ja: "クリア（すべて許可）",
        zh: "清空（允许任意）",
    },
    reqBodyTitle: {
        en: "Body Element",
        ja: "ボディ属性",
        zh: "身体属性",
    },
    allowedBodiesTitle: {
        en: "Allowed body elements", ja: "許可するボディ属性", zh: "允许的身体属性",
    },
    allowedBodiesDesc: {
        en: "Select any acceptable elements; unchecked elements are forbidden. An unchanged body counts as Normal.",
        ja: "許容する属性を複数選択できます。未選択の属性は禁止です。属性変更がない場合はノーマルとして判定します。",
        zh: "可多选；未勾选的属性禁止。身体未被改变时，按一般属性判断。",
    },
    allowedBodiesEmpty: {
        en: "Select at least one allowed body element.", ja: "許可する属性を1つ以上選択してください。", zh: "请至少勾选一种允许的身体属性。",
    },
    reqGaugeTitle: {
        en: "Gauge Speed",
        ja: "ゲージ速度",
        zh: "战斗量表速度",
    },
    allowedGaugesTitle: {
        en: "Allowed gauge speeds", ja: "許可するゲージ速度", zh: "允许的量表速度",
    },
    allowedGaugesDesc: {
        en: "Select any acceptable gauge speeds; unchecked speeds are forbidden. An unchanged gauge counts as Normal.",
        ja: "許容するゲージ速度を複数選択できます。未選択の速度は禁止です。ゲージ速度の変更がない場合は通常ゲージとして判定します。",
        zh: "可多选；未勾选的量表速度禁止。量表未被改变时，按普通量表判断。",
    },
    allowedGaugesEmpty: {
        en: "Select at least one allowed gauge speed.", ja: "許可するゲージ速度を1つ以上選択してください。", zh: "请至少勾选一种允许的量表速度。",
    },
    gaugeFast: {
        en: "Fast", ja: "クイック", zh: "快速",
    },
    gaugeNormal: {
        en: "Normal", ja: "通常", zh: "普通",
    },
    gaugeSlow: {
        en: "Slow", ja: "ヘビー", zh: "慢速",
    },
    gaugeFastTitle: {
        en: "Allow FastGauge", ja: "クイックゲージを許可", zh: "允许快速量表",
    },
    gaugeNormalTitle: {
        en: "Allow NormalGauge", ja: "通常ゲージを許可", zh: "允许普通量表",
    },
    gaugeSlowTitle: {
        en: "Allow SlowGauge", ja: "ヘビーゲージを許可", zh: "允许缓慢量表",
    },
    clearAll: {
        en: "Clear (Any)", ja: "解除（任意）", zh: "清除（设为任意）",
    },
    searchOptions: {
        en: "Search options...", ja: "検索...", zh: "搜索选项...",
    },
    selectedCount: {
        en: "selected", ja: "件選択中", zh: "项已选",
    },
    noMatchingOptions: {
        en: "No matching options", ja: "一致する項目がありません", zh: "无匹配选项",
    },
    abilityStrippedNotice: {
        en: "Stripped by Mod Card",
        ja: "改造カードにより無効化",
        zh: "已被改造卡效果剥夺关闭",
    },
    forbiddenBugsTitle: {
        en: "Strictly Forbidden Bugs",
        ja: "厳禁バグ（実戦発生禁止）",
        zh: "严格禁止的 BUG（禁止发生）",
    },
    bugRulesTitle: {
        en: "Battle Bug Rules & Requirements",
        ja: "実戦バグ仕様・要件",
        zh: "实战 Bug 规则与要求",
    },
    bugRulesDesc: {
        en: "Configure combat tolerance for each bug: Forbidden, Allowed (tolerated for high stats), or Required (mandatory for bug gimmicks). In EXE6, common competitive bugs are allowed by default (Movement, Custom -1, Ice/Crack Panel, and Support Failure remain forbidden).",
        ja: "各バグの実戦仕様を設定：禁止、容認（ステータス重視で許容）、または必須（固有戦術用）。EXE6では対戦で一般的なバグがデフォルトで容認されます（移動バグ・カスタム減少・移動氷/ヒビ・サポート不発は禁止を維持）。",
        zh: "为各项 BUG 独立设定对战规则：禁止、容许（为高收益属性可承受）、或必须（用于特定战术构筑）。EXE6 默认容许常用对战 BUG（边界移动 BUG、改装视窗减少 BUG、移动碎裂/冰块、支援 BUG 保持禁止）。",
    },
    bugRuleForbidden: {
        en: "✕ Forbidden",
        ja: "✕ 禁止",
        zh: "✕ 禁止",
    },
    bugRuleAllowed: {
        en: "○ Allowed",
        ja: "○ 容認",
        zh: "○ 容许",
    },
    bugRuleRequired: {
        en: "★ Required",
        ja: "★ 必須",
        zh: "★ 必须",
    },
    resetBugRulesDefault: {
        en: "↺ Reset to Defaults",
        ja: "↺ デフォルトに戻す",
        zh: "↺ 恢复默认规则",
    },
    resetAllBugsForbidden: {
        en: "🛡️ Reset All to Forbidden (Pure 0 Bugs)",
        ja: "🛡️ 全て禁止にリセット（完壁・バグ0）",
        zh: "🛡️ 一键全禁止（纯净 0 BUG）",
    },
    bugRuleStatusPure: {
        en: "🛡️ Pure Build (0 Bugs)",
        ja: "🛡️ 完壁（バグ0）",
        zh: "🛡️ 纯净构筑（0 BUG）",
    },
    bugRuleStatusCustom: {
        en: "Custom Bug Rules",
        ja: "カスタムバグ設定",
        zh: "自定义 Bug 规则",
    },
    anyOption: {
        en: "None / Any",
        ja: "指定なし",
        zh: "不指定",
    },
} as const;

export function t(key: keyof typeof translations, lang: Lang): string {
    return translations[key][lang];
}

export function getInitialLang(): Lang {
    try {
        if (typeof window !== "undefined" && window.localStorage) {
            const saved = window.localStorage.getItem("fullcust_lang");
            if (saved === "en" || saved === "ja" || saved === "zh") return saved;
        }
        if (typeof navigator !== "undefined" && navigator.language) {
            const l = navigator.language.toLowerCase();
            if (l.startsWith("ja")) return "ja";
            if (l.startsWith("zh")) return "zh";
        }
    } catch {
        // Ignore potential security/storage errors
    }
    return "en";
}

export function setPersistedLang(lang: Lang): void {
    try {
        if (typeof window !== "undefined" && window.localStorage) {
            window.localStorage.setItem("fullcust_lang", lang);
        }
    } catch {
        // Ignore potential storage errors
    }
}

export function tBilingual(text: string, lang: Lang): string {
    if (!text || !text.includes("・")) return text;
    const parts = text.split("・");
    if (lang === "ja") return parts[1] || parts[0];
    if (lang === "zh") return parts[2] || parts[1] || parts[0];
    return parts[0];
}

export function getPartName(part: { name: string; nameJa?: string; nameZh?: string }, lang: Lang): string {
    if (lang === "zh" && part.nameZh) {
        return part.nameZh;
    }
    if (lang === "ja" && part.nameJa) {
        return part.nameJa;
    }
    return part.name;
}
