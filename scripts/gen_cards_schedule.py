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
START = datetime.date(2026, 6, 16)
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
]
STORIES = ["story-leak", "story-offer", "story-cta"]

sched, fi, si = {}, 0, 0
for i in range(DAYS):
    d = START + datetime.timedelta(days=i); wd = d.weekday()
    if wd in (1, 3):  # Tue / Thu — feed cards
        it = FEED[fi % len(FEED)]; fi += 1
        sched[d.isoformat()] = {"format": it["format"], "images": [url(n) for n in it["images"]],
                                "caption": it["caption"], "link": it["link"]}
    elif wd == 6:  # Sun — story reshare
        s = STORIES[si % len(STORIES)]; si += 1
        sched[d.isoformat()] = {"format": "story", "images": [url(s)], "caption": "", "link": ""}

out = ROOT / "social/cards.json"; out.parent.mkdir(exist_ok=True)
out.write_text(json.dumps(sched, indent=2))
print(f"wrote {out} — {len(sched)} card days ({START} .. {START + datetime.timedelta(days=DAYS-1)})")
