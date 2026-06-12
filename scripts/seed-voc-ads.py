#!/usr/bin/env python3
"""Seed the hybrid VoC product-ad posts (Heartbeat v2 voice) into social_queue.

These are NOT resource shares — they're pure contractor-peer ad posts (one pain
-> one flip -> consentresolve.com/demo), pulled from the Heartbeat v2 hook bank.
They rotate alongside the resource-share posts. No exclamation points, no banned
words, no competitor names (euphemisms only), no phone-number implications.

Usage:  CR_AUTOMATION_KEY=... python3 scripts/seed-voc-ads.py
"""
import json, os, sys, urllib.request

BASE = os.environ.get("BASE", "https://consentresolve.com").rstrip("/")
KEY = os.environ.get("CR_AUTOMATION_KEY")
if not KEY: sys.exit("Set CR_AUTOMATION_KEY")
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ConsentResolve-Seed/1.0"

# launch platforms only (the ones that actually post)
PLATFORMS = ["facebook", "linkedin_company", "linkedin_personal", "x", "google_business_profile"]
SRC = {"facebook": "facebook", "linkedin_company": "linkedin", "linkedin_personal": "linkedin",
       "x": "x", "google_business_profile": "google_business_profile"}

ADS = [
 ("invoice", "I added up last month's lead spend, then counted how many actually answered. Not close. 98 of 100 site visitors leave anonymous — and you paid to get them there."),
 ("race", "Every lead I buy, four other guys get the same text the same second. That's not a lead, that's a footrace. Your own website traffic is yours alone — exclusive, $7, never resold."),
 ("ftc", "The biggest lead site in America was ordered to pay 7.2 million for lying about lead quality. Suddenly my garbage leads made sense. Now I recover my own traffic instead."),
 ("leak", "98 of 100 people who visit your website leave without a trace. You paid to get them there. We hand them back as real, consent-first leads — $7 each."),
 ("twice", "They sold me the same homeowner twice. Second time, the job was already done. Exclusive used to mean something. With us it still does — sold once, to you."),
 ("ghost", "Thirty leads. Thirty ghosts. Paid for every one. The people already on your site actually want the work — we hand them back, consent-first, $7."),
 ("credit", "They don't refund the fake leads. They hand you credit to buy more fake leads. We charge $7 only when a real, identified person lands in your funnel."),
 ("robot", "A robot charged me four hundred bucks because my own customer called me back. No appeal, nobody to argue with. Your own website traffic doesn't bill you by algorithm."),
 ("policy", "Your whole pipeline lives in someone else's dashboard. One policy change and it's gone. Your website is the one pipe you own — and 98 of 100 visitors leave anonymous."),
 ("creepy", "Tried one of those visitor-ID tools. First week, someone replied: why am I on this list. Never again. Consent-first means the lead expects to hear from you. No phone numbers."),
 ("math", "A hundred bucks for a shared lead I close 5 percent of the time. Or 7 dollars for an exclusive lead from someone already on my website. I can do that math."),
 ("ownership", "Every dollar I gave the lead sites built their brand. The dollars I spend now build mine. Recover the visitors you already paid for — exclusive, $7."),
 ("contrarian", "Lead sites aren't broken. They work exactly as designed — for them. The fix isn't a better marketplace, it's owning your own traffic."),
]

def short(s, n=150):
    if len(s) <= n: return s
    cut = s[:n]
    for sep in (". ", " — ", ", "):
        i = cut.rfind(sep)
        if i > 60: return cut[:i + 1].strip()
    return cut.rsplit(" ", 1)[0].strip()

def utm(slug, src):
    return f"{BASE}/demo/?utm_source={src}&utm_medium=social&utm_campaign=voc_ads&utm_content=voc-{slug}"

def post(payload):
    req = urllib.request.Request(f"{BASE}/api/social-queue", data=json.dumps(payload).encode(),
        method="POST", headers={"Content-Type": "application/json", "X-CR-Automation-Key": KEY, "User-Agent": UA})
    with urllib.request.urlopen(req, timeout=20) as r: return r.status, r.read().decode()

total = 0
for slug, cap in ADS:
    items = []
    for p in PLATFORMS:
        caption = short(cap, 150) if p == "x" else cap
        items.append({"platform": p, "payload": {
            "caption": caption,
            "hook": caption.split(".")[0] + ".",
            "cta": "See it work — consentresolve.com/demo",
            "hashtags": [],                       # Heartbeat v2: no hashtag clutter
            "utm_url": utm(slug, SRC[p]),
            "image_url": "",                      # link-card from the /demo OG image
            "alt_text": "Consent Resolve — recover the visitors you already paid for",
        }})
    st, resp = post({"action": "enqueue", "resource_slug": f"voc-{slug}", "resource_type": "ad", "items": items})
    print(f"{st}  voc-{slug}  -> {resp}")
    total += len(items)
print(f"\nDone. Enqueued {total} VoC ad rows across {len(ADS)} ads x {len(PLATFORMS)} platforms.")
