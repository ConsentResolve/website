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

def cmpbox(d, box, label, num, accent):
    """A stylized comparison box: dark accent-tinted fill, bright accent border,
    accent label at top, the $ number centered both ways below the label."""
    x0, y0, x1, y1 = box
    tint = tuple(int(NAVY9[i] * 0.84 + accent[i] * 0.16) for i in range(3))
    d.rounded_rectangle([x0, y0, x1, y1], radius=30, fill=tint, outline=accent, width=5)
    lf = sans(40); lw = SCR.textlength(label, font=lf)
    d.text(((x0 + x1) / 2 - lw / 2, y0 + 30), label, font=lf, fill=accent)
    nf = fit(num, x1 - x0 - 140, 156, 90, disp)
    bb = nf.getbbox(num); tw = bb[2] - bb[0]; th = bb[3] - bb[1]
    ry0, ry1 = y0 + 84, y1
    d.text(((x0 + x1) / 2 - tw / 2 - bb[0], (ry0 + ry1) / 2 - th / 2 - bb[1]), num, font=nf, fill=WHITE)

def c_cpbj(d, cx, W, H):
    eyebrow(d, cx, 250, "COST PER BOOKED JOB")
    cmpbox(d, (90, 350, W - 90, 632), "SHARED LEADS", "$575", RED)
    cmpbox(d, (90, 700, W - 90, 982), "CONSENT RESOLVE", "$140", MINT)
    # 'vs' badge drawn last, so it sits in front of both boxes
    vy = 666
    d.ellipse([cx - 44, vy - 44, cx + 44, vy + 44], fill=(8, 15, 28), outline=(255, 255, 255, 80), width=2)
    vf = sans(40); vb = vf.getbbox("vs"); vw = vb[2] - vb[0]; vh = vb[3] - vb[1]
    d.text((cx - vw / 2 - vb[0], vy - vh / 2 - vb[1]), "vs", font=vf, fill=SLATE)
    for i, ln in enumerate(wrap("Same booked job — a $7 exclusive lead instead of a shared one sold to four of you.", sans(44), 880)):
        ctext(d, cx, 1042 + i * 58, ln, sans(44), SLATE)
    ctext(d, cx, 1270, "Run your numbers · consentresolve.com/lead-math", sans(34), MINT3)

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

# ── more photo cards (from the approved VoC angles) ──────────────────────────
def c_ghost(d, cx, W, H):
    eyebrow(d, cx, 320, "PURCHASED LEADS")
    ctext(d, cx, 400, "30 leads.", disp(112), WHITE)
    ctext(d, cx, 542, "30 ghosts.", disp(112), RED)
    for i, ln in enumerate(wrap("Paid for every one. The people already on your site actually want the work.", sans(46), 860)):
        ctext(d, cx, 760 + i * 60, ln, sans(46), SLATE)
    ctext(d, cx, 1240, "consentresolve.com/demo", sans(38), MINT3)

def c_robot(d, cx, W, H):
    eyebrow(d, cx, 300, "THE BILLING")
    ctext(d, cx, 380, "$400", disp(200), RED)
    ctext(d, cx, 620, "charged by a robot", disp(66), WHITE)
    for i, ln in enumerate(wrap("for your own customer calling you back. No appeal, no one to argue with.", sans(46), 860)):
        ctext(d, cx, 742 + i * 60, ln, sans(46), SLATE)
    ctext(d, cx, 1240, "Your own traffic doesn't bill you by algorithm.", sans(34), MINT3)

def c_ftc(d, cx, W, H):
    eyebrow(d, cx, 320, "THE RECEIPTS")
    ctext(d, cx, 400, "$7.2M", disp(180), RED)
    ctext(d, cx, 636, "fine for the biggest lead site", fit("fine for the biggest lead site", 940, 56, 40, sans), WHITE)
    for i, ln in enumerate(wrap("for lying about lead quality. Suddenly the garbage leads made sense.", sans(46), 860)):
        ctext(d, cx, 740 + i * 60, ln, sans(46), SLATE)
    ctext(d, cx, 1240, "consentresolve.com/demo", sans(38), MINT3)

# ── more stories ─────────────────────────────────────────────────────────────
def st_race(d, cx, W, H):
    eyebrow(d, cx, 640, "SHARED LEADS")
    ctext(d, cx, 720, "1 lead.", disp(150), WHITE)
    ctext(d, cx, 890, "4 contractors.", disp(118), RED)
    for i, ln in enumerate(wrap("A footrace, not a lead — and you're paying to run it.", sans(54), 820)):
        ctext(d, cx, 1120 + i * 70, ln, sans(54), SLATE)
    pill(d, cx, 1450, "consentresolve.com/demo", sans(44), INKMINT, MINT, padx=44, pady=24)

def st_ftc(d, cx, W, H):
    eyebrow(d, cx, 660, "THE RECEIPTS")
    ctext(d, cx, 740, "$7.2M", disp(220), RED)
    for i, ln in enumerate(["fine for the biggest", "lead site — for lying", "about lead quality."]):
        ctext(d, cx, 1050 + i * 92, ln, sans(58), WHITE)
    pill(d, cx, 1500, "consentresolve.com/demo", sans(44), INKMINT, MINT, padx=44, pady=24)

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

# more photo cards
card("card-ghost", c_ghost)
card("card-robot", c_robot)
card("card-ftc", c_ftc)
card("card-rent", c_quote("Stop renting leads from the people getting rich off your invoices.", "— Own your traffic"))
card("card-credit", c_quote("They don't refund the fake leads. They give you credit to buy more fake leads.", "— what contractors keep telling us"))

# "5 signs your lead source is rigged" carousel
cslide("rigC-1", cover("IS YOUR LEAD SOURCE RIGGED?", "5 signs the game is built against you"))
cslide("rigC-2", step(1, "The same lead goes to four of you", "A race to respond — not a lead."))
cslide("rigC-3", step(2, "'Bad-lead' disputes get denied", "You pay for tire-kickers and wrong numbers."))
cslide("rigC-4", step(3, "Charged when a customer calls back", "Billed by an algorithm, with no appeal."))
cslide("rigC-5", step(4, "Cancelling comes with a penalty", "Auto-renew contracts and exit fees."))
cslide("rigC-6", step(5, "Your pipeline lives in their dashboard", "One policy change and it's gone."))
cslide("rigC-7", cta_slide("Own your traffic instead.", "consentresolve.com/demo"))

# more stories
story("story-race", st_race)
story("story-ftc", st_ftc)

print("\ndone ->", OUT)
