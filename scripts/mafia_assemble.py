#!/usr/bin/env python3
"""Assemble Episode 1 with ffmpeg, limited-animation style:
per-line clip = background (slow Ken Burns pan) + speaking character (audio-bob) +
burned-in CC caption (clean mono). Plus title card (brass stab), green-door reveal
(chime), four-vans footrace (scene 2), end card. Then music bed (ducked) + SFX + grain.
Robust: a failed line falls back to bg+caption; the run never halts.
  python3 scripts/mafia_assemble.py
Output: mafia/out/episode.mp4
"""
import os, subprocess, textwrap, math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
from mafia_lib import ART, VO, SCENES, OUT, SFX, FF, dur, log, script

W, H, FPS = 1920, 1080, 24
CAPFONT = next((f for f in [
    "/System/Library/Fonts/Menlo.ttc", "/System/Library/Fonts/SFNSMono.ttf",
    "/Library/Fonts/Courier New.ttf"] if os.path.exists(f)),
    str(Path(__file__).resolve().parent / ".fonts/Hanken.ttf"))
HEADFONT = str(Path(__file__).resolve().parent / ".fonts/Hanken.ttf")

SCENE_BG = {
    "cold_open": "bg_alley", "scene_1_the_back_room": "bg_backroom",
    "scene_2_the_racket_explained_badly": "bg_porch", "scene_3_the_squeeze": "bg_backroom",
    "scene_4_the_way_out": "bg_sunlit", "tag_mock_cliffhanger": "bg_greendoor",
}
CHARS = {"DON ANGELO": ("don_angelo", 940), "SAL": ("sal", 820),
         "VINNIE": ("vinnie", 640), "MRS. PETUNIA": ("petunia", 820)}

def ff(args, **k):
    return subprocess.run([FF, "-y", "-loglevel", "error", *args], check=True, **k)

