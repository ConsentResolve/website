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

def upload_video(url, t):
    """Meta fetches the video from a public URL (our R2 reels) — no local download."""
    return post(f"{acct()}/advideos", {"file_url": url, "access_token": t}).get("id")
def wait_video(vid, t, timeout=300):
    import time as _t; waited = 0
    while waited < timeout:
        q = urllib.parse.urlencode({"access_token": t, "fields": "status"})
        try: d = json.load(urllib.request.urlopen(f"{GRAPH}/{vid}?{q}", timeout=30))
        except urllib.error.HTTPError: return False
        st = ((d.get("status") or {}).get("video_status")) or ""
        if st == "ready": return True
        if st == "error": return False
        _t.sleep(8); waited += 8
    return False
def video_thumb(vid, t):
    q = urllib.parse.urlencode({"access_token": t, "fields": "thumbnails{uri,is_preferred}"})
    try: d = json.load(urllib.request.urlopen(f"{GRAPH}/{vid}?{q}", timeout=30))
    except urllib.error.HTTPError: return None
    thumbs = ((d.get("thumbnails") or {}).get("data")) or []
    pref = next((x for x in thumbs if x.get("is_preferred")), thumbs[0] if thumbs else None)
    return pref.get("uri") if pref else None

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--audience-id", required=True)
    ap.add_argument("--name", required=True)
    ap.add_argument("--budget", type=float, default=20.0, help="daily budget USD")
    ap.add_argument("--images", nargs="*", default=[], help="static image ad creatives")
    ap.add_argument("--videos", nargs="*", default=[], help="video ad creatives (reel R2 URLs)")
    ap.add_argument("--campaign-id", help="reuse an existing campaign instead of creating a new one")
    ap.add_argument("--adset-id", help="reuse an existing ad set instead of creating a new one")
    ap.add_argument("--push", action="store_true")
    a = ap.parse_args()
    print(f"Campaign 'Retarget · {a.name}' · audience {a.audience_id} · ${a.budget}/day · {len(a.images)} image ads:")
    for im in a.images: print("   -", im)
    if not a.push:
        print("\nDRY RUN. Re-run with --push (+ META_ACCESS_TOKEN/AD_ACCOUNT_ID/PAGE_ID set) to create it all PAUSED.")
        return
    t = tok()
    if a.campaign_id:
        cid = a.campaign_id; print("reusing campaign", cid)
    else:
        camp = post(f"{acct()}/campaigns", {"name": f"Retarget · {a.name}", "objective": "OUTCOME_TRAFFIC",
            "status": "PAUSED", "special_ad_categories": json.dumps([]),
            "is_adset_budget_sharing_enabled": "false",  # budget is set at ad-set level
            "access_token": t})
        cid = camp["id"]; print("campaign", cid)
    if a.adset_id:
        aset_id = a.adset_id; print("reusing ad set", aset_id)
    else:
        aset = post(f"{acct()}/adsets", {"name": f"{a.name} · retarget", "campaign_id": cid,
            "daily_budget": int(a.budget * 100), "billing_event": "IMPRESSIONS", "optimization_goal": "LINK_CLICKS",
            "bid_strategy": "LOWEST_COST_WITHOUT_CAP",
            "targeting": json.dumps({"geo_locations": {"countries": ["US"]}, "custom_audiences": [{"id": a.audience_id}],
                                     "targeting_automation": {"advantage_audience": 0}}),
            "status": "PAUSED", "access_token": t})
        aset_id = aset["id"]; print("ad set", aset_id)
    for im in a.images:
        h = upload_image(im, t)
        cr = post(f"{acct()}/adcreatives", {"name": Path(im).stem,
            "object_story_spec": json.dumps({"page_id": page(), "link_data": {
                "image_hash": h, "link": LINK, "message": PRIMARY, "name": HEADLINE,
                "call_to_action": {"type": "LEARN_MORE", "value": {"link": LINK}}}}),
            "access_token": t})
        ad = post(f"{acct()}/ads", {"name": Path(im).stem, "adset_id": aset_id,
            "creative": json.dumps({"creative_id": cr["id"]}), "status": "PAUSED", "access_token": t})
        print("  ad", ad["id"], "<-", Path(im).name)
    vmade = 0
    for vurl in a.videos:
        nm = vurl.split("/")[-1].replace(".mp4", "")
        vid = upload_video(vurl, t); print("video uploaded:", vid, "<-", nm, "(processing…)")
        if not wait_video(vid, t): print(f"  {nm}: video not ready in time — skipping"); continue
        spec = {"page_id": page(), "video_data": {"video_id": vid, "message": PRIMARY, "title": HEADLINE,
                "call_to_action": {"type": "LEARN_MORE", "value": {"link": LINK}}}}
        th = video_thumb(vid, t)
        if th: spec["video_data"]["image_url"] = th
        cr = post(f"{acct()}/adcreatives", {"name": f"reel-{nm}", "object_story_spec": json.dumps(spec), "access_token": t})
        ad = post(f"{acct()}/ads", {"name": f"reel-{nm}", "adset_id": aset_id,
            "creative": json.dumps({"creative_id": cr["id"]}), "status": "PAUSED", "access_token": t})
        print("  video ad", ad["id"], "<-", nm); vmade += 1
    print(f"DONE — {len(a.images)} image ads + {vmade} video ads created PAUSED. Review in Ads Manager, then activate.")

if __name__ == "__main__":
    main()
