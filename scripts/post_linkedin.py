#!/usr/bin/env python3
"""Post a NATIVE video to LinkedIn (personal feed or Company Page) via the
Assets + ugcPosts API. Native video (not a link) — LinkedIn favors it heavily.

Flow: registerUpload (feedshare-video) -> PUT the bytes -> poll asset until
AVAILABLE -> create ugcPost (shareMediaCategory VIDEO).

Creds per actor in /tmp:
  /tmp/li_personal.json  {"token": "...", "urn": "urn:li:person:XXXX"}
  /tmp/li_company.json   {"token": "...", "urn": "urn:li:organization:110527722"}

Usage: python3 scripts/post_linkedin.py <file.mp4> "<caption>" [personal|company] ["<title>"]
"""
import sys, json, time, urllib.request, urllib.error
from pathlib import Path

API = "https://api.linkedin.com"

def load(actor):
    return json.load(open(f"/tmp/li_{actor}.json"))

def req(url, token, data=None, method=None, ctype="application/json", raw=False):
    headers = {"Authorization": f"Bearer {token}", "X-Restli-Protocol-Version": "2.0.0"}
    if data is not None and not raw:
        data = json.dumps(data).encode(); headers["Content-Type"] = ctype
    r = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        resp = urllib.request.urlopen(r, timeout=300)
        body = resp.read()
        return resp.status, (json.loads(body) if body and not raw else body)
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:500]

def post_video(file, caption, actor="personal", title="Consent Resolve"):
    cfg = load(actor); token, urn = cfg["token"], cfg["urn"]
    body = Path(file).read_bytes()
    # 1) registerUpload
    reg = {"registerUploadRequest": {
        "recipes": ["urn:li:digitalmediaRecipe:feedshare-video"],
        "owner": urn,
        "serviceRelationships": [{"relationshipType": "OWNER", "identifier": "urn:li:userGeneratedContent"}]}}
    st, r = req(f"{API}/v2/assets?action=registerUpload", token, reg)
    if st >= 400: print("registerUpload err:", st, r); return None
    asset = r["value"]["asset"]
    up = r["value"]["uploadMechanism"]["com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"]["uploadUrl"]
    print("asset:", asset)
    # 2) upload bytes (PUT)
    st, _ = req(up, token, data=body, method="PUT", ctype="application/octet-stream", raw=True)
    if st >= 400: print("upload err:", st); return None
    print("bytes uploaded")
    # 3) poll asset until AVAILABLE
    for i in range(30):
        st, r = req(f"{API}/v2/assets/{asset.split(':')[-1]}", token)
        status = (r.get("recipes", [{}])[0].get("status") if isinstance(r, dict) else None)
        print(f"  [{i}] asset status: {status}")
        if status == "AVAILABLE": break
        if status == "PROCESSING_FAILED": print("processing failed"); return None
        time.sleep(10)
    # 4) ugcPost VIDEO
    post = {"author": urn, "lifecycleState": "PUBLISHED",
            "specificContent": {"com.linkedin.ugc.ShareContent": {
                "shareCommentary": {"text": caption},
                "shareMediaCategory": "VIDEO",
                "media": [{"status": "READY", "media": asset, "title": {"text": title}}]}},
            "visibility": {"com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"}}
    st, r = req(f"{API}/v2/ugcPosts", token, post)
    if st >= 400: print("ugcPost err:", st, r); return None
    pid = r.get("id") if isinstance(r, dict) else None
    print("posted:", pid, "->", f"https://www.linkedin.com/feed/update/{pid}/" if pid else r)
    return pid

if __name__ == "__main__":
    file, caption = sys.argv[1], sys.argv[2]
    actor = sys.argv[3] if len(sys.argv) > 3 else "personal"
    title = sys.argv[4] if len(sys.argv) > 4 else "Consent Resolve"
    print(json.dumps({"id": post_video(file, caption, actor, title)}, indent=2))
