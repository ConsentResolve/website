#!/usr/bin/env python3
"""Generate social/cards.json — a dated schedule for the native Facebook on-platform
formats (photo cards, carousels, stories), drawn from the social_cards.py set on R2.

Placed on FB's NON-Reel days so the Page never posts two things in one session
(Reels run Mon/Wed/Fri/Sat via the video schedule): photo/carousel posts land
Tue & Thu, story reshares on Sun. Frozen to JSON so run_cards.py stays simple.
"""
import json, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
R2 = "https://pub-27fc71b9070247178d8756a59bef0b33.r2.dev/social-cards"
START = datetime.date(2026, 6, 18)
DAYS = 45
def url(n): return f"{R2}/{n}.png"

# Feed rotation (photo cards + carousels). caption = the post body; link goes in
# the first comment (native posts aren't reach-throttled that way).
FEED = [
    {"format": "photo", "images": ["card-leak"], "link": "https://consentresolve.com/demo",
     "caption": "You paid for every click. 98 of 100 of them leave without a trace — here's how you get them back."},
    {"format": "carousel", "images": ["howA-1", "howA-2", "howA-3", "howA-4", "howA-5"], "link": "https://consentresolve.com/demo",
     "caption": "How to get a lead without buying one. Swipe →"},
    {"format": "photo", "images": ["card-race"], "link": "https://consentresolve.com/demo",
     "caption": "A shared lead is sold to you and four competitors. That's a footrace, not a lead."},
    {"format": "carousel", "images": ["cmpB-1", "cmpB-2", "cmpB-3", "cmpB-4"], "link": "https://consentresolve.com/lead-math",
     "caption": "Shared leads vs your own traffic — the real math. Swipe →"},
    {"format": "photo", "images": ["card-cpbj"], "link": "https://consentresolve.com/lead-math",
     "caption": "$575 to land a job on shared leads, or about $140 on your own traffic. Same booked job."},
    {"format": "photo", "images": ["card-product"], "link": "https://consentresolve.com/demo",
     "caption": "With the lead sites you pay them — and you're still the product. Own your traffic instead."},
    {"format": "photo", "images": ["card-offer"], "link": "https://consentresolve.com/demo",
     "caption": "$7 a lead. Exclusive, never resold — recovered from the traffic you already have."},
    {"format": "photo", "images": ["card-robbed"], "link": "https://consentresolve.com/demo",
     "caption": "You didn't get worse at marketing. The lead-site game is built to work against you."},
    {"format": "carousel", "images": ["rigC-1", "rigC-2", "rigC-3", "rigC-4", "rigC-5", "rigC-6", "rigC-7"], "link": "https://consentresolve.com/demo",
     "caption": "5 signs your lead source is rigged. Swipe →"},
    {"format": "photo", "images": ["card-ghost"], "link": "https://consentresolve.com/demo",
     "caption": "30 leads, 30 ghosts — paid for every one. The people already on your site actually want the work."},
    {"format": "photo", "images": ["card-robot"], "link": "https://consentresolve.com/demo",
     "caption": "A robot charged me $400 because my own customer called me back. Your own traffic doesn't bill you by algorithm."},
    {"format": "photo", "images": ["card-ftc"], "link": "https://consentresolve.com/demo",
     "caption": "The biggest lead site was fined $7.2M for lying about lead quality. Suddenly the garbage leads made sense."},
    {"format": "photo", "images": ["card-rent"], "link": "https://consentresolve.com/demo",
     "caption": "Stop renting leads from the people getting rich off your invoices."},
    {"format": "photo", "images": ["card-credit"], "link": "https://consentresolve.com/demo",
     "caption": "They don't refund the fake leads — they give you credit to buy more fake leads."},
]
# Full Story pool (warm-up): hooks + SHOP TALK jokes + engagement prompts (19 cards on R2).
STORIES = (["story-leak", "story-offer", "story-cta", "story-race", "story-ftc",
            "story-consent", "story-own", "story-ghost"]
           + [f"story-joke-{i}" for i in range(1, 9)]
           + ["story-q-cpbj", "story-q-visitors", "story-q-trade"])

sched, fi, si = {}, 0, 0
for i in range(DAYS):
    d = START + datetime.timedelta(days=i); wd = d.weekday()
    if wd in (1, 3):  # Tue / Thu — feed cards (FB feed stays ~2x/wk to avoid suppression)
        it = FEED[fi % len(FEED)]; fi += 1
        sched[d.isoformat()] = {"format": it["format"], "slot": "mid", "images": [url(n) for n in it["images"]],
                                "caption": it["caption"], "link": it["link"]}
    else:  # every other day — a rotating Story (near-daily FB Stories for warm-up)
        s = STORIES[si % len(STORIES)]; si += 1
        sched[d.isoformat()] = {"format": "story", "slot": "pm", "images": [url(s)], "caption": "", "link": ""}

out = ROOT / "social/cards.json"; out.parent.mkdir(exist_ok=True)
out.write_text(json.dumps(sched, indent=2))
print(f"wrote {out} — {len(sched)} card days ({START} .. {START + datetime.timedelta(days=DAYS-1)})")
