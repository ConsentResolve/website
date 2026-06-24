#!/usr/bin/env python3
"""Render the two-part interactive HVAC problem video via HeyGen (landscape),
using an existing "Real Tyler" look + UGC-reel attributes. Two clips:
  intro  — Tyler sets up the problem, points at the grid, asks them to tap After
  resume — Tyler pays it off after the grid animates
Prints CLIP <name>: <url> for each. Download + commit separately.

NOTE: route #2 (a generated HVAC-scene look) needs photo-avatar training, which
the HeyGen account can't do right now (402 insufficient credits). This uses the
existing look 026f9397… ("Green Hat, Matching Shirt"); the script is HVAC-specific.
Per industry, change the trade words + (when credits allow) the look id.
"""
import json, time, urllib.request, urllib.error

KEY = open("/tmp/heygen_key.txt").read().strip()
LOOK = "ef74e672158e4b87a445ffaeb3ad92fc"   # Real Tyler · generated HVAC scene (landscape, by condenser)
VOICE = "92071a8742744d17bc92a02baab2941f"
GEN = "https://api.heygen.com/v2/video/generate"

CLIPS = [
    ("hvac-intro",
     # "H-VAC" so the TTS says it as one word (aitch-vack), not "H-V-A-C".
     # Ellipsis before the ask = a natural beat so the close doesn't feel rushed.
     "Quick one for H-VAC owners. Let's look at what happens when a hundred homeowners land on your "
     "site, looking for AC repair or a new system. Watch this. See those website visitors on the right? "
     "Only about two of them ever fill out your form. The other ninety-eight? They just leave — and you "
     "paid for every click. So go ahead... tap the After button, and watch what happens."),
    ("hvac-resume",
     "There we go. Every square that just lit up is a homeowner who said yes — a real name, a "
     "real email, the exact service they were looking at. Recovered from traffic you already "
     "paid for. Seven dollars each, exclusive to you, never resold. Same hundred visitors — "
     "you just stopped letting ninety-eight of them walk."),
]

def api(url, body=None, method="POST"):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, headers={"X-Api-Key": KEY, "Content-Type": "application/json"}, method=method)
    try:
        r = urllib.request.urlopen(req, timeout=120); return r.status, json.load(r)
    except urllib.error.HTTPError as e: return e.code, json.loads(e.read().decode())

def submit(text):
    char = {"type": "avatar", "avatar_id": LOOK, "avatar_style": "normal",
            "use_avatar_iv_model": True, "talking_style": "expressive", "super_resolution": True}
    for emo in (True, False):
        voice = {"type": "text", "voice_id": VOICE, "input_text": text, "speed": 1.0}
        if emo: voice["emotion"] = "Friendly"
        st, r = api(GEN, {"caption": False, "video_inputs": [{"character": char, "voice": voice}],
                          "dimension": {"width": 1280, "height": 720}})
        vid = (r.get("data") or {}).get("video_id")
        if vid: return vid
        print("  submit fail:", st, json.dumps(r)[:160], flush=True)
        if "emotion" not in json.dumps(r).lower(): break
    return None

def wait(vid):
    for _ in range(120):
        st, d = api(f"https://api.heygen.com/v1/video_status.get?video_id={vid}", method="GET")
        s = (d.get("data") or {}).get("status")
        if s == "completed": return (d["data"]).get("video_url")
        if s in ("failed", "error"): return None
        time.sleep(10)
    return None

if __name__ == "__main__":
    ids = []
    for name, text in CLIPS:
        vid = submit(text); print(f"{name} video_id:", vid, flush=True); ids.append((name, vid))
    for name, vid in ids:
        url = wait(vid) if vid else None
        print(f"CLIP {name}: {url}", flush=True)
