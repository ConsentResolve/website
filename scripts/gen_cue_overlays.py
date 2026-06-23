#!/usr/bin/env python3
"""Transparent visual-cue overlays for the founder daily reel (1080x1920 RGBA):
a REC badge, a Siri 'listening' orb, and keyword pop pills. Composited over the
main clip at timestamps by the assembly step; each pairs with a small SFX.
Lower-third placement so they don't cover the face.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = Path("/Users/aaronphillips/GIT/consentresolve2")
HAN = str(ROOT / "scripts/.fonts/Hanken.ttf"); BRI = str(ROOT / "scripts/.fonts/Bricolage.ttf")
MINT = (0, 229, 160); NAVY = (10, 22, 40); WHITE = (245, 248, 250)
W, H = 1080, 1920
han = lambda s: ImageFont.truetype(HAN, s); bri = lambda s: ImageFont.truetype(BRI, s)

def new(): return Image.new("RGBA", (W, H), (0, 0, 0, 0))
def ctext(d, cx, y, t, f, fill):
    w = d.textlength(t, font=f); d.text((cx - w / 2, y), t, font=f, fill=fill); return w

# REC badge (top-right)
img = new(); d = ImageDraw.Draw(img)
d.rounded_rectangle([W - 300, 70, W - 60, 142], radius=36, fill=(0, 0, 0, 150))
d.ellipse([W - 280, 92, W - 252, 120], fill=(255, 70, 70, 255))
d.text((W - 238, 88), "REC", font=han(40), fill=(255, 255, 255, 255))
img.save("/tmp/ov_rec.png")

# Siri 'listening' orb (bottom-center) — soft multi-color glow
img = new(); cx, cy = W // 2, 1560
glow = Image.new("RGBA", (W, H), (0, 0, 0, 0)); gd = ImageDraw.Draw(glow)
for r, col in ((150, (0, 229, 160, 90)), (115, (34, 211, 238, 110)), (80, (167, 139, 250, 130))):
    gd.ellipse([cx - r, cy - r, cx + r, cy + r], fill=col)
img = Image.alpha_composite(img, glow.filter(ImageFilter.GaussianBlur(34)))
d = ImageDraw.Draw(img)
d.ellipse([cx - 70, cy - 70, cx + 70, cy + 70], fill=(8, 16, 30, 210), outline=(0, 229, 160, 230), width=4)
ctext(d, cx, cy + 96, "“Hey Siri”", han(44), (255, 255, 255, 235))
img.save("/tmp/ov_siri.png")

def pill(name, label, sub=None):
    img = new(); d = ImageDraw.Draw(img)
    f = bri(60); tw = d.textlength(label, font=f)
    x0 = (W - tw) // 2 - 46; x1 = (W + tw) // 2 + 46; y0 = 1230; y1 = 1230 + (150 if sub else 120)
    # shadow + pill
    sh = new(); ImageDraw.Draw(sh).rounded_rectangle([x0, y0 + 10, x1, y1 + 10], radius=34, fill=(0, 0, 0, 130))
    img = Image.alpha_composite(img, sh.filter(ImageFilter.GaussianBlur(18))); d = ImageDraw.Draw(img)
    d.rounded_rectangle([x0, y0, x1, y1], radius=34, fill=(0, 229, 160, 255))
    ctext(d, W // 2, y0 + (24 if sub else 28), label, f, NAVY)
    if sub: ctext(d, W // 2, y0 + 92, sub, han(34), (6, 40, 31, 255))
    img.save(f"/tmp/{name}.png")

pill("ov_lz", "LEAD ZEPPELIN", "// new team name")
pill("ov_leads", "98 ANON → NAMED LEADS")
pill("ov_hvac", "it’s “aitch-vack” ✓")
print("overlays written: rec, siri, lz, leads, hvac")
