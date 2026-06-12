#!/usr/bin/env python3
"""Finish the 3 avatar tests per the reduced-standards spec (API-only route).

Per avatar, from build/tests/<name>/s{1,2,3}.mp4:
  - jump-cut framing: scene1 100%, scene2 ~115% punch-in, scene3 100%
  - de-AI: handheld drift (104% prescale + sin wander), brightness variance
    (+/-0.02 alternating), 4% temporal grain on the final
  - burned captions (talking-head only) rendered with PIL (this ffmpeg has no
    drawtext/libass): white Hanken bold, 60% black backing, ~68% down-frame,
    slightly off-center
  - concat scenes (hard jump cuts), mux concatenated scene audio, encode
    h264 ~3.5 Mbps yuv420p faststart
Output: public/reels/test-<name>-FINAL.mp4 ; QC contact sheet + checks in build/tests/qc/
"""
import json, os, subprocess, textwrap
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path("/Users/aaronphillips/GIT/consentresolve2")
T = ROOT / "build/tests"
QC = T / "qc"; QC.mkdir(parents=True, exist_ok=True)
REELS = ROOT / "public/reels"
FF = "/opt/homebrew/bin/ffmpeg"; FP = "/opt/homebrew/bin/ffprobe"
FONT = str(ROOT / "scripts/.fonts/Hanken.ttf")
W, H = 1080, 1920
PUNCH = [1.0, 1.15, 1.0]            # per-scene framing
EXPO = [0.0, 0.02, -0.02]           # per-scene brightness variance

def dur(f):
    return float(subprocess.check_output([FP, "-v", "error", "-show_entries",
        "format=duration", "-of", "csv=p=0", f]).strip())

def caption_png(text, out):
    """Full-frame transparent PNG with a captioned lower-third box."""
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    font = ImageFont.truetype(FONT, 54)
    lines = textwrap.wrap(text.replace("—", "-"), width=26)
    lh = 66
    tw = max(d.textlength(ln, font=font) for ln in lines)
    bh = lh * len(lines) + 36
    bw = int(tw) + 64
    cx = W // 2 + 16                      # slightly off-center
    cy = int(H * 0.68)                    # ~68% down-frame
    x0, y0 = cx - bw // 2, cy - bh // 2
    box = Image.new("RGBA", (bw, bh), (0, 0, 0, 0))
    bd = ImageDraw.Draw(box)
    bd.rounded_rectangle([0, 0, bw, bh], radius=18, fill=(0, 0, 0, 153))  # 60% black
    img.alpha_composite(box, (x0, y0))
    ty = y0 + 18
    for ln in lines:
        lw = d.textlength(ln, font=font)
        d.text((cx - lw / 2, ty), ln, font=font, fill=(255, 255, 255, 255))
        ty += lh
    img.save(out)

def build(name, scenes):
    d = T / name
    parts = []
    for i, sc in enumerate(scenes):
        src = sc["file"]; cap = str(d / f"cap{i+1}.png"); part = str(d / f"p{i+1}.mp4")
        caption_png(sc["text"], cap)
        sclae = PUNCH[i]; ex = EXPO[i]
        chain = ("[0:v]scale=trunc(iw*1.04/2)*2:trunc(ih*1.04/2)*2,"
                 "crop=1080:1920:x='(in_w-1080)/2+16*sin(2*PI*t*0.11)':y='(in_h-1920)/2+12*sin(2*PI*t*0.17)'")
        if sclae > 1.0:
            chain += (f",crop=trunc(1080/{sclae}/2)*2:trunc(1920/{sclae}/2)*2:(in_w-ow)/2:(in_h-oh)/2,scale=1080:1920")
        if abs(ex) > 0:
            chain += f",eq=brightness={ex}"
        chain += ",setsar=1[base];[base][1:v]overlay=0:0[v]"
        subprocess.run([FF, "-y", "-loglevel", "error", "-i", src, "-i", cap,
                        "-filter_complex", chain, "-map", "[v]", "-an",
                        "-c:v", "libx264", "-crf", "18", "-pix_fmt", "yuv420p", "-r", "30", part], check=True)
        parts.append(part)
    # concat video parts (hard jump cuts)
    lst = d / "list.txt"; lst.write_text("".join(f"file '{os.path.abspath(p)}'\n" for p in parts))
    vconcat = str(d / "vconcat.mp4")
    subprocess.run([FF, "-y", "-loglevel", "error", "-f", "concat", "-safe", "0",
                    "-i", str(lst), "-c", "copy", vconcat], check=True)
    # final: grain on video + concat scene audios, ~3.5 Mbps
    out = str(REELS / f"test-{name}-FINAL.mp4")
    ins = ["-i", vconcat]
    for sc in scenes: ins += ["-i", sc["file"]]
    aud = "".join(f"[{i+1}:a]" for i in range(len(scenes)))
    fc = f"[0:v]noise=alls=12:allf=t+u[v];{aud}concat=n={len(scenes)}:v=0:a=1[a]"
    subprocess.run([FF, "-y", "-loglevel", "error", *ins, "-filter_complex", fc,
                    "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-b:v", "3.5M",
                    "-maxrate", "3.8M", "-bufsize", "5M", "-pix_fmt", "yuv420p", "-r", "30",
                    "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", out], check=True)
    # QC contact sheet (1 fps tiled)
    cs = str(QC / f"{name}-contactsheet.png")
    subprocess.run([FF, "-y", "-loglevel", "error", "-i", out, "-vf",
                    "fps=1,scale=216:384,tile=5x3", "-frames:v", "1", cs], check=True)
    vb = subprocess.check_output([FP, "-v", "error", "-select_streams", "v:0",
        "-show_entries", "stream=bit_rate", "-of", "csv=p=0", out]).decode().strip()
    return {"final": out, "dur": round(dur(out), 3),
            "scene_dur_sum": round(sum(s["dur"] for s in scenes), 3),
            "vbitrate_mbps": round(int(vb) / 1e6, 2) if vb.isdigit() else None,
            "contactsheet": cs}

manifest = json.loads((T / "manifest.json").read_text())
report = {}
for name, scenes in manifest.items():
    if not scenes or any(s is None for s in scenes):
        print(f"SKIP {name}: missing scenes"); continue
    print(f"=== finishing {name} ===")
    report[name] = build(name, scenes)
    print("  ->", report[name]["final"], report[name]["dur"], "s",
          report[name]["vbitrate_mbps"], "Mbps")
(T / "finish-report.json").write_text(json.dumps(report, indent=2))
print("\nreport:", T / "finish-report.json")
