#!/usr/bin/env python3
"""Generate on-brand Instagram profile assets: profile pic + 5 Highlight covers.
Brand: navy #0a1628, mint #00e5a0. Logo: public/logo-on-dark.png."""
import math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path("/Users/aaronphillips/GIT/consentresolve2")
OUT = ROOT / "build/ig"; OUT.mkdir(parents=True, exist_ok=True)
NAVY = (10, 22, 40); MINT = (0, 229, 160); WHITE = (255, 255, 255)
S = 1080; C = S // 2
BRI = str(ROOT / "scripts/.fonts/Bricolage.ttf")

# --- profile pic: logo centered on navy ---
bg = Image.new("RGB", (S, S), NAVY)
logo = Image.open(ROOT / "public/logo-on-dark.png").convert("RGBA")
w = int(S * 0.66); h = int(logo.height * w / logo.width)
logo = logo.resize((w, h), Image.LANCZOS)
bg.paste(logo, (C - w // 2, C - h // 2), logo)
bg.save(OUT / "profile.png")

# --- highlight covers: centered mint glyph on navy ---
def cover(name, draw_glyph):
    img = Image.new("RGB", (S, S), NAVY)
    d = ImageDraw.Draw(img)
    draw_glyph(d)
    img.save(OUT / f"hl-{name}.png")

def play(d):
    d.polygon([(C-130, C-180), (C-130, C+180), (C+200, C)], fill=MINT)

def arrow(d):  # the 98% "leak" — down arrow
    d.rectangle([C-55, C-200, C+55, C+60], fill=MINT)
    d.polygon([(C-150, C+40), (C+150, C+40), (C, C+210)], fill=MINT)

def dollar(d):
    f = ImageFont.truetype(BRI, 560)
    tb = d.textbbox((0, 0), "$", font=f)
    d.text((C-(tb[2]-tb[0])//2-tb[0], C-(tb[3]-tb[1])//2-tb[1]), "$", font=f, fill=MINT)

def check(d):
    d.line([(C-180, C+10), (C-50, C+150), (C+190, C-170)], fill=MINT, width=70, joint="curve")

def star(d):
    pts = []
    for i in range(10):
        ang = -math.pi/2 + i*math.pi/5
        r = 220 if i % 2 == 0 else 95
        pts.append((C + r*math.cos(ang), C + r*math.sin(ang)))
    d.polygon(pts, fill=MINT)

cover("howitworks", play)
cover("leak", arrow)
cover("pricing", dollar)
cover("consent", check)
cover("proof", star)

print("assets ->", OUT)
for p in sorted(OUT.glob("*.png")):
    print("  ", p.name)
