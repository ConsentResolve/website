#!/usr/bin/env python3
"""Append post results to social/post-log.json on R2 (download → merge → upload).
The daily runners call append() with the day's results so the dashboard can show
real delivery + give the metrics fetcher post IDs to query. Best-effort: never raises."""
import json, re, subprocess, urllib.request
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
PUB = "https://pub-27fc71b9070247178d8756a59bef0b33.r2.dev"
KEY = "social/post-log.json"
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36"

def parse(platform, out):
    """Best-effort post id + url from a poster's stdout."""
    pid = url = ""
    if platform == "yt":
        m = re.search(r"video id:\s*([\w-]+)", out);  pid = m.group(1) if m else ""
        if pid: url = f"https://www.youtube.com/shorts/{pid}"
    elif platform == "ig":
        m = re.search(r"media id:\s*(\d+)", out); pid = m.group(1) if m else ""
        u = re.search(r"(https://www\.instagram\.com/\S+)", out); url = u.group(1).rstrip('"') if u else ""
    elif platform in ("fb", "card"):
        m = re.search(r'"(?:video_id|id|post_id)":\s*"?([\w_]+)"?', out); pid = m.group(1) if m else ""
        u = re.search(r"(https://www\.facebook\.com/\S+)", out); url = u.group(1).rstrip('"') if u else ""
    return pid, url

def append(records):
    if not records:
        return
    try:
        req = urllib.request.Request(f"{PUB}/{KEY}", headers={"User-Agent": UA})
        log = json.loads(urllib.request.urlopen(req, timeout=30).read())
        if not isinstance(log, list):
            log = []
    except Exception:
        log = []
    log.extend(records)
    tmp = "/tmp/post-log.json"; Path(tmp).write_text(json.dumps(log))
    subprocess.run(["/usr/bin/python3", str(ROOT / "scripts/r2_upload.py"), tmp, KEY, "application/json"], check=False)
    print(f"[post_log] appended {len(records)} record(s) -> {KEY} (total {len(log)})", flush=True)
