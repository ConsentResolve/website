#!/usr/bin/env python3
"""
Recraft generator for the v2 "How it works in five" step strip.

Five small illustrations, one per step. Uses the locked Brand Style
(214dccd1-…) so palette + linework match the rest of the site.

Output: public/illustrations/steps/{NN}-{slug}.svg
        — with the canonical Recraft full-canvas white-background path
        stripped so the assets are transparent.
"""
import json
import re
import sys
import urllib.request
import urllib.error
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
KEY = (Path.home() / ".config" / "recraft" / "key").read_text().strip()
OUT_DIR = ROOT / "public" / "illustrations" / "steps"
OUT_DIR.mkdir(parents=True, exist_ok=True)

# Same Brand Style every other site illustration uses.
STYLE_ID = "214dccd1-dca3-43e6-b005-c664e1b33338"

# Each entry: (slug, scene). Service-pro themed: every scene drops a
# subtle trade nod (toolbox, wrench, work-truck, hardhat, ball cap)
# so the strip reads as "for contractors" without spelling it out.
STEPS = [
    (
        "01-homeowner-visit",
        "A homeowner avatar centered inside a stylized rounded browser "
        "window that has three traffic-light dots and a small address "
        "bar pill at the top. The browser window displays a simple "
        "contractor website layout — a small house icon and a wrench "
        "symbol on the page suggesting a service business. Behind the "
        "browser, a faint house silhouette implies the homeowner is "
        "shopping for a trade pro. Square 1:1 composition, centered, "
        "generous margins, transparent background.",
    ),
    (
        "02-we-handle-consent",
        "A rounded cookie-consent dialog card floating center-frame, "
        "with a large shield-checkmark badge stamped prominently on it. "
        "A small toolbox and a hardhat sit at the base of the card to "
        "signal the contractor context. The card has two simple button "
        "shapes at the bottom (no text). Square 1:1 composition, "
        "centered, generous margins, transparent background.",
    ),
    (
        "03-homeowner-accepts",
        "A friendly hand from the right pressing a large rounded "
        "ACCEPT checkmark button on a cookie consent banner card. A "
        "small thumbs-up symbol floats just beside the hand. Behind "
        "the card, a tiny ball cap sits resting on a corner suggesting "
        "the homeowner approved the contractor's site. Square 1:1, "
        "centered, generous margins, transparent background.",
    ),
    (
        "04-feed-to-funnel",
        "A clean rounded contact card with a circular person avatar at "
        "the top and two horizontal lines for name and contact, sliding "
        "on a curved arrow into an open labeled inbox tray. A small "
        "wrench rests beside the tray to signal a trade-business CRM. "
        "Sparks or small motion lines suggest the contact is being "
        "delivered. Square 1:1, centered, generous margins, transparent "
        "background.",
    ),
    (
        "05-more-calls-more-jobs",
        "A friendly service pro in a ball cap and work shirt holding up "
        "a smartphone showing an incoming call notification, with a "
        "warm confident half-smile. A small checkmark badge floats just "
        "above the phone. A tiny work truck with a ladder rack sits in "
        "the lower corner as a soft background prop. Square 1:1, "
        "centered, generous margins, transparent background.",
    ),
]

# Recraft sometimes bakes a full-canvas white rect as the first path
# — strip it so SVGs are truly transparent.
WHITE_BG_PAT = re.compile(
    r'<path[^>]*\bd="M\s*0\s+0[^"]+2048[^"]+z"[^>]*fill="rgb\(255,\s*255,\s*255\)"[^>]*></path>\s*',
    re.IGNORECASE,
)


def call_recraft(prompt: str) -> bytes:
    body = {
        "prompt": prompt,
        "model": "recraftv3",
        "style_id": STYLE_ID,
        "size": "1024x1024",
        "n": 1,
        "response_format": "url",
    }
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
        raise RuntimeError(f"generation HTTP {e.code}: {err}")

    data = payload.get("data") or []
    if not data or "url" not in data[0]:
        raise RuntimeError(f"unexpected response: {payload}")
    url = data[0]["url"]
    dl = urllib.request.Request(url, headers={"User-Agent": "consentresolve-steps-fetch/1.0"})
    with urllib.request.urlopen(dl, timeout=120) as r:
        return r.read()


def main():
    print(f"Generating {len(STEPS)} step illustrations via Recraft (Brand Style {STYLE_ID[:8]}…)")
    for slug, scene in STEPS:
        print(f"  → {slug} ({len(scene)} chars)...", end=" ", flush=True)
        if len(scene) > 1000:
            print(f"SKIP (prompt {len(scene)} > 1000)")
            continue
        try:
            blob = call_recraft(scene)
        except Exception as e:
            print(f"FAILED: {e}")
            continue
        head = blob[:8]
        ext = "svg" if head.startswith(b"<svg") or b"<?xml" in head else "png"
        if ext == "svg":
            text = blob.decode("utf-8")
            new, n = WHITE_BG_PAT.subn("", text, count=1)
            if n:
                blob = new.encode("utf-8")
        out = OUT_DIR / f"{slug}.{ext}"
        out.write_bytes(blob)
        size_kb = len(blob) // 1024
        print(f"ok .{ext} ({size_kb} KB){'  [bg stripped]' if ext == 'svg' and n else ''}")


if __name__ == "__main__":
    main()
