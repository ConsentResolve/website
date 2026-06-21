#!/usr/bin/env python3
"""Google OAuth helper for the Business Profile API (gets GOOGLE_REFRESH_TOKEN).
App creds from env GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET (or /tmp/google_app.json
{"client_id","client_secret"}). Token saved to /tmp/google_token.json.

Scope: business.manage (manage the Google Business Profile / post local posts).

  python3 scripts/google_oauth.py url <redirect_uri>             # open this URL, approve, copy the ?code= from the redirect
  python3 scripts/google_oauth.py exchange <code> <redirect_uri>  # code -> access/refresh token (prints the refresh token)
  python3 scripts/google_oauth.py refresh                         # sanity-check: refresh the access token

Notes:
- Use the SAME redirect_uri in `url` and `exchange`, and it MUST be registered as an
  Authorized redirect URI on the OAuth client (https://consentresolve.com/ works).
- access_type=offline + prompt=consent is required to receive a refresh_token. If you
  re-run without prompt=consent Google may omit the refresh_token.
- Sign in with the Google account that MANAGES the Business Profile.
"""
import os, sys, json, urllib.request, urllib.parse, urllib.error
SCOPE = "https://www.googleapis.com/auth/business.manage"
AUTH = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN = "https://oauth2.googleapis.com/token"

def app():
    if os.path.exists("/tmp/google_app.json"):
        a = json.load(open("/tmp/google_app.json")); return a["client_id"], a["client_secret"]
    return os.environ["GOOGLE_CLIENT_ID"], os.environ["GOOGLE_CLIENT_SECRET"]

def auth_url(redirect):
    cid, _ = app()
    return AUTH + "?" + urllib.parse.urlencode({
        "client_id": cid, "redirect_uri": redirect, "response_type": "code",
        "scope": SCOPE, "access_type": "offline", "prompt": "consent",
        "include_granted_scopes": "true"})

def _token(data, expect_refresh=True):
    req = urllib.request.Request(TOKEN, data=urllib.parse.urlencode(data).encode(),
        headers={"Content-Type": "application/x-www-form-urlencoded"})
    try:
        r = json.load(urllib.request.urlopen(req, timeout=30))
    except urllib.error.HTTPError as e:
        print("HTTP", e.code, e.read().decode()[:500]); raise SystemExit(1)
    # Preserve the refresh_token across `refresh` calls (Google only returns it on exchange).
    if not r.get("refresh_token") and os.path.exists("/tmp/google_token.json"):
        prev = json.load(open("/tmp/google_token.json"))
        if prev.get("refresh_token"): r["refresh_token"] = prev["refresh_token"]
    json.dump(r, open("/tmp/google_token.json", "w"))
    if expect_refresh and r.get("refresh_token"):
        print("\n=== GOOGLE_REFRESH_TOKEN (copy into Cloudflare — do NOT paste in chat) ===\n" + r["refresh_token"] + "\n")
    elif expect_refresh:
        print("\n[!] No refresh_token returned — re-run the `url` step (prompt=consent) and approve again.\n")
    else:
        print("\n[ok] refresh succeeded (Google omits refresh_token on refresh — that's normal).\n")
    print(json.dumps({k: v for k, v in r.items() if k not in ("access_token", "refresh_token")}, indent=2))
    return r

if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "url"
    cid, sec = app()
    if cmd == "url":
        print(auth_url(sys.argv[2]))
    elif cmd == "exchange":
        _token({"client_id": cid, "client_secret": sec, "code": sys.argv[2],
                "grant_type": "authorization_code", "redirect_uri": sys.argv[3]})
    elif cmd == "refresh":
        t = json.load(open("/tmp/google_token.json"))
        _token({"client_id": cid, "client_secret": sec, "grant_type": "refresh_token",
                "refresh_token": t["refresh_token"]}, expect_refresh=False)
