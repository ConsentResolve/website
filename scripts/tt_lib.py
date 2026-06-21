#!/usr/bin/env python3
"""Shared helpers for the Thumbtack-Exposed faceless explainer: brand palette + PIL
draw helpers, HeyGen TTS, ffmpeg, run log. Motion-graphics are PIL-rendered (this
ffmpeg has no drawtext) and animated with ffmpeg (Ken Burns / fades / timed overlays)."""
import os, json, time, datetime, subprocess, urllib.request, urllib.error
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
TT = ROOT / "thumbtack"
VO, SCENES, OUT = TT/"vo", TT/"scenes", TT/"out"
for d in (VO, SCENES, OUT): d.mkdir(parents=True, exist_ok=True)
FF, FP = "/opt/homebrew/bin/ffmpeg", "/opt/homebrew/bin/ffprobe"
RUNLOG = TT / "RUNLOG.md"
W, H, FPS = 1920, 1080, 30

HEYGEN_KEY = open("/tmp/heygen_key.txt").read().strip()
VOICE_ID = "f365d990e89f4c55810722ef4788b85b"
LOOK = "b8cf5419ad5247d38bb000fd0df239a6"   # audio-only; look arbitrary

# Brand palette
BG = (10, 22, 40); BG2 = (14, 29, 51); PANEL = (18, 34, 58)
MINT = (0, 229, 160); TEXT = (245, 248, 250); SUB = (148, 163, 184)
RED = (255, 109, 109); GOLD = (245, 197, 66); LINE = (30, 45, 70)
HANKEN = str(ROOT / "scripts/.fonts/Hanken.ttf")
MONO = "/System/Library/Fonts/Menlo.ttc" if os.path.exists("/System/Library/Fonts/Menlo.ttc") else HANKEN

def log(msg):
    ts = datetime.datetime.now().strftime("%H:%M:%S")
    line = f"- `{ts}` {msg}"; print(line, flush=True)
    with open(RUNLOG, "a") as f: f.write(line + "\n")

def font(size, mono=False): return ImageFont.truetype(MONO if mono else HANKEN, size)

def canvas(grad=True):
    img = Image.new("RGB", (W, H), BG)
    if grad:
        d = ImageDraw.Draw(img)
        for y in range(H):
            t = y / H
            d.line([(0, y), (W, y)], fill=(int(10+8*t), int(22+10*t), int(40+14*t)))
    return img

def center_text(d, cx, y, text, f, fill, anchor_top=True):
    w = d.textlength(text, font=f)
    d.text((cx - w/2, y), text, font=f, fill=fill); return w

def panel(d, box, radius=22, fill=PANEL, outline=LINE, width=2):
    d.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)

def disclaimer(img):
    d = ImageDraw.Draw(img); f = font(20)
    txt = "Independent analysis · figures are illustrative models · complaint themes paraphrased from public reviews · not affiliated with or endorsed by Thumbtack"
    # wrap to one or two lines at bottom
    import textwrap
    lines = textwrap.wrap(txt, width=120)
    y = H - 26 - 24*len(lines)
    for ln in lines:
        d.text((40, y), ln, font=f, fill=(90, 105, 125)); y += 24
    return img

# ── HeyGen TTS (audio-only) ───────────────────────────────────────────────────
def _hg(url, body=None):
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(url, data=data, headers={"X-Api-Key": HEYGEN_KEY, "Content-Type": "application/json"})
    try: return json.load(urllib.request.urlopen(req, timeout=180))
    except urllib.error.HTTPError as e: return {"error": e.read().decode()[:200]}

def heygen_tts(text, out_wav, speed=1.0, retries=1):
    for attempt in range(retries + 1):
        r = _hg("https://api.heygen.com/v2/video/generate", {"caption": False, "video_inputs": [{
            "character": {"type": "talking_photo", "talking_photo_id": LOOK, "use_avatar_iv_model": True},
            "voice": {"type": "text", "voice_id": VOICE_ID, "input_text": text, "speed": speed}}],
            "dimension": {"width": 720, "height": 1280}})
        vid = (r.get("data") or {}).get("video_id")
        if not vid: log(f"tts submit FAIL ({attempt}) {Path(out_wav).name}: {str(r)[:120]}"); time.sleep(5); continue
        for _ in range(90):
            d = (_hg(f"https://api.heygen.com/v1/video_status.get?video_id={vid}").get("data") or {})
            if d.get("status") == "completed":
                mp4 = str(out_wav) + ".src.mp4"; urllib.request.urlretrieve(d["video_url"], mp4)
                subprocess.run([FF, "-y", "-loglevel", "error", "-i", mp4, "-vn", "-ar", "44100", "-ac", "2", out_wav], check=True)
                os.remove(mp4); return True
            if d.get("status") == "failed": log(f"tts render FAIL ({attempt}) {Path(out_wav).name}"); break
            time.sleep(8)
    return False

def dur(f):
    return float(subprocess.check_output([FP, "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(f)]).strip())
