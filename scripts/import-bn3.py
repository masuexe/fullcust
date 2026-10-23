"""Convert the TREZ BN3 part diagrams in a saved HTML page to the game dataset.

Usage: python3 scripts/import-bn3.py --html /tmp/bn3.html
See docs/bn3.md for the source URL, diagram convention, and support scope.
Only Python's standard library is required.
"""

import argparse
import json
import re
from html.parser import HTMLParser
from pathlib import Path


class Node:
    def __init__(self, tag="", attrs=()):
        self.tag = tag
        self.attrs = dict(attrs)
        self.children = []

    def descendants(self, tag):
        for child in self.children:
            if isinstance(child, Node):
                if child.tag == tag:
                    yield child
                yield from child.descendants(tag)

    def direct(self, tag):
        return [c for c in self.children if isinstance(c, Node) and c.tag == tag]

    def text(self):
        return "".join(c.text() if isinstance(c, Node) else c for c in self.children)


class Parser(HTMLParser):
    VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input",
            "link", "meta", "param", "source", "track", "wbr"}

    def __init__(self):
        super().__init__()
        self.root = Node()
        self.stack = [self.root]

    def handle_starttag(self, tag, attrs):
        node = Node(tag, attrs)
        self.stack[-1].children.append(node)
        if tag not in self.VOID:
            self.stack.append(node)

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        self.handle_endtag(tag)

    def handle_endtag(self, tag):
        for i in range(len(self.stack) - 1, 0, -1):
            if self.stack[i].tag == tag:
                del self.stack[i:]
                break

    def handle_data(self, data):
        self.stack[-1].children.append(data)


def rows(table):
    return table.direct("tr") + [r for body in table.direct("tbody") for r in body.direct("tr")]


# Original program template order, independent of the wiki's display order.
PROGRAMS = [
    ("SprArmor", "スーパーアーマー"),
    ("BrakBust", "ブレイクバスター"),
    ("BrakChrg", "ブレイクチャージ"),
    ("SetGreen", "セットグリーン"),
    ("SetIce", "セットアイス"),
    ("SetLava", "セットマグマ"),
    ("SetSand", "セットサンド"),
    ("SetMetal", "セットメタル"),
    ("SetHoly", "セットホーリー"),
    ("Custom1", "カスタム1"),
    ("Custom2", "カスタム2"),
    ("MegFldr1", "メガフォルダ1"),
    ("MegFldr2", "メガフォルダ2"),
    ("Block", "ブロック"),
    ("Shield", "シールド"),
    ("Reflect", "リフレクト"),
    ("ShdwShoe", "シャドーシューズ"),
    ("FlotShoe", "フロートシューズ"),
    ("AntiDmg", "カワリミマジック"),
    ("Press", "プレスプログラム"),
    ("EngyChng", "エナジーチェンジ"),
    ("Alpha", "アルファ"),
    ("SneakRun", "シノビダッシュ"),
    ("OilBody", "オイルボディ"),
    ("Fish", "アイムフィッシュ"),
    ("Battery", "アイムバッテリー"),
    ("Jungle", "アイムジャングル"),
    ("Collect", "コレクターズアイ"),
    ("AirShoes", "エアシューズ"),
    ("UnderSht", "アンダーシャツ"),
    ("FstGauge", "クイックゲージ"),
    ("Rush", "ラッシュサポート"),
    ("Beat", "ビートサポート"),
    ("Tango", "タンゴサポート"),
    ("WeapLV+1", "ウエポンLV+1"),
    ("HP+100", "HP+100"),
    ("HP+200", "HP+200"),
    ("HP+300", "HP+300"),
    ("HP+500", "HP+500"),
    ("Reg+5", "レギュラー+5"),
    ("Atk+1", "アタック+1"),
    ("Speed+1", "ラピッド+1"),
    ("Charge+1", "チャージ+1"),
    ("BugStop", "バグストッパー"),
    ("Humor", "ユーモアセンス"),
    ("BlckMind", "ブラックマインド"),
    ("BustrMAX", "バスターMAX"),
    ("GigFldr1", "ギガフォルダ1"),
    ("HubBatc", "サイトバッチ"),
    ("DarkLcns", "ダークライセンス"),
]
COLORS = ["", "white", "pink", "yellow", "red", "blue", "green", "orange", "purple", "gray"]
COLOR_JA = ["", "ホワイト", "ピンク", "イエロー", "レッド", "ブルー", "グリーン", "オレンジ", "パープル", "グレー"]


