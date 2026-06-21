#!/usr/bin/env python3
"""Shared YouTube Data API v3 helpers (needs the youtube.force-ssl scope — re-run
scripts/youtube_oauth.py to upgrade an upload-only token). Reads /tmp/yt_token.json."""
import json, urllib.request, urllib.parse, urllib.error
TOK_PATH = "/tmp/yt_token.json"
BASE = "https://www.googleapis.com/youtube/v3"
UPLOAD = "https://www.googleapis.com/upload/youtube/v3"

def token():
    t = json.load(open(TOK_PATH))
    d = urllib.parse.urlencode({"client_id": t["client_id"], "client_secret": t["client_secret"],
        "refresh_token": t["refresh_token"], "grant_type": "refresh_token"}).encode()
    uri = t.get("token_uri", "https://oauth2.googleapis.com/token")
    return json.load(urllib.request.urlopen(urllib.request.Request(uri, data=d), timeout=30))["access_token"]

def api(method, path, tok, params=None, body=None):
    url = f"{BASE}{path}"
    if params:
        url += "?" + urllib.parse.urlencode(params, doseq=True)
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method,
        headers={"Authorization": f"Bearer {tok}", "Content-Type": "application/json"})
    try:
        return json.load(urllib.request.urlopen(req, timeout=60))
    except urllib.error.HTTPError as e:
        raise SystemExit(f"HTTP {e.code} {method} {path}: {e.read().decode()[:500]}")

def upload_media(path_or_bytes, content_type, params, tok, extra_meta=None):
    """Multipart media upload (thumbnails, captions). params include the endpoint path
    under /upload (e.g. '/thumbnails/set'). extra_meta -> JSON metadata part if given."""
    endpoint = params.pop("_endpoint")
    blob = path_or_bytes if isinstance(path_or_bytes, (bytes, bytearray)) else open(path_or_bytes, "rb").read()
    url = f"{UPLOAD}{endpoint}?" + urllib.parse.urlencode(params)
    if extra_meta is None:
        req = urllib.request.Request(url, data=blob, method="POST",
            headers={"Authorization": f"Bearer {tok}", "Content-Type": content_type})
    else:
        b = "====cr_boundary===="
        body = (f"--{b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n"
                + json.dumps(extra_meta) + f"\r\n--{b}\r\nContent-Type: {content_type}\r\n\r\n").encode() \
               + blob + f"\r\n--{b}--\r\n".encode()
        req = urllib.request.Request(url, data=body, method="POST",
            headers={"Authorization": f"Bearer {tok}", "Content-Type": f"multipart/related; boundary={b}"})
    try:
        return json.load(urllib.request.urlopen(req, timeout=180))
    except urllib.error.HTTPError as e:
        raise SystemExit(f"HTTP {e.code} upload {endpoint}: {e.read().decode()[:500]}")
