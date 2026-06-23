#!/usr/bin/env python3
"""End-card for the founder daily reel: a phone-style 'Send Private Message' sheet to
Andy / Tyler / Jason that animates compose -> sending -> sent securely. Outputs 3 PNG
frames (1080x1920). No emoji (PIL fonts lack color glyphs) — icons are drawn shapes.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path("/Users/aaronphillips/GIT/consentresolve2")
HAN = str(ROOT / "scripts/.fonts/Hanken.ttf")
BRI = str(ROOT / "scripts/.fonts/Bricolage.ttf")
NAVY = (10, 22, 40); CARD = (17, 30, 50); SLATE = (148, 163, 184)
MINT = (0, 229, 160); WHITE = (240, 245, 250); INKMINT = (6, 40, 31)
W, H = 1080, 1920
han = lambda s: ImageFont.truetype(HAN, s)
bri = lambda s: ImageFont.truetype(BRI, s)
RECIPIENTS = [("AM", "Andy Mentges"), ("TS", "Tyler Spurlock"), ("JB", "Jason Beyke")]

def ctext(d, cx, y, t, f, fill):
    w = d.textlength(t, font=f); d.text((cx - w / 2, y), t, font=f, fill=fill); return w

def padlock(d, cx, cy, s, col):
    # shackle (arc) + body (rounded rect)
    d.arc([cx - s * 0.42, cy - s * 0.9, cx + s * 0.42, cy - s * 0.1], 180, 360, fill=col, width=max(3, s // 7))
    d.rounded_rectangle([cx - s * 0.55, cy - s * 0.25, cx + s * 0.55, cy + s * 0.7], radius=s * 0.18, fill=col)

def card(state):
    img = Image.new("RGB", (W, H), NAVY); d = ImageDraw.Draw(img)
    # header
    padlock(d, W // 2 - 165, 150, 26, MINT)
    ctext(d, W // 2 + 18, 128, "PRIVATE MESSAGE", han(40), MINT)
    d.line([(120, 215), (W - 120, 215)], fill=(255, 255, 255, 30), width=2)
    # recipients
    ctext(d, W // 2, 268, "To", han(34), SLATE)
    y = 340
    for ini, name in RECIPIENTS:
        cx = W // 2
        d.ellipse([cx - 320, y, cx - 248, y + 72], fill=(0, 229, 160, 255))
        iw = d.textlength(ini, font=han(30)); d.text((cx - 284 - iw / 2, y + 18), ini, font=han(30), fill=INKMINT)
        d.text((cx - 224, y + 6), name, font=han(40), fill=WHITE)
        d.text((cx - 224, y + 48), "Consent Resolve", font=han(26), fill=SLATE)
        # online dot
        d.ellipse([cx + 250, y + 28, cx + 270, y + 48], fill=MINT)
        y += 110
    # attachment bubble
    by = 730
    d.rounded_rectangle([150, by, W - 150, by + 430], radius=34, fill=CARD)
    # video thumb
    try:
        th = Image.open("/tmp/founder-frame.png").convert("RGB").resize((300, 300))
        m = Image.new("L", (300, 300), 0); ImageDraw.Draw(m).rounded_rectangle([0, 0, 300, 300], radius=26, fill=255)
        img.paste(th, (200, by + 60), m)
        d.polygon([(330, by + 175), (330, by + 235), (385, by + 205)], fill=WHITE)
    except Exception as e:
        print("thumb skip", e)
    d.text((540, by + 95), "today.mp4", font=han(38), fill=WHITE)
    d.text((540, by + 150), "0:48 · 24.1 MB", font=han(30), fill=SLATE)
    d.text((200, by + 330), "Do NOT share this — just the guys.", font=han(34), fill=SLATE)
    # action zone
    ay = 1480
    if state == "compose":
        d.rounded_rectangle([180, ay, W - 180, ay + 150], radius=40, fill=MINT)
        ctext(d, W // 2, ay + 42, "Send", bri(58), INKMINT)
    elif state == "sending":
        d.rounded_rectangle([180, ay, W - 180, ay + 150], radius=40, fill=CARD)
        ctext(d, W // 2 - 40, ay + 46, "Sending", bri(52), WHITE)
        for i, dx in enumerate((30, 70, 110)):
            d.ellipse([W // 2 + 120 + dx, ay + 70, W // 2 + 138 + dx, ay + 88], fill=SLATE if i else MINT)
    else:  # sent
        cx, cy = W // 2, ay + 30
        d.ellipse([cx - 55, cy - 55, cx + 55, cy + 55], fill=MINT)
        d.line([(cx - 26, cy + 2), (cx - 6, cy + 24)], fill=INKMINT, width=11)
        d.line([(cx - 6, cy + 24), (cx + 30, cy - 22)], fill=INKMINT, width=11)
        ctext(d, W // 2, cy + 80, "Sent securely", bri(56), MINT)
        padlock(d, W // 2 - 175, cy + 178, 20, SLATE)
        ctext(d, W // 2 + 14, cy + 158, "End-to-end encrypted", han(34), SLATE)
    return img

if __name__ == "__main__":
    for s in ("compose", "sending", "sent"):
        card(s).save(f"/tmp/ec_{s}.png", quality=95)
        print("wrote /tmp/ec_" + s + ".png")
