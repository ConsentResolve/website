#!/usr/bin/env python3
"""Branded Open Graph image generator (1200x630) for Consent Resolve.
Navy/mint brand, ConsentResolve logo, a bold readable headline + subline, and an
optional right-side icon/illustration. Used for og:image + twitter:image so every
shared page has a distinctive, readable social card (not just the bare logo).

Generates: default + key marketing pages + 17 industries + every blog post.
  python3 scripts/gen_og.py            # build everything into public/og/
  python3 scripts/gen_og.py default    # just the default
"""
import sys, re, glob, html, os, subprocess
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = Path("/Users/aaronphillips/GIT/consentresolve2")
BRI = str(ROOT / "scripts/.fonts/Bricolage.ttf")   # display
HAN = str(ROOT / "scripts/.fonts/Hanken.ttf")       # body
LOGO = ROOT / "public/logo-on-dark.png"
TRADE_SVG = ROOT / "public/illustrations/trades"    # per-trade illustration SVGs
ICONCACHE = Path("/tmp/trade_icons"); ICONCACHE.mkdir(parents=True, exist_ok=True)


def trade_art(slug):
    """Rasterize the site's trade illustration SVG via macOS Quick Look, knock the
    near-white background out to transparent, crop to content. Returns RGBA or None."""
    cache = ICONCACHE / f"{slug}.png"
    if cache.exists():
        return Image.open(cache).convert("RGBA")
    matches = sorted(glob.glob(str(TRADE_SVG / f"*-{slug}.svg")))
    if not matches:
        return None
    tmp = ICONCACHE / "_ql"; tmp.mkdir(exist_ok=True)
    for f in glob.glob(str(tmp / "*.png")):
        os.remove(f)
    subprocess.run(["qlmanage", "-t", "-s", "2048", "-o", str(tmp), matches[0]], capture_output=True)
    pngs = glob.glob(str(tmp / "*.png"))
    if not pngs:
        return None
    img = Image.open(pngs[0]).convert("RGBA")
    arr = np.asarray(img).astype(np.uint8)
    rgb, a = arr[..., :3], arr[..., 3].copy()
    near_white = (rgb[..., 0] >= 244) & (rgb[..., 1] >= 244) & (rgb[..., 2] >= 244)
    a[near_white] = 0
    im = Image.fromarray(np.dstack([rgb, a]))
    bbox = im.getbbox()
    im = im.crop(bbox) if bbox else im
    im.save(cache)
    return im
OUT = ROOT / "public/og"; OUT.mkdir(parents=True, exist_ok=True)
(OUT / "blog").mkdir(parents=True, exist_ok=True)

W, H = 1200, 630
NAVY = (10, 22, 40); MINT = (0, 229, 160); WHITE = (245, 248, 250); SLATE = (203, 213, 225)
PAD = 80

def font(path, sz): return ImageFont.truetype(path, sz)

def wrap(draw, text, fnt, max_w):
    words, lines, cur = text.split(), [], ""
    for w in words:
        t = (cur + " " + w).strip()
        if draw.textlength(t, font=fnt) <= max_w: cur = t
        else:
            if cur: lines.append(cur)
            cur = w
    if cur: lines.append(cur)
    return lines

def base():
    img = Image.new("RGB", (W, H), NAVY)
    # mint radial glow, top-right
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(glow).ellipse([W - 380, -260, W + 300, 320], fill=(*MINT, 60))
    img = Image.alpha_composite(img.convert("RGBA"), glow.filter(ImageFilter.GaussianBlur(120))).convert("RGB")
    # subtle bottom-left navy vignette already dark; add a faint mint hairline at very bottom
    d = ImageDraw.Draw(img)
    d.rectangle([0, H - 8, W, H], fill=MINT)
    return img

def put_logo(img):
    try:
        lg = Image.open(LOGO).convert("RGBA")
        lw = 300; lh = int(lg.height * lw / lg.width)
        img.paste(lg.resize((lw, lh), Image.LANCZOS), (PAD, 64), lg.resize((lw, lh), Image.LANCZOS))
    except Exception as e:
        print("logo skip:", e)

