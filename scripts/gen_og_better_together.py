#!/usr/bin/env python3
"""Bespoke Open Graph image (1200x630) for the /better-together field-kit landing.

Not the generic template card — this one is cinematic: a real wrapped-van photo,
full-bleed, navy-graded on the left for legibility, with the field-kit story
($7 leads + the gear that mails itself). Output: public/og/better-together.png
"""
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = Path("/Users/aaronphillips/GIT/consentresolve2")
BRI = str(ROOT / "scripts/.fonts/Bricolage.ttf")
HAN = str(ROOT / "scripts/.fonts/Hanken.ttf")
LOGO = ROOT / "public/logo-on-dark.png"
PHOTO = ROOT / "public/better-together/truck-wraps/truck-wrap-01.webp"
OUT = ROOT / "public/og" / "better-together.png"
OUT.parent.mkdir(parents=True, exist_ok=True)

W, H = 1200, 630
NAVY = (10, 22, 40); MINT = (0, 229, 160); WHITE = (245, 248, 250); SLATE = (203, 213, 225)
PAD = 80


def font(p, s): return ImageFont.truetype(p, s)


def cover(im, w, h):
    """Resize+center-crop to exactly wxh (object-fit: cover)."""
    r = max(w / im.width, h / im.height)
    im = im.resize((round(im.width * r), round(im.height * r)), Image.LANCZOS)
    x = (im.width - w) // 2; y = (im.height - h) // 2
    return im.crop((x, y, x + w, y + h))


# 1) cinematic van photo, full-bleed
base = cover(Image.open(PHOTO).convert("RGB"), W, H)

# 2) navy grade: opaque on the left (for text), clearing toward the van on the right
grad = np.zeros((H, W, 4), np.uint8)
xs = np.linspace(0, 1, W)
alpha = (250 - (250 - 70) * np.clip((xs - 0.02) / 0.72, 0, 1)).astype(np.uint8)  # 250 -> 70
grad[..., 0], grad[..., 1], grad[..., 2] = NAVY
grad[..., 3] = alpha[None, :]
img = Image.alpha_composite(base.convert("RGBA"), Image.fromarray(grad))

# faint mint glow, top-right, over the van
glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
ImageDraw.Draw(glow).ellipse([W - 460, -300, W + 260, 300], fill=(*MINT, 55))
img = Image.alpha_composite(img, glow.filter(ImageFilter.GaussianBlur(130)))
# bottom vignette + mint hairline
vg = Image.new("RGBA", (W, H), (0, 0, 0, 0))
ImageDraw.Draw(vg).rectangle([0, H - 200, W, H], fill=(*NAVY, 130))
img = Image.alpha_composite(img, vg.filter(ImageFilter.GaussianBlur(60))).convert("RGB")
d = ImageDraw.Draw(img)
d.rectangle([0, H - 8, W, H], fill=MINT)

# 3) logo
try:
    lg = Image.open(LOGO).convert("RGBA"); lw = 268; lh = int(lg.height * lw / lg.width)
    lg = lg.resize((lw, lh), Image.LANCZOS); img.paste(lg, (PAD, 60), lg)
except Exception as e:
    print("logo skip:", e)

# 4) headline — "Better together." (mint second word)
TOP = 168
hf = font(BRI, 110)
d.text((PAD, TOP), "Better", font=hf, fill=WHITE)
d.text((PAD, TOP + 116), "together.", font=hf, fill=MINT)

# 5) subline
sf = font(HAN, 32)
d.text((PAD, TOP + 250), "$7 exclusive leads — and the signs, hangers", font=sf, fill=SLATE)
d.text((PAD, TOP + 250 + 42), "and truck wrap ship to you.", font=sf, fill=SLATE)

# 6) mint "$7 A LEAD · GEAR INCLUDED" chip
cf = font(HAN, 27)
label = "$7 A LEAD  ·  GEAR INCLUDED"
padx, pady = 26, 14
pw = int(d.textlength(label, font=cf) + 2 * padx); ph = 27 + 2 * pady
py = H - 56 - ph
d.rounded_rectangle([PAD, py, PAD + pw, py + ph], radius=ph // 2, fill=MINT)
d.text((PAD + padx, py + pady - 2), label, font=cf, fill=NAVY)
d.text((PAD + pw + 24, py + (ph - 26) // 2), "consentresolve.com", font=font(HAN, 26), fill=(148, 163, 184))

img.save(OUT, quality=92)
print("wrote", OUT.relative_to(ROOT), img.size)
