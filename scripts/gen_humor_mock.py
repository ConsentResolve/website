#!/usr/bin/env python3
"""Mock of the deadpan-humor series format on the studfinder test clip:
 - pull the HeyGen render, detect the spoken sentences via silencedetect
 - burn timed lower-third captions (punchline word in mint)
 - subtle series label (top) + @consentresolve handle (bottom), brand accent
 - ~1s deadpan end-hold so it loops seamlessly · output 1080x1920
Demo only — one clip, to approve the look before batching the library."""
import json, re, subprocess, urllib.request
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
ROOT = Path(__file__).resolve().parent.parent
FF, FP = "/opt/homebrew/bin/ffmpeg", "/opt/homebrew/bin/ffprobe"
KEY = open("/tmp/heygen_key.txt").read().strip()
DISP = str(ROOT/"scripts/.fonts/Bricolage.ttf"); SANS = str(ROOT/"scripts/.fonts/Hanken.ttf")
W, H = 1080, 1920
NAVY = (10, 22, 40); MINT = (0, 229, 160); PAPER = (248, 250, 252)
VIDEO_ID = "b026a184b2dd4cb481aa57ab6ebafe9d"
SENTENCES = ["I bought a stud finder.", "I took it to a bar.", "It kept pointing at me.", "It's broken."]
PUNCH = 3  # index of the punchline sentence (mint emphasis)
SERIES = "SHOP TALK"; SUB = "with AAAA-RON"; HANDLE = "@consentresolve"
d = ROOT/"build/humormock"; d.mkdir(parents=True, exist_ok=True)
disp = lambda p: ImageFont.truetype(DISP, p); sans = lambda p: ImageFont.truetype(SANS, p)

# 1) fresh URL + download
st = json.load(urllib.request.urlopen(urllib.request.Request(
    f"https://api.heygen.com/v1/video_status.get?video_id={VIDEO_ID}", headers={"x-api-key": KEY}), timeout=60))["data"]
src = str(d/"src.mp4"); urllib.request.urlretrieve(st["video_url"], src)
dur = float(subprocess.check_output([FP, "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", src]).strip())

# 2) detect speech segments via silencedetect
out = subprocess.run([FF, "-i", src, "-af", "silencedetect=noise=-30dB:d=0.18", "-f", "null", "-"],
                     capture_output=True, text=True).stderr
sil = []
for m in re.finditer(r"silence_start: ([\d.]+)", out): sil.append(["s", float(m.group(1))])
for m in re.finditer(r"silence_end: ([\d.]+)", out): sil.append(["e", float(m.group(1))])
sil.sort(key=lambda x: x[1])
# speech segments = gaps between silences
segs = []; t = 0.0
for kind, ti in sil:
    if kind == "s" and ti > t + 0.05: segs.append((t, ti));
    if kind == "e": t = ti
if t < dur - 0.05: segs.append((t, dur))
if len(segs) != len(SENTENCES):  # fallback: even split across speech span
    span0, span1 = (segs[0][0] if segs else 0.0), (segs[-1][1] if segs else dur)
    step = (span1 - span0)/len(SENTENCES); segs = [(span0+i*step, span0+(i+1)*step) for i in range(len(SENTENCES))]
print("segments:", [f"{a:.1f}-{b:.1f}" for a, b in segs], flush=True)

# 3) caption pngs (lower third dark pill; punchline mint)
def cap_png(text, mint, out):
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0)); dr = ImageDraw.Draw(img); f = sans(64)
    tw = dr.textlength(text, font=f); bw = int(tw)+72; bh = 110; cx = W//2; y0 = int(H*0.74)
    box = Image.new("RGBA", (bw, bh), (0, 0, 0, 0)); ImageDraw.Draw(box).rounded_rectangle([0, 0, bw, bh], radius=22, fill=(10, 22, 40, 235))
    img.alpha_composite(box, (cx-bw//2, y0)); dr.text((cx, y0+bh//2), text, font=f, fill=(MINT+(255,)) if mint else (255, 255, 255, 255), anchor="mm")
    img.save(out)
caps = []
for i, (a, b) in enumerate(segs):
    p = str(d/f"c{i}.png"); cap_png(SENTENCES[i], i == PUNCH, p); caps.append((p, a, b))

# 4) static chrome: SHOP TALK + "with AAAA-RON" (top) + @handle pill (bottom) — all in
#    contrasting pills so they read over any avatar background.
chrome = Image.new("RGBA", (W, H), (0, 0, 0, 0)); cd = ImageDraw.Draw(chrome)
lf = disp(50); lw = cd.textlength(SERIES, font=lf)
cd.rounded_rectangle([W//2-lw//2-32, 64, W//2+lw//2+32, 64+86], radius=43, fill=MINT)
cd.text((W//2, 64+43), SERIES, font=lf, fill=NAVY, anchor="mm")
sf = disp(34); sw = cd.textlength(SUB, font=sf); sy = 64+86+12
cd.rounded_rectangle([W//2-sw//2-22, sy, W//2+sw//2+22, sy+58], radius=29, fill=(10, 22, 40, 235))
cd.text((W//2, sy+29), SUB, font=sf, fill=(MINT+(255,)), anchor="mm")
hf = sans(42); hw = cd.textlength(HANDLE, font=hf); hy = int(H*0.88)
cd.rounded_rectangle([W//2-hw//2-28, hy-36, W//2+hw//2+28, hy+36], radius=36, fill=(10, 22, 40, 215))
cd.text((W//2, hy), HANDLE, font=hf, fill=(255, 255, 255, 255), anchor="mm")
chrome_p = str(d/"chrome.png"); chrome.save(chrome_p)

# 5) composite: scale to 1080x1920, +1s deadpan end-hold (loop), overlay chrome + captions
ins = ["-i", src, "-i", chrome_p] + sum([["-i", p] for p, _a, _b in caps], [])
fc = f"[0:v]scale={W}:{H},tpad=stop_mode=clone:stop_duration=1.0,fps=30[v0]"
fc += ";[v0][1:v]overlay=0:0[b0]"
k = 0
for j, (p, a, b) in enumerate(caps):
    fc += f";[b{k}][{2+j}:v]overlay=0:0:enable='between(t,{a:.2f},{b:.2f})'[b{k+1}]"; k += 1
fc += f";[b{k}]null[v];[0:a]apad=pad_dur=1.0,loudnorm=I=-14:TP=-1.5:LRA=11[a]"
outp = str(ROOT/"public/reels/humor-mock-studfinder.mp4")
subprocess.run([FF, "-y", "-loglevel", "error", *ins, "-filter_complex", fc, "-map", "[v]", "-map", "[a]",
    "-c:v", "libx264", "-b:v", "5M", "-pix_fmt", "yuv420p", "-r", "30", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", outp], check=True)
print("wrote", outp, flush=True)
subprocess.run(["/usr/bin/python3", str(ROOT/"scripts/r2_upload.py"), outp, "social/exp/humor-mock-studfinder.mp4", "video/mp4"], cwd=str(ROOT))
