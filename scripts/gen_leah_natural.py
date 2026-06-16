#!/usr/bin/env python3
"""Leah — NATURAL single-take test. Fixes the choppy/muddy-audio issues:
  - ONE continuous Avatar IV render (no scene seams = no voice resets)
  - STATIC look (motion OFF — saves credits, per request)
  - conversational, non-ad script in her own (office-manager) POV
  - CLEAN audio: original continuous VO, highpass, NO dynaudnorm pumping,
    ambient barely-there (weight 0.07)
  - word-level karaoke captions, gentle handheld drift (no zoom punches)
Output: public/reels/test-leah-natural-tiktok.mp4
"""
import json, os, re, subprocess, time, hashlib, urllib.request, urllib.error
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
KEY = open("/tmp/heygen_key.txt").read().strip()
FF, FP = "/opt/homebrew/bin/ffmpeg", "/opt/homebrew/bin/ffprobe"
FONT = str(ROOT / "scripts/.fonts/Hanken.ttf")
LOOK = "6d3166f5a77545b1ab06a110a189c225"      # Soft-Lit Home Office Selfie (STATIC, no motion)
VOICE = "1d92f4e36247492d9ad806b59fd3434a"     # Real Leah
NAME = "leah-natural"; SPEED = 0.93
W, H, CAP_BOTTOM = 1080, 1920, 0.80
WORK = ROOT / "build/leah_nat"; WORK.mkdir(parents=True, exist_ok=True)
REELS = ROOT / "public/reels"

SPOKEN = ("So I run the front desk and the follow-up at a home-service company. "
          "And the part that used to drive me nuts? Almost everyone who lands on our website... just leaves. "
          "Ninety-eight out of a hundred. No name, no email, nothing for me to work with... "
          "and we paid for every one of those clicks. So now we actually recover those visitors. "
          "The ones who already wanted the work, opting in with their email, expecting to hear from us. "
          "It's our own traffic... handed back. Honestly? It made my job a whole lot easier.")
CAPTION = SPOKEN.replace("...", "")

def api(url, body=None):
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(url, data=data, headers={"X-Api-Key": KEY, "Content-Type": "application/json"})
    try: return json.load(urllib.request.urlopen(req, timeout=180))
    except urllib.error.HTTPError as e: return {"error": e.read().decode()[:200]}

def quota(): return (api("https://api.heygen.com/v2/user/remaining_quota").get("data") or {}).get("remaining_quota")
def dur(f): return round(float(subprocess.check_output([FP,"-v","error","-show_entries","format=duration","-of","csv=p=0",f]).strip()), 3)

# --- 1) single continuous render (static look, no emotion) ---
print("quota before:", quota(), flush=True)
src = str(WORK/"src.mp4")
r = api("https://api.heygen.com/v2/video/generate", {"caption": False, "video_inputs": [{
    "character": {"type": "talking_photo", "talking_photo_id": LOOK, "use_avatar_iv_model": True,
                  "talking_style": "expressive", "super_resolution": True},
    "voice": {"type": "text", "voice_id": VOICE, "input_text": SPOKEN, "speed": SPEED}}],
    "dimension": {"width": 1080, "height": 1920}})
vid = (r.get("data") or {}).get("video_id")
if not vid: raise SystemExit(f"submit failed: {r}")
for _ in range(90):
    d = api(f"https://api.heygen.com/v1/video_status.get?video_id={vid}").get("data") or {}
    if d.get("status") == "completed": urllib.request.urlretrieve(d["video_url"], src); break
    if d.get("status") == "failed": raise SystemExit(f"render failed: {d.get('error')}")
    time.sleep(10)
total = dur(src); print(f"quota after: {quota()} | take: {total}s", flush=True)

# --- 2) phrase + word timing across the single take ---
FONTOBJ = ImageFont.truetype(FONT, 54)
raw = [p.strip() for p in re.split(r'(?<=[.?])\s+', CAPTION) if p.strip()]
phrases = []
for p in raw:                      # cap long phrases to ~6 words for readability
    w = p.split()
    for i in range(0, len(w), 6): phrases.append(w[i:i+6])
