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
    # recipient: the team group (no individual names)
    ctext(d, W // 2, 268, "To", han(34), SLATE)
    cx = W // 2; y = 360
    d.ellipse([cx - 300, y, cx - 212, y + 88], fill=MINT)
    iw = d.textlength("LZ", font=han(38)); d.text((cx - 256 - iw / 2, y + 22), "LZ", font=han(38), fill=INKMINT)
    d.text((cx - 188, y + 8), "Lead Zeppelin", font=han(46), fill=WHITE)
    d.text((cx - 188, y + 58), "Team group · 3 members", font=han(28), fill=SLATE)
    d.ellipse([cx + 248, y + 34, cx + 270, y + 56], fill=MINT)
    # attachment bubble — clean video-file glyph (no warped photo)
    by = 760
    d.rounded_rectangle([150, by, W - 150, by + 350], radius=34, fill=CARD)
    gx, gy = 230, by + 65
    d.rounded_rectangle([gx, gy, gx + 210, gy + 210], radius=24, fill=(13, 33, 40), outline=MINT, width=4)
    d.polygon([(gx + 82, gy + 64), (gx + 82, gy + 146), (gx + 152, gy + 105)], fill=MINT)
    d.text((500, by + 86), "today.mp4", font=han(42), fill=WHITE)
    d.text((500, by + 144), "0:48 · vertical", font=han(30), fill=SLATE)
    d.text((200, by + 272), "Do NOT share this — just the team.", font=han(32), fill=SLATE)
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
