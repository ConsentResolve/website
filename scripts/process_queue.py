#!/usr/bin/env python3
"""Process the review delete-queue: hard-delete each queued reel from R2 (key
resolved from the catalog URL), add it to social/deleted.json so the gallery
omits it, then clear it from the D1 queue. Run when the user says 'delete the
queued ones'. Re-runnable. Does NOT push — caller regenerates + pushes."""
import json, subprocess, urllib.request
from pathlib import Path
ROOT = Path("/Users/aaronphillips/GIT/consentresolve2")
BASE = "https://pub-27fc71b9070247178d8756a59bef0b33.r2.dev/"
API = "https://consentresolve.com/api/queue"
UA = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/124 Safari/537.36"}

q = json.load(urllib.request.urlopen(urllib.request.Request(API, headers=UA)))
names = q.get("queued", [])
if not names:
    print("queue empty — nothing to delete"); raise SystemExit
cat = {c["name"]: c for c in json.load(open(ROOT / "social/sprint-catalog.json"))}
deleted = json.load(open(ROOT / "social/deleted.json"))
for n in names:
    c = cat.get(n)
    if not c:
        print(f"  ?? no catalog entry for {n} — skipping R2 delete");
    else:
        key = c["url"].split("?")[0].replace(BASE, "")
        subprocess.run(["/usr/bin/python3", "scripts/r2_delete.py", key], cwd=str(ROOT))
    if n not in deleted: deleted.append(n)
json.dump(deleted, open(ROOT / "social/deleted.json", "w"), indent=2)
for n in names:  # clear from queue
    body = json.dumps({"name": n, "action": "restore"}).encode()
    urllib.request.urlopen(urllib.request.Request(API, data=body, headers={**UA, "Content-Type": "application/json"}))
print(f"processed {len(names)} deletions; deleted.json now has {len(deleted)}")
