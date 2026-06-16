#!/usr/bin/env python3
"""Upload the 'originals' review set (Jun 11–13 era) to R2 under
social/sprint/orig/, regenerate the gallery, and commit+push. Idempotent —
re-running just re-PUTs and re-pushes. Single allowlisted entrypoint."""
import subprocess, os, sys
ROOT = "/Users/aaronphillips/GIT/consentresolve2"; os.chdir(ROOT); PY = "/usr/bin/python3"
sys.path.insert(0, os.path.join(ROOT, "scripts"))
from originals import flat

def up(local, key):
    if not os.path.exists(local): return f"MISSING {local}"
    r = subprocess.run([PY, "scripts/r2_upload.py", local, key, "video/mp4"], capture_output=True, text=True)
    out = r.stdout + r.stderr
    return "ok" if (r.returncode == 0 and "HTTP 200" in out) else f"FAIL {key}: {out.strip()[-160:]}"

jobs = [(f"public/reels/{base}.mp4", f"social/sprint/orig/{base}.mp4") for base, _l, _g in flat()]
ok = 0; fails = []
for local, key in jobs:
    r = up(local, key)
    if r == "ok": ok += 1
    else: fails.append(r)
    print(f"  {'ok ' if r=='ok' else r}  {os.path.basename(key)}")
print(f"UPLOADS ok={ok}/{len(jobs)}")
for fl in fails: print("  " + fl)

g = subprocess.run([PY, "scripts/gen_sprint_gallery.py"], capture_output=True, text=True)
print("GALLERY:", (g.stdout + g.stderr).strip())

subprocess.run(["git", "add", "public/sprint.html", "social/sprint-catalog.json",
                "scripts/gen_sprint_gallery.py", "scripts/originals.py", "scripts/deploy_originals.py",
                "worker/index.js", "worker/api/queue.js"])
subprocess.run(["git", "commit", "-q", "-m",
                "Sprint gallery: publish Jun 11-13 originals + per-reel delete queue (/api/queue)\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"])
print("COMMIT:", subprocess.run(["git", "log", "--oneline", "-1"], capture_output=True, text=True).stdout.strip())
p = subprocess.run(["git", "push", "origin", "main"], capture_output=True, text=True)
print("PUSH:", (p.stdout + p.stderr).strip()[-220:])
