#!/usr/bin/env python3
"""Post a local 9:16 MP4 as a Facebook Reel to the Consent Resolve Page.

FB Reels publishing is 3-phase: start -> upload bytes -> finish(PUBLISHED),
then it processes async. Reads page id/token from /tmp/fb_page_id.txt and
/tmp/fb_page_token.txt.

Usage: python3 scripts/post_video.py <file.mp4> "<caption>"
"""
import sys, json, time, urllib.request, urllib.parse, urllib.error
from pathlib import Path

GRAPH = "https://graph.facebook.com/v21.0"
PID = open("/tmp/fb_page_id.txt").read().strip()
TOK = open("/tmp/fb_page_token.txt").read().strip()

def _post(url, data, headers=None):
    req = urllib.request.Request(url, data=data, headers=headers or {})
    try:
        return json.load(urllib.request.urlopen(req, timeout=300))
    except urllib.error.HTTPError as e:
        return {"_err": json.loads(e.read().decode())}

def fb_reel(path, caption):
    raw = Path(path).read_bytes(); size = len(raw)
    print(f"file: {path} ({size/1e6:.1f} MB)")
    # 1) start
    s = _post(f"{GRAPH}/{PID}/video_reels",
              urllib.parse.urlencode({"upload_phase": "start", "access_token": TOK}).encode())
    if s.get("_err"): print("START err:", s["_err"]); return None
    vid, up = s["video_id"], s["upload_url"]
    print("start ok, video_id:", vid)
    # 2) upload bytes (single-shot resumable)
    u = _post(up, raw, {"Authorization": f"OAuth {TOK}", "offset": "0", "file_size": str(size)})
    if u.get("_err"): print("UPLOAD err:", u["_err"]); return None
    print("upload ok:", u)
    # 3) finish -> PUBLISHED
    f = _post(f"{GRAPH}/{PID}/video_reels",
              urllib.parse.urlencode({"upload_phase": "finish", "video_id": vid,
                                      "video_state": "PUBLISHED", "description": caption,
                                      "access_token": TOK}).encode())
    if f.get("_err"): print("FINISH err:", f["_err"]); return None
    print("finish ok:", f)
    # 4) poll processing/publish status
    for _ in range(20):
        st = _post(f"{GRAPH}/{vid}?fields=status,permalink_url&access_token={urllib.parse.quote(TOK)}", None) \
             if False else json.load(urllib.request.urlopen(
                 f"{GRAPH}/{vid}?fields=status,permalink_url&access_token={urllib.parse.quote(TOK)}", timeout=30))
        vs = (st.get("status") or {}).get("video_status")
        print("  status:", vs, st.get("permalink_url", ""))
        if vs in ("ready", "published"):
            return st
        if vs == "error":
            return st
        time.sleep(15)
    return {"video_id": vid, "note": "still processing"}

if __name__ == "__main__":
    path, caption = sys.argv[1], sys.argv[2]
    print(json.dumps(fb_reel(path, caption), indent=2))
