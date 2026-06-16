#!/usr/bin/env python3
"""Per-scene assets for the 16 experimental reels — in the SITE'S documented
illustration style (master prompt + hand-drawn marker vector), palette extended
with the brand's own slate-gray + red so the reel color language survives:
gray=anonymous, green=consented/win, red=old shared-lead way. Recraft returns SVG
(vector); rasterized to PNG via Quick Look. Routed through curl (Recraft's
Cloudflare 1010-bans the Python TLS fingerprint).
Usage: python3 scripts/gen_exp_assets.py 10"""
import sys, json, subprocess, shutil
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
KEY = (Path.home() / ".config/recraft/key").read_text().strip()
ENDPOINT = "https://external.api.recraft.ai/v1/images/generations"
SIZE = "1024x1820"  # 9:16 vertical
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36"

# Brand colors (same hues the site illustrations + comparison graphics use),
# carrying the reel color language.
PAL = {
    "green": [0, 229, 160],     # #00E5A0 brand mint — consented / the win
    "ink":   [10, 22, 40],      # #0A1628 navy linework
    "paper": [248, 250, 252],   # #F8FAFC off-white background
    "gray":  [148, 163, 184],   # #94A3B8 brand slate — anonymous
    "red":   [255, 90, 90],     # #FF5A5A brand red — old shared-lead way
}
# The site's master illustration prompt (SITE_STYLE_BASE, verbatim) — marker /
# hand-drawn, flat fills, one offset shadow, white bg, no lettering.
STYLE_BASE = (
    "Hand-inked marker-style illustration: thick slightly rough organic outlines, occasional doubled "
    "'ghost' stroke, flat color fills, ONE hard-edged offset drop shadow down-right (no blur/gradient), "
    "rounded friendly forms, completely flat shading, straight-on 2D, generous negative space, plain "
    "white background. No lettering, no numbers, no surveillance camera, no spying imagery."
)

REELS = {
 "10": (["gray", "green", "ink", "paper"], [
   ("a1-wall",    "a large grid wall of many identical faceless gray anonymous human silhouettes, all uniform and featureless (gray = anonymous)"),
   ("a2-accept",  "a single human silhouette reaching up to tap a green checkmark consent button, the silhouette turning from gray to green (green = consented)"),
   ("a3-card",    "a clean rounded green-accented lead card shape with simple placeholder lines for a name and email, no real text"),
   ("a4-lighting","a grid wall of gray human silhouettes with a scattered few of them turned solid green, the rest still gray"),
   ("a5-phone",   "two green human silhouettes walking together toward a softly ringing telephone, hopeful and warm"),
 ]),
}

COLOR_ROLES = ("Strict color discipline: render anonymous or unknown people as flat COOL SLATE GRAY "
    "(never brown, tan, beige, or skin tones); render consented people and positive outcomes in MINT GREEN; "
    "use RED only for the old shared-lead way. Limited flat palette, cool and modern, no warm earth tones.")
def call(subject, colors):
    # digital_illustration + hand_drawn substyle = the documented hand-drawn family,
    # returns PNG directly, and honors the colors[] palette (the color language).
    prompt = f"Subject: {subject}, arranged center-frame.\n\n{STYLE_BASE}\n\n{COLOR_ROLES}"
    body = json.dumps({"prompt": prompt, "model": "recraftv3", "style": "digital_illustration",
            "substyle": "hand_drawn", "colors": [{"rgb": PAL[c]} for c in colors],
            "size": SIZE, "n": 1, "response_format": "url"})
    r = subprocess.run(["curl", "-s", "-X", "POST", ENDPOINT, "-A", UA,
        "-H", f"Authorization: Bearer {KEY}", "-H", "Content-Type: application/json", "-d", body],
        capture_output=True, text=True, timeout=300)
    d = json.loads(r.stdout)
    if "data" not in d: raise RuntimeError(json.dumps(d)[:200])
    return d["data"][0]["url"]

reel = sys.argv[1] if len(sys.argv) > 1 else "10"
colors, assets = REELS[reel]
out = ROOT / f"public/exp-reels/{reel}"; out.mkdir(parents=True, exist_ok=True)
for name, subject in assets:
    try:
        url = call(subject, colors)
        png = out / f"{name}.png"
        subprocess.run(["curl", "-s", "-A", UA, "-o", str(png), url], check=True, timeout=120)
        print(f"  ok {name} -> {png.stat().st_size//1024}KB")
    except Exception as e:
        print(f"  FAIL {name}: {e}")
print(f"=== reel {reel} assets done (site hand-drawn style) ===")
