#!/usr/bin/env python3
"""Pull engagement for posted reels and write social/metrics.json to R2 for the
dashboard. Reads social/post-log.json (the runners' delivery log), then queries
each post's platform for views/likes:
  FB video  → {GRAPH}/{id}?fields=views,likes.summary(true)
  IG media  → {GRAPH}/{id}?fields=like_count + insights(plays)
  YT video  → youtube/v3/videos?part=statistics
TikTok/X aren't queried (no usable metric API here). Best-effort: per-post try/except,
keeps the newest row per (name, platform). Creds from /tmp (same as the posters)."""
import json, os, urllib.request, urllib.parse, urllib.error
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
PUB = "https://pub-27fc71b9070247178d8756a59bef0b33.r2.dev"
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124 Safari/537.36"
GRAPH = "https://graph.facebook.com/v21.0"
def _read(p): return open(p).read().strip() if os.path.exists(p) else ""
FBTOK = _read("/tmp/fb_page_token.txt")

def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    return json.loads(urllib.request.urlopen(req, timeout=40).read())

def yt_access():
    p = Path("/tmp/yt_token.json")
    if not p.exists(): return ""
    t = json.loads(p.read_text())
    data = urllib.parse.urlencode({"client_id": t["client_id"], "client_secret": t["client_secret"],
        "refresh_token": t["refresh_token"], "grant_type": "refresh_token"}).encode()
    r = json.loads(urllib.request.urlopen(urllib.request.Request("https://oauth2.googleapis.com/token", data=data), timeout=30).read())
    return r.get("access_token", "")

def fb_metrics(vid):
    d = get(f"{GRAPH}/{vid}?fields=views,likes.summary(true)&access_token={urllib.parse.quote(FBTOK)}")
    return d.get("views"), (d.get("likes", {}).get("summary", {}) or {}).get("total_count")

def ig_metrics(mid):
    d = get(f"{GRAPH}/{mid}?fields=like_count,comments_count&access_token={urllib.parse.quote(FBTOK)}")
    views = None
    try:
        ins = get(f"{GRAPH}/{mid}/insights?metric=plays&access_token={urllib.parse.quote(FBTOK)}")
        views = (ins.get("data") or [{}])[0].get("values", [{}])[0].get("value")
    except Exception: pass
    return views, d.get("like_count")

def yt_metrics(vid, tok):
    d = get(f"https://www.googleapis.com/youtube/v3/videos?part=statistics&id={vid}&access_token={tok}")
    s = (d.get("items") or [{}])[0].get("statistics", {})
    return (int(s["viewCount"]) if "viewCount" in s else None), (int(s["likeCount"]) if "likeCount" in s else None)

def main():
    try:
        log = get(f"{PUB}/social/post-log.json?t=x")
    except Exception as e:
        print("no post-log yet:", e); log = []
    if not isinstance(log, list) or not log:
        print("nothing to measure yet."); return
    ytok = yt_access()
    out = {}  # (name,platform) -> row (newest wins)
    for r in log:
        if r.get("status") != "ok" or not r.get("pid"): continue
        plat, pid, name = r["platform"], r["pid"], r.get("name", "")
        try:
            if plat == "fb": v, l = fb_metrics(pid)
            elif plat == "ig": v, l = ig_metrics(pid)
            elif plat == "yt": v, l = yt_metrics(pid, ytok) if ytok else (None, None)
            else: continue
            out[(name, plat)] = {"name": name, "platform": plat, "views": v, "likes": l, "url": r.get("url", ""), "ts": r.get("ts", "")}
        except Exception as e:
            print(f"  {plat} {name} {pid}: {e}")
    rows = list(out.values())
    tmp = "/tmp/metrics.json"; Path(tmp).write_text(json.dumps(rows))
    import subprocess
    subprocess.run(["/usr/bin/python3", str(ROOT / "scripts/r2_upload.py"), tmp, "social/metrics.json", "application/json"], check=False)
    print(f"wrote social/metrics.json — {len(rows)} measured post(s)")

if __name__ == "__main__":
    main()