def convert(html):
    parser = Parser()
    parser.feed(html)
    programs = {}
    for table in parser.root.descendants("table"):
        if "wikitable" not in table.attrs.get("class", "").split():
            continue
        table_rows = rows(table)
        headings = [th.text().strip() for th in table_rows[0].direct("th")]
        if headings not in (["Part", "Effect", "Bug", "Location", "Compression"],
                            ["Part", "Effect", "Bug", "Location"]):
            continue
        is_solid = "Compression" in headings
        for row in table_rows[1:]:
            heading, = row.direct("th")
            name = "".join(c for c in heading.children if isinstance(c, str)).strip()
            if name in programs:
                raise ValueError(f"Duplicate program: {name}")
            diagram, = heading.descendants("table")
            diagram_rows = rows(diagram)
            if len(diagram_rows) != 5 or any(len(r.direct("td")) != 5 for r in diagram_rows):
                raise ValueError(f"Expected a 5x5 diagram: {name}")
            compressed, uncompressed = [], []
            for cell in [c for r in diagram_rows for c in r.direct("td")]:
                blocks = cell.direct("div")
                if len(blocks) > 1:
                    raise ValueError(f"Ambiguous shape cell: {name}")
                uncompressed.append(int(bool(blocks)))
                removed = bool(blocks) and re.search(r"opacity\s*:\s*0\.5\s*;", blocks[0].attrs.get("style", ""))
                compressed.append(int(bool(blocks) and not removed))
            variants = [b.text().strip().lower() for b in row.direct("td")[2].descendants("b")]
            if not variants or any(c not in COLORS[1:] for c in variants):
                raise ValueError(f"Unknown program colors: {name}: {variants}")
            if not any(compressed) or not any(uncompressed):
                raise ValueError(f"Empty shape: {name}")
            programs[name] = (is_solid, compressed, uncompressed, variants)

    if set(programs) != {name for name, _ in PROGRAMS}:
        raise ValueError("Program catalog differs from the expected 50 templates")
    parts = []
    for program_id, (name, name_ja) in enumerate(PROGRAMS, start=1):
        solid, compressed, uncompressed, variants = programs[name]
        for color in variants:
            color_index = COLORS.index(color)
            parts.append({
                "id": program_id,
                "name": f"{name} ({color})",
                "nameJa": f"{name_ja}（{COLOR_JA[color_index]}）",
                "color": color_index,
                "compressedMask": compressed,
                "uncompressedMask": uncompressed,
                "isSolid": solid,
            })
    if len(parts) != 65:
        raise ValueError(f"Expected 65 color variants, found {len(parts)}")
    return {
        "colors": COLORS,
        "gridSettings": {"height": 5, "width": 5, "hasOob": False, "commandLineRow": 2},
        "parts": parts,
    }


def main():
    args = argparse.ArgumentParser(description=__doc__)
    args.add_argument("--html", type=Path, required=True)
    args.add_argument("--output", type=Path, default=Path("data/bn3.json"))
    options = args.parse_args()
    data = convert(options.html.read_text(encoding="utf-8"))
    output = json.dumps(data, ensure_ascii=False, indent=4)
    # Keep each mask as five readable rows instead of 25 separate lines.
    def format_mask(match):
        values = re.findall(r"\b[01]\b", match.group(1))
        return "[\n" + ",\n".join("                " + ", ".join(values[i:i + 5])
                                     for i in range(0, 25, 5)) + "\n            ]"
    output = re.sub(r"\[\s*((?:[01],?\s*){25})\]", format_mask, output)
    options.output.write_text(output + "\n", encoding="utf-8")
    print(f"Wrote {len(data['parts'])} part variants to {options.output}")


if __name__ == "__main__":
    main()
