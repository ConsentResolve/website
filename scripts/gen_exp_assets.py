#!/usr/bin/env python3
"""Per-scene assets for the 16 experimental reels — in the SITE'S exact illustration
style via the locked Recraft Brand Style ID (clean line-art: white fills, navy
outlines, mint-green offset echo, white bg). Single iconographic subjects to suit
the style. Recraft returns SVG; rasterized to PNG via Quick Look. curl-routed
(Recraft Cloudflare 1010-bans the Python TLS fingerprint).
Anonymous vs consented reads through FORM (faceless/?-mark vs checkmark), since the
brand style is white/navy/mint only — not a gray/green/red palette.
Usage: python3 scripts/gen_exp_assets.py 10"""
import sys, json, subprocess, shutil
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
KEY = (Path.home() / ".config/recraft/key").read_text().strip()
ENDPOINT = "https://external.api.recraft.ai/v1/images/generations"
BRAND_STYLE_ID = "214dccd1-dca3-43e6-b005-c664e1b33338"   # the website's exact illustration style
SIZE = "1024x1820"  # 9:16 vertical
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36"
# Site master prompt tail (matches generate-resource-images SITE_STYLE_BASE intent, trimmed).
STYLE_BASE = ("Clean flat line-art icon: bold near-black navy outlines, white fills, a single mint-green "
    "offset echo stroke, one hard-edged offset shadow, rounded friendly forms, straight-on 2D, generous "
    "negative space, plain white background. No lettering, no numbers, no surveillance or spying imagery.")

# Iconographic subjects suited to the brand icon style (single/few clean elements).
REELS = {
 "10": [
   ("a1-anon",    "a single faceless anonymous person icon inside a browser-window frame, a question mark where the face should be"),
   ("a2-accept",  "a hand tapping a large rounded checkmark consent button, a small person icon beside it"),
   ("a3-card",    "a contact card icon showing a person avatar with two simple horizontal placeholder lines beside it"),
   ("a4-some",    "a small three-by-three grid of identical person icons, a few of them marked with a small checkmark badge"),
   ("a5-phone",   "a person icon linked by a connecting line to a ringing telephone, a friendly callback"),
 ],
}

def call(subject):
    prompt = f"Subject: {subject}, centered.\n\n{STYLE_BASE}"
    body = json.dumps({"prompt": prompt, "model": "recraftv3", "style_id": BRAND_STYLE_ID,
            "size": SIZE, "n": 1, "response_format": "url"})
    r = subprocess.run(["curl", "-s", "-X", "POST", ENDPOINT, "-A", UA,
        "-H", f"Authorization: Bearer {KEY}", "-H", "Content-Type: application/json", "-d", body],
        capture_output=True, text=True, timeout=300)
    d = json.loads(r.stdout)
    if "data" not in d: raise RuntimeError(json.dumps(d)[:200])
    return d["data"][0]["url"]

def rasterize(svg_path, png_path):
    qldir = svg_path.parent / "_ql"; qldir.mkdir(exist_ok=True)
    subprocess.run(["qlmanage", "-t", "-s", "1280", "-o", str(qldir), str(svg_path)], capture_output=True, timeout=90)
    made = qldir / (svg_path.name + ".png")
    if made.exists(): shutil.move(str(made), str(png_path)); return True
    return False

reel = sys.argv[1] if len(sys.argv) > 1 else "10"
out = ROOT / f"public/exp-reels/{reel}"; out.mkdir(parents=True, exist_ok=True)
for name, subject in REELS[reel]:
    try:
        url = call(subject)
        svg = out / f"{name}.svg"
        subprocess.run(["curl", "-s", "-A", UA, "-o", str(svg), url], check=True, timeout=120)
        png = out / f"{name}.png"
        ok = rasterize(svg, png)
        print(f"  ok {name} -> svg {svg.stat().st_size//1024}KB" + (f", png {png.stat().st_size//1024}KB" if ok else " (raster FAILED)"))
    except Exception as e:
        print(f"  FAIL {name}: {e}")
print(f"=== reel {reel} assets done (brand style_id) ===")
