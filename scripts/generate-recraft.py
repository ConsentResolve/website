#!/usr/bin/env python3
"""
Generate the 9 Consent Resolve illustrations via Recraft API.

Why Recraft (vs OpenAI gpt-image-1):
- vector_illustration style returns SVG (not PNG) — crisp at any size
- `colors` array LOCKS the palette to exact RGB values
- substyles like 'marker' / 'hand_drawn' / 'hand_drawn_outline' match
  our brand voice without needing aggressive prompt enforcement

Reads the API key from a file (never echoed). Default:
  ~/.config/recraft/key   (chmod 600)

Usage:
  python3 scripts/generate-recraft.py               # all 9
  python3 scripts/generate-recraft.py --only=03,07
  python3 scripts/generate-recraft.py --dry-run     # print payloads only
  python3 scripts/generate-recraft.py --substyle=marker
  python3 scripts/generate-recraft.py --substyle=hand_drawn_outline

Substyles to try (vector_illustration):
  marker, hand_drawn, hand_drawn_outline, linocut, line_art, engraving,
  pen_brushstroke, pencil, neon_calligraphy, infantile_sketch

Output: SVGs at public/illustrations/style/{NN}-{slug}.svg
"""
import argparse
import json
import sys
import urllib.request
import urllib.error
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "public" / "illustrations" / "style"

# Locked brand palette — passed to Recraft as RGB array
BRAND_PALETTE = [
    {"rgb": [0, 229, 160]},     # #00E5A0 — primary brand mint/cyan
    {"rgb": [10, 22, 40]},      # #0A1628 — outline, deep navy
    {"rgb": [30, 41, 59]},      # #1E293B — card navy (shadows)
    {"rgb": [248, 250, 252]},   # #F8FAFC — foreground / shine
]

# Prompt body — describes the COMPOSITION and STYLE. Color is enforced
# by the `colors` parameter, not the prompt, so we can drop the
# aggressive color-restriction language we needed for OpenAI.
STYLE_BASE = (
    "Minimalist hand-drawn vector illustration of a single subject, "
    "centered with generous negative space. Hand-inked marker style: "
    "thick, slightly rough, organic outlines of even medium-heavy "
    "weight, with the occasional doubled 'ghost' outline stroke for a "
    "sketched feel. Flat color fills. Each major shape casts ONE flat, "
    "hard-edged offset drop shadow (no blur, no gradient), offset "
    "slightly down and to the right. Rounded, friendly, organic forms "
    "with soft corners. Completely flat shading: no gradients, no "
    "directional lighting, no texture, no 3D. Straight-on 2D "
    "perspective. Modern, confident, trustworthy tone. Transparent "
    "background. NO eyes, NO surveillance camera, NO spying imagery, "
    "NO lettering, NO numbers."
)

SUBJECTS = [
    ("01", "contact-card",    "Real names, real numbers",     "a contact card showing a person icon above a phone handset"),
    ("02", "map-pin",         "Mapped to your zip",           "a single map pin dropping onto a small neighborhood grid"),
    ("03", "speech-wrench",   "Why they're shopping",         "a speech bubble containing a wrench"),
    ("04", "phone-alert",     "On your phone in five",        "a phone handset with three short motion lines and a small upward arrow"),
    ("05", "crm-inbox",       "Lands in your CRM",            "a card sliding on an arrow into an open labeled inbox tray"),
    ("06", "bell-return",     "Return-visit alerts",          "a notification bell with a small circular return-arrow loop around it"),
    ("07", "lead-house-lock", "Yours alone, never resold",    "one lead card linked by a single line to ONE house, sealed with a small padlock"),
    ("08", "shield-doc",      "Audit-ready by default",       "a rounded shield bearing a checkmark, overlapping a document with a wax-style seal in the corner"),
    ("09", "code-clock",      "Set up in ten minutes",        "a code-tag bracket shape next to a small clock"),
]

# 4-step HowItWorks (preview) illustrations — one per node.
# Subjects deliberately avoid faces/eyes (per STYLE_BASE) and lean on
# symbols a contractor reads instantly: unknown visitor → consent →
# reveal → call & close.
HIW_SUBJECTS = [
    ("01", "anonymous-visit",  "Anonymous Visits",      "a friendly cloud-shaped silhouette of a faceless person standing next to a small house, with a single floating question mark symbol above them, suggesting an unidentified visitor"),
    ("02", "say-yes",          "They Say Yes",          "a hand giving a confident thumbs-up next to a small rounded consent dialog card displaying a single large checkmark in its center"),
    ("03", "lead-revealed",    "Warm Lead Revealed",    "a clean rounded contact card with an abstract circular avatar shape at the top and two horizontal lines beneath it for name and number, with two small four-point spark marks rising from the card to suggest the moment of reveal"),
    ("04", "call-and-close",   "You Call & Close",      "a phone handset on the left connected by a single curved arc to two clasped hands forming a handshake on the right, with a small checkmark badge floating just above the handshake"),
]


