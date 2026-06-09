#!/usr/bin/env python3
"""Generate Resource Center social/OG images — composite of a Recraft
brand-illustration + a branded template card (navy gradient, mint category
label, white title, Consent Resolve wordmark).

Five variants per resource, at the deterministic paths the social packs and
social.json already reference:
  public/images/resources/<type-seg>/<slug>-featured.png   1200x630   (== og)
  public/images/resources/<type-seg>/<slug>-og.png         1200x630
  public/images/resources/<type-seg>/<slug>-square.png     1080x1080
  public/images/resources/<type-seg>/<slug>-vertical.png   1080x1350
  public/images/resources/<type-seg>/<slug>-thumbnail.png  600x400

The Recraft illustration is cached under scripts/.cache so layout tweaks are
free (no re-billing). Re-fetch with --regen-illustration.

Usage:
  python3 scripts/generate-resource-images.py --only <slug> --variant featured
  python3 scripts/generate-resource-images.py --only <slug>          # all 5
  python3 scripts/generate-resource-images.py                        # all resources
"""
import argparse
import json
import re
import sys
import urllib.request
import urllib.error
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
CONTENT = ROOT / "src" / "content" / "resources"
CACHE = ROOT / "scripts" / ".cache" / "resource-illustrations"
FONTS = ROOT / "scripts" / ".fonts"
KEY_FILE = Path.home() / ".config" / "recraft" / "key"

# Brand palette
NAVY = (10, 22, 40)
NAVY2 = (17, 32, 58)
NAVY3 = (30, 41, 59)
MINT = (0, 229, 160)
WHITE = (248, 250, 252)
MUTED = (148, 163, 184)

BRAND_PALETTE = [
    {"rgb": [0, 229, 160]},
    {"rgb": [10, 22, 40]},
    {"rgb": [30, 41, 59]},
    {"rgb": [248, 250, 252]},
]

TYPE_SEG = {
    "how-to-guide": "how-to-guides",
    "glossary": "glossary",
    "plain-language-explainer": "plain-language-explainers",
    "blog": "blog",
}

# Illustration subject per slug. Brand-locked palette is enforced by the API
# `colors` param, so prompts describe composition only. No faces/eyes/lettering.
SUBJECTS = {
    "rank-google-map-pack-home-services": "a single map pin dropping onto a small neighborhood street grid, with three short stacked ranking bars rising beside it",
    "win-google-local-service-ads": "a rounded verification shield badge with a checkmark, floating just above a simple search bar pill",
    "get-more-leads-from-website-traffic": "a rounded browser window at the top funneling small dots downward through a wide funnel into a clean contact card",
    "identify-anonymous-website-visitors": "a faceless rounded ghost shape on the left transforming along an arrow into a clean labeled contact card on the right, with a small consent checkmark above",
    "stop-losing-jobs-missed-calls": "a phone handset with a downward missed-call arrow turning into an upward chat message bubble beside it",
    "follow-up-with-leads": "a small clock next to a sequence of three rounded chat bubbles and a sealed envelope, suggesting timed follow-up",
    "quote-and-close-more-jobs": "three stacked price-option cards of increasing height (good, better, best) with a small handshake symbol floating above the tallest",
    "get-more-google-reviews": "a row of five rounded stars with a small chat bubble and a short upward arrow beside them",
    "market-to-neighbors-after-every-job": "a short row of three simple house shapes along a street, with a postcard mailer flying toward the neighbor houses",
    "track-where-leads-come-from": "several small source icons on the left connected by branching arrows that converge into a single dollar-sign circle on the right",
    "website-visitor-identification": "a faceless rounded ghost shape resolving along an arrow into a clean labeled contact card, with a small consent checkmark badge",
    "what-consent-first-means": "a large rounded checkmark button inside a small consent dialog card, with a protective shield outline behind it",
    "paying-for-traffic-throwing-it-away": "a wide funnel with small dots leaking out the sides while a few convert into clean contact cards at the bottom, a small dollar sign nearby",
}

# Variant -> (width, height, layout)
VARIANTS = {
    "featured": (1200, 630, "wide"),
    "og": (1200, 630, "wide"),
    "square": (1080, 1080, "square"),
    "vertical": (1080, 1350, "portrait"),
    "thumbnail": (600, 400, "wide"),
}


