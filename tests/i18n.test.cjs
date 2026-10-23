require("./register.cjs");
const assert = require("node:assert/strict");
const { test } = require("node:test");
const { t, tBilingual, getPartName, translations } = require("../i18n.ts");

test("i18n translations cover all keys in en, ja, and zh", () => {
    for (const [key, value] of Object.entries(translations)) {
        assert(value.en && value.en.length > 0, `Missing English for key: ${key}`);
        assert(value.ja && value.ja.length > 0, `Missing Japanese for key: ${key}`);
        assert(value.zh && value.zh.length > 0, `Missing Chinese for key: ${key}`);
        assert.equal(t(key, "en"), value.en);
        assert.equal(t(key, "ja"), value.ja);
        assert.equal(t(key, "zh"), value.zh);
    }
});

test("tBilingual splits English, Japanese, and Chinese strings correctly", () => {
    assert.equal(tBilingual("bn6・exe6", "en"), "bn6");
    assert.equal(tBilingual("bn6・exe6", "ja"), "exe6");
    assert.equal(tBilingual("bn6・exe6", "zh"), "exe6");
    assert.equal(tBilingual("Normal・ノーマル・一般型态", "en"), "Normal");
    assert.equal(tBilingual("Normal・ノーマル・一般型态", "ja"), "ノーマル");
    assert.equal(tBilingual("Normal・ノーマル・一般型态", "zh"), "一般型态");
    assert.equal(tBilingual("plain text", "en"), "plain text");
    assert.equal(tBilingual("plain text", "ja"), "plain text");
    assert.equal(tBilingual("plain text", "zh"), "plain text");
});

test("getPartName respects current language with fallbacks", () => {
    const part = {
        name: "SprArmor (red)",
        nameJa: "スーパーアーマー（レッド）",
        nameZh: "超级装甲（红色）",
    };
    assert.equal(getPartName(part, "en"), "SprArmor (red)");
    assert.equal(getPartName(part, "ja"), "スーパーアーマー（レッド）");
    assert.equal(getPartName(part, "zh"), "超级装甲（红色）");

    const jaOnlyPart = { name: "TestPart", nameJa: "テスト" };
    assert.equal(getPartName(jaOnlyPart, "en"), "TestPart");
    assert.equal(getPartName(jaOnlyPart, "ja"), "テスト");
    assert.equal(getPartName(jaOnlyPart, "zh"), "TestPart");

    const englishOnlyPart = { name: "TestPart" };
    assert.equal(getPartName(englishOnlyPart, "en"), "TestPart");
    assert.equal(getPartName(englishOnlyPart, "ja"), "TestPart");
    assert.equal(getPartName(englishOnlyPart, "zh"), "TestPart");
});
