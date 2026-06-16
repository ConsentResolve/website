#!/usr/bin/env python3
"""Re-cut the sprint gallery in the LOCKED UGC style (scripts/ugc_reel.sh).
For each (angle, hook-archetype) in reel_hooks.UGC, build a single-take script
(hook + the angle body) and render it on the persona's Real look + voice, then
upload over the existing gallery path social/sprint/<angle>-<arch>.mp4.

Usage:
  python3 scripts/gen_sprint_styled.py                 # all 30
  python3 scripts/gen_sprint_styled.py leak:stat race:confession   # subset
"""
import os, subprocess, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
from reel_hooks import UGC
from video_scripts import job_for

KEY = open("/tmp/heygen_key.txt").read().strip()
CUE = {
    "jason": "Confident, matter-of-fact contractor. Small nods, an eyebrow raise on the numbers, a slight wry smile. Talking to another tradesman.",
    "tyler": "Friendly and energetic but grounded. Light nods, eyebrow lifts on emphasis, an easy smile that comes and goes.",
    "aaron": "Calm, seasoned owner. Measured nods, a subtle brow on key points, a knowing half-smile. Trustworthy and direct.",
}
want = set(sys.argv[1:])

def do(angle, arch, hook, job):
    body = " ".join(s[0] for s in job["scenes"][1:])
    script = f"{hook} {body}"
    name = f"{angle}-{arch}"
    out = str(ROOT / f"public/reels/test-sprint-{name}-tiktok.mp4")
    env = dict(os.environ, HEYGEN_API_KEY=KEY, CHAR_TYPE="talking_photo",
               AVATAR_ID=job["look"], VOICE_ID=job["voice"], SCRIPT_TEXT=script,
               TITLE=name, OUT=out, MOTION_PROMPT=CUE.get(job["persona"], ""))
    print(f">>> {name} ({job['persona']})", flush=True)
    r = subprocess.run(["bash", str(ROOT / "scripts/ugc_reel.sh")], env=env)
    if r.returncode == 0 and os.path.exists(out):
        subprocess.run(["/usr/bin/python3", str(ROOT / "scripts/r2_upload.py"),
                        out, f"social/sprint/{name}.mp4", "video/mp4"])
        print(f"<<< {name} uploaded", flush=True)
    else:
        print(f"!!! {name} FAILED (rc={r.returncode})", flush=True)

n = 0
for angle, _p, hooks in UGC:
    job = job_for(angle)
    for arch, hook in hooks.items():
        if want and f"{angle}:{arch}" not in want:
            continue
        do(angle, arch, hook, job); n += 1
print(f"=== done: {n} reels ===", flush=True)