# ── fonts ────────────────────────────────────────────────────────────────────
def ensure_fonts():
    FONTS.mkdir(parents=True, exist_ok=True)
    targets = {
        "Bricolage.ttf": "https://github.com/google/fonts/raw/main/ofl/bricolagegrotesque/BricolageGrotesque%5Bopsz%2Cwdth%2Cwght%5D.ttf",
        "Hanken.ttf": "https://github.com/google/fonts/raw/main/ofl/hankengrotesk/HankenGrotesk%5Bwght%5D.ttf",
    }
    for name, url in targets.items():
        p = FONTS / name
        if p.exists() and p.stat().st_size > 50000:
            continue
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=60) as r:
            p.write_bytes(r.read())


def load_font(name, size, weight=None):
    candidates = [FONTS / name, Path("/System/Library/Fonts/HelveticaNeue.ttc")]
    for c in candidates:
        try:
            f = ImageFont.truetype(str(c), size)
            if weight is not None:
                try:
                    f.set_variation_by_axes([weight])
                except Exception:
                    try:
                        f.set_variation_by_axes([weight, 100, 12])  # wght,wdth,opsz
                    except Exception:
                        pass
            return f
        except Exception:
            continue
    return ImageFont.load_default()


# ── frontmatter ───────────────────────────────────────────────────────────────
def read_frontmatter(md_path):
    txt = md_path.read_text(encoding="utf-8")
    m = re.search(r"^---\n(.*?)\n---", txt, re.S)
    fm = m.group(1) if m else ""

    def field(key):
        mm = re.search(rf'^{key}:\s*"?(.*?)"?\s*$', fm, re.M)
        return mm.group(1).strip() if mm else ""

    return {
        "title": field("title"),
        "slug": field("slug"),
        "category": field("category"),
        "resource_type": field("resource_type"),
    }


def find_resource(slug):
    for md in CONTENT.rglob("*.md"):
        fm = read_frontmatter(md)
        if fm["slug"] == slug:
            return fm
    return None


def all_resources():
    out = []
    for md in sorted(CONTENT.rglob("*.md")):
        out.append(read_frontmatter(md))
    return out


# ── recraft ───────────────────────────────────────────────────────────────────
def load_key():
    if not KEY_FILE.exists():
        sys.exit(f"Recraft key not found at {KEY_FILE}")
    return KEY_FILE.read_text().strip()


def fetch_illustration(slug, regen=False):
    CACHE.mkdir(parents=True, exist_ok=True)
    cached = CACHE / f"{slug}.png"
    if cached.exists() and not regen:
        return cached
    subject = SUBJECTS.get(slug)
    if not subject:
        sys.exit(f"No illustration subject defined for slug '{slug}'")
    prompt = (
        f"Subject: {subject}, arranged center-frame.\n\n"
        "Minimalist modern flat vector illustration of a single subject, centered "
        "with generous negative space. Clean medium-weight outlines, flat color "
        "fills, friendly rounded organic forms, completely flat shading (no "
        "gradients, no 3D, no texture), straight-on 2D perspective. Confident, "
        "trustworthy, privacy-first SaaS tone. STRICT TWO-COLOR PALETTE: use ONLY "
        "bright teal-green (#00E5A0) and deep navy (#0A1628) on a plain white "
        "background. Absolutely no red, orange, yellow, brown, purple, or any "
        "other color. Navy outlines, teal-green fills. Transparent or plain white "
        "background. NO eyes, NO surveillance camera, NO spying imagery, NO "
        "lettering, NO numbers."
    )
    body = {
        "prompt": prompt,
        "model": "recraftv3",
        "style": "digital_illustration",
        "colors": BRAND_PALETTE,
        "size": "1024x1024",
        "n": 1,
        "response_format": "url",
    }
    req = urllib.request.Request(
        "https://external.api.recraft.ai/v1/images/generations",
        data=json.dumps(body).encode("utf-8"),
        method="POST",
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {load_key()}"},
    )
    print(f"  recraft → {slug} ...", end=" ", flush=True)
    try:
        with urllib.request.urlopen(req, timeout=300) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        sys.exit(f"\nRecraft HTTP {e.code}: {e.read().decode('utf-8', 'replace')}")
    url = payload["data"][0]["url"]
    dl = urllib.request.Request(url, headers={"User-Agent": "consentresolve-img/1.0"})
    with urllib.request.urlopen(dl, timeout=120) as r:
        cached.write_bytes(r.read())
    print(f"ok ({cached.stat().st_size // 1024} KB)")
    return cached


