#!/usr/bin/env python3
"""Polished SHOP TALK with AAAA-RON demo on the studfinder clip — full show shape:
  · cover poster (grid thumbnail)  · 1.3s cold-open hook  · the bit (timed captions,
    SHOP TALK / with AAAA-RON / @handle pills)  · branded outro (follow for more).
Demo only, one clip, to approve the format before the library."""
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
PUNCH = 3; HOOK_LINE = SENTENCES[0]
SERIES, SUB, HANDLE = "SHOP TALK", "with AAAA-RON", "@consentresolve"
d = ROOT/"build/humormock"; d.mkdir(parents=True, exist_ok=True)
disp = lambda p: ImageFont.truetype(DISP, p); sans = lambda p: ImageFont.truetype(SANS, p)
def fit(dr, t, fp, hi, lo, mw):
    s = hi
    while s > lo and dr.textlength(t, font=ImageFont.truetype(fp, s)) > mw: s -= 2
    return ImageFont.truetype(fp, max(14, s))
def wrap(dr, t, f, mw):
    out, cur = [], ""
    for w in t.split():
        if dr.textlength((cur+" "+w).strip(), font=f) <= mw: cur = (cur+" "+w).strip()
        else: out.append(cur); cur = w
    if cur: out.append(cur)
    return out
def brand_bg():
    img = Image.new("RGB", (W, H), NAVY); dr = ImageDraw.Draw(img, "RGBA")
    for gy in range(60, H, 60):
        for gx in range(60, W, 60): dr.ellipse([gx, gy, gx+2, gy+2], fill=(148, 163, 184))
    return img, dr
