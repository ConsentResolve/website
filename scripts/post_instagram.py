#!/usr/bin/env python3
"""Publish a 9:16 MP4 as an Instagram Reel to @consentresolve.
IG fetches the video from a PUBLIC URL (it does not accept raw bytes), so pass a
publicly-reachable https video_url. Flow: create media container (REELS) -> poll
until FINISHED -> media_publish.
Reads ig-user-id from /tmp/cr_ig_id.txt and the IG-aware page token from
/tmp/fb_page_token.txt.
Usage: python3 scripts/post_instagram.py <public_video_url> "<caption>"
"""
import sys, json, time, urllib.request, urllib.parse, urllib.error

G = "https://graph.facebook.com/v21.0"
IG = open("/tmp/cr_ig_id.txt").read().strip()
TOK = open("/tmp/fb_page_token.txt").read().strip()

def post(path, params):
    params["access_token"] = TOK
    try:
        return json.load(urllib.request.urlopen(urllib.request.Request(
            f"{G}/{path}", data=urllib.parse.urlencode(params).encode()), timeout=60))
    except urllib.error.HTTPError as e:
        return {"_err": json.loads(e.read().decode())}

def get(path, fields):
    u = f"{G}/{path}?fields={fields}&access_token={urllib.parse.quote(TOK)}"
    try:
        return json.load(urllib.request.urlopen(u, timeout=30))
    except urllib.error.HTTPError as e:
        return {"_err": json.loads(e.read().decode())}

def publish(media_url, caption="", media_type="REELS"):
    if media_type == "STORIES":
        is_video = media_url.lower().split("?")[0].endswith((".mp4", ".mov"))
        params = {"media_type": "STORIES", ("video_url" if is_video else "image_url"): media_url}
    else:
        params = {"media_type": "REELS", "video_url": media_url, "caption": caption}
    c = post(f"{IG}/media", params)
    if c.get("_err"): print("CREATE err:", c["_err"]); return None
    cid = c["id"]; print("container:", cid)
    for i in range(40):  # REELS need processing
        st = get(cid, "status_code,status")
        sc = st.get("status_code")
        print(f"  [{i}] status_code={sc}")
        if sc == "FINISHED": break
        if sc == "ERROR": print("  processing ERROR:", st); return None
        time.sleep(15)
    pub = post(f"{IG}/media_publish", {"creation_id": cid})
    if pub.get("_err"): print("PUBLISH err:", pub["_err"]); return None
    mid = pub["id"]
    link = get(mid, "permalink")
    print("published media id:", mid, "->", link.get("permalink"))
    return link

if __name__ == "__main__":
    url = sys.argv[1]
    caption = sys.argv[2] if len(sys.argv) > 2 else ""
    media_type = sys.argv[3] if len(sys.argv) > 3 else "REELS"
    print(json.dumps(publish(url, caption, media_type), indent=2))
