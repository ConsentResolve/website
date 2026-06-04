#!/usr/bin/env python3
"""
One-off Recraft generator for the v2 hero illustration.

Uses the user-provided palette (forest green + sage + pale mint) — NOT the
live brand mint/navy palette — because the hero illustration is a stylistic
hero piece, not part of the feature/trade SVG library.

Output: public/illustrations/hero/protagonist.svg
"""
import json
import sys
import urllib.request
import urllib.error
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
KEY = (Path.home() / ".config" / "recraft" / "key").read_text().strip()
OUT_DIR = ROOT / "public" / "illustrations" / "hero"
OUT_DIR.mkdir(parents=True, exist_ok=True)

# User-specified palette
PALETTE = [
    {"rgb": [20, 39, 28]},     # #14271C  near-black forest green (outlines)
    {"rgb": [95, 185, 140]},   # #5FB98C  primary sage green
    {"rgb": [188, 227, 203]},  # #BCE3CB  pale mint / celadon
    {"rgb": [27, 58, 42]},     # #1B3A2A  deep forest green (shadows)
    {"rgb": [255, 255, 255]},  # white — inner highlights only
    {"rgb": [156, 163, 175]},  # #9CA3AF  flat neutral gray — anonymous figures only
]

PROMPT = (
    "Hand-inked marker illustration, transparent background. Thick rough "
    "outlines with occasional doubled 'ghost' strokes. Flat color fills. "
    "Flat hard-edged drop shadows offset down-right. Rounded organic forms. "
    "No gradients, no 3D. Square 1:1.\n\n"
    "Scene: A friendly service pro in his 30s, ball cap and work shirt and "
    "tool belt, beside a work truck with a ladder rack, mid-stride to the "
    "driver's door, holding up a smartphone with a confident half-smile. "
    "Phone screen shows a lead card built from icons only — round person "
    "avatar, phone handset, map pin, checkmark badge. Beside the phone, a "
    "faceless gray silhouette transforming into sage green: the recovered "
    "lead. Far background: two faceless gray silhouettes drifting off a "
    "small browser-window shape. Low sunrise arc behind the truck. "
    "Protagonist dominant, background tiny.\n\n"
    "Negative: no text, no numbers, no logos, no surveillance imagery, no "
    "magnifying glass, gray figures stay faceless, only the protagonist "
    "has a face."
)


def main():
    body = {
        "prompt": PROMPT,
        "model": "recraftv3",
        # digital_illustration + hand_drawn is the closest Recraft substyle
        # to the user's "hand-inked marker style" brief. (vector_illustration
        # no longer accepts hand_drawn/marker substyles; allowed vector subs
        # are line_art / linocut / engraving — none of which match.) Output
        # is PNG instead of SVG; fine for a single hero asset.
        "style": "digital_illustration",
        "substyle": "hand_drawn",
        "colors": PALETTE,
        "size": "1024x1024",
        "n": 1,
        "response_format": "url",
    }
    print("→ POST Recraft (digital_illustration / hand_drawn, custom 6-color palette)...", flush=True)
    req = urllib.request.Request(
        "https://external.api.recraft.ai/v1/images/generations",
        data=json.dumps(body).encode("utf-8"),
        method="POST",
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {KEY}"},
    )
    try:
        with urllib.request.urlopen(req, timeout=300) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        err = e.read().decode("utf-8", errors="replace")
        sys.exit(f"generation HTTP {e.code}: {err}")

    data = payload.get("data") or []
    if not data or "url" not in data[0]:
        sys.exit(f"Unexpected response: {payload}")
    url = data[0]["url"]
    print(f"  ok, downloading {url[:80]}...", flush=True)

    dl = urllib.request.Request(url, headers={"User-Agent": "consentresolve-hero-fetch/1.0"})
    with urllib.request.urlopen(dl, timeout=120) as r:
        blob = r.read()
    head = blob[:8]
    ext = "svg" if head.startswith(b"<svg") or b"<?xml" in head else ("png" if head.startswith(b"\x89PNG") else "bin")
    out = OUT_DIR / f"protagonist.{ext}"
    out.write_bytes(blob)
    print(f"  saved {out.relative_to(ROOT)} ({len(blob)//1024} KB)")


if __name__ == "__main__":
    main()
