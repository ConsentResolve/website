#!/usr/bin/env python3
"""Hook-test sprint generator (UGC). For each angle: generate the body (scenes
2..6) ONCE, then generate the 3-second hook scene for each archetype, and
assemble one reel per hook = [hook] + [shared body]. This is the budget trick —
~8 HeyGen gens per angle instead of ~18.

Writes build/tests/manifest.json (entries named sprint-<angle>-<arch>) then runs
finish_variants.py to caption + de-AI + cut the posted TikTok/Reels files
(public/reels/test-sprint-<angle>-<arch>-tiktok.mp4).

Usage:  python3 scripts/gen_reel_sprint.py leak race        # a wave of angles
Prints HeyGen remaining_quota before/after so we can read real cost per wave.
"""
import sys, os, re, json, subprocess, time, urllib.request, urllib.error
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from video_scripts import job_for
from reel_hooks import UGC

ROOT = Path(__file__).resolve().parent.parent
BUILD = ROOT / "build/sprint"; BUILD.mkdir(parents=True, exist_ok=True)
TESTS = ROOT / "build/tests"; TESTS.mkdir(parents=True, exist_ok=True)
FP = "/opt/homebrew/bin/ffprobe"
KEY = open("/tmp/heygen_key.txt").read().strip()
HEM = {"stat": "Serious", "confession": "Serious", "contrarian": "Friendly"}
PRON = {r"consentresolve\.com/demo": "consent resolve dot com slash demo", r"\bleads\b": "leeds", r"\blead\b": "leed"}
HOOKS = {a: h for a, p, h in UGC}
PERSONA = {a: p for a, p, h in UGC}

def spoken(t):
    for rx, rep in PRON.items(): t = re.sub(rx, rep, t, flags=re.I)
    return t

def api(url, body=None):
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(url, data=data, headers={"X-Api-Key": KEY, "Content-Type": "application/json"})
    try: return json.load(urllib.request.urlopen(req, timeout=120))
    except urllib.error.HTTPError as e: return {"error": json.loads(e.read().decode())}

def quota():
    d = api("https://api.heygen.com/v2/user/remaining_quota")
    return (d.get("data") or {}).get("remaining_quota")

def submit(look, voice, text, emotion, speed):
    body = {"caption": False, "video_inputs": [{
        "character": {"type": "talking_photo", "talking_photo_id": look, "use_avatar_iv_model": True,
                      "talking_style": "expressive", "super_resolution": True},
        "voice": {"type": "text", "voice_id": voice, "input_text": text, "speed": speed, "emotion": emotion}}],
        "dimension": {"width": 1080, "height": 1920}}
    r = api("https://api.heygen.com/v2/video/generate", body)
    if r.get("error"): print("  submit err:", r["error"]); return None
    return (r.get("data") or {}).get("video_id")

def poll(vid):
    for _ in range(60):
        d = (api(f"https://api.heygen.com/v1/video_status.get?video_id={vid}").get("data") or {})
        if d.get("status") == "completed": return d.get("video_url")
        if d.get("status") == "failed": return None
        time.sleep(10)
    return None

def dur(f):
    return round(float(subprocess.check_output([FP, "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).strip()), 3)

def gen_scene(look, voice, text, emotion, speed, out):
    if os.path.exists(out) and os.path.getsize(out) > 5000:
        return {"file": out, "dur": dur(out), "text": text}
    vid = submit(look, voice, spoken(text), emotion, speed)
    if not vid: return None
    url = poll(vid)
    if not url: print("  render failed"); return None
    urllib.request.urlretrieve(url, out)
    return {"file": out, "dur": dur(out), "text": text}

def main():
    angles = sys.argv[1:] or ["leak"]
    print("quota before:", quota(), flush=True)
    manifest = {}
    for angle in angles:
        if angle not in HOOKS: print(f"skip {angle}: no hooks"); continue
        job = job_for(angle); look, voice, scenes = job["look"], job["voice"], job["scenes"]
        d = BUILD / angle; d.mkdir(parents=True, exist_ok=True)
        print(f"=== {angle} ({PERSONA[angle]}) ===", flush=True)
        # body = scenes 2..n, generated once
        body = []
        for i, (text, emo, spd) in enumerate(scenes[1:]):
            sc = gen_scene(look, voice, text, emo, spd, str(d / f"b{i}.mp4"))
            if not sc: print(f"  body scene {i} failed"); return
            body.append(sc); print(f"  body {i}: {sc['dur']}s", flush=True)
        # 3 hook variants
        for arch, hooktext in HOOKS[angle].items():
            hk = gen_scene(look, voice, hooktext, HEM[arch], 1.06, str(d / f"h_{arch}.mp4"))
            if not hk: print(f"  hook {arch} failed"); continue
            manifest[f"sprint-{angle}-{arch}"] = [hk] + body
            print(f"  hook {arch}: {hk['dur']}s -> sprint-{angle}-{arch}", flush=True)
    for name in manifest:  # finish_variants writes temp files into build/tests/<name>/
        (TESTS / name).mkdir(parents=True, exist_ok=True)
    (TESTS / "manifest.json").write_text(json.dumps(manifest, indent=2))
    print("quota after:", quota(), flush=True)
    print(f"\nmanifest: {len(manifest)} reels. Finishing...", flush=True)
    subprocess.run(["/usr/bin/python3", "scripts/finish_variants.py"], cwd=ROOT, check=False)
    print("done. outputs: public/reels/test-sprint-*-tiktok.mp4")

if __name__ == "__main__":
    main()
