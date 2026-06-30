#!/usr/bin/env python3
"""Paid actuator for the score->promote loop. Reads the CRM promote queue (mode=paid,
status=queued), resolves each winning reel to its public R2 video URL, and launches ONE
conversion-optimized Meta campaign (PAUSED) with those videos as ads — then marks each
item launched so it isn't re-promoted. Reuses scripts/meta_campaign.py wholesale.

Auth/config (env or /tmp; nothing printed):
  FEEDBACK_KEY        gates the CRM promote-queue read/mark (env or /tmp/feedback_key.txt)
  META_ACCESS_TOKEN / META_AD_ACCOUNT_ID / META_PAGE_ID   (for --push, same as meta_campaign.py)

Usage:
  python3 scripts/promote_to_meta.py            # dry-run: show what would launch
  python3 scripts/promote_to_meta.py --push     # create the PAUSED ads + mark launched
"""
import json, os, subprocess, sys, urllib.request, urllib.error, urllib.parse
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BASE = os.environ.get("CR_BASE", "https://consentresolve.com")
PUB = "https://pub-27fc71b9070247178d8756a59bef0b33.r2.dev"
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"

def fkey():
    k = os.environ.get("FEEDBACK_KEY", "").strip()
    if not k and Path("/tmp/feedback_key.txt").exists():
        k = Path("/tmp/feedback_key.txt").read_text().strip()
    if not k:
        sys.exit("set FEEDBACK_KEY (env) or /tmp/feedback_key.txt — needed to read the promote queue")
    return k

def _req(method, path, body=None):
    url = f"{BASE}{path}" + ("&" if "?" in path else "?") + "key=" + urllib.parse.quote(fkey())
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method,
        headers={"User-Agent": UA, "Content-Type": "application/json"})
    try:
        return json.loads(urllib.request.urlopen(req, timeout=30).read() or "{}")
    except urllib.error.HTTPError as e:
        sys.exit(f"{method} {path} -> {e.code}: {e.read().decode()[:200]}")

def resolve_video(name):
    """Find the public R2 URL for a reel name across the known buckets (HEAD check)."""
    for sub in ("social/sprint", "social/shoptalk", "social/exp", "social"):
        u = f"{PUB}/{sub}/{name}.mp4"
        try:
            r = urllib.request.Request(u, method="HEAD", headers={"User-Agent": UA})
            if urllib.request.urlopen(r, timeout=15).status == 200:
                return u
        except Exception:
            continue
    return None

def main():
    push = "--push" in sys.argv
    q = _req("GET", "/api/crm/social/promote?mode=paid&status=queued").get("queue", [])
    if not q:
        print("Promote queue (paid): empty. Nothing to launch."); return
    print(f"Promote queue (paid): {len(q)} winner(s) flagged.")
    resolved, missing = [], []
    for item in q:
        url = resolve_video(item["name"])
        (resolved if url else missing).append((item, url))
        print(f"  {item['name']:28} -> {url or 'NO R2 VIDEO FOUND (skip)'}")
    if missing:
        print(f"\n{len(missing)} couldn't be resolved to an R2 video — they stay queued.")
    if not resolved:
        print("Nothing resolvable to launch."); return
    urls = [u for (_it, u) in resolved]
    cmd = ["/usr/bin/python3", str(ROOT / "scripts/meta_campaign.py"),
           "--conversions", "--name", "Promoted Winners", "--budget", "20", "--videos", *urls]
    if not push:
        print("\nDRY RUN. Re-run with --push to create the PAUSED conversion ads:\n  " + " ".join(cmd) + " --push")
        return
    print("\nLaunching (PAUSED) via meta_campaign.py…")
    r = subprocess.run(cmd + ["--push"], cwd=str(ROOT))
    if r.returncode != 0:
        sys.exit("meta_campaign.py failed — items left queued for retry.")
    for (it, _u) in resolved:
        _req("POST", "/api/crm/social/promote", {"mark": True, "id": it["id"], "status": "launched"})
    print(f"DONE — {len(resolved)} winner(s) launched PAUSED + marked. Review + activate in Ads Manager.")

if __name__ == "__main__":
    main()
