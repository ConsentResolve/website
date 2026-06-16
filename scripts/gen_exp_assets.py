#!/usr/bin/env python3
"""Generate per-scene assets for the 16 experimental reels via Recraft (raster PNG,
palette-locked). Color language is sacred: gray=anonymous, green=consented/win,
red=old shared-lead way. Off-white bg, navy ink. Saves public/exp-reels/<reel>/<name>.png.
Usage: python3 scripts/gen_exp_assets.py 10   (one reel at a time during the pilot)"""
import sys, json, subprocess
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
KEY = (Path.home() / ".config/recraft/key").read_text().strip()
ENDPOINT = "https://external.api.recraft.ai/v1/images/generations"
SIZE = "1024x1820"  # 9:16 vertical

# extended campaign palette (RGB) — superset of brand colors + the color language
PAL = {
    "gray":  [148, 163, 184],   # anonymous
    "green": [0, 229, 160],     # consented / the win (brand mint)
    "red":   [255, 90, 90],     # the old shared-lead way
    "ink":   [10, 22, 40],      # near-black navy linework
    "paper": [248, 250, 252],   # off-white background
}
STYLE_SUFFIX = (" Flat minimalist digital illustration, off-white background, generous negative space, "
                "near-black navy ink linework, clean and modern. Color language: gray = anonymous/unknown person, "
                "green = consented and the win.")

# Per-reel: (palette keys to lock, [(asset_name, prompt)])
REELS = {
 "10": (["gray", "green", "ink", "paper"], [
   ("a1-wall",   "a large grid wall of about fifty identical faceless gray anonymous human silhouettes, all uniform and featureless"),
   ("a2-accept", "a single human silhouette reaching up to tap a glowing green checkmark ACCEPT button on a consent banner, the silhouette transitioning from gray to green"),
   ("a3-card",   "a clean green-accented lead card UI showing a person's name, an email address, and a small label reading viewed water heater quote"),
   ("a4-lighting","a grid wall of gray human silhouettes with a scattered few of them lit up solid green, the rest still gray"),
   ("a5-phone",  "two green human silhouettes walking together toward a softly ringing telephone, hopeful and warm"),
 ]),
}

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36"
# Recraft sits behind Cloudflare, which 1010-bans the Python TLS fingerprint; curl
# negotiates a signature it accepts, so all I/O goes through curl.
def call(prompt, colors):
    body = json.dumps({"prompt": prompt + STYLE_SUFFIX, "model": "recraftv3", "style": "digital_illustration",
            "colors": [{"rgb": PAL[c]} for c in colors], "size": SIZE, "n": 1, "response_format": "url"})
    r = subprocess.run(["curl", "-s", "-X", "POST", ENDPOINT, "-A", UA,
        "-H", f"Authorization: Bearer {KEY}", "-H", "Content-Type: application/json", "-d", body],
        capture_output=True, text=True, timeout=300)
    d = json.loads(r.stdout)
    if "data" not in d: raise RuntimeError(json.dumps(d)[:200])
    return d["data"][0]["url"]
def download(url, dest):
    subprocess.run(["curl", "-s", "-A", UA, "-o", str(dest), url], check=True, timeout=120)

reel = sys.argv[1] if len(sys.argv) > 1 else "10"
colors, assets = REELS[reel]
out = ROOT / f"public/exp-reels/{reel}"; out.mkdir(parents=True, exist_ok=True)
for name, prompt in assets:
    try:
        url = call(prompt, colors)
        dest = out / f"{name}.png"
        download(url, dest)
        print(f"  ok {name} -> {dest} ({dest.stat().st_size//1024} KB)")
    except Exception as e:
        print(f"  FAIL {name}: {e}")
print(f"=== reel {reel} assets done ===")
