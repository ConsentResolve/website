#!/usr/bin/env python3
"""nonugc-leak-contrarian ended abruptly mid-verse. Re-render the brand-animated
body, then hold the final CTA card ~4s longer with the CR1 vocal continuing and a
clean 1.6s fade-out, so the verse resolves instead of hard-cutting. Re-uploads."""
import os, subprocess
from pathlib import Path
ROOT = Path("/Users/aaronphillips/GIT/consentresolve2")
FF, FP = "/opt/homebrew/bin/ffmpeg", "/opt/homebrew/bin/ffprobe"
MUSIC = str(ROOT / "assets/audio/CR1.mp3")

env = dict(os.environ, ANGLE="leak", HOOK_TEXT="The leak isn't a bug. It's the business model.",
           OUTNAME="reel-leak-contrarian")
subprocess.run(["/usr/bin/python3", "scripts/brand_reel.py"], cwd=str(ROOT), env=env, check=True)

v3 = next((c for c in [ROOT/"public/reels/build/video_v3.mp4", ROOT/"build/video_v3.mp4"] if c.exists()), None)
if not v3:
    raise SystemExit("video_v3.mp4 not found after brand_reel")
dur = float(subprocess.check_output([FP, "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(v3)]).strip())
EXT = 4.0; total = round(dur + EXT, 2)
out = str(ROOT / "public/reels/reel-leak-contrarian.mp4")
subprocess.run([FF, "-y", "-loglevel", "error", "-i", str(v3), "-stream_loop", "-1", "-i", MUSIC,
  "-filter_complex",
  f"[0:v]tpad=stop_mode=clone:stop_duration={EXT},fps=30[v];"
  f"[1:a]atrim=0:{total},loudnorm=I=-14:TP=-1.5:LRA=11,afade=t=out:st={total-1.6:.2f}:d=1.6[a]",
  "-map", "[v]", "-map", "[a]", "-t", f"{total:.2f}", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-r", "30",
  "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", out], check=True)
print(f"rebuilt reel-leak-contrarian.mp4 = {total}s (was {dur:.1f}s body + {EXT}s outro fade)")
subprocess.run(["/usr/bin/python3", "scripts/r2_upload.py", out, "social/sprint/nonugc-leak-contrarian.mp4", "video/mp4"], cwd=str(ROOT))
