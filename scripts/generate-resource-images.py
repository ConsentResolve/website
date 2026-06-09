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
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance, ImageChops

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
def gradient_bg(w, h, focus=(0.66, 0.44)):
    """Navy diagonal gradient + mint glow + radial spotlight behind the focal
    point + corner vignette + a faint mint inner-frame (the series signature)."""
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    # diagonal navy gradient (navy -> navy3)
    t = np.clip((xx / w) * 0.55 + (yy / h) * 0.45, 0, 1)[..., None]
    base = (np.array(NAVY, np.float32) * (1 - t) + np.array(NAVY3, np.float32) * t)
    # radial spotlight (lighter behind focus) — additive
    fx, fy = focus[0] * w, focus[1] * h
    ds = np.sqrt(((xx - fx) / (w * 0.55)) ** 2 + ((yy - fy) / (h * 0.62)) ** 2)
    spot = np.clip(1 - ds, 0, 1)[..., None]
    base += np.array([34, 60, 92], np.float32) * (spot ** 1.5) * 0.55
    # corner vignette — multiplicative darken
    cx, cy = w / 2.0, h / 2.0
    dv = np.sqrt(((xx - cx) / (w / 2)) ** 2 + ((yy - cy) / (h / 2)) ** 2)
    vig = 1 - np.clip((dv - 0.72) / 0.6, 0, 1)[..., None] * 0.28
    base = np.clip(base * vig, 0, 255).astype(np.uint8)
    img = Image.fromarray(base).convert("RGBA")
    # mint glow top-right
    glow = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    ImageDraw.Draw(glow).ellipse([int(w * 0.52), int(-h * 0.4), int(w * 1.15), int(h * 0.55)], fill=(0, 235, 165, 34))
    img = Image.alpha_composite(img, glow.filter(ImageFilter.GaussianBlur(int(w * 0.07))))
    return img


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
    rad = int(min(bw, bh) * 0.10)
    pad = int(min(bw, bh) * 0.10)
    W, H = card.size

    # 1) soft drop shadow so the white card floats above the navy
    sh = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    off = int(min(bw, bh) * 0.05)
    ImageDraw.Draw(sh).rounded_rectangle([bx, by + off, bx + bw, by + bh + off],
                                         radius=rad, fill=(0, 0, 0, 130))
    card.alpha_composite(sh.filter(ImageFilter.GaussianBlur(int(min(bw, bh) * 0.045))))

    # 2) the white card + a crisp white keyline border around the illustration
    panel = Image.new("RGBA", (bw, bh), (0, 0, 0, 0))
    ImageDraw.Draw(panel).rounded_rectangle([0, 0, bw, bh], radius=rad, fill=(248, 250, 252, 255))
    card.alpha_composite(panel, (bx, by))
    ImageDraw.Draw(card).rounded_rectangle([bx, by, bx + bw, by + bh], radius=rad,
                                           outline=(0, 235, 165, 255), width=max(3, int(min(bw, bh) / 90)))

    # 3) faint mint rim-light on the edge facing the light (top + left)
    rim = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    rd = ImageDraw.Draw(rim)
    rw = max(1, int(min(bw, bh) / 240))
    rd.arc([bx, by, bx + bw, by + bh], start=150, end=300, fill=(0, 235, 165, 150), width=rw)
    card.alpha_composite(rim)

    # 4) the artwork (unchanged)
    im = art.copy()
    im.thumbnail((bw - 2 * pad, bh - 2 * pad), Image.LANCZOS)
    card.alpha_composite(im, (bx + (bw - im.width) // 2, by + (bh - im.height) // 2))


def is_number_token(tok):
    return bool(re.search(r"\d", tok))


def word_w(draw, s, font, track=0.0):
    """Width of a string drawn char-by-char with letter `track` (px)."""
    if not s:
        return 0.0
    return sum(draw.textlength(c, font=font) for c in s) + track * (len(s) - 1)


def draw_tracked(draw, x, y, s, font, fill, track=0.0):
    cx = x
    for c in s:
        draw.text((cx, y), c, font=font, fill=fill)
        cx += draw.textlength(c, font=font) + track
    return cx


def layout_words(draw, text, font, max_w, track=0.0):
    """Wrap into lines; each word tagged base/hi (numbers highlighted)."""
    space = draw.textlength(" ", font=font)
    lines, cur, curw = [], [], 0.0
    for word in text.split():
        ww = word_w(draw, word, font, track)
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


def draw_hook(draw, x, y, lines, font, line_h, track=0.0):
    space = draw.textlength(" ", font=font)
    for li, line in enumerate(lines):
        cx = x
        for word, hi in line:
            cx = draw_tracked(draw, cx, y + li * line_h, word, font, MINT if hi else WHITE, track)
            cx += space


def fit_hook(draw, hook, text_w, avail_h, max_size, min_size):
    """Largest size that fits; tightened tracking (~-1.5%) + tighter leading."""
    size = max_size
    while size >= min_size:
        f = load_font("Bricolage.ttf", size, weight=800)
        track = -size * 0.015
        lines = layout_words(draw, hook, f, text_w, track)
        line_h = int(size * 1.06)
        space = draw.textlength(" ", font=f)
        widest = max((sum(word_w(draw, wd, f, track) for wd, _ in line) + space * (len(line) - 1)
                      for line in lines), default=0)
        if widest <= text_w and len(lines) * line_h <= avail_h:
            return f, lines, line_h, track
        size -= 3
    f = load_font("Bricolage.ttf", min_size, weight=800)
    track = -min_size * 0.015
    return f, layout_words(draw, hook, f, text_w, track), int(min_size * 1.06), track


BADGE_TEXT = "See Our Interactive Demo"


def draw_badge(draw, x, y, text, scale):
    """A called-out pill badge: subtle mint fill + mint border + mint label.
    Returns the badge's bottom y."""
    fsz = max(13, int(21 * scale))
    f = load_font("Hanken.ttf", fsz, weight=700)
    tw = draw.textlength(text, font=f)
    padx, pady = int(20 * scale), int(12 * scale)
    bw = int(tw + 2 * padx)
    bh = int(fsz + 2 * pady)
    # Solid mint pill + navy text — high contrast, clearly "called out".
    draw.rounded_rectangle([x, y, x + bw, y + bh], radius=bh // 2, fill=MINT)
    draw.text((x + padx, y + pady - int(fsz * 0.08)), text, font=f, fill=NAVY)
    return y + bh


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


def apply_grain(img, amt=0.03, seed=11):
    """Barely-there luminance noise to kill the flat-vector look."""
    w, h = img.size
    n = np.random.default_rng(seed).normal(0, 255 * amt, (h, w)).astype(np.float32)
    arr = np.asarray(img.convert("RGB")).astype(np.float32) + n[..., None]
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))


def finalize(card, variant):
    """2x supersample -> downscale (crisp), pre-saturate mint, add grain."""
    w, h, *_ = VARIANTS[variant]
    card = card.resize((w, h), Image.LANCZOS)
    card = ImageEnhance.Color(card).enhance(1.08)  # platforms desaturate on upload
    return apply_grain(card, 0.03)


# Recraft custom Brand Style (the exact style the website illustrations use).
BRAND_STYLE_ID = "214dccd1-dca3-43e6-b005-c664e1b33338"

# Per-article content motif (the topic of the piece), combined with the trade
# tool so the illustration is BOTH service-pro themed AND about the content.
CONTENT_SUBJECTS = {
    "follow-up-with-leads": "a smartphone showing an incoming chat message bubble with a small alarm clock beside it, signalling a fast reply",
    "stop-losing-jobs-missed-calls": "a ringing smartphone with a missed-call badge turning into a chat reply bubble",
    "get-more-leads-from-website-traffic": "a browser window with an upward arrow and a contact card dropping out of a funnel",
    "rank-google-map-pack-home-services": "a map pin on a small street grid with a ranking podium of three bars",
    "win-google-local-service-ads": "a verification shield badge with a checkmark above a search bar",
    "quote-and-close-more-jobs": "three price-option cards with a handshake above the tallest",
    "get-more-google-reviews": "a row of five stars beside a chat bubble",
    "market-to-neighbors-after-every-job": "a row of houses with a postcard mailer flying between them",
    "track-where-leads-come-from": "branching source arrows converging into a dollar-sign circle",
    "identify-anonymous-website-visitors": "a faceless visitor silhouette resolving into a labelled contact card with a consent checkmark",
    "website-visitor-identification": "a faceless visitor silhouette resolving along an arrow into a labelled contact card with a consent checkmark badge",
    "what-consent-first-means": "a large consent checkmark button inside a dialog card with a protective shield behind it",
    "paying-for-traffic-throwing-it-away": "a wide funnel leaking small dots out the sides while a few convert into contact cards, a dollar sign nearby",
    # Straight Answers explainers
    "what-is-tcpa": "a smartphone with a protective shield and a small gavel beside it",
    "what-is-can-spam-act": "an envelope with a shield badge and a small unsubscribe toggle",
    "what-is-express-written-consent": "a signed document with a large checkmark and a pen",
    "what-is-ccpa": "a shield with a checkmark over a simple state map outline and a padlock",
    "what-is-consent-first-marketing": "a large rounded checkmark button inside a consent dialog card with a shield behind it",
    "what-is-website-visitor-identification": "a faceless visitor silhouette resolving along an arrow into a labelled contact card with a consent checkmark",
    "what-is-a-good-match-rate": "a funnel of small dots above a round percentage gauge dial",
    "what-is-first-party-data": "a labelled database cylinder with a person icon and a small padlock",
    "what-is-identity-resolution": "scattered device and envelope icons converging along arrows into a single contact card",
    "what-are-anonymous-website-visitors": "several faceless ghost silhouettes floating inside a rounded browser window",
    "what-is-an-exclusive-lead": "a single contact card linked by one line to one house, sealed with a small padlock",
    "what-is-speed-to-lead": "a stopwatch beside a chat bubble with a short upward arrow",
    "what-is-pay-per-lead": "a single coin dropping onto a clean contact card",
    "what-is-lead-nurturing": "a small plant growing from a contact card beside a sequence of three chat bubbles",
    "what-is-a-lead-magnet": "a horseshoe magnet pulling a contact card and a small guide booklet",
    "what-is-cost-per-lead": "a contact card with a dollar price tag and a small divide symbol",
    "what-is-customer-acquisition-cost": "a handshake with a dollar tag and a small calculator",
    "what-is-customer-lifetime-value": "a customer icon with a rising bar chart and a repeat-arrow loop",
    "what-is-roas": "one coin going into a box and a larger stack of coins coming out, with an up arrow",
    "what-is-cost-per-booked-job": "a calendar with a booked checkmark and a dollar tag",
    "what-are-google-local-services-ads": "a verification shield badge with a checkmark sitting above a search bar pill",
    "what-is-ppc": "a mouse cursor clicking a small ad rectangle with a coin beside it",
    "what-is-email-marketing-for-contractors": "an envelope with a small upward open-rate arrow and a consent checkmark",
    "what-is-sms-marketing-for-contractors": "a smartphone showing a text message bubble with a consent checkmark",
    "what-is-retargeting": "a rounded browser window with a return-arrow loop and a small ad banner",
    "what-is-a-google-business-profile": "a map pin with a small storefront card and a row of stars",
    "what-is-local-seo": "a magnifying glass over a map pin with three small ranking bars",
    "what-is-a-service-area-business": "a service van with a dashed location-radius circle on a small map",
    "what-is-nap-consistency": "three matching cards aligned, each showing a person, a pin, and a phone icon",
    "what-is-reputation-management": "a row of five stars with a shield and a small chat bubble",
    # Blog (Q1)
    "fathers-day-first-heat-wave-how-hvac-pros-can-catch-the-homeowners-already-pricing-the-job": "an outdoor air-conditioner condenser unit beside a browser window resolving a faceless visitor into a contact card",
}
TRADE_TOOL = {
    "plumber": "a plumber's pipe wrench", "roofing": "a roofing hammer and a shingle",
    "hvac": "an HVAC thermostat dial", "electrician": "an electrician's pliers and a lightning bolt",
}


def fetch_content_art(slug, trade):
    """Generate a service-pro + content-themed illustration in the website's
    Brand Style (Recraft style_id) and rasterize it via Quick Look. Returns PIL
    RGBA, or None if no content motif is defined for this slug."""
    motif = CONTENT_SUBJECTS.get(slug)
    if not motif:
        return None
    CACHE.mkdir(parents=True, exist_ok=True)
    tkey = trade or "generic"
    png_cache = CACHE / f"content-{slug}-{tkey}.png"
    if png_cache.exists():
        return Image.open(png_cache).convert("RGBA")
    svg_cache = CACHE / f"content-{slug}-{tkey}.svg"
    if not svg_cache.exists():
        tool = TRADE_TOOL.get(trade) if trade else None
        with_tool = f", together with {tool}" if tool else ""
        subject = f"{motif}{with_tool}, representing a fast service-pro response to a new customer lead"
        prompt = f"Subject: {subject}, arranged center-frame.\n\n{SITE_STYLE_BASE}"
        body = {"prompt": prompt, "model": "recraftv3", "style_id": BRAND_STYLE_ID,
                "size": "1024x1024", "n": 1, "response_format": "url"}
        req = urllib.request.Request(
            "https://external.api.recraft.ai/v1/images/generations",
            data=json.dumps(body).encode("utf-8"), method="POST",
            headers={"Content-Type": "application/json", "Authorization": f"Bearer {load_key()}"})
        print(f"  recraft content → {slug}/{trade} ...", end=" ", flush=True)
        try:
            with urllib.request.urlopen(req, timeout=300) as resp:
                payload = json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            print("FAILED", e.read().decode("utf-8", "replace")[:200])
            return None
        url = payload["data"][0]["url"]
        dl = urllib.request.Request(url, headers={"User-Agent": "consentresolve-img/1.0"})
        with urllib.request.urlopen(dl, timeout=120) as r:
            svg_cache.write_bytes(r.read())
        print("ok")
    # rasterize via Quick Look
    tmp = CACHE / "_ql"
    tmp.mkdir(parents=True, exist_ok=True)
    for f in glob.glob(str(tmp / "*.png")):
        os.remove(f)
    subprocess.run(["qlmanage", "-t", "-s", "2048", "-o", str(tmp), str(svg_cache)], capture_output=True)
    pngs = glob.glob(str(tmp / "*.png"))
    if not pngs:
        return None
    img = Image.open(pngs[0]).convert("RGBA")
    img.save(png_cache)
    return img


def compose(variant, fm, art, trade_label="", art_mode="ink", ss=1):
    w, h, layout, logo_variant, logo_h_base, logo_pos, margin_base = VARIANTS[variant]
    w, h = w * ss, h * ss
    scale = w / 1200.0
    # focal point for the bg spotlight: behind the illustration
    focus = (0.74, 0.46) if layout == "wide" else (0.6, 0.62)
    card = gradient_bg(w, h, focus)
    draw = ImageDraw.Draw(card)
    pad = int(margin_base * scale)
    logo_h = int(logo_h_base * scale)
    margin = int(margin_base * scale)

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
        badge_bottom = draw_badge(draw, tx, ey, BADGE_TEXT, scale)
        # hook fills the band between badge and the logo
        logo_top = h - margin - logo_h
        hook_top = badge_bottom + int(22 * scale)
        f_hook, lines, lh, htrack = fit_hook(draw, hook, text_w, logo_top - hook_top - int(24 * scale), int(74 * scale), int(30 * scale))
        draw_hook(draw, tx, hook_top, lines, f_hook, lh, htrack)
        place_logo(card, logo_variant, logo_h, "bl", margin)

    elif layout == "thumb":
        # Clean illustration-only tile — no text, badge, or logo (the card UI
        # shows the title/category/excerpt as HTML beneath the image).
        cw_, ch_ = int(w * 0.64), int(h * 0.76)
        place_art(card, art, ((w - cw_) // 2, (h - ch_) // 2, cw_, ch_), art_mode)

    else:  # square / portrait — logo top, then eyebrow, hook, headline, CTA
        place_logo(card, logo_variant, logo_h, "tl", margin)
        # subtle art lower-right
        if layout == "square":
            cw_, ch_ = int(w * 0.56), int(h * 0.40)
            place_art(card, art, ((w - cw_) // 2, int(h * 0.52), cw_, ch_), art_mode)
        else:
            cw_, ch_ = int(w * 0.60), int(h * 0.32)
            place_art(card, art, ((w - cw_) // 2, int(h * 0.40), cw_, ch_), art_mode)
        tx = margin
        ey = margin + logo_h + int(26 * scale)
        text_w = w - 2 * margin
        badge_bottom = draw_badge(draw, tx, ey, BADGE_TEXT, scale)
        hook_top = badge_bottom + int(22 * scale)
        # CTA removed on square (not clickable in-feed) -> bigger headline.
        hook_max = int(84 * scale) if layout == "square" else int(74 * scale)
        f_hook, lines, lh, htrack = fit_hook(draw, hook, text_w, int(h * 0.38), hook_max, int(34 * scale))
        draw_hook(draw, tx, hook_top, lines, f_hook, lh, htrack)
        # subhead — higher contrast for legibility (words unchanged)
        hl_y = hook_top + len(lines) * lh + int(22 * scale)
        f_hl = load_font("Hanken.ttf", int(29 * scale), weight=600)
        hl_lines = layout_words(draw, headline, f_hl, text_w)
        for i, line in enumerate(hl_lines[:3]):
            draw.text((tx, hl_y + i * int(38 * scale)), " ".join(wd for wd, _ in line), font=f_hl, fill=(203, 213, 225))
        if layout == "portrait":
            # CTA pill only on the vertical (still a useful in-feed affordance)
            cta = fm["cta_text"]
            f_cta = load_font("Hanken.ttf", int(24 * scale), weight=700)
            pill_w = int(draw.textlength(cta, font=f_cta) + 44 * scale)
            pill_h = int(54 * scale)
            cta_y = h - margin - pill_h
            draw.rounded_rectangle([tx, cta_y, tx + pill_w, cta_y + pill_h], radius=pill_h // 2, fill=MINT)
            draw.text((tx + int(22 * scale), cta_y + (pill_h - int(24 * scale)) // 2 - int(2 * scale)), cta, font=f_cta, fill=NAVY)

    # defined mint border around the whole image
    bm = int(w * 0.018)
    draw.rounded_rectangle([bm, bm, w - bm, h - bm], radius=int(w * 0.02),
                           outline=(0, 235, 165, 235), width=max(2, int(w / 300)))
    return card.convert("RGB")


# ── Founder-POV variant (real headshot) ─────────────────────────────────────────
def knockout_white(path, thresh=36):
    """White-bg headshot -> transparent knockout (flood from borders so interior
    whites like teeth survive), + a subtle cool color-grade. Returns tight RGBA."""
    im = Image.open(path).convert("RGB")
    flood = im.copy()
    for seed in [(1, 1), (im.width - 2, 1), (1, im.height - 2), (im.width - 2, im.height - 2),
                 (im.width // 2, 1), (1, im.height // 2)]:
        ImageDraw.floodfill(flood, seed, (255, 0, 255), thresh=thresh)
    arr = np.asarray(flood)
    bg = (arr[..., 0] == 255) & (arr[..., 1] == 0) & (arr[..., 2] == 255)
    alpha = np.where(bg, 0, 255).astype(np.uint8)
    a = Image.fromarray(alpha).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.8))
    # subtle grade: gentle contrast lift + cooled shadows
    g = ImageEnhance.Contrast(im).enhance(1.06)
    ga = np.asarray(g).astype(np.float32)
    ga[..., 0] *= 0.985
    ga[..., 2] *= 1.03
    rgba = Image.fromarray(np.clip(ga, 0, 255).astype(np.uint8)).convert("RGBA")
    rgba.putalpha(a)
    bbox = rgba.getbbox()
    return rgba.crop(bbox) if bbox else rgba


def circle_crop(port):
    s = min(port.size)
    port = port.crop(((port.width - s) // 2, 0, (port.width - s) // 2 + s, s))  # head near top
    mask = Image.new("L", (s, s), 0)
    ImageDraw.Draw(mask).ellipse([0, 0, s, s], fill=255)
    out = port.copy()
    out.putalpha(ImageChops.darker(port.split()[-1], mask))
    return out


def place_portrait(card, port, box, scale, anchor="bottom"):
    bx, by, bw, bh = box
    im = port.copy()
    im.thumbnail((bw, bh), Image.LANCZOS)
    ox = bx + (bw - im.width) // 2
    oy = by + (bh - im.height) if anchor == "bottom" else by + (bh - im.height) // 2
    a = im.split()[-1]
    # drop shadow (below)
    sh = Image.new("RGBA", card.size, (0, 0, 0, 0))
    dark = Image.new("RGBA", im.size, (2, 6, 12, 200))
    dark.putalpha(a)
    sh.alpha_composite(dark, (ox + int(2 * scale), oy + int(12 * scale)))
    card.alpha_composite(sh.filter(ImageFilter.GaussianBlur(int(12 * scale))))
    # mint rim-light (ghost offset up-right, behind)
    rim = Image.new("RGBA", card.size, (0, 0, 0, 0))
    mint = Image.new("RGBA", im.size, (0, 235, 165, 255))
    mint.putalpha(a)
    rim.alpha_composite(mint, (ox + int(7 * scale), oy - int(7 * scale)))
    rim = rim.filter(ImageFilter.GaussianBlur(int(3 * scale)))
    rim = Image.blend(Image.new("RGBA", card.size, (0, 0, 0, 0)), rim, 0.6)
    card.alpha_composite(rim)
    card.alpha_composite(im, (ox, oy))
    return (ox, oy, im.width, im.height)


def compose_founder(layout, headshot, ss=2):
    W, H = 1080 * ss, 1080 * ss
    scale = W / 1080.0
    eyebrow, headline, name, org = "FROM THE TEAM", "Your headline goes here.", "Tyler Spurlock", "ConsentResolve"
    focus = {"A": (0.74, 0.5), "B": (0.66, 0.64), "C": (0.72, 0.5)}[layout]
    card = gradient_bg(W, H, focus)
    draw = ImageDraw.Draw(card)
    margin = int(72 * scale)
    logo_h = int(52 * scale)

    # faint mint accent behind subject (arc echoing the brand)
    acc = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(acc).arc([int(W * 0.46), int(H * 0.08), int(W * 1.06), int(H * 0.9)],
                            200, 30, fill=(0, 235, 165, 46), width=int(22 * scale))
    card.alpha_composite(acc.filter(ImageFilter.GaussianBlur(int(2 * scale))))

    place_logo(card, "light", logo_h, "tl", margin)

    tx = margin
    ey = margin + logo_h + int(26 * scale)
    f_eb = load_font("Hanken.ttf", max(13, int(21 * scale)), 700)
    draw_tracked(draw, tx, ey, eyebrow, f_eb, MINT, (21 * scale) * 0.16)
    ry = ey + int(21 * scale) + int(13 * scale)
    draw.rounded_rectangle([tx, ry, tx + int(56 * scale), ry + max(3, int(4 * scale))], radius=2, fill=MINT)
    hook_top = ry + int(26 * scale)

    port = knockout_white(headshot)
    if layout == "A":
        text_w = int(W * 0.52) - margin
        pbox = (int(W * 0.58), int(H * 0.14), int(W * 0.40), int(H * 0.82))
        anchor = "bottom"
    elif layout == "B":
        text_w = int(W * 0.60) - margin
        pbox = (int(W * 0.40), int(H * 0.30), int(W * 0.60), int(H * 0.70))
        anchor = "bottom"
    else:  # C — circle with mint ring
        port = circle_crop(port)
        text_w = int(W * 0.54) - margin
        pbox = (int(W * 0.58), int(H * 0.30), int(W * 0.34), int(H * 0.40))
        anchor = "middle"

    f_h, lines, lh, tr = fit_hook(draw, headline, text_w, int(H * 0.42), int(80 * scale), int(34 * scale))
    draw_hook(draw, tx, hook_top, lines, f_h, lh, tr)

    placed = place_portrait(card, port, pbox, scale, anchor)
    if layout == "C":
        ox, oy, pw, ph = placed
        ImageDraw.Draw(card).ellipse([ox, oy, ox + pw, oy + ph], outline=(0, 235, 165, 255),
                                     width=max(3, int(6 * scale)))

    # attribution (name bold + org muted)
    f_nm = load_font("Hanken.ttf", int(26 * scale), 700)
    f_or = load_font("Hanken.ttf", int(24 * scale), 600)
    ay = H - margin - int(26 * scale)
    nx = draw_tracked(draw, tx, ay, name, f_nm, WHITE, 0)
    draw.text((nx + int(10 * scale), ay + int(2 * scale)), f"· {org}", font=f_or, fill=(148, 163, 184))

    # green image border
    bm = int(W * 0.018)
    draw.rounded_rectangle([bm, bm, W - bm, H - bm], radius=int(W * 0.02),
                           outline=(0, 235, 165, 235), width=max(2, int(W / 300)))

    card = card.convert("RGB").resize((1080, 1080), Image.LANCZOS)
    card = ImageEnhance.Color(card).enhance(1.08)
    return apply_grain(card, 0.03)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", default="")
    ap.add_argument("--variant", default="")
    ap.add_argument("--trade", default="", help="trade slug for themed social variants (e.g. plumber, roofing)")
    ap.add_argument("--site-style", action="store_true",
                    help="render the art in the website's marker style (native brand colors on a white inset) instead of mint ink")
    ap.add_argument("--preview", action="store_true",
                    help="write to scripts/.preview/ instead of public/ (for A/B review, not deploy)")
    ap.add_argument("--founder", default="",
                    help="path to a white-bg headshot; generates founder-POV layouts A/B/C to preview")
    args = ap.parse_args()
    ensure_fonts()

    if args.founder:
        out_dir = ROOT / "scripts" / ".preview" / "founder"
        out_dir.mkdir(parents=True, exist_ok=True)
        for layout in ("A", "B", "C"):
            card = compose_founder(layout, args.founder, ss=2)
            out = out_dir / f"founder-tyler-{layout}.png"
            card.save(out, "PNG")
            print(f"  wrote {out.relative_to(ROOT)} (layout {layout})")
        print("Done.")
        return

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
            # Prefer a service-pro + content-themed illustration in the brand
            # style; fall back to the generic trade SVG, then to a regen.
            content = fetch_content_art(slug, args.trade)
            if content is not None:
                art = trim_knockout(content)
            else:
                real = real_trade_art(args.trade)
                art = trim_knockout(real) if real is not None else brand_snap(Image.open(fetch_trade_bg(args.trade, site=True)))
        elif args.trade:
            art = render_ink(Image.open(fetch_trade_bg(args.trade)))
        elif art_mode == "card":
            content = fetch_content_art(slug, "")
            if content is not None:
                art = trim_knockout(content)
            else:
                art = brand_snap(Image.open(fetch_background(slug)))
        else:
            art = render_ink(Image.open(fetch_background(slug)))
        # site-style is the locked, canonical look — no style suffix on filenames.
        suffix = f"-{args.trade}" if args.trade else ""
        for v in variants:
            card = compose(v, fm, art, trade_label, art_mode, ss=2)
            card = finalize(card, v)
            out = out_dir / f"{slug}{suffix}-{v}.png"
            card.save(out, "PNG")
            print(f"  wrote {out.relative_to(ROOT)} ({VARIANTS[v][0]}x{VARIANTS[v][1]})")
    print("Done.")


if __name__ == "__main__":
    main()
