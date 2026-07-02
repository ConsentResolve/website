#!/usr/bin/env python3
"""Generate one Meta ad image via Recraft.

Grounded in the repo's proven pattern (scripts/da_lib.py, scripts/gen_exp_assets.py): the request
is routed through `curl` because Recraft's Cloudflare edge 1010-bans Python's TLS fingerprint. Two
tracks:
  --track brand  : the locked line-art brand style_id (returns SVG -> rasterized to PNG via qlmanage)
  --track raster : photorealistic (Recraft v4.1 raster) with brand palette/style prompt

Key is read from ~/.config/recraft/key (never hardcode / never print it).

Examples:
  python3 recraft_ad.py --track brand  --size 1080x1080 \
    --prompt "A website with visitors leaving, 98 percent fading away, centered" \
    --out out/wastedspend_sq.png

  python3 recraft_ad.py --track raster --size 1080x1350 \
    --prompt "HVAC contractor at a laptop seeing new leads arrive, warm natural light" \
    --headline "98% leave without a trace" --cta "Get them back for $7" \
    --out out/wastedspend_4x5.png

NOTE ON v4.1: the repo's proven `model` value is "recraftv3". Recraft's exact v4.1 model string
and text_layout field name evolve — if a call 400s on `model` or `text_layout`, confirm the
current values in Recraft's docs (or one test call) and update RASTER_MODEL / TEXT_LAYOUT_KEY
below. The request structure is otherwise correct.
"""
import argparse, json, os, subprocess, sys, tempfile, urllib.request
from pathlib import Path

ENDPOINT = "https://external.api.recraft.ai/v1/images/generations"
KEY_PATH = Path.home() / ".config" / "recraft" / "key"
BRAND_STYLE_ID = "214dccd1-dca3-43e6-b005-c664e1b33338"  # locked line-art brand (white/navy/mint)
RASTER_MODEL = "recraftv3"        # proven; update to the v4.1 model string when confirmed
BRAND_STYLE_BASE = ("Consent Resolve brand: clean, trustworthy, plain, contractor-friendly. "
                    "Navy (#0A1628), mint accent (#00E5A0), off-white. No stock-photo cheese, "
                    "no clutter, generous margins so nothing clips.")
BRAND_COLORS = [{"rgb": [10, 22, 40]}, {"rgb": [0, 229, 160]}, {"rgb": [244, 246, 248]}]
TEXT_LAYOUT_KEY = "text_layout"   # update if Recraft renames the field


def key():
    if not KEY_PATH.exists():
        sys.exit(f"Recraft key not found at {KEY_PATH}")
    return KEY_PATH.read_text().strip()


def build_body(a):
    body = {"size": SIZE_MAP.get(a.size, a.size), "response_format": "url", "n": 1}
    if a.track == "brand":
        body["model"] = "recraftv3"
        body["style_id"] = BRAND_STYLE_ID
        body["prompt"] = f"{a.prompt}\n\n{BRAND_STYLE_BASE}"
    else:  # raster / photoreal
        body["model"] = RASTER_MODEL
        body["style"] = "realistic_image"
        body["colors"] = BRAND_COLORS
        body["prompt"] = f"{a.prompt}\n\n{BRAND_STYLE_BASE}"
        if getattr(a, "raster_style_id", None):  # if a raster brand style was created + passed
            body["style_id"] = a.raster_style_id
            body.pop("style", None); body.pop("colors", None)
    # NOTE: Recraft's text_layout schema was rejected in practice (bbox typing) — bake headline/CTA
    # on afterward as a PIL overlay (the repo's established text pattern), not via the image model.
    # Headline/CTA are carried through for the caller to overlay; not sent to Recraft.
    return body


# Meta ad sizes -> nearest Recraft-SUPPORTED size (Recraft rejects arbitrary WxH like 1080x1350).
SIZE_MAP = {"1080x1080": "1024x1024", "1080x1350": "1024x1280", "1080x1920": "1024x1820",
            "1024x1024": "1024x1024", "1024x1280": "1024x1280", "1024x1820": "1024x1820"}


def recraft_curl(body):
    """POST via curl (dodges Recraft's Cloudflare TLS-fingerprint ban). Returns the image URL."""
    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as f:
        json.dump(body, f); payload = f.name
    try:
        out = subprocess.run(
            ["curl", "-sS", "-X", "POST", ENDPOINT,
             "-H", f"Authorization: Bearer {key()}",
             "-H", "Content-Type: application/json",
             "--data", f"@{payload}"],
            capture_output=True, text=True, timeout=180)
    finally:
        os.unlink(payload)
    if out.returncode != 0:
        sys.exit(f"curl failed: {out.stderr[:300]}")
    try:
        d = json.loads(out.stdout)
    except json.JSONDecodeError:
        sys.exit(f"Non-JSON from Recraft (Cloudflare block?): {out.stdout[:300]}")
    if "data" not in d or not d["data"]:
        sys.exit(f"Recraft error: {json.dumps(d)[:400]}")
    return d["data"][0]["url"]


def download(url, out_path):
    # curl (system CA store) — Python's urllib often lacks CA certs on macOS/Homebrew builds.
    Path(out_path).parent.mkdir(parents=True, exist_ok=True)
    r = subprocess.run(["curl", "-sSL", url, "-o", str(out_path)], capture_output=True, text=True)
    if r.returncode != 0 or not Path(out_path).exists():
        sys.exit(f"download failed: {r.stderr[:200]}")


def rasterize_svg(svg_path, png_path):
    """Brand-style output is SVG; rasterize via macOS qlmanage (same as da_lib.py)."""
    subprocess.run(["qlmanage", "-t", "-s", "2048", "-o", str(Path(png_path).parent), str(svg_path)],
                   capture_output=True)
    produced = Path(png_path).parent / (Path(svg_path).name + ".png")
    if produced.exists():
        produced.rename(png_path)


def main():
    ap = argparse.ArgumentParser(description="Generate one Meta ad image via Recraft.")
    ap.add_argument("--prompt", required=True, help="the image subject/scene")
    ap.add_argument("--track", choices=["brand", "raster"], default="raster")
    ap.add_argument("--size", default="1080x1350", help="WIDTHxHEIGHT (1080x1350 | 1080x1080 | 1080x1920)")
    ap.add_argument("--headline", default="", help="on-image headline (top band)")
    ap.add_argument("--cta", default="", help="on-image CTA (bottom band)")
    ap.add_argument("--raster-style-id", dest="raster_style_id", default=os.environ.get("RECRAFT_RASTER_STYLE_ID"),
                    help="a saved raster brand style id (overrides palette/style)")
    ap.add_argument("--out", required=True, help="output PNG path")
    a = ap.parse_args()

    body = build_body(a)
    url = recraft_curl(body)
    if a.track == "brand":
        svg = str(Path(a.out).with_suffix(".svg"))
        download(url, svg)
        rasterize_svg(svg, a.out)
        print(f"OK (brand/SVG->PNG) -> {a.out}")
    else:
        download(url, a.out)
        print(f"OK (raster) -> {a.out}")


if __name__ == "__main__":
    main()
