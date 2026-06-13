#!/usr/bin/env python3
"""Create a post on a Buffer channel via Buffer's GraphQL API (api.buffer.com).
Media attached by PUBLIC URL (our R2 reels) — no file upload. Used for TikTok
(Buffer holds the TikTok access, so no TikTok audit needed on our side).
Reads the personal token from /tmp/buffer_token.txt.

Usage: post_buffer.py <channel_id> <video_url> "<caption>" [shareNow|addToQueue|<ISO8601>] [ai|noai]
"""
import sys, json, urllib.request, urllib.error

TOK = open("/tmp/buffer_token.txt").read().strip()
ENDPOINT = "https://api.buffer.com"
M = """mutation($input:CreatePostInput!){ createPost(input:$input){ __typename
  ... on PostActionSuccess{ post{ id status dueAt } }
  ... on RestProxyError{ message code } ... on InvalidInputError{ message }
  ... on LimitReachedError{ message } ... on UnauthorizedError{ message }
  ... on NotFoundError{ message } ... on UnexpectedError{ message } } }"""

def create(channel, video_url, caption, when="shareNow", ai=True):
    inp = {"channelId": channel, "text": caption,
           "assets": [{"video": {"url": video_url}}],
           "schedulingType": "automatic",
           "metadata": {"tiktok": {"isAiGenerated": bool(ai)}}}
    if when in ("shareNow", "addToQueue", "shareNext"):
        inp["mode"] = when
    else:
        inp["mode"] = "customScheduled"; inp["dueAt"] = when
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
    create(channel, url, caption, when, ai)
