#!/usr/bin/env python3
"""Direct Post a video to our OWN TikTok via the Content Posting API (FILE_UPLOAD — no
domain verification needed). Sandbox: posts are SELF_ONLY until the app audit passes.
Token from /tmp/tiktok_token.json (see tiktok_oauth.py).

Usage: python3 scripts/post_tiktok_native.py <video_url> "<caption>"
Flow: creator_info/query -> video/init (FILE_UPLOAD) -> PUT bytes -> status/fetch.
"""
import sys, json, urllib.request, urllib.error
API = "https://open.tiktokapis.com/v2"
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124 Safari/537.36"
TOK = json.load(open("/tmp/tiktok_token.json"))["access_token"]

def jpost(path, body):
    req = urllib.request.Request(f"{API}{path}", data=json.dumps(body).encode(),
        headers={"Authorization": f"Bearer {TOK}", "Content-Type": "application/json; charset=UTF-8"})
    try:
        return json.load(urllib.request.urlopen(req, timeout=90))
    except urllib.error.HTTPError as e:
        print("HTTP", e.code, e.read().decode()[:600]); raise SystemExit(1)

def main(video_url, caption):
    # 1) creator info (required before any post; returns allowed privacy levels)
    ci = jpost("/post/publish/creator_info/query/", {}).get("data", {})
    print("creator:", ci.get("creator_nickname"), "| privacy options:", ci.get("privacy_level_options"))
    privacy = (ci.get("privacy_level_options") or ["SELF_ONLY"])[0]  # sandbox forces SELF_ONLY anyway
    # 2) fetch the reel bytes (R2 is behind Cloudflare → needs a browser UA)
    vb = urllib.request.urlopen(urllib.request.Request(video_url, headers={"User-Agent": UA}), timeout=180).read()
    size = len(vb); print(f"video {size/1e6:.1f} MB")
    # 3) init a single-chunk FILE_UPLOAD (reels are < 64MB)
    init = jpost("/post/publish/video/init/", {
        "post_info": {"title": caption[:2200], "privacy_level": privacy,
                      "disable_comment": False, "disable_duet": False, "disable_stitch": False},
        "source_info": {"source": "FILE_UPLOAD", "video_size": size, "chunk_size": size, "total_chunk_count": 1},
    }).get("data", {})
    pid, upload_url = init.get("publish_id"), init.get("upload_url")
    print("publish_id:", pid)
    # 4) upload the bytes
    put = urllib.request.Request(upload_url, data=vb, method="PUT",
        headers={"Content-Type": "video/mp4", "Content-Range": f"bytes 0-{size-1}/{size}"})
    urllib.request.urlopen(put, timeout=300); print("uploaded")
    # 5) poll status once (poll again after a few seconds for PUBLISH_COMPLETE)
    st = jpost("/post/publish/status/fetch/", {"publish_id": pid}).get("data", {})
    print("status:", json.dumps(st))

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
