#!/usr/bin/env python3
"""One-off: full UGC test reel for the new 'Real Tyler' avatar (group 37dd0591…),
lawn-care anchor look + his real cloned voice (92071a…, emotion_support=none → no
emotion field). Flagship 'leak' angle, our pipeline. Review only."""
import json, re, subprocess, time, urllib.request, urllib.error
from pathlib import Path
import sys
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
from video_scripts import job_for

KEY = open("/tmp/heygen_key.txt").read().strip()
FP = "/opt/homebrew/bin/ffprobe"
LOOK = "9b790b0358e344ea91040c2041e6279c"          # Green Hat, Matching Shirt (lawn anchor)
VOICE = "92071a8742744d17bc92a02baab2941f"         # Real Tyler real voice
ANGLE, NAME = "leak", "realtyler-leak"
BUILD = ROOT / "build/sprint/realtyler"; BUILD.mkdir(parents=True, exist_ok=True)
TESTS = ROOT / "build/tests"
PRON = {r"consentresolve\.com/demo": "consent resolve dot com slash demo", r"\bleads\b": "leeds", r"\blead\b": "leed"}

def spoken(t):
    for rx, rep in PRON.items(): t = re.sub(rx, rep, t, flags=re.I)
    return t

def api(url, body=None):
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(url, data=data, headers={"X-Api-Key": KEY, "Content-Type": "application/json"})
    try: return json.load(urllib.request.urlopen(req, timeout=120))
    except urllib.error.HTTPError as e: return {"error": json.loads(e.read().decode())}

def quota(): return (api("https://api.heygen.com/v2/user/remaining_quota").get("data") or {}).get("remaining_quota")

def submit(text, speed):  # real clone: no emotion field
    body = {"caption": False, "video_inputs": [{
        "character": {"type": "talking_photo", "talking_photo_id": LOOK, "use_avatar_iv_model": True,
                      "talking_style": "expressive", "super_resolution": True},
        "voice": {"type": "text", "voice_id": VOICE, "input_text": text, "speed": speed}}],
        "dimension": {"width": 1080, "height": 1920}}
    r = api("https://api.heygen.com/v2/video/generate", body)
    if r.get("error"): print("  submit err:", r["error"]); return None
    return (r.get("data") or {}).get("video_id")

def poll(vid):
    for _ in range(72):
        d = api(f"https://api.heygen.com/v1/video_status.get?video_id={vid}").get("data") or {}
        if d.get("status") == "completed": return d.get("video_url")
        if d.get("status") == "failed": print("  failed:", d.get("error")); return None
        time.sleep(10)
    return None

def dur(f): return round(float(subprocess.check_output([FP,"-v","error","-show_entries","format=duration","-of","csv=p=0",f]).strip()), 3)

print("quota before:", quota(), flush=True)
clips = []
for i, (text, _emo, spd) in enumerate(job_for(ANGLE)["scenes"]):
    f = str(BUILD / f"s{i}.mp4")
    vid = submit(spoken(text), spd)
    if not vid: raise SystemExit(f"submit failed scene {i}")
    url = poll(vid)
    if not url: raise SystemExit(f"render failed scene {i}")
    urllib.request.urlretrieve(url, f)
    clips.append({"file": f, "dur": dur(f), "text": text})
    print(f"  scene {i}: {clips[-1]['dur']}s", flush=True)

(TESTS / NAME).mkdir(parents=True, exist_ok=True)
(TESTS / "manifest.json").write_text(json.dumps({NAME: clips}, indent=2))
print("quota after:", quota(), flush=True)
subprocess.run(["/usr/bin/python3", "scripts/finish_variants.py"], cwd=ROOT, check=False)
print(f"done -> public/reels/test-{NAME}-tiktok.mp4")
