#!/usr/bin/env python3
"""Resource Center image system v2 — hook-led cards, real logo, two layers.

LAYER A (AI / provider): text-free, logo-free brand line-art background.
  Reused from the cached illustration if present (scripts/.cache), else fetched
  from Recraft with a text-free prompt and cached as <slug>-bg.png. Rendered as
  mint "ink" on transparent and placed on the RIGHT, leaving the left clear.

LAYER B (deterministic, authoritative for ALL text + logo): navy background +
  green glow + inner mint frame, eyebrow, the HOOK (not the title; numbers
  highlighted mint), optional headline + CTA pill, and the REAL logo asset from
  public/brand/. The AI never renders text or the logo.

Per-format treatment (spec §3):
  featured/og 1200x630 : eyebrow + hook only           · logo light, bottom-left
  square      1080x1080: eyebrow + hook + headline + CTA · logo light, top-left
  vertical    1080x1350: eyebrow + hook + headline, CTA bottom · logo light, top-left
  thumbnail   600x400  : hook only (condensed)          · mark, top-left

Usage:
  python3 scripts/generate-resource-images.py --only <slug> --variant featured
  python3 scripts/generate-resource-images.py --only <slug>      # all 5
  python3 scripts/generate-resource-images.py                    # all resources
"""
import argparse
import glob
import json
import os
import re
import subprocess
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
BRAND = ROOT / "public" / "brand"
KEY_FILE = Path.home() / ".config" / "recraft" / "key"

NAVY = (10, 22, 40)
NAVY3 = (30, 41, 59)
MINT = (0, 229, 160)
WHITE = (248, 250, 252)
MUTED = (148, 163, 184)
BRAND_PALETTE = [{"rgb": [0, 229, 160]}, {"rgb": [10, 22, 40]}, {"rgb": [30, 41, 59]}, {"rgb": [248, 250, 252]}]

TYPE_SEG = {
    "how-to-guide": "how-to-guides",
    "glossary": "glossary",
    "plain-language-explainer": "plain-language-explainers",
    "blog": "blog",
}
TYPE_LABEL = {
    "how-to-guide": "How-To Guide", "glossary": "Glossary",
    "plain-language-explainer": "Explainer", "blog": "Article",
}

# Layer A visual metaphors (text-free, logo-free). Reused subjects from v1.
SUBJECTS = {
    "rank-google-map-pack-home-services": "a single map pin over a small neighborhood street grid with three stacked ranking bars",
    "win-google-local-service-ads": "a verification shield badge with a checkmark above a simple search bar pill",
    "get-more-leads-from-website-traffic": "a browser window funneling small dots downward through a wide funnel into a contact card",
    "identify-anonymous-website-visitors": "a faceless ghost shape transforming along an arrow into a labeled contact card with a small consent checkmark",
    "stop-losing-jobs-missed-calls": "a phone handset with a downward missed-call arrow turning into an upward chat bubble",
    "follow-up-with-leads": "a clock beside a sequence of three chat bubbles and a sealed envelope",
    "quote-and-close-more-jobs": "three stacked price-option cards of increasing height with a handshake above the tallest",
    "get-more-google-reviews": "a row of five stars with a chat bubble and a short upward arrow",
    "market-to-neighbors-after-every-job": "a short row of house shapes along a street with a postcard mailer flying toward them",
    "track-where-leads-come-from": "source icons connected by branching arrows converging into a dollar-sign circle",
    "website-visitor-identification": "a faceless ghost shape resolving along an arrow into a labeled contact card with a consent checkmark badge",
    "what-consent-first-means": "a large rounded checkmark button in a consent dialog card with a shield behind it",
    "paying-for-traffic-throwing-it-away": "a wide funnel leaking dots out the sides while a few convert into contact cards, a dollar sign nearby",
}

