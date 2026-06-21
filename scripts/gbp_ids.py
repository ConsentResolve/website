#!/usr/bin/env python3
"""List Google Business Profile account + location IDs → GBP_ACCOUNT_ID / GBP_LOCATION_ID.
Uses /tmp/google_token.json (refresh_token from google_oauth.py) + /tmp/google_app.json.
Needs the Account Management + Business Information APIs enabled on the Cloud project."""
import json, urllib.request, urllib.parse, urllib.error
APP = json.load(open("/tmp/google_app.json"))
TOK = json.load(open("/tmp/google_token.json"))

def access():
    data = urllib.parse.urlencode({"client_id": APP["client_id"], "client_secret": APP["client_secret"],
        "refresh_token": TOK["refresh_token"], "grant_type": "refresh_token"}).encode()
    r = json.load(urllib.request.urlopen(urllib.request.Request("https://oauth2.googleapis.com/token", data=data), timeout=30))
    return r["access_token"]

def get(url, tok):
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {tok}"})
    try:
        return json.load(urllib.request.urlopen(req, timeout=30))
    except urllib.error.HTTPError as e:
        print("HTTP", e.code, "on", url.split("?")[0], "->", e.read().decode()[:400]); return {}

tok = access()
accts = get("https://mybusinessaccountmanagement.googleapis.com/v1/accounts", tok)
if not accts.get("accounts"):
    print("No accounts returned (API not enabled, or this Google account manages no profiles)."); raise SystemExit(0)
for a in accts.get("accounts", []):
    name = a.get("name", "")             # "accounts/123456789"
    acct_id = name.split("/")[-1]
    print(f"\nACCOUNT {acct_id}  name='{a.get('accountName','')}'  type={a.get('type','')}")
    locs = get(f"https://mybusinessbusinessinformation.googleapis.com/v1/{name}/locations?readMask=name,title,storefrontAddress&pageSize=100", tok)
    for l in locs.get("locations", []):
        loc_id = l.get("name", "").split("/")[-1]
        print(f"  LOCATION {loc_id}  title='{l.get('title','')}'")
        print(f"     >>> GBP_ACCOUNT_ID={acct_id}   GBP_LOCATION_ID={loc_id}")
    if not locs.get("locations"):
        print("  (no locations under this account)")
