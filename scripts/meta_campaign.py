#!/usr/bin/env python3
"""Full Meta retargeting campaign via Marketing API: campaign -> ad set (targeting
a Custom Audience) -> image creatives -> ads, all created PAUSED for review.
One command per wave (pair with meta_audience.py which makes the audience).

Auth/config (env or /tmp files; NEVER paste in chat):
  META_ACCESS_TOKEN     System User token w/ ads_management
  META_AD_ACCOUNT_ID    act_...
  META_PAGE_ID          the Facebook Page the ads run from (required for ads)

Usage (dry-run first, then --push):
  python3 scripts/meta_campaign.py --audience-id <AUD_ID> --name "HVAC TX 2026" \
      --budget 20 --images build/retarget-ads/hvac_math_meta-square_1080x1080.png \
                            build/retarget-ads/hvac_hook_meta-square_1080x1080.png

Untested against the live API until you --push; if Meta rejects a field it prints
the error and we fix it (same as the Instantly build). Images only for now —
reels (video) upload is a separate flow we can add next.
"""
import argparse, json, os, sys, urllib.request, urllib.parse, urllib.error, uuid
from pathlib import Path

GRAPH = "https://graph.facebook.com/v21.0"
LINK = "https://consentresolve.com/demo?utm_source=retarget_meta&utm_medium=paid_social&utm_campaign=hvac_2026"
PRIMARY = "Stop renting HVAC leads. Recover the ~98% who leave your site — as $7 exclusive, consent-first leads. Real name, email, what they need. 2-minute demo 👇"
HEADLINE = "Exclusive HVAC leads — $7 each"

def _env(n, f):
    v = os.environ.get(n, "").strip()
    if not v and Path(f).exists(): v = Path(f).read_text().strip()
    return v
def tok():
    t = _env("META_ACCESS_TOKEN", "/tmp/meta_token.txt")
    if not t: sys.exit("set META_ACCESS_TOKEN or /tmp/meta_token.txt")
    return t
def acct():
    a = _env("META_AD_ACCOUNT_ID", "/tmp/meta_ad_account.txt")
    if not a: sys.exit("set META_AD_ACCOUNT_ID or /tmp/meta_ad_account.txt")
    return a if a.startswith("act_") else f"act_{a}"
def page():
    p = _env("META_PAGE_ID", "/tmp/meta_page_id.txt")
    if not p: sys.exit("set META_PAGE_ID or /tmp/meta_page_id.txt (the FB Page ads run from)")
    return p
def post(path, params):
    req = urllib.request.Request(f"{GRAPH}/{path}", data=urllib.parse.urlencode(params).encode(), method="POST")
    try: return json.loads(urllib.request.urlopen(req, timeout=90).read())
    except urllib.error.HTTPError as e: sys.exit(f"Meta POST {path} -> {e.code}: {e.read().decode()[:400]}")
def upload_image(path, t):
    b = "----m" + uuid.uuid4().hex; fn = Path(path).name
    body = (f"--{b}\r\nContent-Disposition: form-data; name=\"access_token\"\r\n\r\n{t}\r\n".encode()
            + f"--{b}\r\nContent-Disposition: form-data; name=\"filename\"; filename=\"{fn}\"\r\nContent-Type: image/png\r\n\r\n".encode()
            + Path(path).read_bytes() + f"\r\n--{b}--\r\n".encode())
    req = urllib.request.Request(f"{GRAPH}/{acct()}/adimages", data=body, method="POST",
        headers={"Content-Type": f"multipart/form-data; boundary={b}"})
    try: r = json.loads(urllib.request.urlopen(req, timeout=120).read())
    except urllib.error.HTTPError as e: sys.exit(f"adimages -> {e.code}: {e.read().decode()[:300]}")
    img = (r.get("images") or {}).get(fn) or next(iter((r.get("images") or {}).values()), {})
    return img.get("hash")

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--audience-id", required=True)
    ap.add_argument("--name", required=True)
    ap.add_argument("--budget", type=float, default=20.0, help="daily budget USD")
    ap.add_argument("--images", nargs="+", required=True)
    ap.add_argument("--push", action="store_true")
    a = ap.parse_args()
    print(f"Campaign 'Retarget · {a.name}' · audience {a.audience_id} · ${a.budget}/day · {len(a.images)} image ads:")
    for im in a.images: print("   -", im)
    if not a.push:
        print("\nDRY RUN. Re-run with --push (+ META_ACCESS_TOKEN/AD_ACCOUNT_ID/PAGE_ID set) to create it all PAUSED.")
        return
    t = tok()
    camp = post(f"{acct()}/campaigns", {"name": f"Retarget · {a.name}", "objective": "OUTCOME_TRAFFIC",
        "status": "PAUSED", "special_ad_categories": json.dumps([]), "access_token": t})
    print("campaign", camp["id"])
    aset = post(f"{acct()}/adsets", {"name": f"{a.name} · retarget", "campaign_id": camp["id"],
        "daily_budget": int(a.budget * 100), "billing_event": "IMPRESSIONS", "optimization_goal": "LINK_CLICKS",
        "bid_strategy": "LOWEST_COST_WITHOUT_CAP",
        "targeting": json.dumps({"geo_locations": {"countries": ["US"]}, "custom_audiences": [{"id": a.audience_id}]}),
        "status": "PAUSED", "access_token": t})
    print("ad set", aset["id"])
    for im in a.images:
        h = upload_image(im, t)
        cr = post(f"{acct()}/adcreatives", {"name": Path(im).stem,
            "object_story_spec": json.dumps({"page_id": page(), "link_data": {
                "image_hash": h, "link": LINK, "message": PRIMARY, "name": HEADLINE,
                "call_to_action": {"type": "LEARN_MORE", "value": {"link": LINK}}}}),
            "access_token": t})
        ad = post(f"{acct()}/ads", {"name": Path(im).stem, "adset_id": aset["id"],
            "creative": json.dumps({"creative_id": cr["id"]}), "status": "PAUSED", "access_token": t})
        print("  ad", ad["id"], "<-", Path(im).name)
    print(f"DONE — campaign + ad set + {len(a.images)} ads created PAUSED. Review in Ads Manager, then activate.")

if __name__ == "__main__":
    main()
