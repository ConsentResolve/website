#!/usr/bin/env python3
"""
Generate the 9 Consent Resolve illustrations using OpenAI's Images API.

Reads the API key from a file (never echoed). Default key path:
  ~/.config/openai/key   (chmod 600)

Override with --key-file=/some/other/path

Usage:
  python3 scripts/generate-illustrations.py             # all 9
  python3 scripts/generate-illustrations.py --only=01,03
  python3 scripts/generate-illustrations.py --dry-run   # show prompts only
  python3 scripts/generate-illustrations.py --size=1024x1024 --quality=high

Output: PNGs at public/illustrations/style/{NN}-{slug}.png
"""
import argparse
import base64
import json
import os
import sys
import urllib.request
import urllib.error
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "public" / "illustrations" / "style"

# === Block A — Style Lock (paste verbatim, never modify) ===
STYLE_LOCK = """Minimalist hand-drawn vector illustration of a single subject, centered with
generous negative space, on a fully transparent background (NOT black, NOT a
colored fill). Hand-inked marker style: thick, slightly rough, organic outlines
of even medium-heavy weight in deep navy (#0A1628), with the occasional doubled
"ghost" outline stroke for a sketched feel. Flat color fills from a strict
four-value palette only — primary brand mint/cyan (#00E5A0), card navy
(#1E293B), and almost-white (#F8FAFC) reserved for inner highlights and small
curved "shine" strokes. Each major shape casts ONE flat, hard-edged offset
drop shadow (no blur, no gradient) in the card navy (#1E293B), offset slightly
down and to the right. Rounded, friendly, organic forms with soft corners.
Completely flat shading: no gradients, no directional lighting, no texture,
no 3D. Straight-on 2D perspective. Square 1:1 composition. Modern, confident,
trustworthy tone.

Negative: no black or colored background, no photorealism, no gradients, no
ambient occlusion, no neon, no colors outside the four-color palette above,
no lettering or numbers, no eyes / surveillance-camera / spying imagery."""

# === Block B — Subject library ===
SUBJECTS = [
    ("01", "contact-card",    "Real names, real numbers",     "a contact card showing a person icon above a phone handset"),
    ("02", "map-pin",         "Mapped to your zip",           "a single map pin dropping onto a small neighborhood grid"),
    ("03", "speech-wrench",   "Why they're shopping",         "a speech bubble containing a wrench"),
    ("04", "phone-alert",     "On your phone in five",        "a phone handset with three short motion lines and a small upward arrow"),
    ("05", "crm-inbox",       "Lands in your CRM",            "a card sliding on an arrow into an open labeled inbox tray"),
    ("06", "bell-return",     "Return-visit alerts",          "a notification bell with a small circular return-arrow loop around it"),
    ("07", "lead-house-lock", "Yours alone, never resold",    "one lead card linked by a single line to ONE house, sealed with a small padlock"),
    ("08", "shield-doc",      "Audit-ready by default",       "a rounded shield bearing a checkmark, overlapping a document with a wax-style seal in the corner"),
    ("09", "code-clock",      "Set up in ten minutes",        "a code-tag </> bracket shape next to a small clock"),
]


def load_key(key_path: Path) -> str:
    if not key_path.exists():
        sys.exit(f"Key file not found: {key_path}")
    txt = key_path.read_text().strip()
    if not txt.startswith("sk-"):
        sys.exit("Key file does not look like an OpenAI key (expected to start with 'sk-')")
    return txt


def call_openai(api_key: str, model: str, prompt: str, size: str, quality: str) -> bytes:
    body = {
        "model": model,
        "prompt": prompt,
        "n": 1,
        "size": size,
        "background": "transparent",
        "output_format": "png",
    }
    if quality:
        body["quality"] = quality
    req = urllib.request.Request(
        "https://api.openai.com/v1/images/generations",
        data=json.dumps(body).encode("utf-8"),
        method="POST",
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=180) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {e.code}: {err_body}") from e
    data = payload.get("data") or []
    if not data or "b64_json" not in data[0]:
        raise RuntimeError(f"Unexpected response shape: {payload}")
    return base64.b64decode(data[0]["b64_json"])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--key-file", default=str(Path.home() / ".config" / "openai" / "key"))
    ap.add_argument("--only", default="", help="comma-separated indices to generate (e.g. '01,03')")
    ap.add_argument("--model", default="gpt-image-1")
    ap.add_argument("--size", default="1024x1024")
    ap.add_argument("--quality", default="medium", choices=["low", "medium", "high", "auto", ""])
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    items = SUBJECTS
    if args.only:
        keep = {x.strip() for x in args.only.split(",") if x.strip()}
        items = [s for s in SUBJECTS if s[0] in keep]
    if not items:
        sys.exit("No items selected.")

    api_key = None if args.dry_run else load_key(Path(args.key_file))

    print(f"Generating {len(items)} illustration(s) → {OUT_DIR.relative_to(ROOT)}")
    for n, slug, feature, subject in items:
        prompt = f"{STYLE_LOCK}\n\nSubject: {subject}, arranged center-frame."
        if args.dry_run:
            print(f"\n── {n} {slug} — {feature} ──")
            print(prompt)
            continue
        out_path = OUT_DIR / f"{n}-{slug}.png"
        print(f"  → {n}-{slug} ...", end=" ", flush=True)
        try:
            png = call_openai(api_key, args.model, prompt, args.size, args.quality)
            out_path.write_bytes(png)
            print(f"ok ({len(png) // 1024} KB)")
        except Exception as e:
            print("failed")
            print(f"    {e}")
    print("\nDone.")


if __name__ == "__main__":
    main()
