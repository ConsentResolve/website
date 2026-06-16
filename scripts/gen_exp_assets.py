#!/usr/bin/env python3
"""Generate brand-style line-art assets for the 16 experimental reels via the
locked Recraft Brand Style ID (clean line-art: white fills, navy outlines, mint
echo, white bg). Square 1024 icons (composited onto the 9:16 reel canvas later,
with margins — so nothing clips). Recraft returns SVG; rasterized via Quick Look.
curl-routed (Recraft Cloudflare 1010-bans the Python TLS fingerprint).
Usage: python3 scripts/gen_exp_assets.py 10     (one reel)
       python3 scripts/gen_exp_assets.py all    (all 16)"""
import sys, json, subprocess, shutil
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
from reels_16 import REELS, assets_for
KEY = (Path.home() / ".config/recraft/key").read_text().strip()
ENDPOINT = "https://external.api.recraft.ai/v1/images/generations"
BRAND_STYLE_ID = "214dccd1-dca3-43e6-b005-c664e1b33338"
SIZE = "1024x1024"
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36"
STYLE_BASE = ("Clean flat line-art icon: bold near-black navy outlines, white fills, a single mint-green "
    "offset echo stroke, one hard-edged offset shadow, rounded friendly forms, straight-on 2D, generous "
    "negative space, plain white background. No lettering, no numbers, no surveillance or spying imagery.")

def call(subject):
    body = json.dumps({"prompt": f"Subject: {subject}, centered.\n\n{STYLE_BASE}", "model": "recraftv3",
            "style_id": BRAND_STYLE_ID, "size": SIZE, "n": 1, "response_format": "url"})
    r = subprocess.run(["curl", "-s", "-X", "POST", ENDPOINT, "-A", UA,
        "-H", f"Authorization: Bearer {KEY}", "-H", "Content-Type: application/json", "-d", body],
        capture_output=True, text=True, timeout=300)
    d = json.loads(r.stdout)
    if "data" not in d: raise RuntimeError(json.dumps(d)[:200])
    return d["data"][0]["url"]

def rasterize(svg_path, png_path):
    qldir = svg_path.parent / "_ql"; qldir.mkdir(exist_ok=True)
    subprocess.run(["qlmanage", "-t", "-s", "1200", "-o", str(qldir), str(svg_path)], capture_output=True, timeout=90)
    made = qldir / (svg_path.name + ".png")
    if made.exists(): shutil.move(str(made), str(png_path)); return True
    return False

def gen_reel(reel):
    out = ROOT / f"public/exp-reels/{reel}"; out.mkdir(parents=True, exist_ok=True)
    print(f">>> reel {reel} ({REELS[reel]['title']})", flush=True)
    for slug, subject in assets_for(reel):
        png = out / f"{slug}.png"
        if png.exists() and png.stat().st_size > 20000:
            print(f"  skip {slug} (cached)"); continue
        try:
            url = call(subject)
            svg = out / f"{slug}.svg"
            subprocess.run(["curl", "-s", "-A", UA, "-o", str(svg), url], check=True, timeout=120)
            ok = rasterize(svg, png)
            print(f"  ok {slug}" + ("" if ok else " (raster FAILED)"), flush=True)
        except Exception as e:
            print(f"  FAIL {slug}: {e}", flush=True)

arg = sys.argv[1] if len(sys.argv) > 1 else "10"
reels = list(REELS) if arg == "all" else [arg]
for r in reels:
    gen_reel(r)
print("=== exp assets done ===", flush=True)
