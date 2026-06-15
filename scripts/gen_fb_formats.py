#!/usr/bin/env python3
"""Deployed preview of the Facebook on-platform formats (Phase 1): photo cards,
carousels, stories — rendered by social_cards.py, hosted on R2. Shows each in a
platform-styled mockup for review. Output: public/fb-formats.html (noindex).
"""
import html
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
R2 = "https://pub-27fc71b9070247178d8756a59bef0b33.r2.dev/social-cards"

def img(name): return f"{R2}/{name}.png"
def esc(s): return html.escape(s)

# (image, post caption) — the feed post copy that rides with each photo card
CARDS = [
    ("card-leak", "You paid for every click. 98 of 100 of them leave without a trace — here's how you get them back."),
    ("card-offer", "$7 a lead. Exclusive, never resold — recovered from the traffic you already have."),
    ("card-race", "A shared lead is sold to you and four competitors. That's a footrace, not a lead."),
    ("card-robbed", "You didn't get worse at marketing. The lead-site game is built to work against you."),
    ("card-product", "With the lead sites you pay them — and you're still the product. Own your traffic instead."),
    ("card-cpbj", "$575 to land a job on shared leads, or about $140 on your own traffic. Same booked job."),
    ("card-ghost", "30 leads, 30 ghosts — paid for every one. The people already on your site actually want the work."),
    ("card-robot", "A robot charged me $400 because my own customer called me back. Your own traffic doesn't bill you by algorithm."),
    ("card-ftc", "The biggest lead site was fined $7.2M for lying about lead quality. Suddenly the garbage leads made sense."),
    ("card-rent", "Stop renting leads from the people getting rich off your invoices."),
    ("card-credit", "They don't refund the fake leads — they give you credit to buy more fake leads."),
]
CAROUSELS = [
    ("How you get a lead without buying one — swipe →", ["howA-1", "howA-2", "howA-3", "howA-4", "howA-5"]),
    ("Shared leads vs your own traffic — the real math. Swipe →", ["cmpB-1", "cmpB-2", "cmpB-3", "cmpB-4"]),
    ("5 signs your lead source is rigged. Swipe →", ["rigC-1", "rigC-2", "rigC-3", "rigC-4", "rigC-5", "rigC-6", "rigC-7"]),
]
STORIES = ["story-leak", "story-offer", "story-cta", "story-race", "story-ftc"]

def fb_post(image, caption):
    return f"""<div class="post">
  <div class="hd"><img class="av" src="/favicon.png"><div><div class="nm">Consent Resolve</div><div class="sub">Sponsored · 🌐</div></div></div>
  <div class="body">{esc(caption)}</div>
  <img class="ph" src="{img(image)}" alt="{esc(image)}" loading="lazy">
  <div class="bar"><span>👍 Like</span><span>💬 Comment</span><span>↪ Share</span></div></div>"""

def fb_carousel(caption, slides):
    cells = "".join(f'<img src="{img(s)}" alt="{esc(s)}" loading="lazy">' for s in slides)
    return f"""<div class="post">
  <div class="hd"><img class="av" src="/favicon.png"><div><div class="nm">Consent Resolve</div><div class="sub">Sponsored · carousel ({len(slides)})</div></div></div>
  <div class="body">{esc(caption)}</div>
  <div class="carousel">{cells}</div>
  <div class="bar"><span>👍 Like</span><span>💬 Comment</span><span>↪ Share</span></div></div>"""

CSS = """
*{box-sizing:border-box}body{margin:0;background:#0a1628;color:#f5f8fa;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif}
header{padding:28px 24px 6px;text-align:center}header h1{margin:0;font-size:26px}header p{color:#94a3b8;margin:6px 0 0;font-size:14px}
h2.sec{max-width:1200px;margin:34px auto 4px;padding:0 24px;font-size:15px;letter-spacing:.1em;text-transform:uppercase;color:#00e5a0}
.note{max-width:1200px;margin:0 auto;padding:0 24px 14px;color:#94a3b8;font-size:13px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:20px;max-width:1200px;margin:0 auto;padding:0 24px 24px}
.post{background:#fff;color:#0f1419;border-radius:14px;overflow:hidden;font-size:14px;box-shadow:0 8px 24px rgba(0,0,0,.35);align-self:start}
.post .hd{display:flex;gap:10px;align-items:center;padding:12px 14px}
.post .av{width:42px;height:42px;border-radius:50%;object-fit:cover;background:#0a1628}
.post .nm{font-weight:700;font-size:14px;line-height:1.1}.post .sub{color:#65707a;font-size:12px;margin-top:2px}
.post .body{padding:0 14px 12px;line-height:1.5}
.post .ph{width:100%;display:block;background:#0a1628}
.post .bar{display:flex;justify-content:space-between;padding:10px 16px;border-top:1px solid #eef2f5;color:#536471;font-size:13px}
.carousel{display:flex;gap:8px;overflow-x:auto;scroll-snap-type:x mandatory;padding:0 14px 12px;background:#fff}
.carousel img{width:230px;flex:0 0 auto;border-radius:10px;scroll-snap-align:center;border:1px solid #e6ecf0}
.stories{display:flex;gap:18px;flex-wrap:wrap;max-width:1200px;margin:0 auto;padding:0 24px 30px}
.story{width:230px;aspect-ratio:9/16;border-radius:22px;border:7px solid #14233c;overflow:hidden;background:#000;box-shadow:0 10px 30px rgba(0,0,0,.4)}
.story img{width:100%;height:100%;object-fit:cover;display:block}
"""

cards_html = "".join(fb_post(i, c) for i, c in CARDS)
car_html = "".join(fb_carousel(c, s) for c, s in CAROUSELS)
stories_html = "".join(f'<div class="story"><img src="{img(s)}" alt="{esc(s)}" loading="lazy"></div>' for s in STORIES)

HTML = f"""<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>Consent Resolve — Facebook formats preview</title>
<style>{CSS}</style></head><body>
<header><h1>Facebook formats — Phase 1</h1>
<p>Native on-platform content (photo cards · carousels · stories) — the formats the FB algorithm rewards. For review.</p></header>

<h2 class="sec">Photo posts ({len(CARDS)})</h2>
<p class="note">Single-image feed posts. Native (no outbound link) → higher reach; the link goes in the first comment.</p>
<div class="grid">{cards_html}</div>

<h2 class="sec">Carousels ({len(CAROUSELS)})</h2>
<p class="note">Swipeable multi-image posts — best for teaching the concept; keeps people on-platform.</p>
<div class="grid">{car_html}</div>

<h2 class="sec">Stories ({len(STORIES)})</h2>
<p class="note">9:16 ephemeral. Reshare layer — also wrap each Reel/photo card as a story with a /demo sticker.</p>
<div class="stories">{stories_html}</div>
</body></html>"""

out = ROOT / "public/fb-formats.html"
out.write_text(HTML)
print(f"wrote {out} — {len(CARDS)} cards, {len(CAROUSELS)} carousels, {len(STORIES)} stories")
