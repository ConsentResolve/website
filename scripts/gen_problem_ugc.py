#!/usr/bin/env python3
"""Generate the industry-page "problem" UGC video via HeyGen, poll to ready,
print the final CDN URL. Avatar + voice supplied by the user. Tries the
standard avatar shape first; falls back to Avatar-IV talking_photo if HeyGen
says the id isn't a regular avatar. Run in background — polling takes minutes.

  python3 scripts/gen_problem_ugc.py            # submit + poll + print URL
  python3 scripts/gen_problem_ugc.py <video_id> # just poll an existing id
"""
import json, time, sys, urllib.request, urllib.error

KEY = open("/tmp/heygen_key.txt").read().strip()
# "Real Tyler" is an avatar GROUP (37dd…); generation needs a LOOK id from inside
# it. Default look "Green Hat, Matching Shirt"; override via argv[2] to swap looks.
AVATAR = "026f9397e4e9415b9cb54bab179ab59f"
VOICE = "92071a8742744d17bc92a02baab2941f"
TEXT = ("Look, here's the part nobody likes to talk about. Ninety-eight out of a "
        "hundred people hit your website and just leave. You paid for every one of them. "
        "So watch the difference. Before: anonymous, gone, calling the next shop. "
        "After: a real name, a real email, the exact service they were looking at. "
        "Yours alone, never resold. Same traffic — you just stopped letting it walk out the door.")

def api(url, body):
    req = urllib.request.Request(url, data=json.dumps(body).encode(),
        headers={"X-Api-Key": KEY, "Content-Type": "application/json"})
    try:
        r = urllib.request.urlopen(req, timeout=120)
        return r.status, json.load(r)
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode())

GEN = "https://api.heygen.com/v2/video/generate"

def _body(ctype, with_emotion):
    """Match the UGC-reel attributes: Avatar IV + expressive + super-resolution,
    speed 1.05, emotion Friendly (omitted if the voice has no emotion support)."""
    char = {"type": ctype, ("talking_photo_id" if ctype == "talking_photo" else "avatar_id"): AVATAR,
            "use_avatar_iv_model": True, "talking_style": "expressive", "super_resolution": True}
    if ctype == "avatar":
        char["avatar_style"] = "normal"
    voice = {"type": "text", "voice_id": VOICE, "input_text": TEXT, "speed": 1.05}
    if with_emotion:
        voice["emotion"] = "Friendly"
    return {"caption": False, "video_inputs": [{"character": char, "voice": voice}],
            "dimension": {"width": 1280, "height": 720}}

def submit():
    # 026f… is a Photo-Avatar look → "avatar" type. Try with emotion, then drop
    # emotion if the voice doesn't support it; fall back to talking_photo shape.
    for ctype in ("avatar", "talking_photo"):
        for emo in (True, False):
            st, r = api(GEN, _body(ctype, emo))
            print(f"{ctype} {'emotion' if emo else 'no-emotion'} ->", st, json.dumps(r)[:220], flush=True)
            vid = (r.get("data") or {}).get("video_id")
            if vid:
                return vid
            if emo and "emotion" not in json.dumps(r).lower():
                break  # failure unrelated to emotion — try the next character shape
    return None

def poll(vid):
    url = f"https://api.heygen.com/v1/video_status.get?video_id={vid}"
    for _ in range(120):  # ~20 min max
        req = urllib.request.Request(url, headers={"X-Api-Key": KEY})
        try:
            d = json.load(urllib.request.urlopen(req, timeout=60)).get("data", {})
        except urllib.error.HTTPError as e:
            print("poll err", e.code, e.read().decode()[:200], flush=True); time.sleep(10); continue
        s = d.get("status")
        print("status:", s, flush=True)
        if s == "completed":
            print("VIDEO_URL:", d.get("video_url"), flush=True); return d.get("video_url")
        if s in ("failed", "error"):
            print("FAILED:", json.dumps(d)[:400], flush=True); return None
        time.sleep(10)
    print("timed out", flush=True); return None

if __name__ == "__main__":
    vid = sys.argv[1] if len(sys.argv) > 1 else submit()
    print("video_id:", vid, flush=True)
    if vid:
        poll(vid)
