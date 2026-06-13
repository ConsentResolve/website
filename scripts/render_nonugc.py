#!/usr/bin/env python3
"""Render non-UGC locked reels (brand_reel.py) with their mood-matched music and
stage to R2. Durable home for the angle->track map (was previously ad-hoc).

Usage:
  python3 scripts/render_nonugc.py              # all angles
  python3 scripts/render_nonugc.py ftc robot    # only these
Tracks live in assets/audio/cr-music/no-vocals/ (local, gitignored).
"""
import subprocess, os, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
NOVOX = "assets/audio/cr-music/no-vocals"

# angle -> instrumental (mood-matched). int-new1 (24.68s) retired off the longer
# reels — its loop seam showed; ftc/robot moved to the new ~28-30s tracks.
MUSIC_MAP = {
    "leak": "inst-money", "invoice": "inst-money", "ghost": "inst-money",
    "math": "inst-solveit", "twice": "inst-solveit",
    "ownership": "inst-fp1",
    "ftc": "inst-new6", "robot": "inst-new4",
}

def render(angle):
    track = MUSIC_MAP.get(angle)
    if not track:
        print(f"  skip {angle}: no track mapped"); return
    music = f"{NOVOX}/{track}.mp3"
    if not (ROOT / music).exists():
        print(f"  MISSING track for {angle}: {music}"); return
    print(f"=== render {angle} ({track}) ===", flush=True)
    env = dict(os.environ, ANGLE=angle, MUSIC=music)
    subprocess.run(["/usr/bin/python3", "scripts/brand_reel.py"], cwd=ROOT, env=env, check=False)
    subprocess.run(["/usr/bin/python3", "scripts/r2_upload.py",
                    f"public/reels/reel-{angle}-locked.mp4", f"social/nonugc/{angle}.mp4", "video/mp4"],
                   cwd=ROOT, check=False)

angles = sys.argv[1:] or list(MUSIC_MAP)
for a in angles:
    render(a)
print("done")
