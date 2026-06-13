#!/usr/bin/env python3
"""Generate social/schedule.json for the video+story track.

Maps calendar dates -> posts: {angle, platforms, story, caption, yt_title}.
Platforms limited to CONNECTED ones (ig, fb, yt). TikTok added later.
Cadence: front-load weeks 1-3 (6 videos/wk), then steady. Per-day platform grid
keeps IG/FB ~3-4x and YT ~4-5x per week. Story reshare on the heavy days.

Date math is done here (offline) and frozen into JSON so the runner is simple.
Edit social/schedule.json by hand anytime.
"""
import json, sys, datetime
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
import video_scripts as V

ROOT = Path(__file__).resolve().parent.parent
START = datetime.date(2026, 6, 15)          # Mon, week 1
DAYS = 45
HASHTAGS = "#contractorlife #homeservicebusiness #leadgeneration #trades #smallbusinessmarketing"

# Angles with a locked non-UGC reel (scripts/brand_reel.py). The rest are UGC-only.
NONUGC = {"leak","invoice","math","robot","ftc","twice","ghost","ownership"}
# Rotation weighted ~80% non-UGC / 20% UGC: 8 non-UGC angles + 2 UGC-only.
ROTATION = ["leak","invoice","math","robot","ftc","twice","ghost","ownership",
            "creepy","contrarian"]
YT_TITLE = {
 "invoice":"Where your lead money actually goes #Shorts",
 "leak":"Why 98% of website visitors leave anonymous #Shorts",
 "ftc":"The $7.2M lead-site fine, explained #Shorts",
 "race":"Why shared leads never close #Shorts",
 "math":"Shared leads vs your own website traffic #Shorts",
 "credit":"Why lead sites give credits, not refunds #Shorts",
 "ghost":"Why your purchased leads ghost you #Shorts",
 "creepy":"Is website visitor identification creepy or legal? #Shorts",
 "policy":"You don't own your lead-site pipeline #Shorts",
 "twice":"Exclusive leads vs shared leads #Shorts",
 "contrarian":"Lead sites aren't broken — they're built that way #Shorts",
 "ownership":"Stop building someone else's brand with your ad spend #Shorts",
 "robot":"Why lead-site billing feels like a scam #Shorts",
}
# per weekday: which connected platforms post, and whether to reshare to Story
# 0=Mon..6=Sun. Front-load adds Sat.
# NOTE: avatar (UGC) reels are NOT cross-posted to the personal LinkedIn feed —
# the founder feed gets non-UGC video + founder posts only (see
# .docs/linkedin-personal-voice.md). "li" is reserved for the Company Page once
# its Community Management API clears review.
GRID = {0:(["ig","fb","yt"], True), 1:(["yt"], False), 2:(["ig","fb"], False),
        3:(["yt"], False), 4:(["ig","fb","yt"], True), 5:(["ig","fb"], False), 6:([], False)}
FRONTLOAD_WEEKS = 3

def caption(angle):
    sc = [s[0] for s in V.ANGLES[angle]["scenes"]]
    body = " ".join(sc[:-1])  # drop the spoken URL line
    return f"{body}\n\nFull breakdown's on the site — link in bio.\n\n{HASHTAGS}"

sched = {}
ai = 0
for i in range(DAYS):
    d = START + datetime.timedelta(days=i)
    wd = d.weekday(); week = i // 7
    plats, story = GRID[wd]
    if not plats:
        continue
    if wd == 5 and week >= FRONTLOAD_WEEKS:   # Sat only during front-load
        continue
    angle = ROTATION[ai % len(ROTATION)]; ai += 1
    sched[d.isoformat()] = [{
        "angle": angle, "kind": "nonugc" if angle in NONUGC else "ugc",
        "platforms": plats, "story": story,
        "caption": caption(angle), "yt_title": YT_TITLE.get(angle, f"{angle} #Shorts"),
    }]

out = ROOT / "social/schedule.json"; out.parent.mkdir(exist_ok=True)
out.write_text(json.dumps(sched, indent=2))
print(f"wrote {out} — {len(sched)} posting days, {START} .. {START+datetime.timedelta(days=DAYS-1)}")
