#!/usr/bin/env python3
"""Karaoke closed captions driven by HeyGen's REAL SRT (accurate timing).
Black rounded box, white text, the currently-spoken word colored mint. Within each
SRT cue, words are sub-timed proportionally so the highlight tracks the voice.
Post pass on a finished reel; audio copied untouched.

Usage: python3 scripts/add_captions_srt.py <in.mp4> <srt> <out.mp4>
"""
import re, subprocess, sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
FF, FP = "/opt/homebrew/bin/ffmpeg", "/opt/homebrew/bin/ffprobe"
FONT = str(ROOT / "scripts/.fonts/Hanken.ttf")
IN, SRT, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
W, H = 1080, 1920
FS = 56; BOX_BOTTOM = 0.80; MAXW = 860
MINT = (0, 229, 160, 255); WHITE = (255, 255, 255, 255)
WORK = ROOT / "build/caps_srt"; WORK.mkdir(parents=True, exist_ok=True)
FONTOBJ = ImageFont.truetype(FONT, FS)

def ts(s):  # "HH:MM:SS,mmm" -> seconds
    h, m, rest = s.split(":"); sec, ms = rest.split(",")
    return int(h)*3600 + int(m)*60 + int(sec) + int(ms)/1000.0

cues = []
for block in re.split(r"\n\s*\n", Path(SRT).read_text().strip()):
    lines = [l for l in block.splitlines() if l.strip()]
    if len(lines) < 2: continue
    tl = next((l for l in lines if "-->" in l), None)
    if not tl: continue
    a, b = [x.strip() for x in tl.split("-->")]
    txt = " ".join(lines[lines.index(tl)+1:]).strip()
    if txt: cues.append((ts(a), ts(b), txt))

def _lines(words, d):
    out, cur = [], []
    for w in words:
        if not cur or d.textlength(" ".join(cur+[w]), font=FONTOBJ) <= MAXW: cur.append(w)
        else: out.append(cur); cur = [w]
    if cur: out.append(cur)
    return out

def render(words, active, out):
    img = Image.new("RGBA", (W, H), (0,0,0,0)); d = ImageDraw.Draw(img); lh = 70
    lines = _lines(words, d)
    tw = max(d.textlength(" ".join(l), font=FONTOBJ) for l in lines)
    padx, pady = 30, 18
    bw = int(tw)+padx*2; bh = lh*len(lines)+pady*2; cx = W//2
    y0 = int(H*BOX_BOTTOM)-bh
    box = Image.new("RGBA",(bw,bh),(0,0,0,0))
    ImageDraw.Draw(box).rounded_rectangle([0,0,bw,bh], radius=20, fill=(0,0,0,225))   # black box
    img.alpha_composite(box, (cx-bw//2, y0))
    gi = 0; ty = y0+pady
    for l in lines:
        lw = d.textlength(" ".join(l), font=FONTOBJ); x = cx-lw/2
        for w in l:
            d.text((x, ty), w, font=FONTOBJ, fill=(MINT if gi==active else WHITE))
            x += d.textlength(w+" ", font=FONTOBJ); gi += 1
        ty += lh
    img.save(out)

# word sub-windows within each real SRT cue
pngs, wins = [], []
gidx = 0
for ci,(a,b,txt) in enumerate(cues):
    words = txt.split(); wt = [len(w)+1 for w in words]; tot = sum(wt); t = a
    for k,w in enumerate(words):
        e = b if k == len(words)-1 else t + (b-a)*wt[k]/tot
        p = str(WORK/f"w{gidx}.png"); render(words, k, p)
        pngs.append(p); wins.append((t, e)); t = e; gidx += 1

ins = ["-i", IN] + sum([["-i", p] for p in pngs], [])
fc = "[0:v]null[b0]"
for k,(s,e) in enumerate(wins):
    fc += f";[b{k}][{k+1}:v]overlay=0:0:enable='between(t,{s:.3f},{e:.3f})'[b{k+1}]"
subprocess.run([FF,"-y","-loglevel","error",*ins,"-filter_complex",fc,"-map",f"[b{len(pngs)}]","-map","0:a",
    "-c:v","libx264","-b:v","3.5M","-maxrate","3.8M","-bufsize","5M","-pix_fmt","yuv420p","-r","30",
    "-c:a","copy","-movflags","+faststart",OUT], check=True)
print(f"{len(cues)} cues / {len(pngs)} word-states -> {OUT}")