def put_icon(img, slug):
    """Right-side trade illustration on a floating white inset (matches how the
    site/resource cards present illustrations), so the navy-outlined art reads."""
    ic = trade_art(slug)
    if ic is None:
        return 0
    ps = 380; panel_x, panel_y = W - ps - 56, (H - ps) // 2
    ov = Image.new("RGBA", (W, H), (0, 0, 0, 0))   # single overlay, pasted onto the RGB img
    # soft drop shadow
    sh = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle([panel_x, panel_y + 14, panel_x + ps, panel_y + ps + 14], radius=42, fill=(0, 0, 0, 150))
    ov.alpha_composite(sh.filter(ImageFilter.GaussianBlur(22)))
    # white panel + mint keyline
    pd = ImageDraw.Draw(ov)
    pd.rounded_rectangle([panel_x, panel_y, panel_x + ps, panel_y + ps], radius=42, fill=(248, 250, 252, 255))
    pd.rounded_rectangle([panel_x, panel_y, panel_x + ps, panel_y + ps], radius=42, outline=(*MINT, 255), width=4)
    # the artwork, padded inside the panel
    pad = 46
    art = ic.copy(); art.thumbnail((ps - 2 * pad, ps - 2 * pad), Image.LANCZOS)
    ov.alpha_composite(art, (panel_x + (ps - art.width) // 2, panel_y + (ps - art.height) // 2))
    img.paste(ov, (0, 0), ov)   # composite overlay onto the working RGB image
    return ps + 90  # occupied right width -> narrower text column

def render(out, kicker, headline, subline, accent=None, slug=None, blog=False):
    img = base(); put_logo(img)
    right_occupied = put_icon(img, slug) if slug else 0
    text_w = (W - 2 * PAD - right_occupied) if right_occupied else int((W - 2 * PAD) * 0.82)
    d = ImageDraw.Draw(img)
    y = 220 if not blog else 250
    # kicker (small uppercase mint)
    if kicker:
        kf = font(HAN, 24)
        d.text((PAD, y - 56), kicker.upper(), font=kf, fill=MINT)
    # headline (Bricolage bold), wrap; size shrinks if many lines
    hsz = 76 if not blog else 60
    hf = font(BRI, hsz)
    lines = wrap(d, headline, hf, text_w)
    while len(lines) > (3 if not blog else 4) and hsz > 40:
        hsz -= 6; hf = font(BRI, hsz); lines = wrap(d, headline, hf, text_w)
    lh = int(hsz * 1.12)
    for ln in lines:
        # optional mint accent word
        if accent and accent in ln:
            pre, _, post = ln.partition(accent)
            x = PAD
            d.text((x, y), pre, font=hf, fill=WHITE); x += d.textlength(pre, font=hf)
            d.text((x, y), accent, font=hf, fill=MINT); x += d.textlength(accent, font=hf)
            d.text((x, y), post, font=hf, fill=WHITE)
        else:
            d.text((PAD, y), ln, font=hf, fill=WHITE)
        y += lh
    # subline
    if subline:
        y += 14; sf = font(HAN, 30)
        for ln in wrap(d, subline, sf, text_w)[:2]:
            d.text((PAD, y), ln, font=sf, fill=SLATE); y += 40
    # footer url
    d.text((PAD, H - 64), "consentresolve.com", font=font(HAN, 26), fill=(148, 163, 184))
    img.save(out, quality=92)
    print("wrote", Path(out).relative_to(ROOT))

# ── Page manifest ─────────────────────────────────────────────────────────────
KEY_PAGES = {
    "default":        ("Consent-first lead recovery", "The 98% your ads paid for don't have to vanish", "Recover the homeowners who bounce — with consent — into the funnel you already run.", "98%"),
    "home":           ("For home-service contractors", "Turn anonymous homeowners into booked jobs", "Identify the visitors who'd otherwise bounce, with consent, and feed them to your CRM.", None),
    "features":       ("Features", "Anonymous homeowner to booked job", "Consent banner → identity → your CRM. Exclusive, consented leads, never resold.", None),
    "how-it-works":   ("How it works", "Five steps to a warm inbound call", "Visitor lands, consents, and drops into your retargeting, email, and CRM — in seconds.", None),
    "pricing":        ("Pricing", "Flat per recovered lead. No contracts.", "Pay only for exclusive, consented leads that are yours alone. Cancel anytime.", None),
    "about":          ("About", "The consent-first identification company", "Not a shared-lead marketplace. Real names, real consent, one contractor per lead.", None),
    "why-consent-first": ("Compliance", "Is visitor identification legal?", "Why consent-first is the only safe way — built for TCPA, CIPA, and state privacy laws.", None),
    "faq":            ("FAQ", "Questions contractors actually ask", "Exclusivity, legality, CRM fit, and how recovered leads reach you fast.", None),
    "contact":        ("Contact", "Talk to a human", "Questions about recovery, consent, or setup? Reach the team behind Consent Resolve.", None),
    "stats":          ("Data & sources", "The data behind the story", "The benchmarks, studies, and sources behind every number we publish.", None),
    "lead-math":      ("The lead math", "What shared leads really cost", "Sold four ways and rarely booked. See the true cost-per-job, both ways.", None),
    "demo":           ("Live demo", "See it work on yourself", "Register, browse a sample site, consent — and watch the lead land in your inbox.", None),
    "industries":     ("By trade", "Exclusive leads, built for your trade", "Consent-first lead recovery tuned to how homeowners shop your service.", None),
}

INDUSTRIES = [
    ("general-contractor", "General Contractor"), ("handyman", "Handyman"), ("tree-removal", "Tree Removal"),
    ("hvac", "HVAC & AC"), ("plumber", "Plumbing"), ("locksmith", "Locksmith"), ("electrician", "Electrical"),
    ("roofing", "Roofing"), ("painter", "Painting"), ("deck-fence", "Deck & Fence"), ("garage-door", "Garage Door"),
    ("appliance-repair", "Appliance Repair"), ("house-cleaning", "House Cleaning"), ("pest-control", "Pest Control"),
    ("power-washing", "Power Washing"), ("lawn-care", "Lawn Care"), ("mobile-car-service", "Mobile Mechanic"),
]

def gen_key():
    for slug, (kicker, headline, sub, accent) in KEY_PAGES.items():
        out = (ROOT / "public/og-default.png") if slug == "default" else (OUT / f"{slug}.png")
        render(out, kicker, headline, sub, accent)

def gen_industries():
    for slug, name in INDUSTRIES:
        render(OUT / f"industry-{slug}.png", "Consent-first lead recovery", f"Exclusive {name} Leads", "Recovered from your own traffic — yours alone, never resold.", slug=slug)

def gen_blog():
    posts = sorted(glob.glob(str(ROOT / "src/content/resources/blog/*.md")))
    for fp in posts:
        txt = Path(fp).read_text(errors="ignore")[:1500]
        mt = re.search(r'(?m)^title:\s*["\']?(.+?)["\']?\s*$', txt)
        ms = re.search(r'(?m)^slug:\s*["\']?(.+?)["\']?\s*$', txt)
        if not (mt and ms): continue
        title = mt.group(1).strip().strip('"\'')
        title = re.sub(r'^[\'"]|[\'"]$', '', title)
        slug = ms.group(1).strip().strip('"\'')
        render(OUT / "blog" / f"{slug}.png", "Consent Resolve · Blog", title, "", blog=True)

if __name__ == "__main__":
    arg = sys.argv[1] if len(sys.argv) > 1 else "all"
    if arg in ("all", "default", "key"): gen_key()
    if arg in ("all", "industries"): gen_industries()
    if arg in ("all", "blog"): gen_blog()
    print("OG generation done.")
