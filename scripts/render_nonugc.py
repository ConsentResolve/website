#!/usr/bin/env python3
"""Render the non-UGC reels in their assigned audio mode and stage to R2.

One audio mode per angle (chosen for the angle's tone):
  - vo     : matched cloned-voice voice-over (scripts/vo_reel.py) over a ducked bed
  - instr  : instrumental only — visuals carry the story (muted-legible by design)
  - lyrics : a with-lyrics Suno track — energetic, the on-screen story still reads muted

Every angle, regardless of mode, normalizes to:
  - local  public/reels/reel-<angle>-locked.mp4   (what run_scheduler.py posts)
  - R2     social/nonugc/<angle>.mp4              (URL for platforms that need one)

Usage:
  python3 scripts/render_nonugc.py            # all angles
  python3 scripts/render_nonugc.py ftc robot  # only these
"""
import subprocess, os, sys, shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
NOVOX = "assets/audio/cr-music/no-vocals"
VOX = "assets/audio/cr-music/vocals"

# angle -> (mode, track). track is the instrumental/lyrics file for instr/lyrics;
# for vo it's unused (vo_reel.py supplies its own ducked bed).
MODES = {
    "leak":      ("vo",     None),
    "ftc":       ("vo",     None),
    "ownership": ("vo",     None),
    "invoice":   ("instr",  f"{NOVOX}/inst-money.mp3"),
    "math":      ("instr",  f"{NOVOX}/inst-solveit.mp3"),
    "robot":     ("instr",  f"{NOVOX}/inst-new4.mp3"),
    "twice":     ("lyrics", f"{VOX}/voc-sparks.mp3"),
    "ghost":     ("lyrics", f"{VOX}/voc-oneroof.mp3"),
}

def render(angle):
    spec = MODES.get(angle)
    if not spec:
        print(f"  skip {angle}: not in MODES"); return
    mode, track = spec
    print(f"=== render {angle} ({mode}{'/'+Path(track).stem if track else ''}) ===", flush=True)
    if mode == "vo":
        subprocess.run(["/usr/bin/python3", "scripts/vo_reel.py"], cwd=ROOT,
                       env=dict(os.environ, ANGLE=angle), check=False)
        produced = ROOT / f"public/reels/reel-{angle}-vo.mp4"
    else:
        if not (ROOT / track).exists():
            print(f"  MISSING track for {angle}: {track}"); return
        subprocess.run(["/usr/bin/python3", "scripts/brand_reel.py"], cwd=ROOT,
                       env=dict(os.environ, ANGLE=angle, MUSIC=track), check=False)
        produced = ROOT / f"public/reels/reel-{angle}-locked.mp4"
    if not produced.exists():
        print(f"  render produced nothing for {angle}"); return
    # normalize to the canonical name the scheduler posts
    canonical = ROOT / f"public/reels/reel-{angle}-locked.mp4"
    if produced != canonical:
        shutil.copy2(produced, canonical)
    subprocess.run(["/usr/bin/python3", "scripts/r2_upload.py",
                    f"public/reels/reel-{angle}-locked.mp4", f"social/nonugc/{angle}.mp4", "video/mp4"],
                   cwd=ROOT, check=False)

angles = sys.argv[1:] or list(MODES)
for a in angles:
    render(a)
print("done")
