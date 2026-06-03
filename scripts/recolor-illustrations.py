#!/usr/bin/env python3
"""
Post-process Recraft SVG output: snap every color to the locked
4-value brand palette via HSL bucketing.

Usage:
  python3 scripts/recolor-illustrations.py
  python3 scripts/recolor-illustrations.py --only=01,03
  python3 scripts/recolor-illustrations.py --dry-run

Buckets:
  outline (L < 20)                              → #0A1628 navy
  shadow  (20 ≤ L < 45, low saturation)         → #1E293B card navy
  mint    (cyan-green hue, S > 20, 20 ≤ L < 85) → #00E5A0
  white   (L ≥ 85)                              → #F8FAFC
"""
import argparse
import colorsys
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
IN_DIR = ROOT / "public" / "illustrations" / "style"

# Brand palette as (r, g, b) tuples
BRAND = {
    "outline":  (10, 22, 40),       # #0A1628
    "shadow":   (30, 41, 59),       # #1E293B
    "mint":     (0, 229, 160),      # #00E5A0
    "white":    (248, 250, 252),    # #F8FAFC
}

RGB_RE = re.compile(r"rgb\((\d+),\s*(\d+),\s*(\d+)\)")
HEX_RE = re.compile(r"#([0-9a-fA-F]{6})\b")


def bucket(r: int, g: int, b: int) -> tuple[int, int, int]:
    """Return the brand RGB tuple that this color should snap to."""
    h, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
    # convert to 0-100 ranges for readable thresholds
    L = l * 100
    S = s * 100
    H_deg = h * 360

    if L >= 88:
        return BRAND["white"]
    if L < 22:
        return BRAND["outline"]
    # Cyan-green hue range = 130°–200° (covers mint, teal, cyan)
    if 120 <= H_deg <= 200 and S > 18:
        return BRAND["mint"]
    # Otherwise treat low-saturation mid-tones as shadow
    if S < 25 and L < 50:
        return BRAND["shadow"]
    # Default: still snap to mint for any high-saturation colored content
    if S > 25:
        return BRAND["mint"]
    return BRAND["white"]


def hex_to_rgb(h: str) -> tuple[int, int, int]:
    return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)


def rgb_to_hex(rgb: tuple[int, int, int]) -> str:
    return "#{:02X}{:02X}{:02X}".format(*rgb)


def process(svg_text: str, dry_run: bool = False) -> tuple[str, dict]:
    """Return (recolored_svg, mapping)."""
    mapping: dict[str, str] = {}

    def repl_rgb(m: re.Match) -> str:
        r, g, b = int(m.group(1)), int(m.group(2)), int(m.group(3))
        target = bucket(r, g, b)
        before = f"rgb({r},{g},{b})"
        after = f"rgb({target[0]},{target[1]},{target[2]})"
        mapping[before] = after
        return after

    def repl_hex(m: re.Match) -> str:
        r, g, b = hex_to_rgb(m.group(1))
        target = bucket(r, g, b)
        before = "#" + m.group(1).upper()
        after = rgb_to_hex(target)
        mapping[before] = after
        return after

    out = RGB_RE.sub(repl_rgb, svg_text)
    out = HEX_RE.sub(repl_hex, out)
    return out, mapping


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", default="", help="comma-separated indices (e.g. '01,03')")
    ap.add_argument("--in-dir", default="", help="override input directory; default is public/illustrations/style/")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    in_dir = Path(args.in_dir) if args.in_dir else IN_DIR
    files = sorted(in_dir.glob("*.svg"))
    if args.only:
        keep = {x.strip() for x in args.only.split(",") if x.strip()}
        files = [f for f in files if any(f.name.startswith(k + "-") for k in keep)]
    if not files:
        sys.exit(f"No SVGs found in {in_dir}")

    print(f"Recoloring {len(files)} SVG(s) → brand palette")
    for f in files:
        original = f.read_text(encoding="utf-8")
        recolored, mapping = process(original, args.dry_run)
        before_unique = sorted(set(mapping.keys()))
        after_unique = sorted(set(mapping.values()))
        print(f"\n  {f.name}: {len(before_unique)} unique colors → {len(after_unique)} brand colors")
        for src, dst in sorted(mapping.items()):
            print(f"    {src:32} → {dst}")
        if not args.dry_run:
            f.write_text(recolored, encoding="utf-8")
    print("\nDone." + ("" if not args.dry_run else " (dry-run — no files written)"))


if __name__ == "__main__":
    main()
