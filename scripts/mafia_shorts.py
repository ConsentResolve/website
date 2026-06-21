#!/usr/bin/env python3
"""Cut three 9:16 Shorts from the per-line clips (mafia/out/manifest.json):
  a) the "yours-ish" beat   b) the four-vans footrace   c) the green-door reveal
Vertical = the 16:9 clip centered over a blurred fill, with a top title banner.
  python3 scripts/mafia_shorts.py
Output: mafia/shorts/short_{a,b,c}_*.mp4
"""
import json, subprocess
from pathlib import Path
from mafia_lib import OUT, SHORTS, SCENES, FF, dur, log

CAPFONT = next((f for f in ["/System/Library/Fonts/Menlo.ttc"] if Path(f).exists()),
               str(Path(__file__).resolve().parent / ".fonts/Hanken.ttf"))

def ff(args): subprocess.run([FF, "-y", "-loglevel", "error", *args], check=True)

def pick(man, pred):
    return [m["clip"] for m in man if pred(m) and Path(m["clip"]).exists()]

def make(name, title, clips):
    if not clips:
        log(f"SHORT {name}: no clips matched — skipped"); return
    lst = SHORTS / f"{name}.txt"; lst.write_text("".join(f"file '{c}'\n" for c in clips))
    joined = SHORTS / f"{name}_h.mp4"
    ff(["-f", "concat", "-safe", "0", "-i", str(lst), "-c", "copy", str(joined)])
    out = SHORTS / f"{name}.mp4"
    title_esc = title.replace("'", "")
    vf = ("[0:v]scale=1080:1920,boxblur=24:3,setsar=1,crop=1080:1920[bg];"
          "[0:v]scale=1080:-2[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2[ov];"
          f"[ov]drawtext=fontfile='{CAPFONT}':text='{title_esc}':fontsize=54:fontcolor=white:"
          "box=1:boxcolor=black@0.5:boxborderw=20:x=(w-text_w)/2:y=150[v]")
    ff(["-i", str(joined), "-filter_complex", vf, "-map", "[v]", "-map", "0:a",
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k",
        "-movflags", "+faststart", str(out)])
    log(f"SHORT {name}: {len(clips)} clips -> {dur(out):.1f}s {out.name}")

def main():
    man = json.loads((OUT / "manifest.json").read_text())
    make("short_a_yours_ish", "Yours-ish.",
         pick(man, lambda m: m["scene"] == "scene_1_the_back_room" and m["n"] >= 5))
    make("short_b_four_vans", "One lead. Four vans.",
         pick(man, lambda m: m["scene"] == "scene_2_the_racket_explained_badly"))
    make("short_c_green_door", "Behind the green door.",
         pick(man, lambda m: m["scene"] == "scene_4_the_way_out"))
    log("SHORTS: done")

if __name__ == "__main__":
    main()
