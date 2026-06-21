#!/usr/bin/env python3
"""Render the 7 motion-graphic scene stills (+ timed reveal overlays) for the
Thumbtack-Exposed explainer. All PIL, brand-styled, 1920x1080. Run: python3 scripts/tt_scenes.py"""
from PIL import Image, ImageDraw
from tt_lib import (W, H, SCENES, canvas, panel, center_text, disclaimer, font,
                    BG, PANEL, MINT, TEXT, SUB, RED, GOLD, LINE, log)

def save(img, name): img.save(SCENES / f"{name}.png")

def header(d, text, color=MINT):
    f = font(34); center_text(d, W//2, 70, text.upper(), f, color)
    d.line([(W//2-60, 120), (W//2+60, 120)], fill=color, width=4)

def hook():
    img = canvas(); d = ImageDraw.Draw(img)
    center_text(d, W//2, 120, "ONE TAP.", font(120), TEXT)
    center_text(d, W//2, 250, "FOUR CHARGES.", font(120), RED)
    center_text(d, W//2, 400, "Zero jobs booked.", font(44), SUB)
    # four contractor cards charged
    cw, gap = 360, 30; total = cw*4 + gap*3; x = (W-total)//2; y = 560
    for i in range(4):
        panel(d, [x, y, x+cw, y+260], fill=PANEL)
        center_text(d, x+cw//2, y+40, f"HVAC Pro #{i+1}", font(30), TEXT)
        d.rounded_rectangle([x+50, y+120, x+cw-50, y+200], radius=12, fill=(40,18,24), outline=RED, width=3)
        center_text(d, x+cw//2, y+140, "CHARGED", font(26), RED)
        center_text(d, x+cw//2, y+172, "$55", font(40), RED)
        x += cw+gap
    save(disclaimer(img), "hook")

def customer():
    img = canvas(); d = ImageDraw.Draw(img)
    header(d, "The homeowner's side: effortless")
    px, pw = W//2-260, 520; py, ph = 200, 760
    panel(d, [px, py, px+pw, py+ph], radius=40, fill=(16,30,52))
    panel(d, [px+40, py+60, px+pw-40, py+150], radius=18, fill=BG, outline=LINE)
    center_text(d, px+pw//2, py+88, "“AC not cooling”", font(38), TEXT)
    center_text(d, px+pw//2, py+185, "Matching you with pros…", font(28), MINT)
    yy = py+250
    for i in range(4):
        panel(d, [px+40, yy, px+pw-40, yy+80], radius=14, fill=PANEL)
        center_text(d, px+90, yy+24, f"Pro available", font(28), TEXT)
        d.ellipse([px+pw-90, yy+26, px+pw-62, yy+54], fill=MINT)
        yy += 100
    center_text(d, W//2, py+ph+24, "Two minutes. Zero cost. Sit back.", font(34), SUB)
    save(disclaimer(img), "customer")

def contractor():
    img = canvas(); d = ImageDraw.Draw(img)
    header(d, "Your side: you pay to play", RED)
    px, pw, py = W//2-460, 920, 190
    panel(d, [px, py, px+pw, py+150], radius=20, fill=PANEL)
    center_text(d, px+pw//2, py+30, "NEW LEAD · AC not cooling", font(38), TEXT)
    center_text(d, px+pw//2, py+90, "a homeowner just messaged you", font(28), SUB)
    panel(d, [px, py+180, px+pw, py+320], radius=20, fill=(40,18,24), outline=RED, width=3)
    center_text(d, px+pw//2, py+212, "YOUR CARD WAS CHARGED", font(32), RED)
    center_text(d, px+pw//2, py+254, "$55  —  win or lose", font(50), RED)
    # stamp
    panel(d, [px+pw-360, py+360, px+pw, py+440], radius=14, fill=(46,40,16), outline=GOLD, width=3)
    center_text(d, px+pw-180, py+388, "ALSO SENT TO 4 PROS", font(26), GOLD)
    center_text(d, px+200, py+395, "1 lead.  4–5 pros.", font(40), TEXT)
    panel(d, [px, py+480, px+pw, py+580], radius=16, fill=PANEL)
    center_text(d, px+pw//2, py+510, "$35–$90 per contact · price updates weekly", font(34), GOLD)
    save(disclaimer(img), "contractor")

def math(reveal=False):
    img = canvas(); d = ImageDraw.Draw(img)
    header(d, "A typical HVAC month")
    rows = [("30 leads  ×  $55", "= $1,650 / month", SUB),
            ("shared with 4 pros", "you're 1 of 4 voices", SUB),
            ("~50% reply", "15 real conversations", SUB),
            ("win 1 in 4", "4 booked jobs", SUB)]
    y = 200; bw = 1100; x = (W-bw)//2
    for a, b, c in rows:
        panel(d, [x, y, x+bw, y+96], radius=16, fill=PANEL)
        d.text((x+40, y+28), a, font=font(40), fill=TEXT)
        w = d.textlength(b, font=font(40)); d.text((x+bw-40-w, y+28), b, font=font(40), fill=MINT)
        y += 116
    if reveal:
        panel(d, [W//2-480, y+16, W//2+480, y+286], radius=22, fill=(40,18,24), outline=RED, width=4)
        center_text(d, W//2, y+40, "TRUE COST PER BOOKED JOB", font(30), SUB)
        center_text(d, W//2, y+78, "$412", font(112), RED)
        center_text(d, W//2, y+228, "even a great month is north of $200", font(28), GOLD)
    save(disclaimer(img), "math_reveal" if reveal else "math")

def complaints():
    img = canvas(); d = ImageDraw.Draw(img)
    header(d, "Reddit · BBB · review sites: the same 4 stories", RED)
    quotes = ["“Paid $78 for a lead that never texted back.”",
              "“Won the job — still charged for the 3 I lost.”",
              "“Refund came back as credit, not cash.”",
              "“Set my service area — billed for a lead 2 states away.”"]
    cw, ch, gx, gy = 820, 270, 40, 36; x0 = (W - (cw*2+gx))//2; y0 = 200
    for i, q in enumerate(quotes):
        cx = x0 + (i % 2)*(cw+gx); cy = y0 + (i//2)*(ch+gy)
        panel(d, [cx, cy, cx+cw, cy+ch], radius=20, fill=PANEL)
        center_text(d, cx+cw//2, cy+40, f"#{i+1}", font(34), GOLD)
        # wrap quote
        import textwrap
        lines = textwrap.wrap(q, width=34); ty = cy+110
        for ln in lines:
            center_text(d, cx+cw//2, ty, ln, font(36), TEXT); ty += 46
        center_text(d, cx+cw//2, cy+ch-50, "— HVAC pro", font(26), SUB)
    save(disclaimer(img), "complaints")

def turn():
    img = canvas(); d = ImageDraw.Draw(img)
    center_text(d, W//2, 70, "IT'S NOT BAD LUCK. IT'S THE DESIGN.", font(48), TEXT)
    colw = 820; gx = 60; x0 = (W-(colw*2+gx))//2; y0 = 200; ch = 640
    # left: shared
    panel(d, [x0, y0, x0+colw, y0+ch], radius=24, fill=(34,18,24), outline=RED, width=3)
    center_text(d, x0+colw//2, y0+36, "SHARED PLATFORM", font(40), RED)
    for i, t in enumerate(["You're 1 of 4–5 pros", "They set the price", "Refund = store credit", "You rent the pipe"]):
        d.ellipse([x0+60, y0+150+i*110+6, x0+84, y0+150+i*110+30], outline=RED, width=3)
        d.text((x0+110, y0+150+i*110), t, font=font(40), fill=TEXT)
    # right: CR
    rx = x0+colw+gx
    panel(d, [rx, y0, rx+colw, y0+ch], radius=24, fill=(12,38,30), outline=MINT, width=3)
    center_text(d, rx+colw//2, y0+36, "CONSENT RESOLVE", font(40), MINT)
    for i, t in enumerate(["Exclusive — yours alone", "Consent-first opt-in", "$7 flat · never resold", "On your own website"]):
        d.ellipse([rx+60, y0+150+i*110+6, rx+84, y0+150+i*110+30], fill=MINT)
        d.text((rx+110, y0+150+i*110), t, font=font(40), fill=TEXT)
    save(disclaimer(img), "turn")

def end():
    img = canvas(); d = ImageDraw.Draw(img)
    center_text(d, W//2, 300, "Stop paying to enter the race.", font(72), TEXT)
    center_text(d, W//2, 400, "Start owning the finish line.", font(72), MINT)
    panel(d, [W//2-360, 560, W//2+360, 660], radius=50, fill=(12,38,30), outline=MINT, width=3)
    center_text(d, W//2, 585, "ConsentResolve.com/demo", font(48), MINT)
    center_text(d, W//2, 720, "$7 a lead   ·   yours alone   ·   consent-first", font(38), SUB)
    save(img, "end")

def main():
    log("SCENES: rendering")
    hook(); customer(); contractor(); math(False); math(True); complaints(); turn(); end()
    log("SCENES: done (8 stills)")

if __name__ == "__main__":
    main()
