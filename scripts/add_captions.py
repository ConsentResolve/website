#!/usr/bin/env python3
"""TikTok-style closed captions, added as a POST pass on a finished reel (does not
re-render the avatar). Small 1-3 word chunks appear as spoken; clean white text
with outline + soft shadow (no heavy box) = readable but non-obtrusive; parked in
the lower third. Audio is copied untouched.

Usage: python3 scripts/add_captions.py <in.mp4> <out.mp4>   (caption text below)
Timing: proportional to word length + a pause beat after , . ? ! ; : — approximate
(no ASR), good enough for social; tighten by hand if a chunk drifts.
"""
import subprocess, sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
FF, FP = "/opt/homebrew/bin/ffmpeg", "/opt/homebrew/bin/ffprobe"
FONT = str(ROOT / "scripts/.fonts/Hanken.ttf")
IN, OUT = sys.argv[1], sys.argv[2]
W, H = 1080, 1920
Y = int(H * 0.72)            # lower third, clear of bottom UI
FS = 58                      # medium — readable, not shouty
MAXW = 760                   # px before forcing a new chunk
WORK = ROOT / "build/caps"; WORK.mkdir(parents=True, exist_ok=True)

CAPTION = ("So I run the front desk at a roofing company, and here is what used to drive me crazy. "
           "We would spend real money getting people to our website, and then most of them would just leave. "
           "No call, no form, nothing. Turns out about 98 out of every 100 visitors never reach out. "
           "We were paying for all of them, and only ever hearing from a handful. "
           "Now when someone who has opted in lands on our site, we actually get them as a lead. "
           "A name, an email, the details we need to follow up. Same traffic. "
           "We just stopped letting most of it disappear. Honestly? It made my whole job easier.")

dur = float(subprocess.check_output([FP,"-v","error","-show_entries","format=duration","-of","csv=p=0",IN]).strip())
FONTOBJ = ImageFont.truetype(FONT, FS)
_d = ImageDraw.Draw(Image.new("RGB",(10,10)))

# --- chunk into 1-3 word reading units, breaking at punctuation / width ---
words = CAPTION.split()
chunks, cur = [], []
for w in words:
    cur.append(w)
    ends_punct = w[-1] in ".?!,;:"
    too_wide = _d.textlength(" ".join(cur), font=FONTOBJ) > MAXW
    if ends_punct or len(cur) >= 3 or too_wide:
        chunks.append(cur); cur = []
if cur: chunks.append(cur)

# --- time windows: weight = chars + pause beat after punctuation ---
def weight(ch):
    s = " ".join(ch); base = len(s) + 2
    return base + (6 if s[-1] in ".?!" else 3 if s[-1] in ",;:" else 0)
wts = [weight(c) for c in chunks]; tot = sum(wts)
lead = 0.10; span = dur - lead; t = lead; wins = []
for w in wts: wins.append((t, t + span*w/tot)); t += span*w/tot

# --- render one PNG per chunk: white text, black outline + soft shadow, no box ---
def render(text, out):
    img = Image.new("RGBA",(W,H),(0,0,0,0)); d = ImageDraw.Draw(img)
    tw = d.textlength(text, font=FONTOBJ); x = (W - tw)/2
    d.text((x+3, Y+3), text, font=FONTOBJ, fill=(0,0,0,120))                       # soft shadow
    d.text((x, Y), text, font=FONTOBJ, fill=(255,255,255,255),
           stroke_width=5, stroke_fill=(0,0,0,235))                               # outline
    img.save(out)

pngs = []
for i, ch in enumerate(chunks):
    p = str(WORK/f"c{i}.png"); render(" ".join(ch).rstrip(",;:"), p); pngs.append(p)

ins = ["-i", IN] + sum([["-i", p] for p in pngs], [])
fc = "[0:v]null[b0]"
for k,(s,e) in enumerate(wins):
    fc += f";[b{k}][{k+1}:v]overlay=0:0:enable='between(t,{s:.3f},{e:.3f})'[b{k+1}]"
subprocess.run([FF,"-y","-loglevel","error",*ins,"-filter_complex",fc,"-map",f"[b{len(pngs)}]","-map","0:a",
    "-c:v","libx264","-b:v","3.5M","-maxrate","3.8M","-bufsize","5M","-pix_fmt","yuv420p","-r","30",
    "-c:a","copy","-movflags","+faststart",OUT], check=True)
print(f"{len(chunks)} caption chunks over {dur:.1f}s -> {OUT}")
