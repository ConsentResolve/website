#!/usr/bin/env python3
"""Upload a local 9:16 MP4 as a YouTube Short to the Consent Resolve channel.
Resumable upload via the Data API v3. Reads creds/refresh_token from
/tmp/yt_token.json (permanent). Usage:
  python3 scripts/post_youtube.py <file.mp4> "<title>" "<description>" [public|unlisted|private]
"""
import sys, json, urllib.parse, urllib.request, urllib.error
from pathlib import Path

T = json.load(open("/tmp/yt_token.json"))

def access_token():
    d = urllib.parse.urlencode({"client_id": T["client_id"], "client_secret": T["client_secret"],
        "refresh_token": T["refresh_token"], "grant_type": "refresh_token"}).encode()
    return json.load(urllib.request.urlopen(urllib.request.Request(T["token_uri"], data=d), timeout=30))["access_token"]

def upload(path, title, desc, privacy="public"):
    at = access_token()
    raw = Path(path).read_bytes(); size = len(raw)
    meta = {"snippet": {"title": title, "description": desc,
                        "tags": ["contractor leads", "home services", "lead generation",
                                 "Angi alternative", "small business"], "categoryId": "22"},
            "status": {"privacyStatus": privacy, "selfDeclaredMadeForKids": False}}
    body = json.dumps(meta).encode()
    # 1) start resumable session
    req = urllib.request.Request(
        "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
        data=body, headers={"Authorization": f"Bearer {at}", "Content-Type": "application/json",
                            "X-Upload-Content-Type": "video/mp4", "X-Upload-Content-Length": str(size)})
    try:
        resp = urllib.request.urlopen(req, timeout=60)
    except urllib.error.HTTPError as e:
        print("START err:", e.read().decode()); return None
    loc = resp.headers.get("Location")
    print(f"resumable session open ({size/1e6:.1f} MB)")
    # 2) upload bytes
    put = urllib.request.Request(loc, data=raw, method="PUT",
        headers={"Authorization": f"Bearer {at}", "Content-Type": "video/mp4", "Content-Length": str(size)})
    try:
        r = json.load(urllib.request.urlopen(put, timeout=600))
    except urllib.error.HTTPError as e:
        print("UPLOAD err:", e.read().decode()); return None
    vid = r.get("id")
    print("uploaded. video id:", vid)
    print("watch:", f"https://www.youtube.com/shorts/{vid}")
    return r

if __name__ == "__main__":
    path, title, desc = sys.argv[1], sys.argv[2], sys.argv[3]
    privacy = sys.argv[4] if len(sys.argv) > 4 else "public"
    print(json.dumps(upload(path, title, desc, privacy), indent=2)[:400])
