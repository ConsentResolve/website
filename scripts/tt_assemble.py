#!/usr/bin/env python3
"""Assemble the Thumbtack-Exposed explainer: per-segment clip = scene still (slow
Ken Burns + fades) + rolling burned-in captions + VO; math segment gets a timed
$412 reveal. Concat, add a quiet bed + film grain. Output thumbtack/out/thumbtack_hvac.mp4
  python3 scripts/tt_assemble.py
"""
import json, subprocess, textwrap
from pathlib import Path
from PIL import Image, ImageDraw
from tt_lib import (W, H, FPS, TT, VO, SCENES, OUT, FF, dur, log, font, MONO)

def ff(args): subprocess.run([FF, "-y", "-loglevel", "error", *args], check=True)

def caption_png(text, path):
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(img)
    f = font(46, mono=True)
    lines = textwrap.wrap(text, width=46) or [text]
    lh, pad = 56, 24
    tw = max(d.textlength(ln, font=f) for ln in lines)
    bw, bh = int(tw) + pad*2, lh*len(lines) + pad*2
    x0, y0 = (W-bw)//2, H - bh - 70
    box = Image.new("RGBA", (bw, bh), (0, 0, 0, 0))
    ImageDraw.Draw(box).rounded_rectangle([0, 0, bw, bh], radius=16, fill=(0, 0, 0, 170))
    img.alpha_composite(box, (x0, y0))
    ty = y0 + pad
    for ln in lines:
        lw = d.textlength(ln, font=f); d.text(((W-lw)//2, ty), ln, font=f, fill=(245, 248, 250, 255)); ty += lh
    img.save(path); return str(path)

def cues(vo, d):
    words = vo.split(); out, i, per = [], 0, 7
    chunks = [" ".join(words[j:j+per]) for j in range(0, len(words), per)]
    seg = d / max(1, len(chunks))
    for k, c in enumerate(chunks):
        out.append((c, k*seg, (k+1)*seg + 0.05))
    return out

def render_segment(seg, idx):
    out = SCENES / f"clip_{idx:02d}.mp4"
    d = max(1.5, dur(seg["wav"]) + 0.3)
    scene = SCENES / f"{seg['scene']}.png"
    inputs = ["-loop", "1", "-t", f"{d:.2f}", "-i", str(scene)]
    fc = [f"[0:v]scale=2112:1188,setsar=1,crop={W}:{H}:x='(2112-{W})*min(t/{d:.2f},1)':y=54,fps={FPS},"
          f"fade=t=in:st=0:d=0.3,fade=t=out:st={d-0.4:.2f}:d=0.4[bg]"]
    last, ni = "bg", 1
    # math: fade in the $412 reveal partway
    if seg["scene"] == "math":
        rv = SCENES / "math_reveal.png"
        inputs += ["-loop", "1", "-t", f"{d:.2f}", "-i", str(rv)]
        st = d * 0.5
        fc.append(f"[{ni}:v]format=yuva420p,fade=t=in:st={st:.2f}:d=0.5:alpha=1[rev]")
        fc.append(f"[{last}][rev]overlay=0:0:enable='gte(t,{st:.2f})'[mv]")
        last = "mv"; ni += 1
    # rolling captions
    cap_dir = SCENES
    for ci, (txt, s, e) in enumerate(cues(seg["vo"], d)):
        p = cap_dir / f"cap_{idx:02d}_{ci:02d}.png"; caption_png(txt, p)
        inputs += ["-loop", "1", "-t", f"{d:.2f}", "-i", str(p)]
        fc.append(f"[{last}][{ni}:v]overlay=0:0:enable='between(t,{s:.2f},{e:.2f})'[c{ci}]")
        last = f"c{ci}"; ni += 1
    inputs += ["-i", seg["wav"]]
    fc.append(f"[{ni}:a]apad[a]")
    ff([*inputs, "-filter_complex", ";".join(fc), "-map", f"[{last}]", "-map", "[a]", "-t", f"{d:.2f}",
        "-r", str(FPS), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-ar", "44100", "-ac", "2",
        "-b:a", "160k", "-movflags", "+faststart", str(out)])
    return str(out), d

def bed(path, seconds):
    # quiet, tense low pulse — not music, just a floor under the VO
    ff(["-f", "lavfi", "-t", f"{seconds:.2f}", "-i", "sine=frequency=72:sample_rate=44100",
        "-af", "tremolo=f=1.6:d=0.5,volume=0.05,lowpass=f=220", "-ac", "2", str(path)])

def main():
    timing = json.loads((TT / "timing.json").read_text())
    clips, total = [], 0.0
    log("ASSEMBLE: building segment clips")
    for i, seg in enumerate(timing):
        p, d = render_segment(seg, i); clips.append(p); total += d
        log(f"  clip {i:02d} {seg['scene']:12} {d:.1f}s")
    lst = OUT / "concat.txt"; lst.write_text("".join(f"file '{c}'\n" for c in clips))
    silent = OUT / "_concat.mp4"
    ff(["-f", "concat", "-safe", "0", "-i", str(lst), "-c", "copy", str(silent)])
    total = dur(silent)
    bedwav = OUT / "_bed.wav"; bed(bedwav, total)
    out = OUT / "thumbtack_hvac.mp4"
    ff(["-i", str(silent), "-i", str(bedwav), "-filter_complex",
        "[0:v]noise=alls=5:allf=t,format=yuv420p[v];[0:a][1:a]amix=inputs=2:duration=first:dropout_transition=0,dynaudnorm[a]",
        "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k",
        "-movflags", "+faststart", str(out)])
    log(f"ASSEMBLE: done -> {out} ({dur(out)/60:.2f} min)")

if __name__ == "__main__":
    main()
