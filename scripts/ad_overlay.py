#!/usr/bin/env python3
"""Overlay a Jobber-style headline + mint CTA pill + logo onto a photo ad (PIL).
Adds a top+bottom dark scrim for legibility over the photo.
Usage: ad_overlay.py --img in.png --headline "One lead. One pro." --cta "See a 2-min demo" --out out.png
"""
import argparse
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
FONTS = Path(__file__).resolve().parent / ".fonts"
BRICOLAGE = str(FONTS / "Bricolage.ttf")
LOGO = str(ROOT / "public" / "logo-on-dark.png")
NAVY = (10, 22, 40); MINT = (0, 229, 160); WHITE = (248, 250, 252)
W = H = 1080


def wrap(draw, text, font, maxw):
    lines, cur = [], ""
    for w in text.split():
        t = (cur + " " + w).strip()
        if draw.textlength(t, font=font) <= maxw:
            cur = t
        else:
            if cur:
                lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--img", required=True)
    ap.add_argument("--headline", required=True)
    ap.add_argument("--cta", default="See a 2-min demo")
    ap.add_argument("--out", required=True)
    a = ap.parse_args()

    im = Image.open(a.img).convert("RGB").resize((W, H))
    # top + bottom dark scrim for text legibility
    scrim = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    sd = ImageDraw.Draw(scrim)
    for y in range(H):
        top = int(200 * max(0.0, 1 - y / 500.0))
        bot = int(190 * max(0.0, (y - (H - 340)) / 340.0)) if y > H - 340 else 0
        sd.line([(0, y), (W, y)], fill=(6, 14, 26, max(top, bot)))
    im = Image.alpha_composite(im.convert("RGBA"), scrim).convert("RGB")
    d = ImageDraw.Draw(im)

    # headline (top-left, bold, wrapped)
    hf = ImageFont.truetype(BRICOLAGE, 76)
    y = 66
    for ln in wrap(d, a.headline, hf, W - 120):
        d.text((60, y), ln, font=hf, fill=WHITE)
        y += 90

    # CTA pill (bottom-left)
    cf = ImageFont.truetype(BRICOLAGE, 40)
    ctatext = "→  " + a.cta
    tw = d.textlength(ctatext, font=cf)
    pill_w, pill_h, px = int(tw + 76), 88, 60
    py = H - 66 - pill_h
    d.rounded_rectangle([px, py, px + pill_w, py + pill_h], radius=pill_h // 2, fill=MINT)
    d.text((px + 38, py + pill_h // 2), ctatext, font=cf, fill=NAVY, anchor="lm")

    # Logo lock-up: bigger, on a solid black rounded card, lower-right corner
    try:
        logo = Image.open(LOGO).convert("RGBA")
        lw = 360; lh = int(logo.height * lw / logo.width)
        pad_x, pad_y = 30, 26
        box_w, box_h = lw + pad_x * 2, lh + pad_y * 2
        margin = 48
        bx2, by2 = W - margin, H - margin
        bx1, by1 = bx2 - box_w, by2 - box_h
        d.rounded_rectangle([bx1, by1, bx2, by2], radius=26, fill=(0, 0, 0))
        im.paste(logo.resize((lw, lh)), (bx1 + pad_x, by1 + pad_y), logo.resize((lw, lh)))
    except Exception:
        pass

    im.save(a.out, quality=92)
    print("OK ->", a.out)


if __name__ == "__main__":
    main()
