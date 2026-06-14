#!/usr/bin/env python3
"""Facebook on-platform formats — photo cards, carousels, stories — in the locked
navy/mint Consent Resolve brand. The native content FB rewards (vs throttled link
posts). "Own Your Traffic" angle, Heartbeat-v2 voice: dry, no exclamation, no
competitor names (the machine / the big lead sites), email not phone, $7 /
exclusive / consent-first / demo, 98-of-100 OK, never a "% identified" claim.

Renders to build/social-cards/*.png:
  - 6 feed photo cards (4:5, 1080x1350)
  - 2 carousels (4:5 slides): how-it-works (5), shared-vs-yours (4)
  - 3 stories (9:16, 1080x1920)
Phase 1 = content for review (no posting wiring; that's Phase 2).
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = Path("/Users/aaronphillips/GIT/consentresolve2")
OUT = ROOT / "build/social-cards"; OUT.mkdir(parents=True, exist_ok=True)
NAVY9 = (10, 22, 40); NAVY8 = (13, 27, 42); NAVY7 = (30, 41, 59)
MINT = (0, 229, 160); MINT3 = (0, 245, 176); RED = (255, 107, 107)
WHITE = (245, 248, 250); SLATE = (148, 163, 184); INKMINT = (6, 40, 31)
BRI = str(ROOT / "scripts/.fonts/Bricolage.ttf"); HAN = str(ROOT / "scripts/.fonts/Hanken.ttf")
LOGO = Image.open(ROOT / "public/logo-on-dark.png").convert("RGBA")
SCR = ImageDraw.Draw(Image.new("RGB", (10, 10)))

def disp(px): return ImageFont.truetype(BRI, px)
def sans(px): return ImageFont.truetype(HAN, px)
def fit(text, maxw, hi, lo, fn):
    s = hi
    while s > lo and SCR.textlength(text, font=fn(s)) > maxw: s -= 2
    return fn(s)
def wrap(text, fn, maxw):
    out, cur = [], ""
    for w in text.split():
        t = (cur + " " + w).strip()
        if SCR.textlength(t, font=fn) <= maxw: cur = t
        else: out.append(cur); cur = w
    if cur: out.append(cur)
    return out
def ctext(d, cx, y, text, fn, fill):
    w = SCR.textlength(text, font=fn); d.text((cx - w / 2, y), text, font=fn, fill=fill); return fn.size

def base(w, h, logo_y=None):
    img = Image.new("RGB", (w, h), NAVY9); d = ImageDraw.Draw(img, "RGBA")
    for y in range(h):
        f = y / h; d.line([(0, y), (w, y)], fill=tuple(int(NAVY8[i] + (NAVY9[i] - NAVY8[i]) * f) for i in range(3)))
    gl = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    ImageDraw.Draw(gl).ellipse([w // 2 - 360, -300, w // 2 + 360, 300], fill=(0, 229, 160, 40))
    img = Image.alpha_composite(img.convert("RGBA"), gl.filter(ImageFilter.GaussianBlur(150)))
    d = ImageDraw.Draw(img, "RGBA")
    for gx in range(50, w, 54):
        for gy in range(50, h, 54): d.ellipse([gx, gy, gx + 2, gy + 2], fill=(148, 163, 184, 12))
    if logo_y is not None:
        lw = int(w * 0.40); lh = int(LOGO.height * lw / LOGO.width)
        lg = LOGO.resize((lw, lh), Image.LANCZOS); img.alpha_composite(lg, (w // 2 - lw // 2, logo_y))
    return img

def pill(d, cx, y, text, fn, fg, bg, padx=34, pady=18):
    tw = SCR.textlength(text, font=fn); w = int(tw) + padx * 2; h = fn.size + pady * 2
    x0 = cx - w // 2
    d.rounded_rectangle([x0, y, x0 + w, y + h], radius=h // 2, fill=bg)
    d.text((cx - tw / 2, y + pady - 2), text, font=fn, fill=fg); return h

def eyebrow(d, cx, y, text):
    fn = sans(34); tw = SCR.textlength(" ".join(text), font=fn)
    d.text((cx - tw / 2, y), " ".join(text), font=fn, fill=MINT); return fn.size

# ── feed photo cards (4:5) ───────────────────────────────────────────────────
def card(name, render):
    W, H = 1080, 1350; img = base(W, H, logo_y=80); d = ImageDraw.Draw(img, "RGBA"); cx = W // 2
    render(d, cx, W, H)
    img.convert("RGB").save(OUT / f"{name}.png"); print(name)

def c_leak(d, cx, W, H):
    eyebrow(d, cx, 300, "THE LEAK")
    ctext(d, cx, 380, "98 of 100", disp(150), RED)
    for i, ln in enumerate(["leave your website", "without a trace."]):
        ctext(d, cx, 560 + i * 78, ln, disp(72), WHITE)
    for i, ln in enumerate(wrap("You paid for every click. They never call, and you never even knew they were there.", sans(46), 860)):
        ctext(d, cx, 800 + i * 60, ln, sans(46), SLATE)
    ctext(d, cx, 1240, "consentresolve.com/demo", sans(38), MINT3)

def c_offer(d, cx, W, H):
    eyebrow(d, cx, 320, "THE FIX")
    ctext(d, cx, 400, "$7", disp(240), MINT)
    ctext(d, cx, 680, "a lead.", disp(80), WHITE)
    for i, ln in enumerate(["Exclusive. Never resold.", "From the traffic you already have."]):
        ctext(d, cx, 820 + i * 64, ln, sans(48), SLATE)
    ctext(d, cx, 1240, "consentresolve.com/demo", sans(38), MINT3)

def c_race(d, cx, W, H):
    eyebrow(d, cx, 330, "SHARED LEADS")
    ctext(d, cx, 410, "1 lead.", disp(120), WHITE)
    ctext(d, cx, 560, "4 contractors.", disp(120), RED)
    for i, ln in enumerate(wrap("That's not a lead. That's a footrace — and you're paying to run it.", sans(48), 860)):
        ctext(d, cx, 780 + i * 64, ln, sans(48), SLATE)
    ctext(d, cx, 1240, "Own your traffic · consentresolve.com", sans(36), MINT3)

def c_quote(quote, attrib):
    def r(d, cx, W, H):
        ctext(d, cx, 300, "“", disp(160), MINT)
        lines = wrap(quote, disp(76), 900)
        y = 540 - len(lines) * 46
        for ln in lines:
            ctext(d, cx, y, ln, disp(76), WHITE); y += 92
        ctext(d, cx, y + 40, attrib, sans(40), SLATE)
        ctext(d, cx, 1240, "consentresolve.com/demo", sans(36), MINT3)
    return r

def c_cpbj(d, cx, W, H):
    eyebrow(d, cx, 250, "COST PER BOOKED JOB")
    # shared (amber-ish red) box
    d.rounded_rectangle([110, 360, W - 110, 600], radius=26, fill=(255, 107, 107, 26), outline=acol_red(), width=3)
    ctext(d, cx, 400, "Shared leads", sans(40), RED)
    ctext(d, cx, 452, "$575", disp(120), WHITE)
    # consent box
    d.rounded_rectangle([110, 650, W - 110, 900], radius=26, fill=(0, 229, 160, 26), outline=(0, 229, 160, 200), width=3)
    ctext(d, cx, 690, "Consent Resolve", sans(40), MINT3)
    ctext(d, cx, 742, "$140", disp(120), WHITE)
    for i, ln in enumerate(wrap("Same booked job. $7 a lead, exclusive — instead of a shared one sold to four of you.", sans(44), 880)):
        ctext(d, cx, 980 + i * 58, ln, sans(44), SLATE)
    ctext(d, cx, 1250, "Run your numbers · consentresolve.com/lead-math", sans(34), MINT3)

def acol_red(): return (255, 107, 107, 200)

# ── carousels (4:5 slides) ───────────────────────────────────────────────────
def cslide(name, render):
    W, H = 1080, 1350; img = base(W, H, logo_y=70); d = ImageDraw.Draw(img, "RGBA"); cx = W // 2
    render(d, cx, W, H)
    img.convert("RGB").save(OUT / f"{name}.png"); print(name)

def cover(eyebrow_t, title):
    def r(d, cx, W, H):
        eyebrow(d, cx, 360, eyebrow_t)
        lines = wrap(title, disp(96), 900)
        y = 560 - len(lines) * 56
        for ln in lines:
            ctext(d, cx, y, ln, disp(96), WHITE); y += 112
        ctext(d, cx, 1230, "swipe →", sans(40), MINT3)
    return r

def step(num, title, body):
    def r(d, cx, W, H):
        d.ellipse([cx - 56, 300, cx + 56, 412], fill=MINT)
        ctext(d, cx, 320, str(num), disp(72), INKMINT)
        ty = 470
        for ln in wrap(title, disp(72), 920):
            ctext(d, cx, ty, ln, disp(72), WHITE); ty += 86
        ty += 24
        for ln in wrap(body, sans(48), 880):
            ctext(d, cx, ty, ln, sans(48), SLATE); ty += 62
    return r

def cmp_slide(label, labelcol, big, body):
    def r(d, cx, W, H):
        ctext(d, cx, 420, label, sans(48), labelcol)
        ctext(d, cx, 490, big, disp(150), WHITE)
        ty = 720
        for ln in wrap(body, sans(50), 880):
            ctext(d, cx, ty, ln, sans(50), SLATE); ty += 64
    return r

def cta_slide(line, url):
    def r(d, cx, W, H):
        ty = 480
        for ln in wrap(line, disp(88), 900):
            ctext(d, cx, ty, ln, disp(88), WHITE); ty += 104
        pill(d, cx, ty + 50, url, sans(44), INKMINT, MINT, padx=44, pady=22)
    return r

# ── stories (9:16) ───────────────────────────────────────────────────────────
def story(name, render):
    W, H = 1080, 1920; img = base(W, H, logo_y=160); d = ImageDraw.Draw(img, "RGBA"); cx = W // 2
    render(d, cx, W, H)
    img.convert("RGB").save(OUT / f"{name}.png"); print(name)

def st_leak(d, cx, W, H):
    eyebrow(d, cx, 620, "THE LEAK")
    ctext(d, cx, 700, "98 of 100", disp(160), RED)
    for i, ln in enumerate(["leave your site.", "You paid for", "every click."]):
        ctext(d, cx, 900 + i * 100, ln, disp(88), WHITE)
    pill(d, cx, 1320, "consentresolve.com/demo", sans(44), INKMINT, MINT, padx=44, pady=24)

def st_offer(d, cx, W, H):
    eyebrow(d, cx, 640, "THE FIX")
    ctext(d, cx, 720, "$7", disp(280), MINT)
    ctext(d, cx, 1040, "a lead.", disp(100), WHITE)
    for i, ln in enumerate(["Exclusive.", "Never resold."]):
        ctext(d, cx, 1220 + i * 96, ln, sans(60), SLATE)
    pill(d, cx, 1480, "consentresolve.com/demo", sans(44), INKMINT, MINT, padx=44, pady=24)

def st_cta(d, cx, W, H):
    ctext(d, cx, 720, "Own your", disp(150), WHITE)
    ctext(d, cx, 880, "traffic.", disp(150), MINT)
    for i, ln in enumerate(wrap("Stop renting leads from the people getting rich off your invoices.", sans(54), 820)):
        ctext(d, cx, 1120 + i * 70, ln, sans(54), SLATE)
    pill(d, cx, 1480, "See it work on you →", sans(46), INKMINT, MINT, padx=44, pady=24)
    ctext(d, cx, 1620, "link in bio · /demo", sans(38), MINT3)

# ── render all ───────────────────────────────────────────────────────────────
card("card-leak", c_leak)
card("card-offer", c_offer)
card("card-race", c_race)
card("card-robbed", c_quote("You didn't get worse at marketing. You got robbed by the machine.", "— what we keep hearing from contractors"))
card("card-product", c_quote("The lead site isn't your partner. You're its product.", "— Own your traffic"))
card("card-cpbj", c_cpbj)

cslide("howA-1", cover("OWN YOUR TRAFFIC", "How to get a lead without buying one"))
cslide("howA-2", step(1, "A homeowner lands on your site", "Traffic you already pay for — from ads, search, social."))
cslide("howA-3", step(2, "They consent on the banner", "Consent-first — nothing happens until they say yes."))
cslide("howA-4", step(3, "You get them back as a lead", "A real name and email. Exclusive, $7, never resold."))
cslide("howA-5", cta_slide("See it work on you.", "consentresolve.com/demo"))

cslide("cmpB-1", cover("THE LEAD-SITE MATH", "Shared leads vs your own traffic"))
cslide("cmpB-2", cmp_slide("Shared leads", RED, "$575", "per booked job — sold to you and four competitors, a race to respond."))
cslide("cmpB-3", cmp_slide("Your own traffic", MINT3, "$140", "per booked job — $7 a lead, exclusive, sold once, to you."))
cslide("cmpB-4", cta_slide("Run your own numbers.", "consentresolve.com/lead-math"))

story("story-leak", st_leak)
story("story-offer", st_offer)
story("story-cta", st_cta)

print("\ndone ->", OUT)