# ── brand palette lock (post-process) ──────────────────────────────────────────
def brandify(img):
    """Snap a generated illustration to the brand palette so stray colors (a red
    map pin, green trees, etc.) can never ship. Deterministic, regardless of what
    Recraft returns:
      - dark pixels            -> navy   (#0A1628)  (outlines, dark fills)
      - bright chromatic pixels-> mint   (#00E5A0)  (any colored fill)
      - bright neutral pixels  -> kept   (white / light gray background)
    Transparency is preserved.
    """
    rgba = img.convert("RGBA")
    arr = np.asarray(rgba).astype(np.uint8)
    rgb = arr[..., :3]
    alpha = arr[..., 3]

    hsv = np.asarray(rgba.convert("RGB").convert("HSV")).astype(np.float32)
    S = hsv[..., 1] / 255.0
    V = hsv[..., 2] / 255.0

    out = rgb.copy()
    dark = V < 0.45
    chroma_bright = (~dark) & (S > 0.15)
    out[dark] = NAVY
    out[chroma_bright] = MINT
    # bright neutrals (background/highlights) are left untouched

    result = np.dstack([out, alpha]).astype(np.uint8)
    return Image.fromarray(result)


# ── compositing ────────────────────────────────────────────────────────────────
def gradient_bg(w, h):
    base = Image.new("RGB", (w, h), NAVY)
    top = Image.new("RGB", (w, h), NAVY3)
    mask = Image.new("L", (w, h))
    md = mask.load()
    for y in range(h):
        for x in range(0, w, 4):
            v = int(((x / w) * 0.6 + (y / h) * 0.4) * 150)
            for dx in range(4):
                if x + dx < w:
                    md[x + dx, y] = v
    base = Image.composite(top, base, mask)
    # mint glow top-right
    glow = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    r = int(w * 0.5)
    gd.ellipse([w - r, -r // 2, w + r // 2, r], fill=(0, 229, 160, 46))
    glow = glow.filter(ImageFilter.GaussianBlur(int(w * 0.06)))
    return Image.alpha_composite(base.convert("RGBA"), glow)


def wrap_text(draw, text, font, max_w):
    words = text.split()
    lines, cur = [], ""
    for word in words:
        trial = (cur + " " + word).strip()
        if draw.textlength(trial, font=font) <= max_w or not cur:
            cur = trial
        else:
            lines.append(cur)
            cur = word
    if cur:
        lines.append(cur)
    return lines


def place_illustration(card, ill, box):
    """Fit illustration into box=(x,y,w,h) preserving aspect, centered."""
    bx, by, bw, bh = box
    im = ill.copy()
    im.thumbnail((bw, bh), Image.LANCZOS)
    ox = bx + (bw - im.width) // 2
    oy = by + (bh - im.height) // 2
    card.alpha_composite(im, (ox, oy))


def round_panel(card, box, radius, fill):
    bx, by, bw, bh = box
    panel = Image.new("RGBA", (bw, bh), (0, 0, 0, 0))
    ImageDraw.Draw(panel).rounded_rectangle([0, 0, bw, bh], radius=radius, fill=fill)
    card.alpha_composite(panel, (bx, by))


def fit_title(draw, title, text_w, avail_h, max_size, min_size):
    """Largest Bricolage size whose wrapped lines fit text_w x avail_h."""
    size = max_size
    while size >= min_size:
        f = load_font("Bricolage.ttf", size, weight=750)
        lines = wrap_text(draw, title, f, text_w)
        line_h = int(size * 1.14)
        widest = max((draw.textlength(ln, font=f) for ln in lines), default=0)
        if widest <= text_w and len(lines) * line_h <= avail_h:
            return f, lines, line_h
        size -= 2
    f = load_font("Bricolage.ttf", min_size, weight=750)
    return f, wrap_text(draw, title, f, text_w), int(min_size * 1.14)


def compose(w, h, layout, title, category, ill, type_label):
    card = gradient_bg(w, h)
    draw = ImageDraw.Draw(card)
    scale = w / 1200.0  # width-based: stable across aspect ratios

    pad = int(64 * scale)
    cat_size = max(12, int(21 * scale))
    mark_size = max(11, int(21 * scale))
    f_cat = load_font("Hanken.ttf", cat_size, weight=700)
    f_mark = load_font("Hanken.ttf", mark_size, weight=700)
    eyebrow = f"{category.upper()}  ·  {type_label.upper()}"

    if layout == "wide":
        text_w = int(w * 0.54) - pad
        ill_box = (int(w * 0.58), int(h * 0.12), int(w * 0.40), int(h * 0.76))
        tx, ty = pad, pad
        title_max = int(58 * scale)
    elif layout == "square":
        text_w = w - 2 * pad
        ill_box = (int(w * 0.14), int(h * 0.05), int(w * 0.72), int(h * 0.40))
        tx, ty = pad, int(h * 0.50)
        title_max = int(66 * scale)
    else:  # portrait
        text_w = w - 2 * pad
        ill_box = (int(w * 0.12), int(h * 0.05), int(w * 0.76), int(h * 0.36))
        tx, ty = pad, int(h * 0.45)
        title_max = int(64 * scale)

    # illustration on a soft rounded panel (contains art regardless of its bg)
    round_panel(card, ill_box, int(28 * scale), (255, 255, 255, 12))
    place_illustration(card, ill, tuple(int(v) for v in (
        ill_box[0] + 14 * scale, ill_box[1] + 14 * scale,
        ill_box[2] - 28 * scale, ill_box[3] - 28 * scale)))

    # eyebrow + mint rule
    draw.text((tx, ty), eyebrow, font=f_cat, fill=MINT)
    rule_y = ty + cat_size + int(14 * scale)
    draw.rounded_rectangle([tx, rule_y, tx + int(48 * scale), rule_y + max(3, int(4 * scale))],
                           radius=2, fill=MINT)

    # wordmark bottom-left (reserve its band so the title auto-fits above it)
    mark_y = h - pad - mark_size
    title_y = rule_y + int(26 * scale)
    avail_h = mark_y - title_y - int(28 * scale)
    f_title, lines, line_h = fit_title(draw, title, text_w, avail_h, title_max, int(26 * scale))
    for i, ln in enumerate(lines):
        draw.text((tx, title_y + i * line_h), ln, font=f_title, fill=WHITE)

    dot_r = int(mark_size * 0.34)
    cy = mark_y + mark_size // 2
    draw.ellipse([tx, cy - dot_r, tx + 2 * dot_r, cy + dot_r], fill=MINT)
    draw.text((tx + 2 * dot_r + int(10 * scale), mark_y), "CONSENT RESOLVE", font=f_mark, fill=WHITE)

    return card.convert("RGB")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", default="", help="single resource slug")
    ap.add_argument("--variant", default="", help="featured|og|square|vertical|thumbnail (default: all)")
    ap.add_argument("--regen-illustration", action="store_true")
    args = ap.parse_args()

    ensure_fonts()

    resources = [find_resource(args.only)] if args.only else all_resources()
    resources = [r for r in resources if r]
    if not resources:
        sys.exit("No matching resource(s).")

    variants = [args.variant] if args.variant else list(VARIANTS.keys())
    type_label_map = {
        "how-to-guide": "How-To Guide", "glossary": "Glossary",
        "plain-language-explainer": "Explainer", "blog": "Article",
    }

    for fm in resources:
        slug = fm["slug"]
        seg = TYPE_SEG[fm["resource_type"]]
        out_dir = ROOT / "public" / "images" / "resources" / seg
        out_dir.mkdir(parents=True, exist_ok=True)
        raw = fetch_illustration(slug, args.regen_illustration)
        brand_path = CACHE / f"{slug}-brand.png"
        if args.regen_illustration or not brand_path.exists():
            brandify(Image.open(raw)).save(brand_path, "PNG")
        ill = Image.open(brand_path).convert("RGBA")
        for v in variants:
            w, h, layout = VARIANTS[v]
            card = compose(w, h, layout, fm["title"], fm["category"], ill,
                           type_label_map[fm["resource_type"]])
            out = out_dir / f"{slug}-{v}.png"
            card.save(out, "PNG")
            print(f"  wrote {out.relative_to(ROOT)} ({w}x{h})")

    print("Done.")


if __name__ == "__main__":
    main()
