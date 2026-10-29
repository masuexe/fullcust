"""Rebuild the BN3 part shapes from the official ROMs.

The TREZ wiki diagrams are drawn at their own offsets inside the 5x5 canvas.
For 17 parts they do not match the ROM bitmaps, so saves made in the official
game fail to reproduce the stored grid. This importer reads the real 5x5
bitmaps from the ROM part tables and writes them into data/bn3.json. Names,
colors and part order stay unchanged.

Usage:
    python3 scripts/import-bn3-rom.py --rom-dir ../gba/roms [--data data/bn3.json]
"""

import argparse
import json
import re
import struct
from pathlib import Path

# ROM file -> address of the NaviCust part table (RawNavicustPart[204]).
VARIANT_TABLES = [
    ("exe3.gba", 0x080398D8, "JP White"),
    ("exe3b.gba", 0x080398C0, "JP Blue"),
    ("bn3.gba", 0x08039420, "US White"),
    ("bn3b.gba", 0x08039408, "US Blue"),
]

STRUCT_SIZE = 0x10
BITMAP_SIZE = 25

COLORS = ["", "white", "pink", "yellow", "red", "blue", "green", "orange", "purple", "gray"]


def rom_offset(address):
    if 0x08000000 <= address < 0x0A000000:
        return address - 0x08000000
    raise ValueError(f"Not a ROM address: {address:#010x}")


def read_bitmap(rom, address):
    offset = rom_offset(address)
    data = rom[offset:offset + BITMAP_SIZE]
    if len(data) != BITMAP_SIZE:
        raise ValueError(f"Bitmap outside ROM: {address:#010x}")
    return [1 if value else 0 for value in data]


def read_table(path):
    rom = path.read_bytes()
    entries = {}
    for part_id in range(204):
        offset = rom_offset(0x080398D8)  # placeholder replaced below
        raise RuntimeError("unreachable")
    return entries


def read_variant(path, table_address):
    rom = path.read_bytes()
    base = rom_offset(table_address)
    entries = {}
    for part_id in range(204):
        offset = base + part_id * STRUCT_SIZE
        if offset + STRUCT_SIZE > len(rom):
            break
        is_solid = rom[offset + 1]
        color_byte = rom[offset + 3]
        if not color_byte:
            continue
        if color_byte >= len(COLORS):
            continue
        uncompressed_ptr = struct.unpack_from("<I", rom, offset + 8)[0]
        compressed_ptr = struct.unpack_from("<I", rom, offset + 12)[0]
        try:
            uncompressed = read_bitmap(rom, uncompressed_ptr)
            compressed = read_bitmap(rom, compressed_ptr)
        except ValueError:
            continue
        if not any(uncompressed):
            continue
        if not any(compressed):
            compressed = list(uncompressed)
        template = part_id // 4
        key = (template, COLORS[color_byte])
        entries.setdefault(key, {
            "isSolid": is_solid == 0,
            "uncompressedMask": uncompressed,
            "compressedMask": compressed,
            "partId": part_id,
        })
    return entries


def format_masks(text):
    def replace(match):
        values = re.findall(r"\b[01]\b", match.group(1))
        return "[\n" + ",\n".join(
            "                " + ", ".join(values[i:i + 5]) for i in range(0, 25, 5)
        ) + "\n            ]"
    return re.sub(r"\[\s*((?:[01],?\s*){25})\]", replace, text)


def main():
    args = argparse.ArgumentParser(description=__doc__)
    args.add_argument("--rom-dir", type=Path, required=True)
    args.add_argument("--data", type=Path, default=Path("data/bn3.json"))
    options = args.parse_args()

    tables = []
    for name, address, label in VARIANT_TABLES:
        path = options.rom_dir / name
        if not path.exists():
            raise SystemExit(f"Missing ROM: {path}")
        tables.append((label, read_variant(path, address)))

    # Check that the four versions agree; JP White wins on conflict.
    conflicts = []
    reference = tables[0][1]
    for label, table in tables[1:]:
        for key, entry in table.items():
            other = reference.get(key)
            if other and (other["isSolid"] != entry["isSolid"]
                          or other["uncompressedMask"] != entry["uncompressedMask"]
                          or other["compressedMask"] != entry["compressedMask"]):
                conflicts.append((key, label))
    if conflicts:
        print(f"warning: {len(conflicts)} version conflicts; JP White data kept")
        for key, label in conflicts[:10]:
            print(f"  {key} differs in {label}")

    data = json.loads(options.data.read_text(encoding="utf-8"))
    missing = []
    changed = []
    for part in data["parts"]:
        key = (part["id"], COLORS[part["color"]])
        entry = reference.get(key)
        if entry is None:
            missing.append(key)
            continue
        if (part["isSolid"] != entry["isSolid"]
                or part["uncompressedMask"] != entry["uncompressedMask"]
                or part["compressedMask"] != entry["compressedMask"]):
            changed.append(key)
        part["isSolid"] = entry["isSolid"]
        part["uncompressedMask"] = entry["uncompressedMask"]
        part["compressedMask"] = entry["compressedMask"]
    if missing:
        raise SystemExit(f"Parts missing from the ROM tables: {missing}")

    text = json.dumps(data, ensure_ascii=False, indent=4)
    options.data.write_text(format_masks(text) + "\n", encoding="utf-8")
    print(f"Updated {len(changed)} of {len(data['parts'])} part variants from the official ROMs.")
    for key in changed:
        print(f"  changed {key[0]}:{key[1]}")


if __name__ == "__main__":
    main()