# Trade theming — reuse existing brand trade motifs; only the right-side art +
# the eyebrow tag change. Label shown as "FOR {LABEL}"; motif is a text-free
# Recraft line-art cached once per trade and reused across all resources.
TRADE_LABEL = {
    "plumber": "PLUMBERS", "roofing": "ROOFERS", "hvac": "HVAC PROS",
    "electrician": "ELECTRICIANS", "general-contractor": "CONTRACTORS",
    "handyman": "HANDYMEN", "painter": "PAINTERS", "lawn-care": "LAWN PROS",
    "pest-control": "PEST PROS", "garage-door": "GARAGE DOOR PROS",
    "power-washing": "POWER WASHERS", "house-cleaning": "CLEANERS",
}
TRADE_MOTIF = {
    "plumber": "a curved metal pipe gripped by a wrench with a single water droplet below",
    "roofing": "a triangular pitched roof with rows of overlapping shingles and a small chimney",
    "hvac": "an outdoor air-conditioner condenser unit beside a round thermostat dial",
    "electrician": "a wall electrical outlet with a small lightning bolt above it",
    "general-contractor": "a house outline beside a hardhat and a rolled blueprint",
    "handyman": "an open toolbox with a hammer, screwdriver, and wrench",
    "painter": "a paint roller leaning on an open paint can with a brush",
    "lawn-care": "a push lawn mower with two grass blades in front",
    "pest-control": "a stylized bug shape with a spray nozzle aimed at it",
    "garage-door": "a half-raised sectional garage door with a remote beside it",
    "power-washing": "a pressure-washer wand with three angled jet-spray lines",
    "house-cleaning": "a spray bottle and feather duster crossed with sparkle marks",
}

# variant -> (w, h, layout, logo_variant, logo_h_px@base, logo_pos, margin_px@base)
VARIANTS = {
    "featured": (1200, 630, "wide", "light", 44, "bl", 64),
    "og": (1200, 630, "wide", "light", 44, "bl", 64),
    "square": (1080, 1080, "square", "light", 52, "tl", 72),
    "vertical": (1080, 1350, "portrait", "light", 56, "tl", 72),
    "thumbnail": (600, 400, "thumb", "mark", 40, "tl", 32),
}


# ── fonts ───────────────────────────────────────────────────────────────────
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
    try:
        f = ImageFont.truetype(str(FONTS / name), size)
        if weight is not None:
            try:
                f.set_variation_by_axes([weight])
            except Exception:
                try:
                    f.set_variation_by_axes([weight, 100, 12])
                except Exception:
                    pass
        return f
    except Exception:
        return ImageFont.load_default()


# ── frontmatter ───────────────────────────────────────────────────────────────
def read_frontmatter(md_path):
    txt = md_path.read_text(encoding="utf-8")
    m = re.search(r"^---\n(.*?)\n---", txt, re.S)
    fm = m.group(1) if m else ""

    def field(key):
        mm = re.search(rf'^{key}:\s*"?(.*?)"?\s*$', fm, re.M)
        return mm.group(1).strip() if mm else ""

    excerpt = field("excerpt")
    return {
        "title": field("title"),
        "slug": field("slug"),
        "category": field("category"),
        "resource_type": field("resource_type"),
        "og_hook": field("og_hook"),
        "social_headline": field("social_headline"),
        "cta_text": field("cta_text") or "Read the guide →",
        "excerpt": excerpt,
    }


def find_resource(slug):
    for md in CONTENT.rglob("*.md"):
        fm = read_frontmatter(md)
        if fm["slug"] == slug:
            return fm
    return None


def all_resources():
    return [read_frontmatter(md) for md in sorted(CONTENT.rglob("*.md"))]


def hook_for(fm):
    if fm["og_hook"]:
        return fm["og_hook"]
    # Fallback for resources without og_hook yet: first sentence of the excerpt.
    m = re.match(r"^.*?[.!?](\s|$)", fm["excerpt"])
    return (m.group(0) if m else fm["excerpt"]).strip()


# ── Layer A: background art ─────────────────────────────────────────────────────
def load_key():
    if not KEY_FILE.exists():
        sys.exit(f"Recraft key not found at {KEY_FILE}")
    return KEY_FILE.read_text().strip()