def lockup(dr, y):  # SHOP TALK pill + with AAAA-RON
    lf = disp(52); lw = dr.textlength(SERIES, font=lf)
    dr.rounded_rectangle([W//2-lw//2-34, y, W//2+lw//2+34, y+90], radius=45, fill=MINT)
    dr.text((W//2, y+45), SERIES, font=lf, fill=NAVY, anchor="mm")
    sf = disp(36); dr.text((W//2, y+90+36), SUB, font=sf, fill=(MINT+(255,)), anchor="mm")

# 1) pull + download fresh
st = json.load(urllib.request.urlopen(urllib.request.Request(
    f"https://api.heygen.com/v1/video_status.get?video_id={VIDEO_ID}", headers={"x-api-key": KEY}), timeout=60))["data"]
src = str(d/"src.mp4"); urllib.request.urlretrieve(st["video_url"], src)
dur = float(subprocess.check_output([FP, "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", src]).strip())

# 2) sentence timing via silencedetect (fallback even split)
err = subprocess.run([FF, "-i", src, "-af", "silencedetect=noise=-30dB:d=0.18", "-f", "null", "-"], capture_output=True, text=True).stderr
sil = sorted([("s", float(m.group(1))) for m in re.finditer(r"silence_start: ([\d.]+)", err)]
             + [("e", float(m.group(1))) for m in re.finditer(r"silence_end: ([\d.]+)", err)], key=lambda x: x[1])
segs = []; t = 0.0
for k, ti in sil:
    if k == "s" and ti > t+0.05: segs.append((t, ti))
    if k == "e": t = ti
if t < dur-0.05: segs.append((t, dur))
if len(segs) != len(SENTENCES):
    a0, a1 = (segs[0][0] if segs else 0.0), (segs[-1][1] if segs else dur); step = (a1-a0)/len(SENTENCES)
    segs = [(a0+i*step, a0+(i+1)*step) for i in range(len(SENTENCES))]

# 3) caption pngs
def cap_png(text, mint, out):
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0)); dr = ImageDraw.Draw(img); f = sans(64)
    tw = dr.textlength(text, font=f); bw = int(tw)+72; cx = W//2; y0 = int(H*0.74)
    box = Image.new("RGBA", (bw, 110), (0, 0, 0, 0)); ImageDraw.Draw(box).rounded_rectangle([0, 0, bw, 110], radius=22, fill=(10, 22, 40, 235))
    img.alpha_composite(box, (cx-bw//2, y0)); dr.text((cx, y0+55), text, font=f, fill=(MINT+(255,)) if mint else (255, 255, 255, 255), anchor="mm")
    img.save(out)
caps = []
for i, (a, b) in enumerate(segs):
    p = str(d/f"c{i}.png"); cap_png(SENTENCES[i], i == PUNCH, p); caps.append((p, a, b))

# 4) chrome (pills) for the bit
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

# 5) cold-open hook card (navy, lockup + the setup line big) + outro card
img, dr = brand_bg(); lockup(dr, 150)
f = fit(dr, HOOK_LINE, DISP, 120, 64, W-150)
ls = wrap(dr, HOOK_LINE, f, W-150); y = H//2 - len(ls)*int(f.size*1.12)//2
for ln in ls: dr.text((W//2, y), ln, font=f, fill=PAPER, anchor="mm"); y += int(f.size*1.12)
hook_png = str(d/"hook.png"); img.save(hook_png)
img, dr = brand_bg(); lockup(dr, 360)
ff = disp(96); dr.text((W//2, int(H*0.55)), "follow for more", font=ff, fill=PAPER, anchor="mm")
hw2 = dr.textlength(HANDLE, font=sans(48)); hy2 = int(H*0.70)
dr.rounded_rectangle([W//2-hw2//2-30, hy2-40, W//2+hw2//2+30, hy2+40], radius=40, fill=MINT)
dr.text((W//2, hy2), HANDLE, font=sans(48), fill=NAVY, anchor="mm")
outro_png = str(d/"outro.png"); img.save(outro_png)

# 6) cover poster (grid thumbnail): a strong avatar frame + setup line + lockup
frame = str(d/"frame.png"); subprocess.run([FF, "-y", "-loglevel", "error", "-ss", f"{dur*0.42:.2f}", "-i", src, "-frames:v", "1", "-vf", f"scale={W}:{H}", frame], check=True)
cov = Image.open(frame).convert("RGB"); cd2 = ImageDraw.Draw(cov, "RGBA")
cd2.rectangle([0, 0, W, 260], fill=(10, 22, 40, 150)); cd2.rectangle([0, H-460, W, H], fill=(10, 22, 40, 150))
lockup(cd2, 60)
cf = fit(cd2, HOOK_LINE, DISP, 96, 56, W-120); cls = wrap(cd2, HOOK_LINE, cf, W-120); cy = H-360
for ln in cls: cd2.text((W//2, cy), ln, font=cf, fill=PAPER, anchor="mm"); cy += int(cf.size*1.1)
cd2.text((W//2, H-90), HANDLE, font=sans(40), fill=(MINT+(255,)), anchor="mm")
cover_p = str(ROOT/"public/reels/humor-cover-studfinder.png"); cov.save(cover_p)

# 7) the bit (avatar + chrome + captions, +0.4s punch hold)
ins = ["-i", src, "-i", chrome_p] + sum([["-i", p] for p, _a, _b in caps], [])
fc = f"[0:v]scale={W}:{H},tpad=stop_mode=clone:stop_duration=0.4,fps=30[v0];[v0][1:v]overlay=0:0[b0]"
k = 0
for j, (p, a, b) in enumerate(caps):
    fc += f";[b{k}][{2+j}:v]overlay=0:0:enable='between(t,{a:.2f},{b:.2f})'[b{k+1}]"; k += 1
fc += f";[b{k}]null[v];[0:a]apad=pad_dur=0.4,loudnorm=I=-14:TP=-1.5:LRA=11[a]"
bit = str(d/"bit.mp4")
subprocess.run([FF, "-y", "-loglevel", "error", *ins, "-filter_complex", fc, "-map", "[v]", "-map", "[a]",
    "-c:v", "libx264", "-b:v", "5M", "-pix_fmt", "yuv420p", "-r", "30", "-c:a", "aac", "-b:a", "160k", bit], check=True)

# 8) hook + outro clips (silent), then concat hook + bit + outro
def card_clip(png, dur_s, out):
    subprocess.run([FF, "-y", "-loglevel", "error", "-loop", "1", "-t", f"{dur_s}", "-i", png,
        "-f", "lavfi", "-t", f"{dur_s}", "-i", "anullsrc=r=44100:cl=stereo",
        "-vf", f"scale={W}:{H},fps=30,format=yuv420p", "-c:v", "libx264", "-r", "30", "-c:a", "aac", "-b:a", "160k", "-shortest", out], check=True)
hook_c = str(d/"hookclip.mp4"); outro_c = str(d/"outroclip.mp4")
card_clip(hook_png, 1.3, hook_c); card_clip(outro_png, 1.6, outro_c)
out = str(ROOT/"public/reels/humor-mock-studfinder.mp4")
subprocess.run([FF, "-y", "-loglevel", "error", "-i", hook_c, "-i", bit, "-i", outro_c,
    "-filter_complex", "[0:v][0:a][1:v][1:a][2:v][2:a]concat=n=3:v=1:a=1[v][a]", "-map", "[v]", "-map", "[a]",
    "-c:v", "libx264", "-b:v", "5M", "-pix_fmt", "yuv420p", "-r", "30", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", out], check=True)
print("reel:", out, "| cover:", cover_p, flush=True)
subprocess.run(["/usr/bin/python3", str(ROOT/"scripts/r2_upload.py"), out, "social/exp/humor-mock-studfinder.mp4", "video/mp4"], cwd=str(ROOT))
subprocess.run(["/usr/bin/python3", str(ROOT/"scripts/r2_upload.py"), cover_p, "social/exp/humor-cover-studfinder.png", "image/png"], cwd=str(ROOT))
