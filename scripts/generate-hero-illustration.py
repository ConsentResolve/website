#!/usr/bin/env python3
"""
One-off Recraft generator for the v2 hero illustration.

Uses the LOCKED brand Style ID — same one driving every other site
illustration (features, trades, HowItWorks). The Brand Style fixes palette,
linework, substyle, and shading; only the prompt SCENE changes.

Output: public/illustrations/hero/protagonist.{svg|png}
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

# Locked Consent Resolve brand style — same one used by every other
# Recraft-generated illustration on the site. When style_id is set,
# Recraft ignores style/substyle/colors and renders in this brand.
STYLE_ID = "214dccd1-dca3-43e6-b005-c664e1b33338"

PROMPT = (
    "A friendly service pro in his 30s, ball cap, work shirt, tool belt, "
    "stands beside a work truck with a ladder rack — mid-stride to the "
    "driver's door, holding up a smartphone with a confident half-smile. "
    "The phone screen shows a lead card built from icons only: a round "
    "person avatar, a phone handset, a map pin, a checkmark badge. "
    "Floating beside the phone, a faceless silhouette transforming from "
    "a dim desaturated tone into bright brand color — the recovered "
    "lead. Far background, small and faint: two faceless silhouettes "
    "drift off the edge of a browser-window shape — the bounce. A low "
    "sunrise arc rises behind the truck. Protagonist large and "
    "dominant, background tiny. Square 1:1 with generous margins.\n\n"
    "Negative: no text, no numbers, no surveillance imagery, no "
    "magnifying glass on a person, faceless figures stay faceless, "
    "only the protagonist has a face, no logos."
)


def main():
    body = {
        "prompt": PROMPT,
        "model": "recraftv3",
        # Locked brand Style ID — same one every other site illustration
        # uses. Overrides style/substyle/colors with the saved Brand Style.
        "style_id": STYLE_ID,
        "size": "1024x1024",
        "n": 1,
        "response_format": "url",
    }
    print(f"→ POST Recraft (Brand Style {STYLE_ID[:8]}…)...", flush=True)
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
