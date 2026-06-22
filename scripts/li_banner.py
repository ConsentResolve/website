#!/usr/bin/env python3
"""LinkedIn banners, brand-matched to the YT/X assets:
  - li-company-cover.png   1128x191  (Company Page cover)
  - li-personal-banner.png 1584x396  (personal profile background)
Content kept centered/clear of the lower-left logo/avatar zone.
  python3 scripts/li_banner.py
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
ROOT = Path(__file__).resolve().parent.parent
HANKEN = str(ROOT / "scripts/.fonts/Hanken.ttf")
MINT, TEXT, SUB = (0, 229, 160), (245, 248, 250), (148, 163, 184)
def font(s): return ImageFont.truetype(HANKEN, s)
def ctext(d, cx, y, t, f, fill):
    w = d.textlength(t, font=f); d.text((cx - w/2, y), t, font=f, fill=fill)

def base(W, H):
    img = Image.new("RGB", (W, H), (10, 22, 40)); d = ImageDraw.Draw(img)
    for y in range(H):
        t = y/H; d.line([(0, y), (W, y)], fill=(int(8+10*t), int(18+12*t), int(34+16*t)))
    ov = Image.new("RGBA", (W, H), (0, 0, 0, 0)); od = ImageDraw.Draw(ov)
    for side in (-1, 1):
        apex = (W//2 + side*int(W*0.36), H//2)
        for off in (-H*0.22, -H*0.07, H*0.07, H*0.22):
            od.line([(W//2 + side*int(W*0.52), H/2+off), apex], fill=(0, 229, 160, 24), width=2)
        od.ellipse([apex[0]-6, apex[1]-6, apex[0]+6, apex[1]+6], fill=(0, 229, 160, 60))
    return Image.alpha_composite(img.convert("RGBA"), ov).convert("RGB")

def badges(d, cx, y, items, fs, h, padx, gap):
    f = font(fs)
    widths = [d.textlength(b, font=f) + padx*2 for b in items]
    total = sum(widths) + gap*(len(items)-1); x = cx - total/2
    for b, w in zip(items, widths):
        d.rounded_rectangle([x, y, x+w, y+h], radius=h//2, fill=(12, 38, 30), outline=MINT, width=2)
        ctext(d, x+w/2, y + (h-fs)//2 - 2, b, f, MINT); x += w + gap
PROPS = ["Exclusive", "Consent-First", "Never Resold", "For Service Pros"]

# 1) Company Page cover 1128x191. The page LOGO overlaps the lower-left, so reserve
# the left ~300px and place text in the right area, vertically centered.
W, H = 1128, 191; img = base(W, H); d = ImageDraw.Draw(img)
LOGO_CLEAR = 320
cx = (LOGO_CLEAR + (W - 50)) // 2           # center of the clear right-hand area
d.rectangle([cx-46, 44, cx+46, 50], fill=MINT)   # small accent rule
ctext(d, cx, 64, "Your leads should be yours.", font(44), TEXT)
ctext(d, cx, 122, "Exclusive · Consent-First · Never Resold · For Service Pros", font(21), MINT)
out1 = ROOT / "li-company-cover.png"; img.save(out1, "PNG")

# 2) Personal profile banner 1584x396 (roomy — headline + badges + url)
W, H = 1584, 396; img = base(W, H); d = ImageDraw.Draw(img); cx = W//2
ctext(d, cx, 96, "Your leads should be yours.", font(66), TEXT)
badges(d, cx, 200, PROPS, 28, 54, 24, 18)
pill = "consentresolve.com/demo"; pf = font(30)
pw = d.textlength(pill, font=pf) + 64; by = 290
d.rounded_rectangle([cx-pw/2, by, cx+pw/2, by+56], radius=28, fill=(12, 38, 30), outline=MINT, width=2)
ctext(d, cx, by+11, pill, pf, MINT)
out2 = ROOT / "li-personal-banner.png"; img.save(out2, "PNG")

for o, dim in ((out1, "1128x191"), (out2, "1584x396")):
    print(f"wrote {o.name} ({o.stat().st_size/1e6:.2f} MB, {dim})")
