#!/usr/bin/env python3
"""Add two deliverables per avatar test (no new HeyGen credits — reuses scenes):
  1) <name>.srt  — deterministic captions from scene text + durations (YouTube CC)
  2) test-<name>-tiktok.mp4 — TikTok/Reels-safe captions: raised to ~62% down,
     centered, narrower wrap so text clears the right-side action rail + bottom bar.
Same de-AI/framing/grain pipeline as the feed version.
"""
import json, os, subprocess, textwrap
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path("/Users/aaronphillips/GIT/consentresolve2")
T = ROOT / "build/tests"; REELS = ROOT / "public/reels"
FF = "/opt/homebrew/bin/ffmpeg"; FP = "/opt/homebrew/bin/ffprobe"
FONT = str(ROOT / "scripts/.fonts/Hanken.ttf")
W, H = 1080, 1920
PUNCH = [1.0, 1.15, 1.0]; EXPO = [0.0, 0.02, -0.02]

def ts(sec):
    ms = int(round(sec * 1000)); h, ms = divmod(ms, 3600000); m, ms = divmod(ms, 60000); s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"

def write_srt(scenes, out):
    cues, t = [], 0.0
    for i, sc in enumerate(scenes):
        start, end = t, t + sc["dur"]; t = end
        cues.append(f"{i+1}\n{ts(start)} --> {ts(end)}\n{sc['text'].replace('—','-')}\n")
    Path(out).write_text("\n".join(cues))

def caption_png(text, out, cy_frac, x_off, wrap):
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(img)
    font = ImageFont.truetype(FONT, 54)
    lines = textwrap.wrap(text.replace("—", "-"), width=wrap); lh = 66
    tw = max(d.textlength(ln, font=font) for ln in lines)
    bh = lh * len(lines) + 36; bw = int(tw) + 64
    cx = W // 2 + x_off; cy = int(H * cy_frac)
    x0, y0 = cx - bw // 2, cy - bh // 2
    box = Image.new("RGBA", (bw, bh), (0, 0, 0, 0))
    ImageDraw.Draw(box).rounded_rectangle([0, 0, bw, bh], radius=18, fill=(0, 0, 0, 153))
    img.alpha_composite(box, (x0, y0))
    ty = y0 + 18
    for ln in lines:
        lw = d.textlength(ln, font=font); d.text((cx - lw/2, ty), ln, font=font, fill=(255,255,255,255)); ty += lh
    img.save(out)

def build_tiktok(name, scenes):
    d = T / name; parts = []
    for i, sc in enumerate(scenes):
        cap = str(d / f"tk_cap{i+1}.png"); part = str(d / f"tk_p{i+1}.mp4")
        caption_png(sc["text"], cap, cy_frac=0.62, x_off=0, wrap=20)   # raised + centered + narrow
        sc_, ex = PUNCH[i % len(PUNCH)], EXPO[i % len(EXPO)]
        chain = ("[0:v]scale=trunc(iw*1.04/2)*2:trunc(ih*1.04/2)*2,"
                 "crop=1080:1920:x='(in_w-1080)/2+16*sin(2*PI*t*0.11)':y='(in_h-1920)/2+12*sin(2*PI*t*0.17)'")
        if sc_ > 1.0:
            chain += f",crop=trunc(1080/{sc_}/2)*2:trunc(1920/{sc_}/2)*2:(in_w-ow)/2:(in_h-oh)/2,scale=1080:1920"
        if abs(ex) > 0: chain += f",eq=brightness={ex}"
        chain += ",setsar=1[base];[base][1:v]overlay=0:0[v]"
        subprocess.run([FF,"-y","-loglevel","error","-i",sc["file"],"-i",cap,"-filter_complex",chain,
                        "-map","[v]","-an","-c:v","libx264","-crf","18","-pix_fmt","yuv420p","-r","30",part], check=True)
        parts.append(part)
    lst = d/"tk_list.txt"; lst.write_text("".join(f"file '{os.path.abspath(p)}'\n" for p in parts))
    vconcat = str(d/"tk_vconcat.mp4")
    subprocess.run([FF,"-y","-loglevel","error","-f","concat","-safe","0","-i",str(lst),"-c","copy",vconcat], check=True)
    out = str(REELS/f"test-{name}-tiktok.mp4")
    ins = ["-i", vconcat]
    for sc in scenes: ins += ["-i", sc["file"]]
    aud = "".join(f"[{i+1}:a]" for i in range(len(scenes)))
    fc = f"[0:v]noise=alls=12:allf=t+u[v];{aud}concat=n={len(scenes)}:v=0:a=1[a]"
    subprocess.run([FF,"-y","-loglevel","error",*ins,"-filter_complex",fc,"-map","[v]","-map","[a]",
                    "-c:v","libx264","-b:v","3.5M","-maxrate","3.8M","-bufsize","5M","-pix_fmt","yuv420p","-r","30",
                    "-c:a","aac","-b:a","128k","-movflags","+faststart",out], check=True)
    return out

man = json.loads((T/"manifest.json").read_text())
for name, scenes in man.items():
    if not scenes or any(s is None for s in scenes): continue
    srt = REELS / f"test-{name}-FINAL.srt"
    write_srt(scenes, srt)
    tk = build_tiktok(name, scenes)
    print(f"{name}: SRT -> {srt.name} ; TikTok-safe -> {Path(tk).name}")
