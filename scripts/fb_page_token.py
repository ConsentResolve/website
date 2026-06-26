#!/usr/bin/env python3
"""Mint a long-lived Facebook PAGE token for the Consent Resolve Page and write it
to /tmp/fb_page_token.txt. Works for either source:

  • Business Manager SYSTEM-USER token (how the CR page is actually managed) —
    just set FB_USER_TOKEN to the system-user token. It's already long-lived;
    no app id/secret needed.
  • A personal USER token (only if your personal account is a Page admin) — set
    FB_USER_TOKEN plus FB_APP_ID/FB_APP_SECRET to exchange it for long-lived.

For Instagram insights (reel reach/saves/shares in the social dashboard) the source
FB_USER_TOKEN must include scopes: instagram_basic + instagram_manage_insights
(+ pages_read_engagement). Without instagram_manage_insights, media insights return
"(#10) Application does not have permission for this action".

Env:
  FB_USER_TOKEN  (required) — system-user token OR Explorer user token
  FB_APP_ID, FB_APP_SECRET  (optional) — enables the long-lived exchange + scope check
Target page = /tmp/fb_page_id.txt. Does NOT print the token; copy it for the
GitHub secret with:  cat /tmp/fb_page_token.txt
"""
import os, sys, json, urllib.request, urllib.parse, urllib.error

GRAPH = "https://graph.facebook.com/v21.0"
def get(url):
    try: return json.load(urllib.request.urlopen(url, timeout=30))
    except urllib.error.HTTPError as e: return {"_err": json.loads(e.read().decode())}

tok = os.environ.get("FB_USER_TOKEN", "").strip()
APPID = os.environ.get("FB_APP_ID", "").strip()
SECRET = os.environ.get("FB_APP_SECRET", "").strip()
if not tok: sys.exit("Set FB_USER_TOKEN (a system-user token, or an Explorer user token).")
PID = open("/tmp/fb_page_id.txt").read().strip()

# Optionally upgrade a short-lived USER token to long-lived (system-user tokens
# can't be exchanged and don't need it — we just keep them as-is).
if APPID and SECRET:
    ll = get(f"{GRAPH}/oauth/access_token?" + urllib.parse.urlencode(
        {"grant_type": "fb_exchange_token", "client_id": APPID, "client_secret": SECRET, "fb_exchange_token": tok}))
    if ll.get("_err"):
        print("note: token exchange skipped (fine for system-user tokens):", ll["_err"].get("message", ""))
    else:
        tok = ll["access_token"]; print("✓ long-lived user token obtained")

# Get the Page's token directly (works for a system-user or page-admin token that
# has the CR page assigned — no /me/accounts needed).
pg = get(f"{GRAPH}/{PID}?fields=name,access_token&access_token={urllib.parse.quote(tok)}")
if pg.get("access_token"):
    ptoken, pname = pg["access_token"], pg.get("name", PID)
else:
    acc = get(f"{GRAPH}/me/accounts?" + urllib.parse.urlencode({"access_token": tok, "limit": 200}))
    page = next((p for p in acc.get("data", []) if p.get("id") == PID), None) if not acc.get("_err") else None
    if not page:
        why = pg.get("_err", {}).get("message", "") or acc.get("_err", {}).get("message", "")
        avail = ", ".join(f"{p.get('name')} ({p.get('id')})" for p in acc.get("data", [])) if not acc.get("_err") else "(could not list)"
        sys.exit(f"Could not get a token for Page {PID}.\n  reason: {why}\n  pages this token can see: {avail}\n"
                 f"  → This page is in Business Manager; use a SYSTEM-USER token that has it assigned.")
    ptoken, pname = page["access_token"], page.get("name", PID)

open("/tmp/fb_page_token.txt", "w").write(ptoken)
print(f"✓ wrote /tmp/fb_page_token.txt  (page: {pname})")

if APPID and SECRET:
    dbg = get(f"{GRAPH}/debug_token?" + urllib.parse.urlencode({"input_token": ptoken, "access_token": f"{APPID}|{SECRET}"}))
    data = dbg.get("data") or {}
    scopes = data.get("scopes", []); exp = data.get("expires_at", 0)
    print(f"  scopes: {', '.join(scopes)}")
    print(f"  expires: {'never' if exp == 0 else exp}")
    print(f"  pages_manage_posts present: {'pages_manage_posts' in scopes}")
    print(f"  instagram_manage_insights present: {'instagram_manage_insights' in scopes}  (needed for IG reel insights)")
print("\nNext: copy this token into the FB_PAGE_TOKEN GitHub secret →  cat /tmp/fb_page_token.txt")
