#!/usr/bin/env python3
"""X (Twitter) header / cover photo, 1500x500. Brand navy + mint, matches the YouTube
banner. Content kept centered & upper so the profile avatar (lower-left) doesn't cover it.
  python3 scripts/x_header.py  ->  consentresolve2/x-header.png
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
ROOT = Path(__file__).resolve().parent.parent
HANKEN = str(ROOT / "scripts/.fonts/Hanken.ttf")
W, H = 1500, 500
MINT, TEXT, SUB = (0, 229, 160), (245, 248, 250), (148, 163, 184)
def font(s): return ImageFont.truetype(HANKEN, s)
def ctext(d, cx, y, t, f, fill):
    w = d.textlength(t, font=f); d.text((cx - w/2, y), t, font=f, fill=fill)

img = Image.new("RGB", (W, H), (10, 22, 40)); d = ImageDraw.Draw(img)
for y in range(H):
    t = y/H; d.line([(0, y), (W, y)], fill=(int(8+10*t), int(18+12*t), int(34+16*t)))
# faint converging-lines motif on both sides
ov = Image.new("RGBA", (W, H), (0, 0, 0, 0)); od = ImageDraw.Draw(ov)
for side in (-1, 1):
    apex = (W//2 + side*560, H//2-10)
    for off in (-110, -38, 38, 110):
        od.line([(W//2 + side*820, H//2-10+off), apex], fill=(0, 229, 160, 26), width=2)
    od.ellipse([apex[0]-8, apex[1]-8, apex[0]+8, apex[1]+8], fill=(0, 229, 160, 70))
img = Image.alpha_composite(img.convert("RGBA"), ov).convert("RGB"); d = ImageDraw.Draw(img)

cx = W//2
ctext(d, cx, 96, "Your leads should be yours.", font(62), TEXT)
# badges
badges = ["Exclusive", "Consent-First", "Never Resold", "For Service Pros"]
bf = font(26); bh = 50; padx = 22; gap = 16
widths = [d.textlength(b, font=bf) + padx*2 for b in badges]
total = sum(widths) + gap*(len(badges)-1)
x = cx - total/2; by = 210
for b, w in zip(badges, widths):
    d.rounded_rectangle([x, by, x+w, by+bh], radius=bh//2, fill=(12, 38, 30), outline=MINT, width=2)
    ctext(d, x + w/2, by + 9, b, bf, MINT); x += w + gap
# url pill
pill = "consentresolve.com/demo"; pf = font(28)
pw = d.textlength(pill, font=pf) + 64; by2 = 300
d.rounded_rectangle([cx-pw/2, by2, cx+pw/2, by2+52], radius=26, fill=(12, 38, 30), outline=MINT, width=2)
ctext(d, cx, by2+8, pill, pf, MINT)

out = ROOT / "x-header.png"; img.save(out, "PNG")
print(f"wrote {out} ({out.stat().st_size/1e6:.2f} MB, {W}x{H})")
