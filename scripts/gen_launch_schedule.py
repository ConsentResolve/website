#!/usr/bin/env python3
"""45-day LAUNCH schedule (aggressive ramp) — rebuilds social/schedule.json so the
daily runner posts the WHOLE reel library (all 97 live reels from social/sprint-catalog.json)
across the connected platforms, front-loaded for a brand-new-account warm-up.

Goals: warm the accounts, gain follows, surface FB ad winners. Each reel carries its
own R2 `url` (catalog is the source of truth — SHOP TALK lives at social/shoptalk/,
exp at social/exp/, the rest at social/sprint/), so the runner resolves any bucket.

Cadence ramp (Sun = rest):
  wk1  ~1 reel/day   (gentle warm-up)
  wk2  ~2 reels/day
  wk3+ ~2-3 reels/day  — every reel used exactly once across 45 days.

Platform rules (TikTok via Buffer per launch call):
  tk + yt on every reel (tolerate volume, safe to warm)
  ig on ~75%
  fb Reels on alternate days only, 1/day (won't collide with FB feed cards)
  li on product reels, ~2-3x/week (B2B)
  story reshare ~1 every 3 days
"""
import json, datetime
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
CAT = json.loads((ROOT / "social/sprint-catalog.json").read_text())
START = datetime.date(2026, 6, 18)
DAYS = 45
PUB = "https://pub-27fc71b9070247178d8756a59bef0b33.r2.dev"

HASH_P = "#contractorlife #homeservicebusiness #leadgeneration #trades #smallbusinessmarketing"
HASH_C = "#contractorhumor #tradeslife #contractorlife #bluecollar #homeservicebusiness"
# On-voice product captions (rotated) — email/warm-inbound, $7/exclusive/consent-first, no "free", no banned words.
PROD_CAPS = [
    "About 98 of 100 people who hit your website leave without raising a hand — and you paid for every click. We hand those visitors back as real, consent-first leads. $7, exclusive, yours alone.\n\nSee it work on your own site — link in bio.",
    "A shared lead is a footrace you pay to enter. Recover your own website traffic instead — opted-in, exclusive, $7 a lead, never resold.\n\nSee it work on your own site — link in bio.",
    "Stop renting your customers back from a middleman. The people who land on your site should be yours — a real name, a real email. Consent-first, $7, cancel anytime.\n\nSee it work on your own site — link in bio.",
    "What does a shared lead really cost per booked job? Rough. $7 for an exclusive, opted-in lead from your own traffic beats $100 for a name four other companies are also calling.\n\nSee it work on your own site — link in bio.",
    "Someone visits your site, raises their hand, and opts in. We hand that person back — a real email, never a shared list. Built to the strictest privacy standard.\n\nSee it work on your own site — link in bio.",
]
PROMPTS = ["Tag a contractor who needs to hear this 👇", "Who else has lived this?",
           "Send this to your crew.", "Too real? 😅", "Name a more accurate take."]
SOFT = "Own your website traffic — link in bio."

def caption(e, i):
    grp = e.get("group") or e.get("persona") or ""
    if grp == "shoptalk":
        tail = SOFT if i % 4 == 3 else PROMPTS[i % len(PROMPTS)]
        return f"{e['hook']}\n\n{tail}\n\n{HASH_C}"
    if grp in ("reframed", "brand-animated", "leah", "Tyler") or e.get("persona") in ("reframed", "leah", "Tyler"):
        return f"{PROD_CAPS[i % len(PROD_CAPS)]}\n\n{HASH_P}"
    # experimental / originals — lighter product lean
    return f"{PROD_CAPS[i % len(PROD_CAPS)]}\n\n{HASH_P}"

def yt_title(e):
    grp = e.get("group") or ""
    if grp == "shoptalk":
        return " ".join(e["hook"].split()[:8]).rstrip(".,") + " #Shorts"
    return "Own your website traffic — $7 exclusive leads #Shorts"

def kind(e):
    return "nonugc" if (e.get("group") == "brand-animated") else "ugc"

# Interleave categories round-robin so showcase content is spread across all 45 days
ORDER = ["shoptalk", "reframed", "leah", "Tyler", "brand-animated", "experimental", "original"]
buckets = {k: [] for k in ORDER}
for e in CAT:
    g = e.get("group") or e.get("persona") or "original"
    buckets.setdefault(g if g in buckets else "original", []).append(e)
pool = []
while any(buckets.values()):
    for k in ORDER:
        if buckets[k]:
            pool.append(buckets[k].pop(0))
N = len(pool)

# Ramp: daily reel counts, Sun = 0, summing to N across DAYS
def daily_counts():
    counts = []
    for d in range(DAYS):
        dow = (START + datetime.timedelta(days=d)).weekday()  # Mon=0..Sun=6
        if dow == 6:
            counts.append(0); continue
        wk = d // 7
        counts.append(1 if wk == 0 else 2 if wk == 1 else 3)
    # trim total down to exactly N (drop from the latest heavy days first)
    while sum(counts) > N:
        for d in range(DAYS - 1, -1, -1):
            if counts[d] > 1:
                counts[d] -= 1; break
        else:
            break
    return counts

counts = daily_counts()
sched, idx, slot = {}, 0, 0
for d in range(DAYS):
    if idx >= N:
        break
    date = (START + datetime.timedelta(days=d)).isoformat()
    n = counts[d]
    if n == 0:
        continue
    day_items, fb_used = [], False
    for j in range(n):
        if idx >= N:
            break
        e = pool[idx]
        plats = ["tk", "yt"]
        if slot % 4 != 3:
            plats.append("ig")
        if d % 2 == 0 and not fb_used:
            plats.append("fb"); fb_used = True
        # LinkedIn intentionally excluded — account not verified yet (re-add "li" when it is)
        day_items.append({
            "name": e["name"],
            "url": e.get("url") or f"{PUB}/social/sprint/{e['name']}.mp4",
            "kind": kind(e),
            "platforms": plats,
            "story": (slot % 3 == 1),
            "caption": caption(e, slot),
            "yt_title": yt_title(e),
        })
        idx += 1; slot += 1
    sched[date] = day_items

(ROOT / "social/schedule.json").write_text(json.dumps(sched, indent=2, ensure_ascii=False))
# Report
from collections import Counter
plat_counts = Counter()
days_used = [k for k in sched]
for items in sched.values():
    for it in items:
        for p in it["platforms"]:
            plat_counts[p] += 1
        if it["story"]:
            plat_counts["ig-story"] += 1
print(f"wrote social/schedule.json — {idx} reels across {len(days_used)} days ({days_used[0]} → {days_used[-1]})")
print("per-platform reel posts:", dict(plat_counts))
print("reels used:", idx, "of", N, "in catalog")
