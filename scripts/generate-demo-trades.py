#!/usr/bin/env python3
"""
Generate realistic hero photos for the live-demo sample site — one per trade.
Distinct from the locked brand illustrations (this is photoreal, not vector).

Output: public/demo/trades/<slug>.png   (raster, ~landscape)

Usage:
  python3 scripts/generate-demo-trades.py
  python3 scripts/generate-demo-trades.py --only=plumber,hvac
  python3 scripts/generate-demo-trades.py --dry-run
"""
import argparse, json, sys, urllib.request, urllib.error
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "demo" / "trades"

SUFFIX = (", photorealistic, candid professional at work, natural daylight, clean bright composition, "
          "residential setting, shallow depth of field, friendly and trustworthy, "
          "no text, no words, no watermark, no logos")

TRADES = {
    "general-contractor": "a professional general contractor in a hard hat reviewing blueprints at a residential home renovation site",
    "handyman":           "a friendly handyman wearing a tool belt repairing a cabinet inside a bright modern home",
    "tree-removal":       "a tree service professional in safety gear using a chainsaw to trim a large tree in a suburban backyard",
    "hvac":               "an HVAC technician in uniform servicing an outdoor air conditioning condenser unit beside a house on a sunny day",
    "plumber":            "a professional plumber in uniform fixing pipes under a kitchen sink in a modern home",
    "locksmith":          "a locksmith installing a deadbolt lock on a residential front door",
    "electrician":        "an electrician in uniform safely working on a home electrical panel",
    "roofing":            "a roofer installing asphalt shingles on a suburban house roof under a clear blue sky",
    "painter":            "a professional painter rolling fresh paint onto an interior wall of a bright home",
    "deck-fence":         "a carpenter building a wooden backyard deck on a sunny day",
    "garage-door":        "a technician repairing a residential sectional garage door",
    "appliance-repair":   "an appliance repair technician fixing a front-load washing machine in a home kitchen",
    "house-cleaning":     "a professional house cleaner wiping a kitchen counter in a bright tidy home",
    "pest-control":       "a pest control technician in uniform spraying along the exterior foundation of a house",
    "power-washing":      "a worker power washing a residential driveway with a pressure washer, water spray and mist",
    "lawn-care":          "a lawn care professional mowing a lush green suburban front lawn on a sunny day",
    "mobile-car-service": "a mobile mechanic in uniform working on a car engine in a residential driveway",
}

def load_key(p: Path) -> str:
    if not p.exists():
        sys.exit(f"Key file not found: {p}")
    return p.read_text().strip()

def gen(api_key, prompt, size):
    body = {"prompt": prompt, "model": "recraftv3", "style": "realistic_image", "size": size, "n": 1, "response_format": "url"}
    req = urllib.request.Request("https://external.api.recraft.ai/v1/images/generations",
        data=json.dumps(body).encode(), method="POST",
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {api_key}"})
    with urllib.request.urlopen(req, timeout=300) as resp:
        payload = json.loads(resp.read().decode())
    url = payload["data"][0]["url"]
    dl = urllib.request.Request(url, headers={"User-Agent": "cr-demo-fetch/1.0"})
    with urllib.request.urlopen(dl, timeout=180) as r:
        return r.read()

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--key-file", default=str(Path.home() / ".config" / "recraft" / "key"))
    ap.add_argument("--only", default="")
    ap.add_argument("--size", default="1365x1024")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    OUT.mkdir(parents=True, exist_ok=True)
    items = TRADES
    if args.only:
        keep = {x.strip() for x in args.only.split(",")}
        items = {k: v for k, v in TRADES.items() if k in keep}

    api_key = None if args.dry_run else load_key(Path(args.key_file))
    ok, fail = 0, 0
    for slug, subj in items.items():
        prompt = subj + SUFFIX
        if args.dry_run:
            print(f"[dry] {slug}: {prompt[:90]}…"); continue
        try:
            data = gen(api_key, prompt, args.size)
            (OUT / f"{slug}.png").write_bytes(data)
            print(f"✓ {slug}.png ({len(data)//1024} KB)"); ok += 1
        except urllib.error.HTTPError as e:
            print(f"✗ {slug}: HTTP {e.code} {e.read().decode(errors='replace')[:200]}"); fail += 1
        except Exception as e:
            print(f"✗ {slug}: {e}"); fail += 1
    print(f"done: {ok} ok, {fail} failed → {OUT}")

if __name__ == "__main__":
    main()