def fetch_background(slug):
    """Text-free, logo-free background art. Cached as <slug>-bg.png."""
    CACHE.mkdir(parents=True, exist_ok=True)
    bg = CACHE / f"{slug}-bg.png"
    if bg.exists():
        return bg
    # Reuse the v1 text-free line-art if present (no re-bill).
    legacy = CACHE / f"{slug}.png"
    if legacy.exists():
        return legacy
    subject = SUBJECTS.get(slug, "an abstract privacy-first data motif")
    prompt = (
        f"Abstract on-brand background illustration for a SaaS social card. "
        f"Subject: {subject}. Flat minimal line-art on a plain white background, "
        f"bright mint green (#00E5A0) and deep navy (#0A1628) only, lots of "
        f"negative space. NO text, NO words, NO letters, NO logos, NO watermarks, "
        f"NO UI elements. Composition weighted to the RIGHT; left side empty."
    )
    body = {"prompt": prompt, "model": "recraftv3", "style": "digital_illustration",
            "colors": BRAND_PALETTE, "size": "1024x1024", "n": 1, "response_format": "url"}
    req = urllib.request.Request(
        "https://external.api.recraft.ai/v1/images/generations",
        data=json.dumps(body).encode("utf-8"), method="POST",
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {load_key()}"})
    print(f"  recraft bg → {slug} ...", end=" ", flush=True)
    with urllib.request.urlopen(req, timeout=300) as resp:
        payload = json.loads(resp.read().decode("utf-8"))
    url = payload["data"][0]["url"]
    dl = urllib.request.Request(url, headers={"User-Agent": "consentresolve-img/1.0"})
    with urllib.request.urlopen(dl, timeout=120) as r:
        bg.write_bytes(r.read())
    print("ok")
    return bg


# The website's master illustration prompt (from scripts/generate-recraft.py
# STYLE_BASE) — marker / hand-drawn, flat fills, one offset shadow, on white.
SITE_STYLE_BASE = (
    "Minimalist hand-drawn vector illustration of a single subject, centered "
    "with generous negative space. Hand-inked marker style: thick, slightly "
    "rough, organic outlines of even medium-heavy weight, with the occasional "
    "doubled 'ghost' outline stroke for a sketched feel. Flat color fills. Each "
    "major shape casts ONE flat, hard-edged offset drop shadow (no blur, no "
    "gradient), offset slightly down and to the right. Rounded, friendly, "
    "organic forms with soft corners. Completely flat shading: no gradients, no "
    "directional lighting, no texture, no 3D. Straight-on 2D perspective. "
    "Modern, confident, trustworthy tone. Plain white background. NO eyes, NO "
    "surveillance camera, NO spying imagery, NO lettering, NO numbers."
)


TRADE_SVG_DIR = ROOT / "public" / "illustrations" / "trades"


def real_trade_art(trade):
    """Rasterize the ACTUAL site trade illustration SVG (closest possible match
    to the website look) via macOS Quick Look. Returns PIL RGBA, or None."""
    cache = CACHE / f"trade-{trade}-real.png"
    if cache.exists():
        return Image.open(cache).convert("RGBA")
    matches = sorted(glob.glob(str(TRADE_SVG_DIR / f"*-{trade}.svg")))
    if not matches:
        return None
    tmp = CACHE / "_ql"
    tmp.mkdir(parents=True, exist_ok=True)
    for f in glob.glob(str(tmp / "*.png")):
        os.remove(f)
    subprocess.run(["qlmanage", "-t", "-s", "2048", "-o", str(tmp), matches[0]],
                   capture_output=True)
    pngs = glob.glob(str(tmp / "*.png"))
    if not pngs:
        return None
    img = Image.open(pngs[0]).convert("RGBA")
    img.save(cache)
    return img


def trim_knockout(img, thresh=244):
    """Knock the near-white background out to transparent and crop to content,
    so the navy-outlined illustration sits cleanly on a light inset."""
    arr = np.asarray(img.convert("RGBA")).astype(np.uint8)
    rgb = arr[..., :3]
    near_white = (rgb[..., 0] >= thresh) & (rgb[..., 1] >= thresh) & (rgb[..., 2] >= thresh)
    a = arr[..., 3].copy()
    a[near_white] = 0
    im = Image.fromarray(np.dstack([rgb, a]))
    bbox = im.getbbox()
    return im.crop(bbox) if bbox else im


def brand_snap(img):
    """Lock a generated illustration to the 4 brand colors for NATIVE-color
    display on a light card: dark->navy, bright chromatic->mint, light kept."""
    rgba = img.convert("RGBA")
    arr = np.asarray(rgba).astype(np.uint8)
    rgb, alpha = arr[..., :3].copy(), arr[..., 3]
    hsv = np.asarray(rgba.convert("RGB").convert("HSV")).astype(np.float32)
    S, V = hsv[..., 1] / 255.0, hsv[..., 2] / 255.0
    dark = V < 0.45
    rgb[dark] = NAVY
    rgb[(~dark) & (S > 0.15)] = MINT
    return Image.fromarray(np.dstack([rgb, alpha]))


def render_ink(img, color=MINT, max_alpha=230, gamma=1.15):
    """Brand line-art -> mint 'ink' on transparent: dark pixels become opaque
    mint, white background becomes transparent. So it sits cleanly on navy."""
    g = np.asarray(img.convert("L")).astype(np.float32) / 255.0  # 0=dark .. 1=white
    a = np.power(np.clip(1.0 - g, 0, 1), gamma) * max_alpha
    a = a.astype(np.uint8)
    h, w = a.shape
    rgb = np.zeros((h, w, 3), np.uint8)
    rgb[..., 0], rgb[..., 1], rgb[..., 2] = color
    return Image.fromarray(np.dstack([rgb, a]))


# ── Layer B: deterministic compositor ───────────────────────────────────────────
def gradient_bg(w, h):
    base = Image.new("RGB", (w, h), NAVY)
    top = Image.new("RGB", (w, h), NAVY3)
    mask = Image.new("L", (w, h))
    md = mask.load()
    for y in range(h):
        for x in range(0, w, 4):
            v = int(((x / w) * 0.55 + (y / h) * 0.45) * 130)
            for dx in range(4):
                if x + dx < w:
                    md[x + dx, y] = v
    base = Image.composite(top, base, mask).convert("RGBA")
    glow = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    ImageDraw.Draw(glow).ellipse([int(w * 0.5), int(-h * 0.4), int(w * 1.15), int(h * 0.6)], fill=(0, 229, 160, 40))
    glow = glow.filter(ImageFilter.GaussianBlur(int(w * 0.07)))
    base = Image.alpha_composite(base, glow)
    # inner frame stroke
    fr = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    m = int(w * 0.02)
    ImageDraw.Draw(fr).rounded_rectangle([m, m, w - m, h - m], radius=int(w * 0.02),
                                         outline=(0, 229, 160, 46), width=max(1, int(w / 600)))
    return Image.alpha_composite(base, fr)


def load_logo(variant):
    name = {"light": "logo-light", "dark": "logo-dark", "mark": "mark"}.get(variant, "logo-light")
    for cand in (BRAND / f"{name}.png", BRAND / "logo-light.png"):
        if cand.exists():
            return Image.open(cand).convert("RGBA")
    return None


def place_logo(card, variant, height, pos, margin):
    logo = load_logo(variant)
    if not logo:
        return
    ratio = height / logo.height
    logo = logo.resize((max(1, int(logo.width * ratio)), height), Image.LANCZOS)
    W, H = card.size
    x = margin if pos in ("tl", "bl") else W - margin - logo.width
    y = margin if pos in ("tl", "tr") else H - margin - logo.height
    card.alpha_composite(logo, (x, y))


def place_ink(card, ink, box):
    bx, by, bw, bh = box
    im = ink.copy()
    im.thumbnail((bw, bh), Image.LANCZOS)
    card.alpha_composite(im, (bx + (bw - im.width) // 2, by + (bh - im.height) // 2))


def place_art(card, art, box, mode):
    """mode 'ink' = mint silhouette directly on navy (default v2 look).
       mode 'card' = native-color illustration on a soft white rounded inset
       (matches how the website presents its illustrations)."""
    if mode != "card":
        place_ink(card, art, box)
        return
    bx, by, bw, bh = box
    pad = int(min(bw, bh) * 0.10)
    panel = Image.new("RGBA", (bw, bh), (0, 0, 0, 0))
    ImageDraw.Draw(panel).rounded_rectangle([0, 0, bw, bh], radius=int(min(bw, bh) * 0.10),
                                            fill=(248, 250, 252, 255))
    card.alpha_composite(panel, (bx, by))
    im = art.copy()
    im.thumbnail((bw - 2 * pad, bh - 2 * pad), Image.LANCZOS)
    card.alpha_composite(im, (bx + (bw - im.width) // 2, by + (bh - im.height) // 2))


def is_number_token(tok):
    return bool(re.search(r"\d", tok))


def layout_words(draw, text, font, max_w):
    """Wrap into lines; each word tagged base/hi (numbers highlighted)."""
    space = draw.textlength(" ", font=font)
    lines, cur, curw = [], [], 0.0
    for word in text.split():
        ww = draw.textlength(word, font=font)
        add = ww + (space if cur else 0)
        if cur and curw + add > max_w:
            lines.append(cur)
            cur, curw = [], 0.0
            add = ww
        cur.append((word, is_number_token(word)))
        curw += add
    if cur:
        lines.append(cur)
    return lines


def draw_hook(draw, x, y, lines, font, line_h):
    space = draw.textlength(" ", font=font)
    for li, line in enumerate(lines):
        cx = x
        for word, hi in line:
            draw.text((cx, y + li * line_h), word, font=font, fill=MINT if hi else WHITE)
            cx += draw.textlength(word, font=font) + space


def fit_hook(draw, hook, text_w, avail_h, max_size, min_size):
    size = max_size
    while size >= min_size:
        f = load_font("Bricolage.ttf", size, weight=800)
        lines = layout_words(draw, hook, f, text_w)
        line_h = int(size * 1.12)
        widest = 0
        for line in lines:
            w = sum(draw.textlength(wd, font=f) for wd, _ in line) + draw.textlength(" ", font=f) * (len(line) - 1)
            widest = max(widest, w)
        if widest <= text_w and len(lines) * line_h <= avail_h:
            return f, lines, line_h
        size -= 3
    f = load_font("Bricolage.ttf", min_size, weight=800)
    return f, layout_words(draw, hook, f, text_w), int(min_size * 1.12)


def eyebrow_text(fm, trade_label=""):
    if trade_label:
        # Lead with the trade; drop the type label to keep the line short.
        return f"FOR {trade_label}  ·  {fm['category'].upper()}"
    return f"{fm['category'].upper()}  ·  {TYPE_LABEL.get(fm['resource_type'], '').upper()}"


def fetch_trade_bg(trade, site=False):
    """Trade motif illustration, cached once and reused across resources.
    site=True uses the website's STYLE_BASE master prompt (marker / hand-drawn,
    native brand colors on white) for a site-matched look."""
    CACHE.mkdir(parents=True, exist_ok=True)
    p = CACHE / (f"trade-{trade}-site.png" if site else f"trade-{trade}-bg.png")
    if p.exists():
        return p
    subject = TRADE_MOTIF.get(trade)
    if not subject:
        sys.exit(f"No TRADE_MOTIF for '{trade}'")
    if site:
        prompt = f"Subject: {subject}, arranged center-frame.\n\n{SITE_STYLE_BASE}"
    else:
        prompt = (
            f"Abstract on-brand background illustration for a SaaS social card. "
            f"Subject: {subject}. Flat minimal line-art on a plain white background, "
            f"bright mint green (#00E5A0) and deep navy (#0A1628) only, lots of "
            f"negative space. NO text, NO words, NO letters, NO logos, NO watermarks, "
            f"NO UI elements. Composition weighted to the RIGHT; left side empty."
        )
    body = {"prompt": prompt, "model": "recraftv3", "style": "digital_illustration",
            "colors": BRAND_PALETTE, "size": "1024x1024", "n": 1, "response_format": "url"}
    req = urllib.request.Request(
        "https://external.api.recraft.ai/v1/images/generations",
        data=json.dumps(body).encode("utf-8"), method="POST",
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {load_key()}"})
    print(f"  recraft trade → {trade} ...", end=" ", flush=True)
    with urllib.request.urlopen(req, timeout=300) as resp:
        payload = json.loads(resp.read().decode("utf-8"))
    url = payload["data"][0]["url"]
    dl = urllib.request.Request(url, headers={"User-Agent": "consentresolve-img/1.0"})
    with urllib.request.urlopen(dl, timeout=120) as r:
        p.write_bytes(r.read())
    print("ok")
    return p


def compose(variant, fm, art, trade_label="", art_mode="ink"):
    w, h, layout, logo_variant, logo_h_base, logo_pos, margin_base = VARIANTS[variant]
    scale = w / 1200.0
    card = gradient_bg(w, h)
    draw = ImageDraw.Draw(card)
    pad = int(margin_base * scale) if layout != "wide" else 64
    if layout == "wide":
        pad = 64
    logo_h = int(logo_h_base * scale) if layout != "wide" else logo_h_base
    margin = int(margin_base) if layout == "wide" else int(margin_base * scale)

    cat_size = max(12, int(20 * scale))
    f_cat = load_font("Hanken.ttf", cat_size, weight=700)
    hook = hook_for(fm)
    headline = fm["social_headline"] or fm["title"]

    if layout == "wide":
        # art on the right; text on the left
        place_art(card, art, (int(w * 0.60), int(h * 0.16), int(w * 0.34), int(h * 0.68)), art_mode)
        tx = pad
        ey = pad
        text_w = int(w * 0.55) - pad
        # eyebrow + rule
        draw.text((tx, ey), eyebrow_text(fm, trade_label), font=f_cat, fill=MINT)
        ry = ey + cat_size + int(12 * scale)
        draw.rounded_rectangle([tx, ry, tx + int(50 * scale), ry + max(3, int(4 * scale))], radius=2, fill=MINT)
        # hook fills the band between eyebrow and the logo
        logo_top = h - margin - logo_h
        hook_top = ry + int(26 * scale)
        f_hook, lines, lh = fit_hook(draw, hook, text_w, logo_top - hook_top - int(24 * scale), int(72 * scale), int(30 * scale))
        draw_hook(draw, tx, hook_top, lines, f_hook, lh)
        place_logo(card, logo_variant, logo_h, "bl", margin)

    elif layout == "thumb":
        place_art(card, art, (int(w * 0.58), int(h * 0.20), int(w * 0.36), int(h * 0.60)), art_mode)
        place_logo(card, "mark", logo_h, "tl", margin)
        tx = margin
        top = margin + logo_h + int(14 * scale)
        text_w = int(w * 0.56)
        f_hook, lines, lh = fit_hook(draw, hook, text_w, h - top - margin, int(40 * scale), int(20 * scale))
        draw_hook(draw, tx, top, lines, f_hook, lh)

    else:  # square / portrait — logo top, then eyebrow, hook, headline, CTA
        place_logo(card, logo_variant, logo_h, "tl", margin)
        # subtle art lower-right
        if layout == "square":
            place_art(card, art, (int(w * 0.46), int(h * 0.50), int(w * 0.46), int(h * 0.34)), art_mode)
        else:
            place_art(card, art, (int(w * 0.40), int(h * 0.40), int(w * 0.52), int(h * 0.30)), art_mode)
        tx = margin
        ey = margin + logo_h + int(26 * scale)
        text_w = w - 2 * margin
        draw.text((tx, ey), eyebrow_text(fm, trade_label), font=f_cat, fill=MINT)
        ry = ey + cat_size + int(12 * scale)
        draw.rounded_rectangle([tx, ry, tx + int(50 * scale), ry + max(3, int(4 * scale))], radius=2, fill=MINT)
        hook_top = ry + int(26 * scale)
        f_hook, lines, lh = fit_hook(draw, hook, text_w, int(h * 0.34), int(74 * scale), int(34 * scale))
        draw_hook(draw, tx, hook_top, lines, f_hook, lh)
        hl_y = hook_top + len(lines) * lh + int(22 * scale)
        f_hl = load_font("Hanken.ttf", int(30 * scale), weight=600)
        hl_lines = layout_words(draw, headline, f_hl, text_w)
        for i, line in enumerate(hl_lines[:3]):
            draw.text((tx, hl_y + i * int(38 * scale)), " ".join(wd for wd, _ in line), font=f_hl, fill=MUTED)
        # CTA pill
        cta = fm["cta_text"]
        f_cta = load_font("Hanken.ttf", int(24 * scale), weight=700)
        cw = draw.textlength(cta, font=f_cta)
        pill_w = int(cw + 44 * scale)
        pill_h = int(54 * scale)
        cta_y = h - margin - pill_h if layout == "portrait" else hl_y + len(hl_lines[:3]) * int(38 * scale) + int(26 * scale)
        draw.rounded_rectangle([tx, cta_y, tx + pill_w, cta_y + pill_h], radius=pill_h // 2, fill=MINT)
        draw.text((tx + int(22 * scale), cta_y + (pill_h - int(24 * scale)) // 2 - int(2 * scale)), cta, font=f_cta, fill=NAVY)

    return card.convert("RGB")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", default="")
    ap.add_argument("--variant", default="")
    ap.add_argument("--trade", default="", help="trade slug for themed social variants (e.g. plumber, roofing)")
    ap.add_argument("--site-style", action="store_true",
                    help="render the art in the website's marker style (native brand colors on a white inset) instead of mint ink")
    ap.add_argument("--preview", action="store_true",
                    help="write to scripts/.preview/ instead of public/ (for A/B review, not deploy)")
    args = ap.parse_args()
    ensure_fonts()

    trade_label = ""
    if args.trade:
        if args.trade not in TRADE_MOTIF:
            sys.exit(f"Unknown trade '{args.trade}'. Known: {', '.join(sorted(TRADE_MOTIF))}")
        trade_label = TRADE_LABEL.get(args.trade, args.trade.upper())

    art_mode = "card" if args.site_style else "ink"
    resources = [find_resource(args.only)] if args.only else all_resources()
    resources = [r for r in resources if r]
    if not resources:
        sys.exit("No matching resource(s).")
    variants = [args.variant] if args.variant else list(VARIANTS.keys())

    for fm in resources:
        slug = fm["slug"]
        seg = TYPE_SEG[fm["resource_type"]]
        if args.preview:
            out_dir = ROOT / "scripts" / ".preview" / seg
        else:
            out_dir = ROOT / "public" / "images" / "resources" / seg
        out_dir.mkdir(parents=True, exist_ok=True)
        if args.site_style and args.trade:
            # Closest match: the ACTUAL site trade SVG, rasterized + knocked out.
            real = real_trade_art(args.trade)
            if real is not None:
                art = trim_knockout(real)
            else:
                art = brand_snap(Image.open(fetch_trade_bg(args.trade, site=True)))
        elif args.trade:
            art = render_ink(Image.open(fetch_trade_bg(args.trade)))
        elif art_mode == "card":
            art = brand_snap(Image.open(fetch_background(slug)))
        else:
            art = render_ink(Image.open(fetch_background(slug)))
        suffix = f"-{args.trade}" if args.trade else ""
        style_tag = "-site" if args.site_style else ""
        for v in variants:
            card = compose(v, fm, art, trade_label, art_mode)
            out = out_dir / f"{slug}{suffix}{style_tag}-{v}.png"
            card.save(out, "PNG")
            print(f"  wrote {out.relative_to(ROOT)} ({VARIANTS[v][0]}x{VARIANTS[v][1]})")
    print("Done.")


if __name__ == "__main__":
    main()