flat = [(pi, li, w) for pi, ph in enumerate(phrases) for li, w in enumerate(ph)]
wt = [len(w)+2 for _, _, w in flat]; tot = sum(wt)
lead = 0.15; span = total-lead; t = lead; wins = []
for w in wt: wins.append((t, t+span*w/tot)); t += span*w/tot

def _lines(words, d, mw):
    lines, cur = [], []
    for w in words:
        if not cur or d.textlength(" ".join(cur+[w]), font=FONTOBJ) <= mw: cur.append(w)
        else: lines.append(cur); cur = [w]
    if cur: lines.append(cur)
    return lines

def karaoke_png(words, active, out):
    img = Image.new("RGBA",(W,H),(0,0,0,0)); d = ImageDraw.Draw(img); lh = 66
    lines = _lines(words, d, W-220)
    tw = max(d.textlength(" ".join(l), font=FONTOBJ) for l in lines)
    bh = lh*len(lines)+36; bw = int(tw)+64; cx = W//2; y0 = int(H*CAP_BOTTOM)-bh
    box = Image.new("RGBA",(bw,bh),(0,0,0,0))
    ImageDraw.Draw(box).rounded_rectangle([0,0,bw,bh],radius=18,fill=(0,0,0,150))
    img.alpha_composite(box,(cx-bw//2,y0)); gi = 0; ty = y0+18
    for l in lines:
        lw = d.textlength(" ".join(l), font=FONTOBJ); x = cx-lw/2
        for w in l:
            col = (0,229,160,255) if gi==active else (255,255,255,255)
            d.text((x,ty), w, font=FONTOBJ, fill=col); x += d.textlength(w+" ", font=FONTOBJ); gi += 1
        ty += lh
    img.save(out)

pngs = []
for g,(pi,li,_) in enumerate(flat):
    p = str(WORK/f"k{g}.png"); karaoke_png(phrases[pi], li, p); pngs.append(p)

# --- 3) one ffmpeg pass: gentle drift + grain + karaoke overlays + clean audio ---
import random; rnd = random.Random(int(hashlib.md5(NAME.encode()).hexdigest()[:8],16))
ax, ay = 8, 7; fx, fy = 0.07, 0.11; phx, phy = rnd.uniform(0,6.28), rnd.uniform(0,6.28)
ins = ["-i", src] + sum([["-i", p] for p in pngs], [])
amb_idx = len(pngs)+1
ins += ["-f","lavfi","-t",f"{total:.3f}","-i","anoisesrc=color=brown:amplitude=0.18:sample_rate=44100"]
xexpr = f"(in_w-1080)/2+{ax}*sin(2*PI*t*{fx}+{phx})"
yexpr = f"(in_h-1920)/2+{ay}*sin(2*PI*t*{fy}+{phy})"
fc = f"[0:v]scale=trunc(iw*1.05/2)*2:trunc(ih*1.05/2)*2,crop=1080:1920:x='{xexpr}':y='{yexpr}',noise=alls=10:allf=t+u,setsar=1[b0]"
for k,(s,e) in enumerate(wins): fc += f";[b{k}][{k+1}:v]overlay=0:0:enable='between(t,{s:.3f},{e:.3f})'[b{k+1}]"
fc += f";[0:a]highpass=f=85[vo];[{amb_idx}:a]lowpass=f=520,volume=0.4[amb];[vo][amb]amix=inputs=2:duration=first:weights=1 0.07[a]"
out = str(REELS/f"test-{NAME}-tiktok.mp4")
subprocess.run([FF,"-y","-loglevel","error",*ins,"-filter_complex",fc,"-map",f"[b{len(pngs)}]","-map","[a]",
    "-c:v","libx264","-b:v","3.5M","-maxrate","3.8M","-bufsize","5M","-pix_fmt","yuv420p","-r","30",
    "-c:a","aac","-b:a","160k","-movflags","+faststart",out], check=True)
print(f"done -> {out}", flush=True)
