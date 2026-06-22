#!/usr/bin/env python3
"""Build one full video for a given Recraft style: generate the 9 panels, compose
B&W comic scenes (green only on positive beats), assemble to 16:9.
  python3 scripts/da_style.py <style_id> <label>
Needs disaster/vo/*.wav (run da_voice.py first). Output: disaster/out/<label>.mp4
"""
import sys, json, subprocess, math
from pathlib import Path
from PIL import Image, ImageDraw
from da_lib import (W, H, FPS, DA, ART, SCENES as SC_DIR, OUT, FF, font, dur, log,
                    recraft, cut, BG, INK, NAVY, GREEN)
from da_script import PANELS, SCENES

def ff(a): subprocess.run([FF, "-y", "-loglevel", "error", *a], check=True)

def comic_bg():
    img = Image.new("RGB", (W, H), BG); d = ImageDraw.Draw(img)
    for y in range(0, H, 26):                       # faint halftone dots
        for x in range((y//26 % 2)*13, W, 26):
            d.ellipse([x-1, y-1, x+1, y+1], fill=(228, 228, 224))
    d.rectangle([0, 0, W, 10], fill=INK); d.rectangle([0, H-10, W, H], fill=INK)  # comic frame bars
    return img

def paste_char(bg, cut_png, scale):
    ch = Image.open(cut_png).convert("RGBA")
    th = int(H * scale); tw = int(ch.width * th / ch.height)
    ch = ch.resize((tw, th))
    bg.paste(ch, ((W - tw)//2, H - th - 16), ch)

def onscreen(d, on):
    if not on: return
    if "huge" in on:
        f = font(420); t = on["huge"]; tw = d.textlength(t, font=f)
        d.text(((W-tw)/2, H/2-260), t, font=f, fill=INK)
    elif "big" in on:
        f = font(150); t = on["big"]; tw = d.textlength(t, font=f)
        d.text((W-tw-90, 120), t, font=f, fill=INK)
        sf = font(46); s = on.get("sub", ""); sw = d.textlength(s, font=sf)
        d.text((W-sw-90, 280), s, font=sf, fill=(120, 120, 116))
    elif "small" in on:
        f = font(54); t = on["small"]; tw = d.textlength(t, font=f)
        d.text((W-tw-90, 140), t, font=f, fill=(120, 120, 116))

def scene_png(s, label, out):
    img = comic_bg(); d = ImageDraw.Draw(img)
    on = s.get("on") or {}
    if on.get("special") == "green_turn":
        # gray "website visitor" -> GREEN, with a ringing green phone (green = the win)
        d.text((W/2-360, 120), "A website visitor...", font=font(64), fill=INK)
        # person icon (green)
        cxp, cyp = W/2-220, H/2+40
        d.ellipse([cxp-70, cyp-150, cxp+70, cyp-10], outline=GREEN, width=14)
        d.rounded_rectangle([cxp-110, cyp+10, cxp+110, cyp+210], radius=60, outline=GREEN, width=14)
        # phone (green) + ring marks
        px, py = W/2+260, H/2+30
        d.rounded_rectangle([px-70, py-130, px+70, py+150], radius=26, outline=GREEN, width=14)
        d.ellipse([px-30, py-90, px+30, py-30], outline=GREEN, width=10)
        for r in (110, 150):
            d.arc([px-r, py-r-60, px+r, py+r-60], 300, 360, fill=GREEN, width=8)
        d.text((W/2-170, H-220), "...becomes a CUSTOMER.", font=font(58), fill=GREEN)
    elif on.get("special") == "endcard":
        paste_char(img, ART/label/"frank_approve.cut.png", s["scale"])
        # green check
        cx, cy = 360, 360
        d.line([(cx-70, cy), (cx-15, cy+70)], fill=GREEN, width=26)
        d.line([(cx-15, cy+70), (cx+95, cy-70)], fill=GREEN, width=26)
        ty = H-300
        for i, t in enumerate(["MORE CONSENT.", "MORE CUSTOMERS.", "MORE JOBS."]):
            d.text((W-720, ty + i*78), t, font=font(64), fill=GREEN);
    else:
        paste_char(img, ART/label/f"{s['panel']}.cut.png", s["scale"])
        onscreen(d, on)
    img.save(out)

def clip(s, label, idx, out):
    sid = s["id"]
    secs = s.get("secs") or (dur(DA/"vo"/f"{sid}.wav") + 0.35 if (DA/"vo"/f"{sid}.wav").exists() else 2.0)
    png = SC_DIR/label/f"{sid}.png"; scene_png(s, label, png)
    z = 1 + s.get("zoom", 0.05)
    vf = (f"scale={int(W*1.15)}:{int(H*1.15)},zoompan=z='min(zoom+{(z-1)/(secs*FPS):.5f},{z})':"
          f"d={int(secs*FPS)}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s={W}x{H}:fps={FPS},"
          f"fade=t=in:st=0:d=0.12")
    wav = DA/"vo"/f"{sid}.wav"
    if wav.exists():
        ff(["-loop","1","-t",f"{secs:.2f}","-i",str(png),"-i",str(wav),"-vf",vf,
            "-c:v","libx264","-pix_fmt","yuv420p","-r",str(FPS),"-c:a","aac","-ar","44100","-ac","2",
            "-af","apad","-t",f"{secs:.2f}","-movflags","+faststart",str(out)])
    else:
        ff(["-loop","1","-t",f"{secs:.2f}","-i",str(png),"-f","lavfi","-t",f"{secs:.2f}","-i",
            "anullsrc=r=44100:cl=stereo","-vf",vf,"-c:v","libx264","-pix_fmt","yuv420p","-r",str(FPS),
            "-c:a","aac","-t",f"{secs:.2f}","-movflags","+faststart",str(out)])
    return str(out), secs

def main():
    style_id, label = sys.argv[1], sys.argv[2]
    (ART/label).mkdir(parents=True, exist_ok=True); (SC_DIR/label).mkdir(parents=True, exist_ok=True)
    log(f"[{label}] panels via {style_id[:8]}…")
    for key, prompt in PANELS.items():
        cutp = ART/label/f"{key}.cut.png"
        if cutp.exists(): continue
        raw = ART/label/f"{key}.png"
        if recraft(prompt, str(raw), style_id):
            cut(str(raw), str(cutp)); log(f"  [{label}] {key} ok")
        else:
            log(f"  [{label}] {key} FAIL — skipped")
    log(f"[{label}] composing + assembling")
    clips = []
    for i, s in enumerate(SCENES):
        p, _ = clip(s, label, i, SC_DIR/label/f"clip_{i:02d}.mp4"); clips.append(p)
    lst = SC_DIR/label/"concat.txt"; lst.write_text("".join(f"file '{c}'\n" for c in clips))
    out = OUT/f"{label}.mp4"
    ff(["-f","concat","-safe","0","-i",str(lst),"-c","copy",str(out)])
    log(f"[{label}] DONE -> {out} ({dur(out):.1f}s)")

if __name__ == "__main__":
    main()
