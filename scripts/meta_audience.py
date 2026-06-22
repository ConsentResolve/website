#!/usr/bin/env python3
"""Create a Meta (Facebook) Custom Audience from an email CSV and upload the
hashed emails via the Marketing API — so each wave's retargeting list is one
command instead of a manual UI upload.

Auth (one-time, set as env or /tmp files; NEVER paste in chat):
  META_ACCESS_TOKEN     — System User token w/ ads_management (Business Settings)
  META_AD_ACCOUNT_ID    — e.g. act_1234567890  (or just the digits)

Usage:
  python3 scripts/meta_audience.py apollo-contacts-export.csv --name "HVAC TX - Cold List"
      -> DRY RUN: parses + SHA256-hashes emails, shows count + a sample. No API calls.
  python3 scripts/meta_audience.py apollo-contacts-export.csv --name "HVAC TX - Cold List" --push
      -> creates the Custom Audience + uploads the hashed emails (10k/batch).

Note: uploading a cold list as a Custom Audience is the consent grey-area — use
B2B business emails, honor opt-outs. Pixel-based (site-visitor) audiences are clean.
"""
import argparse, csv, hashlib, json, os, sys, urllib.request, urllib.parse, urllib.error
from pathlib import Path

GRAPH = "https://graph.facebook.com/v21.0"

def _env(name, file):
    v = os.environ.get(name, "").strip()
    if not v and Path(file).exists(): v = Path(file).read_text().strip()
    return v

def token():
    t = _env("META_ACCESS_TOKEN", "/tmp/meta_token.txt")
    if not t: sys.exit("ERROR: set META_ACCESS_TOKEN (env) or /tmp/meta_token.txt to --push.")
    return t

def ad_account():
    a = _env("META_AD_ACCOUNT_ID", "/tmp/meta_ad_account.txt")
    if not a: sys.exit("ERROR: set META_AD_ACCOUNT_ID (env) or /tmp/meta_ad_account.txt.")
    return a if a.startswith("act_") else f"act_{a}"

def sha(email): return hashlib.sha256(email.strip().lower().encode()).hexdigest()

def post(path, params):
    data = urllib.parse.urlencode(params).encode()
    req = urllib.request.Request(f"{GRAPH}/{path}", data=data, method="POST")
    try:
        return json.loads(urllib.request.urlopen(req, timeout=60).read())
    except urllib.error.HTTPError as e:
        sys.exit(f"Meta API POST {path} -> {e.code}: {e.read().decode()[:400]}")

def emails_from_csv(path):
    out, low = [], None
    for r in csv.DictReader(open(path, newline="", encoding="utf-8-sig")):
        if low is None: low = {k.lower().strip(): k for k in r}
        col = low.get("email") or low.get("work email")
        e = (r.get(col) or "").strip() if col else ""
        if "@" in e: out.append(e)
    # dedupe, preserve order
    seen, uniq = set(), []
    for e in out:
        k = e.lower()
        if k not in seen: seen.add(k); uniq.append(e)
    return uniq

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("csv")
    ap.add_argument("--name", required=True, help='Custom Audience name, e.g. "HVAC TX - Cold List"')
    ap.add_argument("--push", action="store_true", help="create audience + upload (else dry-run)")
    a = ap.parse_args()

    emails = emails_from_csv(a.csv)
    hashed = [sha(e) for e in emails]
    print(f"{len(emails)} unique emails · sample hash: {emails[0]} -> {hashed[0][:16]}…" if emails else "no emails found")
    if not a.push:
        print(f"\nDRY RUN. Re-run with --push (and META_ACCESS_TOKEN + META_AD_ACCOUNT_ID set) to create + upload.")
        return

    acct = ad_account(); tok = token()
    aud = post(f"{acct}/customaudiences", {
        "name": a.name, "subtype": "CUSTOM", "customer_file_source": "USER_PROVIDED_ONLY",
        "description": f"Wave list ({len(emails)} contacts) — uploaded via meta_audience.py",
        "access_token": tok})
    aid = aud.get("id"); print(f"created Custom Audience id={aid}")
    BATCH = 10000
    for i in range(0, len(hashed), BATCH):
        chunk = hashed[i:i+BATCH]
        post(f"{aid}/users", {"payload": json.dumps({"schema": ["EMAIL"], "data": [[h] for h in chunk]}),
                              "access_token": tok})
        print(f"  uploaded {min(i+BATCH, len(hashed))}/{len(hashed)}")
    print(f"DONE. Audience '{a.name}' ({aid}) populated. Match rate populates in Ads Manager over ~30–60 min.")

if __name__ == "__main__":
    main()
