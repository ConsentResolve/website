#!/usr/bin/env python3
"""Generate a YouTube channel banner (2048x1152). All critical text sits inside the
center safe area (1235x338) so it shows on every device. Brand navy + mint.
  python3 scripts/yt_banner.py
Output: consentresolve2/yt-channel-banner.png
"""
import math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter
ROOT = Path(__file__).resolve().parent.parent
HANKEN = str(ROOT / "scripts/.fonts/Hanken.ttf")
W, H = 2048, 1152
BG, MINT, TEXT, SUB = (10, 22, 40), (0, 229, 160), (245, 248, 250), (148, 163, 184)
def font(s): return ImageFont.truetype(HANKEN, s)
def ctext(d, cx, y, t, f, fill, ls=0):
    if ls:
        # letter-spaced
        total = sum(d.textlength(c, font=f) + ls for c in t) - ls
        x = cx - total/2
        for c in t:
            d.text((x, y), c, font=f, fill=fill); x += d.textlength(c, font=f) + ls
        return
    w = d.textlength(t, font=f); d.text((cx - w/2, y), t, font=f, fill=fill)

img = Image.new("RGB", (W, H), BG)
d = ImageDraw.Draw(img)
# vertical gradient + edge vignette
for y in range(H):
    t = y / H
    d.line([(0, y), (W, y)], fill=(int(8+10*t), int(18+12*t), int(34+16*t)))

# faint side motif: "4 lines converge to 1" (shared -> exclusive), low opacity, framing the center
ov = Image.new("RGBA", (W, H), (0, 0, 0, 0)); od = ImageDraw.Draw(ov)
for side in (-1, 1):
    apex = (W//2 + side*760, H//2)
    for i, off in enumerate((-150, -50, 50, 150)):
        start = (W//2 + side*1120, H//2 + off)
        od.line([start, apex], fill=(0, 229, 160, 26), width=3)
    od.ellipse([apex[0]-10, apex[1]-10, apex[0]+10, apex[1]+10], fill=(0, 229, 160, 70))
# faint large dots
for (cx, cy, r, a) in [(180, 200, 90, 14), (1880, 950, 120, 14), (250, 950, 60, 12)]:
    od.ellipse([cx-r, cy-r, cx+r, cy+r], outline=(0, 229, 160, a), width=4)
img = Image.alpha_composite(img.convert("RGBA"), ov).convert("RGB")
d = ImageDraw.Draw(img)

# ── center safe area (1235x338), vertically centered: y 407..745 ──
cx = W//2
d.rectangle([cx-70, 430, cx+70, 436], fill=MINT)                       # accent rule
ctext(d, cx, 452, "CONSENT RESOLVE", font(40), MINT, ls=10)            # kicker
ctext(d, cx, 510, "Your leads should be yours.", font(96), TEXT)       # headline
ctext(d, cx, 628, "Exclusive  ·  consent-first  ·  $7 a lead  ·  never resold", font(40), SUB)
# url pill
pill = "consentresolve.com/demo"; pf = font(36)
pw = d.textlength(pill, font=pf) + 80
d.rounded_rectangle([cx-pw/2, 690, cx+pw/2, 752], radius=31, fill=(12, 38, 30), outline=MINT, width=2)
ctext(d, cx, 700, pill, pf, MINT)

out = ROOT / "yt-channel-banner.png"
img.save(out, "PNG")
print(f"wrote {out} ({out.stat().st_size/1e6:.2f} MB, {W}x{H})")
