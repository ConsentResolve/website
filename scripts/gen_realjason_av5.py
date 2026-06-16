#!/usr/bin/env python3
"""Real-footage reel: ONE continuous Avatar V take (no scene seams = no choppy
voice resets) on the real video avatar 'Aaron Phillips' (ceff9efa), real voice
clone (9d5497, TTS), then crop-to-fill 9:16 + timed captions + grain. Review only.
"""
import json, re, subprocess, time, textwrap, urllib.request, urllib.error
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import sys
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
from video_scripts import job_for

KEY = open("/tmp/heygen_key.txt").read().strip()
FF, FP = "/opt/homebrew/bin/ffmpeg", "/opt/homebrew/bin/ffprobe"
FONT = str(ROOT / "scripts/.fonts/Hanken.ttf")
AVATAR = "ceff9efa4fcc40de9f750bfae36c8dd5"     # real-footage video avatar
VOICE = "9d5497bed1f144049861da9389addc96"      # real voice clone
NAME = "realjason-av5"
W, H, CAP_BOTTOM = 1080, 1920, 0.80
WORK = ROOT / "build/av5"; WORK.mkdir(parents=True, exist_ok=True)
REELS = ROOT / "public/reels"
PRON = {r"consentresolve\.com/demo": "consent resolve dot com slash demo", r"\bleads\b": "leeds", r"\blead\b": "leed"}

def spoken(t):
    for rx, rep in PRON.items(): t = re.sub(rx, rep, t, flags=re.I)
    return t

def api(u, body=None):
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(u, data=data, headers={"X-Api-Key": KEY, "Content-Type": "application/json"})
    try: return json.load(urllib.request.urlopen(req, timeout=180))
    except urllib.error.HTTPError as e: return {"error": e.read().decode()[:300]}

def dur(f): return float(subprocess.check_output([FP,"-v","error","-show_entries","format=duration","-of","csv=p=0",f]).strip())

def caption_png(text, out):
    img = Image.new("RGBA", (W, H), (0,0,0,0)); d = ImageDraw.Draw(img)
    font = ImageFont.truetype(FONT, 54)
    lines = textwrap.wrap(text.replace("—","-"), width=20); lh = 66
    tw = max(d.textlength(ln, font=font) for ln in lines)
    bh = lh*len(lines)+36; bw = int(tw)+64; cx = W//2
    y0 = int(H*CAP_BOTTOM)-bh; x0 = cx-bw//2
    box = Image.new("RGBA",(bw,bh),(0,0,0,0))
    ImageDraw.Draw(box).rounded_rectangle([0,0,bw,bh],radius=18,fill=(0,0,0,153))
    img.alpha_composite(box,(x0,y0)); ty = y0+18
    for ln in lines:
        lw = d.textlength(ln,font=font); d.text((cx-lw/2,ty),ln,font=font,fill=(255,255,255,255)); ty += lh
    img.save(out)

# 1) ONE continuous Avatar V render of the full leak script
scenes = job_for("leak")["scenes"]
texts = [s[0] for s in scenes]
full = " ".join(spoken(t) for t in texts)
print("rendering single continuous take...", flush=True)
r = api("https://api.heygen.com/v2/video/generate", {"caption": False, "video_inputs": [{
    "character": {"type": "avatar", "avatar_id": AVATAR, "avatar_style": "normal"},
    "voice": {"type": "text", "voice_id": VOICE, "input_text": full, "speed": 0.97}}],
    "dimension": {"width": 1920, "height": 1080}})   # native landscape, crop-to-fill after
vid = (r.get("data") or {}).get("video_id")
if not vid: raise SystemExit(f"submit failed: {r}")
src = str(WORK/"src.mp4")
for _ in range(90):
    d = api(f"https://api.heygen.com/v1/video_status.get?video_id={vid}").get("data") or {}
    if d.get("status") == "completed": urllib.request.urlretrieve(d["video_url"], src); break
    if d.get("status") == "failed": raise SystemExit(f"render failed: {d.get('error')}")
    time.sleep(10)
total = dur(src); print(f"  take: {round(total,2)}s", flush=True)

# 2) caption cues — proportional to word count across the measured take
words = [max(1, len(t.split())) for t in texts]; tot = sum(words)
cues, t = [], 0.0
for i, txt in enumerate(texts):
    seg = total*words[i]/tot; cap = str(WORK/f"cap{i}.png"); caption_png(txt, cap)
    cues.append((cap, t, t+seg)); t += seg

# 3) crop-to-fill 9:16 + grain + timed caption overlays
ins = ["-i", src] + sum([["-i", c[0]] for c in cues], [])
fc = "[0:v]scale=-2:1920,crop=1080:1920,noise=alls=11:allf=t+u,setsar=1[b0]"
for i,(cap,s,e) in enumerate(cues):
    fc += f";[b{i}][{i+1}:v]overlay=0:0:enable='between(t,{s:.3f},{e:.3f})'[b{i+1}]"
out = str(REELS/f"test-{NAME}-tiktok.mp4")
subprocess.run([FF,"-y","-loglevel","error",*ins,"-filter_complex",fc,"-map",f"[b{len(cues)}]","-map","0:a",
    "-c:v","libx264","-b:v","3.5M","-maxrate","3.8M","-bufsize","5M","-pix_fmt","yuv420p","-r","30",
    "-c:a","aac","-b:a","128k","-movflags","+faststart",out], check=True)
print(f"done -> {out}")
