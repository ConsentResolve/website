#!/usr/bin/env python3
"""Generate 3-scene Avatar IV clips for aaron, tyler, jason.
Avatar IV is the only engine usable on our photo avatars (Avatar V requires a
video-trained instant-avatar look our AI personas don't have).
Reuses an already-rendered scene if a video_id is cached. Outputs to
build/tests/<name>/s{1,2,3}.mp4 and writes a manifest with durations + cost notes.
"""
import json, os, re, hashlib, subprocess, time, urllib.request, urllib.error
from pathlib import Path

# Phonetic respellings applied to the SPOKEN text only (captions keep the real
# spelling). Sales "lead/leads" must say "leed/leeds", never rhyme with "led".
# The /demo URL is spoken naturally but shown as the real URL in captions.
PRONOUNCE = {
    r"consentresolve\.com/demo": "consent resolve dot com slash demo",
    r"\bleads\b": "leeds",
    r"\blead\b": "leed",
}
def spoken(text):
    out = text
    for rx, rep in PRONOUNCE.items():
        out = re.sub(rx, rep, out, flags=re.I)
    return out

ROOT = Path("/Users/aaronphillips/GIT/consentresolve2")
OUT = ROOT / "build/tests"
FP = "/opt/homebrew/bin/ffprobe"
KEY = open("/tmp/heygen_key.txt").read().strip()

# Approved upstream 3-scene script (already voice-compliant; no new content).
SCENES = [
    ("Look— ninety-eight out of a hundred people hit your website... and just leave.", "Friendly", 1.05),
    ("You paid for every single one of those clicks. Every one.", "Serious", 1.05),
    ("Consent Resolve tells you who they were. Seven bucks a lead— exclusive, never resold.", "Excited", 1.08),
]
# (name, look_id, voice_id) — synced to the re-themed avatar groups (Jun 2026).
# Anchor look per persona; full look sets are in .docs/avatar-casting.md.
AVATARS = [
    ("aaron", "b5dc5a22eb684b959e36d2c0a1834461", "f365d990e89f4c55810722ef4788b85b"),  # office-desk henley
    ("tyler", "7a317560c0d54461a38666bc965cac72", "0c76e4a9be91456da07c3c9e1160db1e"),  # moss-green lawn
    ("jason", "26e04090a6124f48b27623c888c6996b", "0e671a523e3d4cd7b6d5c580de70931e"),  # warm-lit pickup
]
CACHE = {}  # old cache invalid — new looks, regenerate all scenes

# JOBS: default = the 3-persona anchor test (shared SCENES). If ANGLE is set
# (comma-separated angle ids), produce those ~30s scripts from video_scripts.py
# instead — one job per angle, each with its own persona look/voice + scenes.
_ANGLE_ENV = os.environ.get("ANGLE", "").strip()
if _ANGLE_ENV:
    from video_scripts import job_for
    JOBS = []
    for aid in [a.strip() for a in _ANGLE_ENV.split(",") if a.strip()]:
        j = job_for(aid)
        JOBS.append((j["name"], j["look"], j["voice"], j["scenes"]))
else:
    JOBS = [(n, lk, vc, SCENES) for (n, lk, vc) in AVATARS]

def api(url, body=None):
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(url, data=data,
        headers={"X-Api-Key": KEY, "Content-Type": "application/json"})
    try:
        return json.load(urllib.request.urlopen(req, timeout=120))
    except urllib.error.HTTPError as e:
        return {"error": json.loads(e.read().decode())}

# Cloned voices with emotion_support=false — emotion field must be OMITTED.
NO_EMOTION = {"9d5497bed1f144049861da9389addc96",   # Real Jason
              "92071a8742744d17bc92a02baab2941f",   # Real Tyler
              "41c46ea57c0a4dd29e3acd1de0765c05"}   # Real Aaron

def submit(look, voice, text, emotion, speed):
    voice_obj = {"type": "text", "voice_id": voice, "input_text": text, "speed": speed}
    if voice not in NO_EMOTION: voice_obj["emotion"] = emotion
    body = {"caption": False, "video_inputs": [{
        "character": {"type": "talking_photo", "talking_photo_id": look,
                      "use_avatar_iv_model": True, "talking_style": "expressive", "super_resolution": True},
        "voice": voice_obj,
    }], "dimension": {"width": 1080, "height": 1920}}
    r = api("https://api.heygen.com/v2/video/generate", body)
    if r.get("error"): print("   submit error:", r["error"]); return None
    return (r.get("data") or {}).get("video_id")

def poll(vid):
    for _ in range(60):
        r = api(f"https://api.heygen.com/v1/video_status.get?video_id={vid}")
        d = r.get("data") or {}
        if d.get("status") == "completed": return d.get("video_url")
        if d.get("status") == "failed": return None
        time.sleep(10)
    return None

def dur(f):
    return float(subprocess.check_output([FP, "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).strip())

manifest = {}
for name, look, voice, job_scenes in JOBS:
    d = OUT / name; d.mkdir(parents=True, exist_ok=True)
    # per-video pacing jitter (~0.97–1.04x): every take lands on a slightly
    # different cadence so the model's delivery/expression isn't uniform.
    sf = round(0.97 + (int(hashlib.md5(name.encode()).hexdigest()[:4], 16) % 70) / 1000.0, 3)
    print(f"\n=== {name} ({len(job_scenes)} scenes, speed x{sf}) ===")
    # submit all scenes first (concurrent render server-side), reusing cache
    vids = []
    for i, (text, emo, spd) in enumerate(job_scenes):
        vid = CACHE.get((name, i)) or submit(look, voice, spoken(text), emo, round(spd * sf, 3))
        print(f"  scene {i+1}: {vid}")
        vids.append(vid)
    # poll + download
    scenes = []
    for i, vid in enumerate(vids):
        out = d / f"s{i+1}.mp4"
        if not vid:
            print(f"  scene {i+1} FAILED submit"); scenes.append(None); continue
        url = poll(vid)
        if not url:
            print(f"  scene {i+1} FAILED render"); scenes.append(None); continue
        urllib.request.urlretrieve(url, out)
        scenes.append({"video_id": vid, "file": str(out), "dur": round(dur(out), 3),
                       "text": job_scenes[i][0]})
        print(f"  scene {i+1} -> {out.name} ({scenes[-1]['dur']}s)")
    manifest[name] = scenes

(OUT / "manifest.json").write_text(json.dumps(manifest, indent=2))
print("\nmanifest:", OUT / "manifest.json")
