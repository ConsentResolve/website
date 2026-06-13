#!/usr/bin/env python3
"""Finish UGC avatar reels (feed cut). From build/tests/<name>/s*.mp4:
  - jump-cut framing (100% / ~115% punch-in alternation)
  - de-AI handheld drift + grain + brightness variance, now SEEDED PER VIDEO
    (unique start position, drift phase/amplitude, grain, exposure) so each
    reel reads as its own handheld take, not a clone
  - burned captions anchored LOW in the safe zone (well below center)
Output: public/reels/test-<name>-FINAL.mp4
"""
import json, os, subprocess, textwrap, hashlib, random
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path("/Users/aaronphillips/GIT/consentresolve2")
T = ROOT / "build/tests"
QC = T / "qc"; QC.mkdir(parents=True, exist_ok=True)
REELS = ROOT / "public/reels"
FF = "/opt/homebrew/bin/ffmpeg"; FP = "/opt/homebrew/bin/ffprobe"
FONT = str(ROOT / "scripts/.fonts/Hanken.ttf")
W, H = 1080, 1920
PUNCH = [1.0, 1.15, 1.0]
CAP_BOTTOM = 0.82                    # caption box BOTTOM at 82% down (safe zone)

def dur(f):
    return float(subprocess.check_output([FP, "-v", "error", "-show_entries",
        "format=duration", "-of", "csv=p=0", f]).strip())

def vparams(name):
    """Deterministic-per-video random imperfections (same name => same look)."""
    r = random.Random(int(hashlib.md5(name.encode()).hexdigest()[:8], 16))
    return dict(ax=round(r.uniform(10, 20), 1), ay=round(r.uniform(8, 16), 1),
                fx=round(r.uniform(0.08, 0.15), 3), fy=round(r.uniform(0.10, 0.19), 3),
                phx=round(r.uniform(0, 6.28), 2), phy=round(r.uniform(0, 6.28), 2),
                x0=round(r.uniform(-14, 14), 1), y0=round(r.uniform(-14, 14), 1),
                grain=r.choice([8, 10, 12, 14, 16]), eb=round(r.uniform(-0.015, 0.015), 3),
                xoff=r.choice([-16, 0, 16]))

def caption_png(text, out, xoff):
    """Full-frame transparent PNG; caption box anchored low (bottom at CAP_BOTTOM)."""
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(img)
    font = ImageFont.truetype(FONT, 54)
    lines = textwrap.wrap(text.replace("—", "-"), width=26)
    lh = 66; tw = max(d.textlength(ln, font=font) for ln in lines)
    bh = lh * len(lines) + 36; bw = int(tw) + 64
    cx = W // 2 + xoff
    bottom = int(H * CAP_BOTTOM); y0 = bottom - bh
    x0 = cx - bw // 2
    box = Image.new("RGBA", (bw, bh), (0, 0, 0, 0))
    ImageDraw.Draw(box).rounded_rectangle([0, 0, bw, bh], radius=18, fill=(0, 0, 0, 153))
    img.alpha_composite(box, (x0, y0))
    ty = y0 + 18
    for ln in lines:
        lw = d.textlength(ln, font=font); d.text((cx - lw / 2, ty), ln, font=font, fill=(255, 255, 255, 255)); ty += lh
    img.save(out)

def build(name, scenes):
    d = T / name; P = vparams(name); parts = []
    for i, sc in enumerate(scenes):
        src = sc["file"]; cap = str(d / f"cap{i+1}.png"); part = str(d / f"p{i+1}.mp4")
        caption_png(sc["text"], cap, P["xoff"])
        scl = PUNCH[i % len(PUNCH)]; ex = round(EXPO_BASE(i) + P["eb"], 3)
        # 108% prescale leaves room for the unique start offset + drift wander
        xexpr = f"(in_w-1080)/2+({P['x0']})+{P['ax']}*sin(2*PI*t*{P['fx']}+{P['phx']})"
        yexpr = f"(in_h-1920)/2+({P['y0']})+{P['ay']}*sin(2*PI*t*{P['fy']}+{P['phy']})"
        chain = (f"[0:v]scale=trunc(iw*1.08/2)*2:trunc(ih*1.08/2)*2,"
                 f"crop=1080:1920:x='{xexpr}':y='{yexpr}'")
        if scl > 1.0:
            chain += f",crop=trunc(1080/{scl}/2)*2:trunc(1920/{scl}/2)*2:(in_w-ow)/2:(in_h-oh)/2,scale=1080:1920"
        if abs(ex) > 0:
            chain += f",eq=brightness={ex}"
        chain += ",setsar=1[base];[base][1:v]overlay=0:0[v]"
        subprocess.run([FF, "-y", "-loglevel", "error", "-i", src, "-i", cap, "-filter_complex", chain,
                        "-map", "[v]", "-an", "-c:v", "libx264", "-crf", "18", "-pix_fmt", "yuv420p", "-r", "30", part], check=True)
        parts.append(part)
    lst = d / "list.txt"; lst.write_text("".join(f"file '{os.path.abspath(p)}'\n" for p in parts))
    vconcat = str(d / "vconcat.mp4")
    subprocess.run([FF, "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", str(lst), "-c", "copy", vconcat], check=True)
    out = str(REELS / f"test-{name}-FINAL.mp4")
    ins = ["-i", vconcat]
    for sc in scenes: ins += ["-i", sc["file"]]
    aud = "".join(f"[{i+1}:a]" for i in range(len(scenes)))
    fc = f"[0:v]noise=alls={P['grain']}:allf=t+u[v];{aud}concat=n={len(scenes)}:v=0:a=1[a]"
    subprocess.run([FF, "-y", "-loglevel", "error", *ins, "-filter_complex", fc, "-map", "[v]", "-map", "[a]",
                    "-c:v", "libx264", "-b:v", "3.5M", "-maxrate", "3.8M", "-bufsize", "5M", "-pix_fmt", "yuv420p", "-r", "30",
                    "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", out], check=True)
    return {"final": out, "dur": round(dur(out), 3)}

def EXPO_BASE(i):
    return [0.0, 0.02, -0.02][i % 3]

manifest = json.loads((T / "manifest.json").read_text())
report = {}
for name, scenes in manifest.items():
    if not scenes or any(s is None for s in scenes):
        print(f"SKIP {name}: missing scenes"); continue
    print(f"=== finishing {name} ===")
    report[name] = build(name, scenes)
    print("  ->", report[name]["final"], report[name]["dur"], "s")
(T / "finish-report.json").write_text(json.dumps(report, indent=2))
print("\nreport:", T / "finish-report.json")