def load_key(p: Path) -> str:
    if not p.exists():
        sys.exit(f"Key file not found: {p}\nCreate it with:\n  echo YOUR_KEY > {p} && chmod 600 {p}")
    return p.read_text().strip()


def build_prompt(subject: str) -> str:
    return f"Subject: {subject}, arranged center-frame.\n\n{STYLE_BASE}"


def call_recraft(api_key: str, prompt: str, model: str, style: str, substyle: str, size: str, style_id: str = "") -> bytes:
    body = {
        "prompt": prompt,
        "model": model,
        "size": size,
        "n": 1,
        "response_format": "url",
    }
    if style_id:
        # Custom Brand Style — overrides style/substyle/colors
        body["style_id"] = style_id
    else:
        body["style"] = style
        body["colors"] = BRAND_PALETTE
        if substyle:
            body["substyle"] = substyle
    req = urllib.request.Request(
        "https://external.api.recraft.ai/v1/images/generations",
        data=json.dumps(body).encode("utf-8"),
        method="POST",
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=300) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        err = e.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"generation HTTP {e.code}: {err}") from e

    data = payload.get("data") or []
    if not data or "url" not in data[0]:
        raise RuntimeError(f"Unexpected response shape: {payload}")

    url = data[0]["url"]
    try:
        # Some Recraft URLs need a UA header to bypass CDN bot filters
        dl = urllib.request.Request(url, headers={"User-Agent": "consentresolve-illustration-fetch/1.0"})
        with urllib.request.urlopen(dl, timeout=120) as r:
            return r.read()
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"download HTTP {e.code} from {url}: {e.read().decode('utf-8', errors='replace')}") from e


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--key-file", default=str(Path.home() / ".config" / "recraft" / "key"))
    ap.add_argument("--only", default="", help="comma-separated indices to generate")
    ap.add_argument("--model", default="recraftv3", choices=["recraftv3", "recraftv2"])
    ap.add_argument("--style", default="vector_illustration",
                    choices=["vector_illustration", "digital_illustration", "icon"])
    ap.add_argument("--substyle", default="marker",
                    help="substyle slug for the chosen style; see Recraft docs")
    ap.add_argument("--size", default="1024x1024")
    ap.add_argument("--style-id", default="", help="Recraft custom Brand Style UUID; when set, overrides style/substyle/colors")
    ap.add_argument("--set", default="style", choices=["style", "hiw"],
                    help="which subject set: 'style' (9 feature illustrations) or 'hiw' (4 HowItWorks step illustrations)")
    ap.add_argument("--out-dir", default="",
                    help="override output directory; default is public/illustrations/<set>/")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    # Pick subject set + output directory
    subject_set = HIW_SUBJECTS if args.set == "hiw" else SUBJECTS
    out_dir = Path(args.out_dir) if args.out_dir else (
        ROOT / "public" / "illustrations" / ("hiw" if args.set == "hiw" else "style")
    )
    out_dir.mkdir(parents=True, exist_ok=True)

    items = subject_set
    if args.only:
        keep = {x.strip() for x in args.only.split(",") if x.strip()}
        items = [s for s in subject_set if s[0] in keep]
    if not items:
        sys.exit("No items selected.")

    api_key = None if args.dry_run else load_key(Path(args.key_file))

    # vector_illustration outputs SVG; other styles output PNG.
    # When using a custom Brand Style (style_id), we can't know the format
    # ahead of time, so we sniff from the URL extension or content.
    use_style_id = bool(args.style_id)
    default_ext = "svg" if (use_style_id or args.style == "vector_illustration") else "png"

    label = f"style_id={args.style_id[:8]}…" if use_style_id else f"{args.style}/{args.substyle or '—'}"
    print(f"Generating {len(items)} via Recraft ({label})  →  {out_dir.relative_to(ROOT)}")
    for n, slug, feature, subject in items:
        prompt = build_prompt(subject)
        if args.dry_run:
            print(f"\n── {n} {slug} — {feature} ──")
            print(prompt)
            continue
        print(f"  → {n}-{slug} ...", end=" ", flush=True)
        try:
            blob = call_recraft(api_key, prompt, args.model, args.style, args.substyle, args.size, args.style_id)
            # Detect SVG vs PNG by content
            head = blob[:8]
            ext = "svg" if head.startswith(b"<svg") or b"<?xml" in head else ("png" if head.startswith(b"\x89PNG") else default_ext)
            out_path = out_dir / f"{n}-{slug}.{ext}"
            out_path.write_bytes(blob)
            print(f"ok .{ext} ({len(blob) // 1024} KB)")
        except Exception as e:
            print("failed")
            print(f"    {e}")
    print("\nDone.")


if __name__ == "__main__":
    main()
