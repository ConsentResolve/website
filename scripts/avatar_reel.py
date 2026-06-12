#!/usr/bin/env python3
"""
LOCKED avatar-reel pipeline for Consent Resolve presenter reels.

Style (approved): HeyGen Avatar IV + talking_style=expressive + super_resolution,
3 scenes with per-scene emotion (Friendly -> Serious -> Excited), hard-cut
concat, then a "masking" pass that hides still-photo-avatar tells:
  - slow continuous push-in (zoompan)
  - light temporal film grain
  - two full-screen brand cutaways over the worst face beats (leak stat + offer)
  - persistent top logo + brand scrim
  - audio normalized to -14 LUFS

Usage: HEYGEN_KEY in /tmp/heygen_key.txt; run from repo root.
Outputs: public/reels/reel-style-<name>.mp4
"""
import json, os, subprocess, time, urllib.request
from pathlib import Path

ROOT = Path("/Users/aaronphillips/GIT/consentresolve2")
REELS = ROOT / "public/reels"; BUILD = REELS / "build"; (BUILD / "scenes").mkdir(parents=True, exist_ok=True)
FF = "/opt/homebrew/bin/ffmpeg"; FP = "/opt/homebrew/bin/ffprobe"
KEY = open("/tmp/heygen_key.txt").read().strip()
LOGO = str(ROOT / "public/logo-on-dark.png")
CUTA = str(BUILD / "cut/cutA.png"); CUTB = str(BUILD / "cut/cutB.png")

SCENES = [
    ("Look— ninety-eight out of a hundred people hit your website... and just leave.", "Friendly", 1.05),
    ("You paid for every single one of those clicks. Every one.", "Serious", 1.05),
    ("Consent Resolve tells you who they were. Seven bucks a lead— exclusive, never resold.", "Excited", 1.08),
]

# (name, look_id, character_type, voice_id)
AVATARS = [
    ("aaron",  "521fced7bc5847d7a330645e1e8d9dcf", "talking_photo", "f365d990e89f4c55810722ef4788b85b"),
    ("tyler",  "972e62f23f724b688c740e5b8d307822", "talking_photo", "0c76e4a9be91456da07c3c9e1160db1e"),
    ("pickup", "a7ffbaf6bf6d443ebd8a8c19cdaa5059", "talking_photo", "0e671a523e3d4cd7b6d5c580de70931e"),
]

def api(url, body=None):
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(url, data=data, headers={"X-Api-Key": KEY, "Content-Type": "application/json"})
    return json.load(urllib.request.urlopen(req, timeout=120))

def submit(look_id, ctype, voice_id, text, emotion, speed):
    char = {"type": ctype, ("talking_photo_id" if ctype == "talking_photo" else "avatar_id"): look_id,
            "use_avatar_iv_model": True, "talking_style": "expressive", "super_resolution": True}
    if ctype == "avatar": char["avatar_style"] = "normal"
    body = {"caption": False, "video_inputs": [{
        "character": char,
        "voice": {"type": "text", "voice_id": voice_id, "input_text": text, "speed": speed, "emotion": emotion},
    }], "dimension": {"width": 1080, "height": 1920}}
    r = api("https://api.heygen.com/v2/video/generate", body)
    return (r.get("data") or {}).get("video_id")

def poll(vid):
    for _ in range(60):
        r = api(f"https://api.heygen.com/v1/video_status.get?video_id={vid}")
        st = (r.get("data") or {}).get("status")
        if st == "completed": return (r.get("data") or {}).get("video_url")
        if st == "failed": return None
        time.sleep(12)
    return None

def dl(url, out):
    urllib.request.urlretrieve(url, out)

def dur(f):
    return float(subprocess.check_output([FP, "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).strip())

def build(name, look_id, ctype, voice_id):
    print(f"\n=== {name} ===")
    # 1) submit 3 scenes
    vids = [submit(look_id, ctype, voice_id, t, e, s) for (t, e, s) in SCENES]
    print("  submitted:", vids)
    if not all(vids): print("  SUBMIT FAILED"); return
    # 2) poll + download
    paths = []
    for i, vid in enumerate(vids):
        url = poll(vid)
        if not url: print(f"  scene{i+1} render failed"); return
        p = str(BUILD / "scenes" / f"{name}_s{i+1}.mp4"); dl(url, p); paths.append(p)
    d = [dur(p) for p in paths]; print("  durations:", [round(x,2) for x in d], "total", round(sum(d),2))
    # 3) cutaway windows (adapt to scene boundaries)
    a0 = round(d[0]*0.30, 2); a1 = round(a0 + min(2.0, d[0]*0.5), 2)
    b0 = round(d[0]+d[1]+0.30, 2); b1 = round(b0 + min(2.2, d[2]*0.5), 2)
    # 4) concat + mask + overlays in one pass
    fc = (
        "[0:v]fps=30,scale=1080:1920,setsar=1[v0];[1:v]fps=30,scale=1080:1920,setsar=1[v1];[2:v]fps=30,scale=1080:1920,setsar=1[v2];"
        "[v0][0:a][v1][1:a][v2][2:a]concat=n=3:v=1:a=1[cv][ca];"
        "[cv]zoompan=z='min(zoom+0.0006,1.09)':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1080x1920:fps=30,"
        "noise=alls=7:allf=t+u,drawbox=0:0:1080:180:black@0.40:t=fill[zz];"
        "[3:v]scale=440:-1[lg];[zz][lg]overlay=(W-w)/2:60[b1];"
        f"[b1][4:v]overlay=0:0:enable='between(t,{a0},{a1})'[b2];"
        f"[b2][5:v]overlay=0:0:enable='between(t,{b0},{b1})'[v];"
        "[ca]loudnorm=I=-14:TP=-1.0:LRA=11[a]"
    )
    out = str(REELS / f"reel-style-{name}.mp4")
    subprocess.run([FF, "-y", "-loglevel", "error",
        "-i", paths[0], "-i", paths[1], "-i", paths[2], "-i", LOGO, "-i", CUTA, "-i", CUTB,
        "-filter_complex", fc, "-map", "[v]", "-map", "[a]",
        "-c:v", "libx264", "-profile:v", "high", "-pix_fmt", "yuv420p", "-b:v", "10M", "-maxrate", "12M", "-bufsize", "12M", "-r", "30",
        "-c:a", "aac", "-b:a", "192k", "-ar", "44100", "-ac", "2", "-movflags", "+faststart", out], check=True)
    print(f"  -> {out}  ({round(dur(out),1)}s)")

if __name__ == "__main__":
    for av in AVATARS:
        try: build(*av)
        except Exception as e: print(f"  ERROR {av[0]}: {e}")
    print("\nDONE")
