#!/usr/bin/env python3
"""One-time YouTube OAuth (Desktop app, loopback) -> permanent refresh token.
Starts a local server on 127.0.0.1:8765, prints the auth URL, waits for the
redirect, exchanges the code, and saves /tmp/yt_token.json.
"""
import json, os, urllib.parse, urllib.request, http.server, threading, sys

# Provide via env (never hardcode secrets):
#   YT_CLIENT_ID=... YT_CLIENT_SECRET=... python3 scripts/youtube_oauth.py
CLIENT_ID = os.environ.get("YT_CLIENT_ID", "")
CLIENT_SECRET = os.environ.get("YT_CLIENT_SECRET", "")
if not (CLIENT_ID and CLIENT_SECRET):
    sys.exit("Set YT_CLIENT_ID and YT_CLIENT_SECRET env vars (one-time OAuth bootstrap).")
PORT = 8765
REDIRECT = f"http://127.0.0.1:{PORT}/"
SCOPES = "https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly"
AUTH = ("https://accounts.google.com/o/oauth2/v2/auth?" + urllib.parse.urlencode({
    "client_id": CLIENT_ID, "redirect_uri": REDIRECT, "response_type": "code",
    "scope": SCOPES, "access_type": "offline", "prompt": "consent", "include_granted_scopes": "true"}))

result = {}

class H(http.server.BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def do_GET(self):
        q = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        if "code" not in q:
            self.send_response(400); self.end_headers(); return
        code = q["code"][0]
        data = urllib.parse.urlencode({"code": code, "client_id": CLIENT_ID,
            "client_secret": CLIENT_SECRET, "redirect_uri": REDIRECT,
            "grant_type": "authorization_code"}).encode()
        try:
            tok = json.load(urllib.request.urlopen(urllib.request.Request(
                "https://oauth2.googleapis.com/token", data=data), timeout=30))
            result.update(tok)
        except Exception as e:
            result["error"] = str(e)
        self.send_response(200); self.send_header("Content-Type", "text/html"); self.end_headers()
        msg = "refresh token captured — you can close this tab." if result.get("refresh_token") else f"error: {result.get('error') or result}"
        self.wfile.write(f"<h2>Consent Resolve YouTube auth</h2><p>{msg}</p>".encode())

print("AUTH_URL:", AUTH, flush=True)
srv = http.server.HTTPServer(("127.0.0.1", PORT), H)
srv.timeout = 300
# serve until we get a token (or timeout)
import time
start = time.time()
while "refresh_token" not in result and "error" not in result and time.time() - start < 300:
    srv.handle_request()
if result.get("refresh_token"):
    out = {"client_id": CLIENT_ID, "client_secret": CLIENT_SECRET,
           "refresh_token": result["refresh_token"], "token_uri": "https://oauth2.googleapis.com/token"}
    open("/tmp/yt_token.json", "w").write(json.dumps(out))
    print("SAVED /tmp/yt_token.json (refresh_token captured)", flush=True)
else:
    print("FAILED:", result, flush=True)