def caption_png(text, path):
    """Render a caption as a full-frame transparent PNG (this ffmpeg lacks drawtext)."""
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(img)
    font = ImageFont.truetype(CAPFONT, 46)
    lines = textwrap.wrap(text, width=42) or [text]
    lh, pad = 58, 26
    tw = max(d.textlength(ln, font=font) for ln in lines)
    bw, bh = int(tw) + pad * 2, lh * len(lines) + pad * 2
    x0, y0 = (W - bw) // 2, H - bh - 54
    box = Image.new("RGBA", (bw, bh), (0, 0, 0, 0))
    ImageDraw.Draw(box).rounded_rectangle([0, 0, bw, bh], radius=18, fill=(0, 0, 0, 165))
    img.alpha_composite(box, (x0, y0))
    ty = y0 + pad
    for ln in lines:
        lw = d.textlength(ln, font=font); d.text(((W - lw) // 2, ty), ln, font=font, fill=(255, 255, 255, 255)); ty += lh
    img.save(path)
    return str(path)

def bg_path(key):
    p = ART / f"{key}.png"
    return str(p) if p.exists() else None

def fallback_bg():
    p = SCENES / "_navy.png"
    if not p.exists():
        img = Image.new("RGB", (W, H), (10, 22, 40)); img.save(p)
    return str(p)

def render_line(li, idx):
    """Render one spoken line to scenes/clip_idx.mp4. Returns (path, duration, start_pending)."""
    out = SCENES / f"clip_{idx:02d}.mp4"
    d = max(1.2, dur(li["wav"]) + 0.35)
    bg = bg_path(SCENE_BG.get(li["scene"], "bg_backroom")) or fallback_bg()
    capimg = caption_png(li["cc"], SCENES / f"cap_{idx:02d}.png")
    char = CHARS.get(li["character"])
    is_vans = li["scene"] == "scene_2_the_racket_explained_badly" and li["character"] in ("NARRATOR", "MRS. PETUNIA")
    van = ART / "van.png"
    inputs = ["-loop", "1", "-t", f"{d:.2f}", "-i", bg]
    fc = [f"[0:v]scale=2120:1192,setsar=1,crop={W}:{H}:x='(2120-{W})*min(t/{d:.2f},1)':y=56,fps={FPS}[v0]"]
    last, ni = "v0", 1
    if char and (ART / f"{char[0]}.png").exists():
        inputs += ["-loop", "1", "-t", f"{d:.2f}", "-i", str(ART / f"{char[0]}.png")]
        fc.append(f"[{ni}:v]scale=-1:{char[1]}[c]")
        fc.append(f"[{last}][c]overlay=x='(W-w)/2':y='H-h-10+7*sin(2*PI*5*t)'[vc]")
        last = "vc"; ni += 1
    if is_vans and van.exists():
        for k in range(4):
            inputs += ["-loop", "1", "-t", f"{d:.2f}", "-i", str(van)]
            tx = 150 + k * 330
            fc.append(f"[{ni}:v]scale=-1:150[vn{k}]")
            fc.append(f"[{last}][vn{k}]overlay=x='max({tx},{W}-({W}-{tx})*min(t/1.3,1))':y={H-185}[vk{k}]")
            last = f"vk{k}"; ni += 1
    inputs += ["-loop", "1", "-t", f"{d:.2f}", "-i", capimg]
    fc.append(f"[{last}][{ni}:v]overlay=0:0[vt]"); ni += 1
    inputs += ["-i", li["wav"]]
    fc.append(f"[{ni}:a]apad[a]")
    try:
        ff([*inputs, "-filter_complex", ";".join(fc), "-map", "[vt]", "-map", "[a]", "-t", f"{d:.2f}",
            "-r", str(FPS), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-ar", "44100", "-ac", "2",
            "-b:a", "160k", "-movflags", "+faststart", str(out)])
    except subprocess.CalledProcessError:
        log(f"  clip {idx} FAIL -> bg+caption placeholder")
        ff(["-loop", "1", "-t", f"{d:.2f}", "-i", bg, "-loop", "1", "-t", f"{d:.2f}", "-i", capimg,
            "-i", li["wav"], "-filter_complex",
            f"[0:v]scale={W}:{H},fps={FPS}[b];[b][1:v]overlay=0:0[vt];[2:a]apad[a]",
            "-map", "[vt]", "-map", "[a]", "-t", f"{d:.2f}", "-r", str(FPS), "-c:v", "libx264",
            "-pix_fmt", "yuv420p", "-c:a", "aac", "-ar", "44100", "-ac", "2", str(out)])
    return str(out), d

def card(idx, lines, seconds, bgkey=None, accent=(0, 229, 160), big=110):
    """A text card (title / green-door / end). Silent video; audio added in mix."""
    out = SCENES / f"clip_{idx:02d}.mp4"
    img = Image.new("RGB", (W, H), (8, 14, 24))
    bp = bg_path(bgkey) if bgkey else None
    if bp:
        b = Image.open(bp).convert("RGB").resize((W, H)); img.paste(b)
        ov = Image.new("RGBA", (W, H), (8, 14, 24, 150)); img = Image.alpha_composite(img.convert("RGBA"), ov).convert("RGB")
    d = ImageDraw.Draw(img)
    fbig = ImageFont.truetype(HEADFONT, big); fsub = ImageFont.truetype(HEADFONT, 52)
    total = len(lines); y = H // 2 - total * 70
    for i, ln in enumerate(lines):
        f = fbig if i == 0 else fsub
        tw = d.textlength(ln, font=f)
        d.text(((W - tw) / 2, y), ln, font=f, fill=(245, 248, 250) if i == 0 else accent)
        y += (big + 24) if i == 0 else 70
    png = SCENES / f"card_{idx:02d}.png"; img.save(png)
    ff(["-loop", "1", "-t", f"{seconds}", "-i", str(png), "-f", "lavfi", "-t", f"{seconds}",
        "-i", "anullsrc=r=44100:cl=stereo", "-vf",
        f"scale={W}:{H},fps={FPS},fade=t=in:d=0.4,fade=t=out:st={seconds-0.5:.2f}:d=0.5",
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-t", f"{seconds}", str(out)])
    return str(out), float(seconds)

def main():
    sc = script()
    lines = [li for s in sc["scenes"] for li in s["lines"]]
    # attach measured wav durations
    import json
    timing = {t["n"]: t for t in json.loads((VO.parent / "timing.json").read_text())}
    for li in lines: li["wav"] = timing[li["n"]]["wav"]; li["dur"] = timing[li["n"]]["dur"]

    clips, timeline, sfx_cues, manifest = [], 0.0, [], []
    idx = 0
    log("ASSEMBLE: building clips")
    sfx_cues.append((SFX / "newsreel.wav", 0.2))  # cold-open sting
    for li in lines:
        # title card replaces the "Mafia Marketing. Episode One." narrator line
        if li["cc"].strip().startswith("Mafia Marketing. Episode One"):
            p, d = card(idx, ["MAFIA MARKETING", "Episode One"], 2.6, bgkey="bg_title", big=130)
            sfx_cues.append((SFX / "stab.wav", timeline + 0.15))
            clips.append(p); timeline += d; idx += 1
            continue
        # green-door reveal beat right before scene 4
        if li["scene"] == "scene_4_the_way_out" and not any(c for c in clips if "gd" in c):
            if (ART / "bg_greendoor.png").exists():
                p, d = card(idx, ["CONSENT RESOLVE"], 2.4, bgkey="bg_greendoor", big=96)
                sfx_cues.append((SFX / "chime.wav", timeline + 0.2)); clips.append(p); timeline += d; idx += 1
                # mark with a sentinel filename so we only insert once
                Path(p).rename(SCENES / f"clip_{idx-1:02d}_gd.mp4"); clips[-1] = str(SCENES / f"clip_{idx-1:02d}_gd.mp4")
        if li["character"] == "MRS. PETUNIA" and "faucet" in li["cc"].lower() and "only one" in li["cc"].lower():
            sfx_cues.append((SFX / "ring.wav", timeline))
        if li["scene"] == "scene_2_the_racket_explained_badly" and li["character"] == "NARRATOR":
            sfx_cues.append((SFX / "screech.wav", timeline + 0.1))
        p, d = render_line(li, idx)
        clips.append(p); manifest.append({"clip": p, "n": li["n"], "scene": li["scene"],
                                          "character": li["character"], "cc": li["cc"]})
        timeline += d; idx += 1
        log(f"  clip {idx-1:02d} {li['character']:12} {d:.1f}s  (t={timeline:.1f})")

    # end card
    p, d = card(idx, ["Your leads should be yours.", "ConsentResolve.com",
                      "$7 a lead  ·  yours alone  ·  consent-first"], 5.0, bgkey="bg_endcard", big=84)
    clips.append(p); idx += 1

    (OUT / "manifest.json").write_text(__import__("json").dumps(manifest, indent=2))
    # concat
    lst = OUT / "concat.txt"; lst.write_text("".join(f"file '{c}'\n" for c in clips))
    silent = OUT / "episode_silent.mp4"
    ff(["-f", "concat", "-safe", "0", "-i", str(lst), "-c", "copy", str(silent)])
    total = dur(silent); log(f"ASSEMBLE: concatenated {len(clips)} clips -> {total:.1f}s")

    # final mix: VO (already in video) + ducked music bed + SFX (adelay) + film grain
    bed = SFX / "bed.wav"
    amix = [f"[0:a]volume=1.0[vo]"]
    extra_inputs, ai = [], 1
    if bed.exists():
        extra_inputs += ["-i", str(bed)]; amix.append(f"[{ai}:a]volume=0.10,atrim=0:{total:.2f}[bed]"); bedlbl = "[bed]"; ai += 1
    else: bedlbl = ""
    sfxlbls = []
    for f, t in sfx_cues:
        if not Path(f).exists(): continue
        extra_inputs += ["-i", str(f)]; ms = int(t * 1000)
        amix.append(f"[{ai}:a]adelay={ms}|{ms},volume=0.6[s{ai}]"); sfxlbls.append(f"[s{ai}]"); ai += 1
    mixins = "[vo]" + bedlbl + "".join(sfxlbls)
    nmix = 1 + (1 if bedlbl else 0) + len(sfxlbls)
    amix.append(f"{mixins}amix=inputs={nmix}:duration=first:dropout_transition=0,dynaudnorm[aout]")
    vfilt = "[0:v]noise=alls=6:allf=t,format=yuv420p[vout]"
    fc = vfilt + ";" + ";".join(amix)
    out = OUT / "episode.mp4"
    ff(["-i", str(silent), *extra_inputs, "-filter_complex", fc, "-map", "[vout]", "-map", "[aout]",
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", str(out)])
    log(f"ASSEMBLE: done -> {out}  ({dur(out)/60:.2f} min)")

if __name__ == "__main__":
    main()
