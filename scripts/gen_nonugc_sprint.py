#!/usr/bin/env python3
"""Non-UGC sprint: the 4 brand-animated angles (reel_hooks.NONUGC) x 3 archetype
hooks = 12 reels, via brand_reel.py with a HOOK_TEXT override. Completes the
literal 42-reel sprint (30 UGC + 12 non-UGC). Uploads to a distinct gallery path
(nonugc-<angle>-<arch>) since these angle names overlap the UGC ones.
"""
import os, subprocess, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
from reel_hooks import NONUGC

n = 0
for angle, hooks in NONUGC:
    for arch, hooktext in hooks.items():
        name = f"{angle}-{arch}"
        outname = f"reel-{name}"
        out = ROOT / f"public/reels/{outname}.mp4"
        env = dict(os.environ, ANGLE=angle, HOOK_TEXT=hooktext, OUTNAME=outname)
        print(f">>> nonugc {name}", flush=True)
        r = subprocess.run(["/usr/bin/python3", str(ROOT / "scripts/brand_reel.py")], env=env)
        if r.returncode == 0 and out.exists():
            subprocess.run(["/usr/bin/python3", str(ROOT / "scripts/r2_upload.py"),
                            str(out), f"social/sprint/nonugc-{name}.mp4", "video/mp4"])
            print(f"<<< nonugc {name} uploaded", flush=True)
        else:
            print(f"!!! nonugc {name} FAILED (rc={r.returncode})", flush=True)
        n += 1
print(f"=== non-UGC sprint done: {n} reels ===", flush=True)
