#!/usr/bin/env python3
"""Tier-1 polished pass for Style A: tight face framing, mouth-flap lip movement
(closed<->open during speech), animated gray->green payoff, snappy cuts, music + SFX.
Reuses disaster/art/A panels (+ *_open variants) and disaster/vo/*.wav.
  python3 scripts/da_polish.py    ->  disaster/out/A_polished.mp4
"""
import subprocess
from pathlib import Path
from PIL import Image, ImageDraw
from da_lib import W, H, FPS, DA, ART, SCENES as SCN, OUT, FF, font, dur, log, BG, INK, GREEN
from da_script import SCENES

LBL = "A"; AART = ART/LBL; SDIR = SCN/LBL; SDIR.mkdir(parents=True, exist_ok=True)
SFX = DA/"assets"; SFX.mkdir(exist_ok=True)
def ff(a): subprocess.run([FF, "-y", "-loglevel", "error", *a], check=True)

def bg():
    img = Image.new("RGB", (W, H), BG); d = ImageDraw.Draw(img)
    for y in range(0, H, 26):
        for x in range((y//26 % 2)*13, W, 26):
            d.ellipse([x-1, y-1, x+1, y+1], fill=(228, 228, 224))
    d.rectangle([0, 0, W, 8], fill=INK); d.rectangle([0, H-8, W, H], fill=INK)
    return img

def place(img, cut_png, big):
    """Tight, face-forward: scale the character large and seat the head high so the
    face dominates and the body crops off the bottom (a 'zoom on the face')."""
    ch = Image.open(cut_png).convert("RGBA")
    th = int(H * big); tw = int(ch.width * th / ch.height)
    ch = ch.resize((tw, th))
    img.paste(ch, ((W - tw)//2, int(-H*0.12)), ch)   # head near top, body runs off-frame

def numbers(d, on):
    if not on: return
    if "huge" in on:
        f = font(560); t = on["huge"]; tw = d.textlength(t, font=f)
        d.text(((W-tw)/2, H/2-330), t, font=f, fill=INK)
    elif "big" in on:
        f = font(170); t = on["big"]; tw = d.textlength(t, font=f)
        d.text((W-tw-80, 90), t, font=f, fill=INK)
        sf = font(50); s = on.get("sub", ""); sw = d.textlength(s, font=sf)
        d.text((W-sw-80, 280), s, font=sf, fill=(110, 110, 106))
    elif "small" in on:
        f = font(60); t = on["small"]; tw = d.textlength(t, font=f)
        d.text((W-tw-80, 120), t, font=f, fill=(110, 110, 106))

def bg_numbers(s):
    """Background + on-screen numbers only (the character is overlaid in ffmpeg so it
    can bob). Two-image mouth-swaps jitter on AI art, so we animate a talking bob instead."""
    img = bg(); d = ImageDraw.Draw(img); numbers(d, s.get("on"))
    out = SDIR/f"{s['id']}_bg.png"; img.save(out); return out

def green_turn(out_gray, out_green):
    for fn, col, label, sub in [(out_gray, (150,150,146), "A website visitor…", None),
                                (out_green, GREEN, "A website visitor…", "…becomes a CUSTOMER.")]:
        img = bg(); d = ImageDraw.Draw(img)
        d.text((W/2-330, 90), label, font=font(66), fill=INK)
        cxp, cyp = W/2-230, H/2+30
        d.ellipse([cxp-72, cyp-150, cxp+72, cyp-6], outline=col, width=16)
        d.rounded_rectangle([cxp-115, cyp+14, cxp+115, cyp+220], radius=60, outline=col, width=16)
        px, py = W/2+250, H/2+20
        d.rounded_rectangle([px-72, py-130, px+72, py+155], radius=26, outline=col, width=16)
        d.ellipse([px-30, py-90, px+30, py-30], outline=col, width=10)
        if sub:
            for r in (115, 158): d.arc([px-r, py-r-70, px+r, py+r-70], 300, 360, fill=col, width=9)
            sw = d.textlength(sub, font=font(60)); d.text(((W-sw)/2, H-200), sub, font=font(60), fill=GREEN)
        img.save(fn)

def endcard(out):
    img = bg(); d = ImageDraw.Draw(img)
    place(img, AART/"frank_approve.cut.png", 1.3)
    cx, cy = 330, 330
    d.line([(cx-72, cy), (cx-12, cy+74)], fill=GREEN, width=30)
    d.line([(cx-12, cy+74), (cx+104, cy-74)], fill=GREEN, width=30)
    ty = H-330
    for i, t in enumerate(["MORE CONSENT.", "MORE CUSTOMERS.", "MORE JOBS."]):
        d.text((W-760, ty + i*90), t, font=font(70), fill=GREEN)
    img.save(out)

# ── SFX (synth) ──────────────────────────────────────────────────────────────
def synth():
    def g(args, out): ff(["-f","lavfi","-t",args[0],"-i",args[1],"-af",args[2],"-ac","2",str(out)])
    g(["0.25","sine=frequency=300:sample_rate=44100","highpass=f=600,volume=0.5,afade=t=out:st=0.08:d=0.17"], SFX/"whoosh.wav")
    g(["0.5","sine=frequency=70:sample_rate=44100","volume=0.9,afade=t=out:st=0.1:d=0.4"], SFX/"thud.wav")
    g(["1.4","sine=frequency=520:sample_rate=44100","tremolo=f=18:d=0.9,volume=0.6"], SFX/"ring.wav")
    g(["0.6","sine=frequency=950:sample_rate=44100","volume=0.5,afade=t=out:st=0.15:d=0.45"], SFX/"ding.wav")
    ff(["-f","lavfi","-t","40","-i","sine=frequency=66:sample_rate=44100","-af","tremolo=f=1.5:d=0.5,volume=0.04,lowpass=f=200","-ac","2",str(SFX/"bed.wav")])

def main():
    synth(); clips = []; cuts = []; clock = 0.0
    log("[A polish] building scenes")
    for i, s in enumerate(SCENES):
        out = SDIR/f"p_{i:02d}.mp4"
        if s["id"] == "s9":
            secs = s.get("secs", 2.6); green_turn(SDIR/"s9_gray.png", SDIR/"s9_green.png")
            ff(["-loop","1","-t",f"{secs*0.4:.2f}","-i",str(SDIR/"s9_gray.png"),
                "-loop","1","-t",f"{secs*0.7:.2f}","-i",str(SDIR/"s9_green.png"),
                "-filter_complex",f"[0:v][1:v]xfade=transition=fade:duration=0.4:offset={secs*0.4-0.4:.2f},fps={FPS}[v]",
                "-map","[v]","-t",f"{secs:.2f}","-c:v","libx264","-pix_fmt","yuv420p","-r",str(FPS),str(out)])
            cuts.append(("ring", clock+0.3)); cuts.append(("ding", clock+secs*0.45)); clock += secs; clips.append(str(out)); continue
        if s["id"] == "s10":
            secs = s.get("secs", 4.2); endcard(SDIR/"s10.png"); wav = DA/"vo"/"s10.wav"
            ff(["-loop","1","-t",f"{secs:.2f}","-i",str(SDIR/"s10.png"),"-i",str(wav),
                "-vf",f"fps={FPS},fade=t=in:st=0:d=0.2","-c:v","libx264","-pix_fmt","yuv420p","-r",str(FPS),
                "-c:a","aac","-af","apad","-t",f"{secs:.2f}",str(out)])
            cuts.append(("ding", clock+0.1)); clock += secs; clips.append(str(out)); continue
        # speaking scene: single consistent panel + audio-synced talking bob (no jitter)
        vo = dur(DA/"vo"/f"{s['id']}.wav"); secs = vo + 0.3
        bgp = bg_numbers(s); char = AART/f"{s['panel']}.cut.png"
        bigh = int(H * (1.5 if s["zoom"] >= 0.12 else 1.42))   # tight: big head, body crops off
        basey = int(-H*0.12)
        ff(["-loop","1","-t",f"{secs:.2f}","-i",str(bgp),"-loop","1","-t",f"{secs:.2f}","-i",str(char),
            "-i",str(DA/"vo"/f"{s['id']}.wav"),"-filter_complex",
            f"[1:v]scale=-1:{bigh}[c];[0:v][c]overlay=x='(W-w)/2':"
            f"y='{basey}+7*sin(2*PI*5*t)*between(t,0,{vo:.2f})'[v0];"
            f"[v0]fps={FPS},fade=t=in:st=0:d=0.1[v];[2:a]apad[a]",
            "-map","[v]","-map","[a]","-t",f"{secs:.2f}","-c:v","libx264","-pix_fmt","yuv420p","-r",str(FPS),
            "-c:a","aac","-ar","44100","-ac","2",str(out)])
        cuts.append(("whoosh", clock))
        if s["id"] == "s7": cuts.append(("thud", clock))
        clock += secs; clips.append(str(out))
    # concat
    lst = SDIR/"polish_concat.txt"; lst.write_text("".join(f"file '{c}'\n" for c in clips))
    silent = OUT/"_A_polish.mp4"; ff(["-f","concat","-safe","0","-i",str(lst),"-c","copy",str(silent)])
    total = dur(silent)
    # mix: bed + SFX (adelay) under the existing VO
    ins = ["-i",str(silent),"-i",str(SFX/"bed.wav")]; amix = [f"[1:a]volume=1.0,atrim=0:{total:.2f}[bed]"]; lbls=["[0:a]","[bed]"]; idx=2
    for name, t in cuts:
        f = SFX/f"{name}.wav"
        if not f.exists(): continue
        ins += ["-i",str(f)]; ms=int(max(0,t)*1000); amix.append(f"[{idx}:a]adelay={ms}|{ms},volume=0.5[s{idx}]"); lbls.append(f"[s{idx}]"); idx+=1
    fc = ";".join(amix) + f";{''.join(lbls)}amix=inputs={len(lbls)}:duration=first:dropout_transition=0,dynaudnorm[a]"
    out = OUT/"A_polished.mp4"
    ff([*ins,"-filter_complex",fc,"-map","0:v","-map","[a]","-c:v","copy","-c:a","aac","-b:a","192k","-movflags","+faststart",str(out)])
    log(f"[A polish] DONE -> {out} ({dur(out):.1f}s)")

if __name__ == "__main__":
    main()
