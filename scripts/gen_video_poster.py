#!/usr/bin/env python3
"""Design a click-worthy video cover (poster) for the problem-section UGC video.
Tyler's face (a frame from the clip) is the hook; adds a glowing mint play button,
one curiosity headline with a contrast stroke (MrBeast-style, kept tasteful), and a
small logo. Brand: navy/mint, Bricolage display. -> public/video/<out>.jpg

  python3 scripts/gen_video_poster.py <frame.png> <out.jpg> "Headline" "MINTWORD"
"""
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance

ROOT = Path("/Users/aaronphillips/GIT/consentresolve2")
BRI = str(ROOT / "scripts/.fonts/Bricolage.ttf")
LOGO = ROOT / "public/logo-on-dark.png"
NAVY = (10, 22, 40); MINT = (0, 229, 160); WHITE = (245, 248, 250)
W, H = 1280, 720

frame = sys.argv[1] if len(sys.argv) > 1 else "/tmp/pf_2.5.png"
out = sys.argv[2] if len(sys.argv) > 2 else "public/video/hvac-poster.jpg"
HEAD = sys.argv[3] if len(sys.argv) > 3 else "Where do the other 98 go?"
MINTW = sys.argv[4] if len(sys.argv) > 4 else "98"

img = Image.open(frame).convert("RGB").resize((W, H), Image.LANCZOS)
# Subtle "pop" — a touch more contrast + saturation (thumbnail energy, not garish)
img = ImageEnhance.Contrast(img).enhance(1.08)
img = ImageEnhance.Color(img).enhance(1.12)
img = img.convert("RGBA")

# Cinematic gradients: darken top (logo) + bottom (headline) for legibility/drama.
grad = Image.new("RGBA", (W, H), (0, 0, 0, 0))
gd = ImageDraw.Draw(grad)
for y in range(H):
    top = max(0, int(150 * (1 - y / 240))) if y < 240 else 0
    bot = max(0, int(205 * ((y - 360) / (H - 360)))) if y > 360 else 0
    a = max(top, bot)
    if a:
        gd.line([(0, y), (W, y)], fill=(*NAVY, a))
img = Image.alpha_composite(img, grad)

d = ImageDraw.Draw(img)

# --- Glowing mint play button (the click magnet), lower-center over the chest ---
# Pass "noplay" as an extra arg to skip it (e.g. when the page draws its own
# custom play button overlay, so the poster shouldn't bake one in).
if "noplay" not in sys.argv:
    cx, cy, r = W // 2, 430, 64
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(glow).ellipse([cx - r * 2, cy - r * 2, cx + r * 2, cy + r * 2], fill=(*MINT, 120))
    img = Image.alpha_composite(img, glow.filter(ImageFilter.GaussianBlur(40)))
    d = ImageDraw.Draw(img)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(*MINT, 255), outline=(255, 255, 255, 230), width=5)
    tri = r * 0.46
    d.polygon([(cx - tri * 0.6, cy - tri), (cx - tri * 0.6, cy + tri), (cx + tri, cy)], fill=NAVY)
d = ImageDraw.Draw(img)

# --- Logo (top-left, small) ---
try:
    lg = Image.open(LOGO).convert("RGBA")
    lw = 190; lh = int(lg.height * lw / lg.width)
    img.alpha_composite(lg.resize((lw, lh), Image.LANCZOS), (44, 40))
except Exception as e:
    print("logo skipped:", e)

# --- Headline (bottom), one line, mint accent word, dark stroke for contrast ---
d = ImageDraw.Draw(img)
fs = 66
font = ImageFont.truetype(BRI, fs)
parts, cur = [], 0
# split into (text, color) around the mint word
segs = []
for w in HEAD.split(" "):
    segs.append((w + " ", MINT if w.strip("?.,") == MINTW else WHITE))
total = sum(d.textlength(t, font=font) for t, _ in segs)
x = (W - total) / 2; y = 612
for t, col in segs:
    d.text((x, y), t, font=font, fill=col, stroke_width=4, stroke_fill=(6, 14, 28))
    x += d.textlength(t, font=font)

img.convert("RGB").save(ROOT / out, quality=90)
print("wrote", out, "headline:", HEAD)
