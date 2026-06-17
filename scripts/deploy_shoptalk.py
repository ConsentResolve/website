#!/usr/bin/env python3
"""Render the full SHOP TALK library (pilot cached, rest fresh), build the
/shop-talk review gallery, commit + push."""
import subprocess
from pathlib import Path
ROOT = Path("/Users/aaronphillips/GIT/consentresolve2"); PY = "/usr/bin/python3"
subprocess.run([PY, "scripts/gen_shoptalk.py", "all"], cwd=str(ROOT))
subprocess.run([PY, "scripts/gen_shoptalk_gallery.py"], cwd=str(ROOT))
subprocess.run(["git", "add", "public/shop-talk.html", "scripts/gen_shoptalk_gallery.py", "scripts/deploy_shoptalk.py"], cwd=str(ROOT))
subprocess.run(["git", "commit", "-q", "-m", "SHOP TALK: full library rendered + /shop-talk review gallery\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"], cwd=str(ROOT))
print("COMMIT:", subprocess.run(["git", "log", "--oneline", "-1"], cwd=str(ROOT), capture_output=True, text=True).stdout.strip())
p = subprocess.run(["git", "push", "origin", "main"], cwd=str(ROOT), capture_output=True, text=True)
print("PUSH:", (p.stdout+p.stderr).strip()[-160:])
print("=== deploy_shoptalk done ===")
