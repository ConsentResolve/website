#!/usr/bin/env python3
"""TikTok OAuth helper for the Content Posting API (sandbox-ready).
App creds from env TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET (or /tmp/tiktok_app.json
{"client_key","client_secret"}). Token saved to /tmp/tiktok_token.json.

  python3 scripts/tiktok_oauth.py url <redirect_uri>            # open this URL, authorize, copy the ?code= from the redirect
  python3 scripts/tiktok_oauth.py exchange <code> <redirect_uri> # code -> access/refresh token
  python3 scripts/tiktok_oauth.py refresh                        # refresh the access token
"""
import os, sys, json, urllib.request, urllib.parse, urllib.error
SCOPES = "user.info.basic,video.publish"

def app():
    if os.path.exists("/tmp/tiktok_app.json"):
        a = json.load(open("/tmp/tiktok_app.json")); return a["client_key"], a["client_secret"]
    return os.environ["TIKTOK_CLIENT_KEY"], os.environ["TIKTOK_CLIENT_SECRET"]

def auth_url(redirect):
    k, _ = app()
    return "https://www.tiktok.com/v2/auth/authorize/?" + urllib.parse.urlencode(
        {"client_key": k, "scope": SCOPES, "response_type": "code", "redirect_uri": redirect, "state": "cr"})

def _token(data):
    req = urllib.request.Request("https://open.tiktokapis.com/v2/oauth/token/",
        data=urllib.parse.urlencode(data).encode(), headers={"Content-Type": "application/x-www-form-urlencoded"})
    try:
        r = json.load(urllib.request.urlopen(req, timeout=30))
    except urllib.error.HTTPError as e:
        print("HTTP", e.code, e.read().decode()[:500]); raise SystemExit(1)
    json.dump(r, open("/tmp/tiktok_token.json", "w")); print(json.dumps(r, indent=2)); return r

if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "url"
    k, s = app()
    if cmd == "url":
        print(auth_url(sys.argv[2]))
    elif cmd == "exchange":
        _token({"client_key": k, "client_secret": s, "code": sys.argv[2],
                "grant_type": "authorization_code", "redirect_uri": sys.argv[3]})
    elif cmd == "refresh":
        t = json.load(open("/tmp/tiktok_token.json"))
        _token({"client_key": k, "client_secret": s, "grant_type": "refresh_token", "refresh_token": t["refresh_token"]})
