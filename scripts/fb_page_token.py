#!/usr/bin/env python3
"""Mint a long-lived Facebook PAGE token from a Graph Explorer USER token.

Reads from the environment (so secrets never land in argv/shell history):
  FB_USER_TOKEN  — the short-lived user token you just generated in the Explorer
  FB_APP_ID      — your Meta app id   (App Dashboard → Settings → Basic)
  FB_APP_SECRET  — your Meta app secret (same page, "Show")
Target page = /tmp/fb_page_id.txt.

Writes the long-lived Page token to /tmp/fb_page_token.txt and prints a scope
check (it does NOT print the token itself). To update the cron, copy the file
into the FB_PAGE_TOKEN GitHub secret:  cat /tmp/fb_page_token.txt

Usage:
  FB_USER_TOKEN=... FB_APP_ID=... FB_APP_SECRET=... python3 scripts/fb_page_token.py
"""
import os, sys, json, urllib.request, urllib.parse, urllib.error

GRAPH = "https://graph.facebook.com/v21.0"
def get(url):
    try: return json.load(urllib.request.urlopen(url, timeout=30))
    except urllib.error.HTTPError as e: return {"_err": json.loads(e.read().decode())}

USER = os.environ.get("FB_USER_TOKEN", "").strip()
APPID = os.environ.get("FB_APP_ID", "").strip()
SECRET = os.environ.get("FB_APP_SECRET", "").strip()
if not (USER and APPID and SECRET):
    sys.exit("Set FB_USER_TOKEN, FB_APP_ID and FB_APP_SECRET in the environment.")
PID = open("/tmp/fb_page_id.txt").read().strip()

# 1) short-lived user token → long-lived user token
ll = get(f"{GRAPH}/oauth/access_token?" + urllib.parse.urlencode(
    {"grant_type": "fb_exchange_token", "client_id": APPID, "client_secret": SECRET, "fb_exchange_token": USER}))
if ll.get("_err"): sys.exit("exchange error: " + json.dumps(ll["_err"]))
llu = ll["access_token"]; print("✓ long-lived user token obtained")

# 2) long-lived user token → the Page's token (inherits the granted scopes, long-lived)
acc = get(f"{GRAPH}/me/accounts?" + urllib.parse.urlencode({"access_token": llu, "limit": 200}))
if acc.get("_err"): sys.exit("accounts error: " + json.dumps(acc["_err"]))
page = next((p for p in acc.get("data", []) if p.get("id") == PID), None)
if not page:
    avail = ", ".join(f"{p.get('name')} ({p.get('id')})" for p in acc.get("data", []))
    sys.exit(f"Page {PID} not found in your /me/accounts. Pages you manage: {avail}")
ptoken = page["access_token"]

# 3) confirm the scope is actually on the page token
dbg = get(f"{GRAPH}/debug_token?" + urllib.parse.urlencode({"input_token": ptoken, "access_token": f"{APPID}|{SECRET}"}))
scopes = (dbg.get("data") or {}).get("scopes", [])

open("/tmp/fb_page_token.txt", "w").write(ptoken)
print(f"✓ wrote /tmp/fb_page_token.txt  (page: {page.get('name')})")
print(f"  scopes: {', '.join(scopes)}")
ok = "pages_manage_engagement" in scopes and "pages_manage_posts" in scopes
print(f"  pages_manage_posts + pages_manage_engagement present: {ok}")
print("\nNext: copy this token into the FB_PAGE_TOKEN GitHub secret →  cat /tmp/fb_page_token.txt")
