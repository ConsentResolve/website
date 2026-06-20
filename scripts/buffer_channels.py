#!/usr/bin/env python3
"""List your Buffer channels (id + service) so BUFFER_TIKTOK_CHANNEL can be set to the
correct TikTok channel. Reads the token from /tmp/buffer_token.txt (runner) — or pass it:
  BUFFER_TOKEN=xxxx python3 scripts/buffer_channels.py
Prints the raw response + a clean id list. (Buffer Business accounts can direct-publish to
TikTok, so once the right channel id is set, post_buffer's shareNow posts live.)"""
import os, json, urllib.request, urllib.error
TOK = os.environ.get("BUFFER_TOKEN") or (open("/tmp/buffer_token.txt").read().strip() if os.path.exists("/tmp/buffer_token.txt") else "")
if not TOK:
    raise SystemExit("no Buffer token (set BUFFER_TOKEN or /tmp/buffer_token.txt)")
Q = "query { channels { id name service serviceType locked } }"
req = urllib.request.Request("https://api.buffer.com", data=json.dumps({"query": Q}).encode(),
                             headers={"Authorization": f"Bearer {TOK}", "Content-Type": "application/json"})
try:
    r = json.load(urllib.request.urlopen(req, timeout=30))
except urllib.error.HTTPError as e:
    print("HTTP", e.code, e.read().decode()[:600]); raise SystemExit(1)
print(json.dumps(r, indent=2))
chs = (r.get("data") or {}).get("channels") or []
print("\n--- channels ---")
for c in chs:
    star = "  <-- set BUFFER_TIKTOK_CHANNEL to this" if (c.get("service") or "").lower() == "tiktok" else ""
    print(f"  {(c.get('service') or '?'):12} {c.get('id')}  {c.get('name','')}{star}")
