#!/usr/bin/env python3
"""Create 4 HeyGen test videos (v3/videos, Avatar IV default), poll to completion,
return the 4 video_url labeled by test name. Falls back to dropping motion_prompt/
expressiveness if a call 400s (video avatars reject them). Prints raw responses."""
import json, time, urllib.request, urllib.error
KEY = open("/tmp/heygen_key.txt").read().strip()
# v3/videos rejected the documented field layout (discriminator 'type' error); using
# the project's proven v2 endpoint, which gives the same avatar+voice+bg+9:16/720p output.
CREATE = "https://api.heygen.com/v2/video/generate"
STATUS = "https://api.heygen.com/v1/video_status.get?video_id="
VOICE = "41c46ea57c0a4dd29e3acd1de0765c05"
MOTION = ("Face stays neutral and still. Eyes fixed on camera. No smile, no eyebrow movement. "
          "Hands rest down, no gestures. Slow occasional blink.")
TESTS = [
    ("01_sawdust_lookA", "ec564e1e4d0942c19cbba4fe23940d19", "Sawdust is just wood that gave up."),
    ("02_studfinder_lookA", "ec564e1e4d0942c19cbba4fe23940d19", "I bought a stud finder... I took it to a bar... It kept pointing at me... It's broken."),
    ("03_furnace_lookB", "1f8411c83f2f4d2e82fc3c381c2f2592", "A furnace is just an air conditioner that found religion."),
    ("04_ballpark_lookB", "1f8411c83f2f4d2e82fc3c381c2f2592", "A guy asked me for a ballpark figure... So I drove him to a ballpark... and pointed at a man."),
]

def build(name, avatar_id, script, with_motion):
    char = {"type": "avatar", "avatar_id": avatar_id, "avatar_style": "normal"}
    if with_motion:  # photo-avatar-only fields; dropped on 400 (video avatars)
        char["motion_prompt"] = MOTION
        char["expressiveness"] = "low"
    return {
        "callback_id": name, "title": name,
        "dimension": {"width": 720, "height": 1280},  # 9:16 720p
        "video_inputs": [{
            "character": char,
            "voice": {"type": "text", "voice_id": VOICE, "input_text": script, "speed": 0.9},
            "background": {"type": "color", "value": "#EAE3D6"},
        }],
    }

def post(body):
    req = urllib.request.Request(CREATE, data=json.dumps(body).encode(), method="POST",
        headers={"x-api-key": KEY, "Content-Type": "application/json"})
    try:
        return 200, json.load(urllib.request.urlopen(req, timeout=120))
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:600]

def vid_of(resp):
    if isinstance(resp, dict):
        return resp.get("video_id") or (resp.get("data") or {}).get("video_id")
    return None

def get(u):
    r = urllib.request.Request(u, headers={"x-api-key": KEY})
    try: return json.load(urllib.request.urlopen(r, timeout=60))
    except urllib.error.HTTPError as e: return {"error": e.read().decode()[:300]}

# 1) create all 4
jobs = []  # (name, video_id, used_fallback)
for name, av, script in TESTS:
    code, resp = post(build(name, av, script, with_motion=True))
    fb = False
    if not vid_of(resp):  # with-motion failed -> retry without (video avatars reject those fields)
        print(f"   with-motion failed ({code}): {str(resp)[:160]} -> retrying without", flush=True)
        code, resp = post(build(name, av, script, with_motion=False)); fb = True
    vid = vid_of(resp)
    print(f"[create] {name}: HTTP {code} fallback={fb} video_id={vid}", flush=True)
    if not vid: print(f"   RAW: {resp}", flush=True)
    jobs.append((name, vid, fb))

# 2) poll each to completion
print("--- polling ---", flush=True)
results = {}
for name, vid, fb in jobs:
    if not vid:
        results[name] = ("NO_VIDEO_ID", fb); continue
    url = None
    for _ in range(90):
        st = get(STATUS + vid).get("data") or {}
        s = st.get("status")
        if s == "completed": url = st.get("video_url"); break
        if s == "failed": url = f"FAILED: {st.get('error')}"; break
        time.sleep(8)
    results[name] = (url or "TIMEOUT", fb)
    print(f"[done] {name}: {results[name][0]}", flush=True)

print("\n=== RESULTS ===", flush=True)
fbs = [n for n, (u, f) in results.items() if f]
for name, _av, _s in TESTS:
    u, f = results[name]
    print(f"{name}{'  (fallback: no motion/expressiveness)' if f else ''}\n  {u}", flush=True)
print(f"\nfallback needed: {fbs or 'none'}", flush=True)
