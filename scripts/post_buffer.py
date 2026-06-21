#!/usr/bin/env python3
"""Create a post on a Buffer channel via Buffer's GraphQL API (api.buffer.com).
Media attached by PUBLIC URL (our R2 assets) — no file upload. Used for TikTok and
LinkedIn (Buffer holds the channel access, so no native audit needed on our side).
Supports video, single image, multi-image carousel, link (text+link), and text-only.
Reads the personal token from /tmp/buffer_token.txt.

CLI (video, backward-compatible):
  post_buffer.py <channel_id> <video_url> "<caption>" [shareNow|<ISO8601>] [ai|noai] [tiktok|linkedin]
For images/carousels/links, import and call create() directly.
"""
import os, sys, json, urllib.request, urllib.error

# Lazy/safe: importing this module must not crash when the token file is absent
# (e.g. local dry-runs). create() fails gracefully if the token is empty.
TOK = open("/tmp/buffer_token.txt").read().strip() if os.path.exists("/tmp/buffer_token.txt") else ""
ENDPOINT = "https://api.buffer.com"
M = """mutation($input:CreatePostInput!){ createPost(input:$input){ __typename
  ... on PostActionSuccess{ post{ id status dueAt } }
  ... on RestProxyError{ message code } ... on InvalidInputError{ message }
  ... on LimitReachedError{ message } ... on UnauthorizedError{ message }
  ... on NotFoundError{ message } ... on UnexpectedError{ message } } }"""

def build_assets(media, kind):
    """media = list of URLs. kind = video | image | link | text."""
    if not media:
        return []
    if kind == "image":
        return [{"image": {"url": u}} for u in media]
    if kind == "link":
        return [{"link": {"url": media[0]}}]
    if kind == "text":
        return []
    return [{"video": {"url": media[0]}}]  # default: video

def create(channel, media_url, caption, when="shareNow", ai=True, service="tiktok", kind="video", extra_media=None):
    media = ([media_url] if media_url else []) + list(extra_media or [])
    inp = {"channelId": channel, "text": caption, "schedulingType": "automatic"}
    assets = build_assets(media, kind)
    if assets:
        inp["assets"] = assets
    if service == "tiktok":  # tiktok-only AI-disclosure metadata; other services reject it
        inp["metadata"] = {"tiktok": {"isAiGenerated": bool(ai)}}
    inp["mode"] = when if when in ("shareNow", "addToQueue", "shareNext") else "customScheduled"
    if inp["mode"] == "customScheduled":
        inp["dueAt"] = when
    req = urllib.request.Request(ENDPOINT, data=json.dumps({"query": M, "variables": {"input": inp}}).encode(),
                                 headers={"Authorization": f"Bearer {TOK}", "Content-Type": "application/json"})
    try:
        r = json.load(urllib.request.urlopen(req, timeout=60))
    except urllib.error.HTTPError as e:
        print("buffer HTTP", e.code, e.read().decode()[:400]); return None
    res = (r.get("data") or {}).get("createPost") or r
    print(json.dumps(res))
    if isinstance(res, dict) and res.get("__typename") != "PostActionSuccess":
        return None
    return res

if __name__ == "__main__":
    channel, url, caption = sys.argv[1], sys.argv[2], sys.argv[3]
    when = sys.argv[4] if len(sys.argv) > 4 else "shareNow"
    ai = (sys.argv[5].lower() == "ai") if len(sys.argv) > 5 else True
    service = sys.argv[6] if len(sys.argv) > 6 else "tiktok"
    sys.exit(0 if create(channel, url, caption, when, ai, service) else 1)  # non-zero on any Buffer error so the runner logs a real fail
