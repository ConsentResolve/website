#!/usr/bin/env python3
"""Build social/resource-cards.json — a dated Facebook drip of the resource-center
posts (each = its Recraft illustration + the resource's FB caption + UTM link),
scheduled on the card-cadence days (Tue/Thu/Sun) AFTER the brand-card run in
social/cards.json, so the two never collide. run_cards.py reads both (brand cards
win on any shared date). Nothing posts until CARDS_AUTOPOST=="true" — this only
writes the plan for review. Re-runnable; caches fetched FB packs.
"""
import json, urllib.request, datetime
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
UA = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ConsentResolve/1.0"}
INDEX = "https://consentresolve.com/resources/index.json"
CARD_DAYS = {1, 3, 6}  # Tue, Thu, Sun (weekday(): Mon=0)
CACHE = ROOT / "scripts/.cache/resource-fb-packs.json"

def get(url):
    return json.load(urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30))

idx = get(INDEX)
items = idx if isinstance(idx, list) else (idx.get("resources") or idx.get("items") or [])
# only resources flagged ready/published and that target Facebook
def fb_ok(it):
    st = (it.get("status") or "").lower()
    plats = [str(p).lower() for p in (it.get("platforms") or [])]
    return st in ("ready_to_publish", "published", "scheduled") and (not plats or any("face" in p or p == "fb" for p in plats))
items = [it for it in items if fb_ok(it)]
print(f"resources targeting FB: {len(items)}")

cache = json.loads(CACHE.read_text()) if CACHE.exists() else {}
posts = []
for it in items:
    slug = it["slug"]
    pack = cache.get(slug)
    if not pack:
        try:
            sj = get(it["social_json"])
            fb = (sj.get("social") or {}).get("facebook") or {}
            pack = {
                "caption": fb.get("caption") or fb.get("hook") or it["title"],
                "cta": fb.get("cta") or "",
                "hashtags": fb.get("hashtags") or [],
                "image": fb.get("image_url") or it.get("og_image"),
                "link": fb.get("link") or (it["url"] + "?utm_source=facebook&utm_medium=social&utm_campaign=resource_center"),
            }
            cache[slug] = pack
        except Exception as e:
            print(f"  skip {slug}: {e}"); continue
    body = pack["caption"]
    if pack.get("cta"): body += "\n\n" + pack["cta"]
    if pack.get("hashtags"): body += "\n\n" + " ".join("#" + h.lstrip("#") for h in pack["hashtags"])
    posts.append({"slug": slug, "title": it["title"], "format": "photo",
                  "images": [pack["image"]], "caption": body, "link": pack["link"]})
CACHE.parent.mkdir(parents=True, exist_ok=True); CACHE.write_text(json.dumps(cache, indent=1))

# start the day after the last brand-card date
brand = json.loads((ROOT / "social/cards.json").read_text()) if (ROOT / "social/cards.json").exists() else {}
start = max([datetime.date.fromisoformat(d) for d in brand], default=datetime.date(2026, 6, 16)) + datetime.timedelta(days=1)

sched = {}
d = start
for p in posts:
    while d.weekday() not in CARD_DAYS:
        d += datetime.timedelta(days=1)
    sched[d.isoformat()] = p
    d += datetime.timedelta(days=1)

(ROOT / "social/resource-cards.json").write_text(json.dumps(sched, indent=2))
dates = sorted(sched)
print(f"scheduled {len(sched)} resource FB posts: {dates[0]} → {dates[-1]} (Tue/Thu/Sun, ~3/wk)")
