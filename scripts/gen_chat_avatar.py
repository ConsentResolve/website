#!/usr/bin/env python3
"""Live-chat Avatar — Tyler (HeyGen Avatar IV), square, downscaled to 400x400, <10MB.

Generates a short Tyler greeting clip for use as a live-chat avatar. Renders square
on HeyGen, then ffmpeg scales to exactly 400x400 and compresses under 10MB (h264).
Reads the HeyGen key from /tmp/heygen_key.txt. Output: build/chat-avatar/tyler-chat-avatar-400.mp4
"""
import json, os, subprocess, time, urllib.request, urllib.error
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
KEY  = open("/tmp/heygen_key.txt").read().strip() if os.path.exists("/tmp/heygen_key.txt") else ""
FF, FP = "/opt/homebrew/bin/ffmpeg", "/opt/homebrew/bin/ffprobe"

LOOK  = "026f9397e4e9415b9cb54bab179ab59f"   # Real Tyler — motion photo-avatar look (#4)
VOICE = "92071a8742744d17bc92a02baab2941f"   # Real Tyler cloned voice (no emotion)
GEN_W = GEN_H = 720                            # square render on HeyGen
OUT_PX = 400                                   # final 400x400
MAX_MB = 10

# Editable greeting (kept short → tiny file, snappy in a chat widget).
TEXT = ("Hey, I'm Tyler. Got a question about turning your website visitors into "
        "real, exclusive leads? Ask me right here — happy to help.")

WORK = ROOT / "build/chat-avatar"; WORK.mkdir(parents=True, exist_ok=True)
RAW  = str(WORK / "raw-square.mp4")
OUT  = str(WORK / "tyler-chat-avatar-400.mp4")

def api(url, body=None):
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(url, data=data, headers={"X-Api-Key": KEY, "Content-Type": "application/json"})
    try: return json.load(urllib.request.urlopen(req, timeout=120))
    except urllib.error.HTTPError as e: return {"error": json.loads(e.read().decode())}

def quota(): return (api("https://api.heygen.com/v2/user/remaining_quota").get("data") or {}).get("remaining_quota")

def submit():
    body = {"caption": False, "video_inputs": [{
        "character": {"type": "talking_photo", "talking_photo_id": LOOK, "use_avatar_iv_model": True,
                      "talking_style": "expressive", "super_resolution": True},
        "voice": {"type": "text", "voice_id": VOICE, "input_text": TEXT, "speed": 1.0}}],
        "dimension": {"width": GEN_W, "height": GEN_H}}
    r = api("https://api.heygen.com/v2/video/generate", body)
    if r.get("error"): raise SystemExit(f"submit error: {r['error']}")
    return (r.get("data") or {}).get("video_id")

def poll(vid):
    for _ in range(90):
        d = api(f"https://api.heygen.com/v1/video_status.get?video_id={vid}").get("data") or {}
        s = d.get("status")
        if s == "completed": return d.get("video_url")
        if s == "failed": raise SystemExit(f"render failed: {d.get('error')}")
        time.sleep(10)
    raise SystemExit("timed out")

def dur(f): return round(float(subprocess.check_output([FP,"-v","error","-show_entries","format=duration","-of","csv=p=0",f]).strip()), 2)
def mb(f): return round(os.path.getsize(f)/1e6, 2)

if not KEY: raise SystemExit("No HeyGen key at /tmp/heygen_key.txt")
print("quota before:", quota(), flush=True)
vid = submit(); print("video_id:", vid, flush=True)
url = poll(vid)
urllib.request.urlretrieve(url, RAW)
print(f"raw square: {dur(RAW)}s  {mb(RAW)}MB", flush=True)
print("quota after:", quota(), flush=True)

# Scale square -> 400x400, compress under 10MB. Bump CRF if needed.
for crf in (23, 27, 30, 34):
    subprocess.run([FF,"-y","-loglevel","error","-i",RAW,
        "-vf",f"scale={OUT_PX}:{OUT_PX}:flags=lanczos","-r","30",
        "-c:v","libx264","-crf",str(crf),"-preset","slow","-pix_fmt","yuv420p",
        "-c:a","aac","-b:a","96k","-movflags","+faststart",OUT], check=True)
    if mb(OUT) <= MAX_MB: break
print(f"DONE -> {OUT}  ({OUT_PX}x{OUT_PX}, {dur(OUT)}s, {mb(OUT)}MB)")
