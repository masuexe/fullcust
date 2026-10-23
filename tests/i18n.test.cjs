require("./register.cjs");
const assert = require("node:assert/strict");
const { test } = require("node:test");
const { t, tBilingual, getPartName, translations } = require("../i18n.ts");

test("i18n translations cover all keys in both en and ja", () => {
    for (const [key, value] of Object.entries(translations)) {
        assert(value.en && value.en.length > 0, `Missing English for key: ${key}`);
        assert(value.ja && value.ja.length > 0, `Missing Japanese for key: ${key}`);
        assert.equal(t(key, "en"), value.en);
        assert.equal(t(key, "ja"), value.ja);
    }
});

test("tBilingual splits English and Japanese strings correctly", () => {
    assert.equal(tBilingual("bn6・exe6", "en"), "bn6");
    assert.equal(tBilingual("bn6・exe6", "ja"), "exe6");
    assert.equal(tBilingual("Normal・ノーマル", "en"), "Normal");
    assert.equal(tBilingual("Normal・ノーマル", "ja"), "ノーマル");
    assert.equal(tBilingual("plain text", "en"), "plain text");
    assert.equal(tBilingual("plain text", "ja"), "plain text");
});

test("getPartName respects current language with fallbacks", () => {
    const part = { name: "SprArmor (red)", nameJa: "スーパーアーマー（レッド）" };
    assert.equal(getPartName(part, "en"), "SprArmor (red)");
    assert.equal(getPartName(part, "ja"), "スーパーアーマー（レッド）");

    const englishOnlyPart = { name: "TestPart" };
    assert.equal(getPartName(englishOnlyPart, "en"), "TestPart");
    assert.equal(getPartName(englishOnlyPart, "ja"), "TestPart");
});
