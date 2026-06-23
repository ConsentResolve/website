#!/usr/bin/env python3
"""HVAC retargeting ad creatives — navy/mint Consent Resolve brand (reuses the
social_cards toolkit). 3 angles x 4 sizes -> build/retarget-ads/.
Angles reinforce the cold email: the lead math, the 98% hook, own-vs-rent.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = Path("/Users/aaronphillips/GIT/consentresolve2")
OUT = ROOT / "build/retarget-ads"; OUT.mkdir(parents=True, exist_ok=True)
NAVY9 = (10, 22, 40); NAVY8 = (13, 27, 42); MINT = (0, 229, 160)
WHITE = (245, 248, 250); SLATE = (148, 163, 184); INKMINT = (6, 40, 31)
BRI = str(ROOT / "scripts/.fonts/Bricolage.ttf"); HAN = str(ROOT / "scripts/.fonts/Hanken.ttf")
LOGO = Image.open(ROOT / "public/logo-on-dark.png").convert("RGBA")
SCR = ImageDraw.Draw(Image.new("RGB", (10, 10)))
def disp(px): return ImageFont.truetype(BRI, px)
def sans(px): return ImageFont.truetype(HAN, px)
def ctext(d, cx, y, t, fn, fill):
    w = SCR.textlength(t, font=fn); d.text((cx - w / 2, y), t, font=fn, fill=fill); return fn.size
def wrap(t, fn, maxw):
    out, cur = [], ""
    for w in t.split():
        s = (cur + " " + w).strip()
        if SCR.textlength(s, font=fn) <= maxw: cur = s
        else: out.append(cur); cur = w
    if cur: out.append(cur)
    return out
def base(w, h, logo_y):
    img = Image.new("RGB", (w, h), NAVY9)
    for y in range(h):
        f = y / h; ImageDraw.Draw(img).line([(0, y), (w, y)], fill=tuple(int(NAVY8[i] + (NAVY9[i] - NAVY8[i]) * f) for i in range(3)))
    gl = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    ImageDraw.Draw(gl).ellipse([w // 2 - int(w * 0.34), -int(h * 0.28), w // 2 + int(w * 0.34), int(h * 0.28)], fill=(0, 229, 160, 45))
    img = Image.alpha_composite(img.convert("RGBA"), gl.filter(ImageFilter.GaussianBlur(150)))
    d = ImageDraw.Draw(img, "RGBA")
    for gx in range(50, w, 54):
        for gy in range(50, h, 54): d.ellipse([gx, gy, gx + 2, gy + 2], fill=(148, 163, 184, 12))
    lw = int(w * 0.30); lh = int(LOGO.height * lw / LOGO.width)
    img.alpha_composite(LOGO.resize((lw, lh), Image.LANCZOS), (w // 2 - lw // 2, logo_y))
    return img
def pill(d, cx, y, t, fn, fg, bg, padx, pady):
    tw = SCR.textlength(t, font=fn); w = int(tw) + padx * 2; h = fn.size + pady * 2; x0 = cx - w // 2
    d.rounded_rectangle([x0, y, x0 + w, y + h], radius=h // 2, fill=bg)
    d.text((cx - tw / 2, y + pady - 2), t, font=fn, fill=fg); return h

ANGLES = {
    "math":    {"kicker": "HVAC LEAD MATH",
                "head": [("A $149 HVAC lead,", WHITE), ("split 5 ways.", WHITE), ("Or $7 — all yours.", MINT)],
                "sub": "Exclusive, consent-first leads. Yours alone, never resold."},
    "hook":    {"kicker": "YOUR WEBSITE",
                "head": [("98% of your HVAC", WHITE), ("site visitors leave.", WHITE), ("Get them back.", MINT)],
                "sub": "$7 each. Exclusive. Consent-first."},
    "reframe": {"kicker": "STOP RENTING LEADS",
                "head": [("Own your HVAC leads.", WHITE), ("Don't rent them.", MINT)],
                "sub": "Consent-first leads — $7, yours alone, never resold."},
}
SIZES = {"meta-square": (1080, 1080), "meta-feed-4x5": (1080, 1350), "meta-story": (1080, 1920), "landscape": (1200, 628), "square": (1200, 1200)}
CTA = "See the 2-minute demo  →"

def render(angle, key, w, h):
    a = ANGLES[angle]; cx = w // 2
    logo_y = int(h * 0.07); logo_h = int(LOGO.height * (w * 0.30) / LOGO.width)
    img = base(w, h, logo_y); d = ImageDraw.Draw(img, "RGBA")
    head_px = int(w * (0.066 if h > w else 0.072))
    lines = a["head"]
    lh = int(head_px * 1.14)
    block_h = len(lines) * lh
    y = (h - block_h) // 2 - int(h * 0.03)
    # kicker — only in square/portrait; the short landscape has no vertical room for it
    if h >= w:
        kf = sans(max(20, int(w * 0.021)))
        pill(d, cx, y - int(head_px * 1.7), a["kicker"], kf, INKMINT, MINT, int(w * 0.02), int(w * 0.012))
    # headline
    for txt, col in lines:
        fn = disp(head_px)
        while SCR.textlength(txt, font=fn) > w * 0.88 and fn.size > 20: fn = disp(fn.size - 2)
        ctext(d, cx, y, txt, fn, col); y += lh
    # sub
    y += int(h * 0.025)
    sf = sans(int(w * 0.030))
    for ln in wrap(a["sub"], sf, int(w * 0.82)):
        ctext(d, cx, y, ln, sf, SLATE); y += int(sf.size * 1.35)
    # CTA
    pill(d, cx, int(h * 0.85), CTA, sans(int(w * 0.026)), INKMINT, MINT, int(w * 0.032), int(w * 0.018))
    out = OUT / f"hvac_{angle}_{key}_{w}x{h}.png"
    img.convert("RGB").save(out, quality=95)
    return out.name

if __name__ == "__main__":
    for angle in ANGLES:
        for key, (w, h) in SIZES.items():
            print(render(angle, key, w, h))
    print(f"DONE -> {OUT} ({len(ANGLES)*len(SIZES)} ads)")
