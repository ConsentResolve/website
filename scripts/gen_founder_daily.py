#!/usr/bin/env python3
"""Founder 'accidental private video' daily reel — Real Aaron (HeyGen), vertical 9:16,
casual/raw. Renders a script (today's, or argv[1]=path to a script file), polls, prints
the CDN URL. The end-card + posting are handled separately.

  python3 scripts/gen_founder_daily.py [script.txt]
"""
import json, time, sys, urllib.request, urllib.error

KEY = open("/tmp/heygen_key.txt").read().strip()
LOOK = "eb27139692644fa699bb45df77d96da6"   # Real Aaron · casual grey tee, blurred wood
VOICE = "41c46ea57c0a4dd29e3acd1de0765c05"  # Real Aaron (emotion_support: False)
GEN = "https://api.heygen.com/v2/video/generate"

TODAY = (
    "Yo — Andy, Tyler, Jason — this is just for you three, do not share this. "
    "So today was unhinged. I tore the whole H-VAC page apart and rebuilt it into a "
    "paid-ad weapon. Got Tyler — well, A.I. Tyler, sorry man — talking on camera in a real "
    "H-VAC scene now. And there's this stupid-good animation where ninety-eight anonymous "
    "ghosts turn into real named leads the second you tap a button. Built a whole MrBeast-style "
    "cover for it too. Honestly? We're about to make every shared-lead site look like a damn "
    "scam. Seven bucks a lead, exclusive, and they're gonna— ...wait. Is this thing recording? "
    "Is this — is this posting right now? Oh. Oh shi—. No no no, how do I— okay just send it to "
    "the guys, send it private, just the guys—"
)
TEXT = open(sys.argv[1]).read().strip() if len(sys.argv) > 1 else TODAY

def api(url, body=None, method="POST"):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, headers={"X-Api-Key": KEY, "Content-Type": "application/json"}, method=method)
    try:
        r = urllib.request.urlopen(req, timeout=120); return r.status, json.load(r)
    except urllib.error.HTTPError as e: return e.code, json.loads(e.read().decode())

def submit():
    char = {"type": "avatar", "avatar_id": LOOK, "avatar_style": "normal",
            "use_avatar_iv_model": True, "talking_style": "expressive", "super_resolution": True}
    voice = {"type": "text", "voice_id": VOICE, "input_text": TEXT, "speed": 1.0}  # no emotion (unsupported)
    st, r = api(GEN, {"caption": False, "video_inputs": [{"character": char, "voice": voice}],
                      "dimension": {"width": 1080, "height": 1920}})
    print("submit:", st, json.dumps(r)[:240], flush=True)
    return (r.get("data") or {}).get("video_id")

def wait(vid):
    for _ in range(150):
        st, d = api(f"https://api.heygen.com/v1/video_status.get?video_id={vid}", method="GET")
        s = (d.get("data") or {}).get("status"); print("status:", s, flush=True)
        if s == "completed": print("VIDEO_URL:", (d["data"]).get("video_url"), flush=True); return
        if s in ("failed", "error"): print("FAILED", json.dumps(d)[:300], flush=True); return
        time.sleep(10)

if __name__ == "__main__":
    vid = submit(); print("video_id:", vid, flush=True)
    if vid: wait(vid)
