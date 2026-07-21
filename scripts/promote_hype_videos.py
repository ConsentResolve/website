#!/usr/bin/env python3
"""Prep the 5 finalized hype-reel videos as PAUSED Meta ads across 3 destinations.

Uploads each R2 video to the ad account ONCE (advideos via file_url), then builds a
paused video ad per (video x destination), reusing each destination's already-vetted
copy/CTA/lead-form so nothing about voice/compliance changes — only the creative swaps
to the new hype reels.

Destinations (all existing except the new one; everything created PAUSED, no spend):
  new   -> a fresh PAUSED Leads campaign (LEAD_GENERATION, instant form) — mirrors the
           paused Lead Ads ad set's targeting
  lead  -> existing paused Lead Ads ad set  120247550182860527  (instant form)
  conv  -> existing paused Conversions·Story ad set 120247931238950527 (site/LEARN_MORE)

READS are free. Uploads + ad creation only happen with --push; default is a dry-run
that prints exactly what would be created.

  META_ACCESS_TOKEN / META_AD_ACCOUNT_ID / META_PAGE_ID  (env or /tmp files)
  python3 scripts/promote_hype_videos.py            # dry-run
  python3 scripts/promote_hype_videos.py --push
"""
import argparse, json, os, sys, time, urllib.request, urllib.parse, urllib.error
from pathlib import Path

GRAPH = "https://graph.facebook.com/v21.0"
R2 = "https://pub-27fc71b9070247178d8756a59bef0b33.r2.dev/social/ugc-ads/"

def _env(n, f):
    v = os.environ.get(n, "").strip()
    if not v and Path(f).exists(): v = Path(f).read_text().strip()
    return v
TOKEN = _env("META_ACCESS_TOKEN", "/tmp/meta_token.txt")
ACCT = _env("META_AD_ACCOUNT_ID", "/tmp/meta_ad_account.txt")
PAGE = _env("META_PAGE_ID", "/tmp/meta_page_id.txt")
if not (TOKEN and ACCT and PAGE): sys.exit("need META_ACCESS_TOKEN / META_AD_ACCOUNT_ID / META_PAGE_ID")
ACCT = ACCT if ACCT.startswith("act_") else f"act_{ACCT}"

FORM_ID = "2257248851481025"       # current qualified instant form (from the live lead ads)
CONV_ADSET = "120247931238950527"  # Conversions·Story · Contact (WEBSITE / OFFSITE_CONVERSIONS)
LEAD_ADSET = "120247550182860527"  # Home Services US · leads (LEAD_GENERATION / instant form)

# Vetted, compliance-cleared copy lifted verbatim from the existing ads in each ad set.
LEAD_TITLE = "Get back the 98% who leave"
LEAD_MSG = ("You're already paying for the clicks. About 98% of the homeowners who land on your "
            "site leave without a trace. We hand the ones who opt in back to you as exclusive, "
            "consent-first leads — a real name and email, $7 each, never resold.")
CONV_TITLE = "See it work — 2-minute walkthrough"
CONV_DESC = "No form. Just tap through it."
CONV_MSG = ("You're already paying for the clicks. About 98% of the homeowners who land on your "
            "site leave without a trace. Take the 2-minute walkthrough — no form, just tap through "
            "it — and see how we hand the ones who opt in back to you.")
CONV_LINK = ("https://consentresolve.com/how-it-works/?story=1&utm_source=meta&utm_medium=paid_social"
             "&utm_campaign=conv_story_2026&utm_content=")

# slug -> short label (ad-name + utm suffix)
VIDEOS = [
    ("hype-visited-short",   "visited-short"),
    ("hype-goldmine-short",  "goldmine-short"),
    ("hype-anon-male",       "anon"),
    ("hype-visited-male",    "visited"),
    ("hype-goldmine-female", "goldmine"),
]
# Already-uploaded ad-account video ids — set to skip re-upload on a re-run (avoids
# duplicate videos in the library). Cleared = upload fresh.
VIDEO_IDS = {
    "hype-visited-short":   "1329072955610017",
    "hype-goldmine-short":  "1004014152401508",
    "hype-anon-male":       "2935756100102961",
    "hype-visited-male":    "911385798020169",
    "hype-goldmine-female": "1718872239260838",
}

def api(method, path, params):
    data = urllib.parse.urlencode(params).encode()
    url = f"{GRAPH}/{path}"
    if method == "GET":
        url += "?" + data.decode(); data = None
    req = urllib.request.Request(url, data=data, method=method)
    try:
        return json.loads(urllib.request.urlopen(req, timeout=60).read())
    except urllib.error.HTTPError as e:
        sys.exit(f"{method} {path} -> {e.code}: {e.read().decode()[:300]}")

def _thumb(vid):
    th = api("GET", f"{vid}/thumbnails", {"fields": "uri,is_preferred", "access_token": TOKEN}).get("data", [])
    return next((t["uri"] for t in th if t.get("is_preferred")), (th[0]["uri"] if th else None))

def upload_video(slug, label, push):
    url = R2 + slug + ".mp4"
    if not push:
        print(f"    [dry] would upload {url}"); return f"DRY_{label}", None
    if slug in VIDEO_IDS:  # reuse an already-uploaded video
        vid = VIDEO_IDS[slug]
        print(f"      reuse video_id {vid} ({slug})", flush=True)
        return vid, _thumb(vid)
    print(f"    uploading {slug} …", flush=True)
    r = api("POST", f"{ACCT}/advideos", {"file_url": url, "title": f"hype · {label}", "access_token": TOKEN})
    vid = r["id"]
    for _ in range(60):  # wait for processing
        st = api("GET", vid, {"fields": "status", "access_token": TOKEN}).get("status", {})
        s = st.get("video_status")
        if s == "ready": break
        if s == "error": sys.exit(f"video {vid} processing error: {st}")
        time.sleep(5)
    print(f"      -> video_id {vid}", flush=True)
    return vid, _thumb(vid)

def video_data(kind, label, video_id, thumb):
    d = {"video_id": video_id}
    if thumb: d["image_url"] = thumb
    if kind == "form":
        d.update(title=LEAD_TITLE, message=LEAD_MSG,
                 call_to_action={"type": "SIGN_UP", "value": {"lead_gen_form_id": FORM_ID}})
    else:  # link / conversions
        link = CONV_LINK + label
        d.update(title=CONV_TITLE, message=CONV_MSG, link_description=CONV_DESC,
                 call_to_action={"type": "LEARN_MORE", "value": {"link": link}})
    return d

def make_ad(adset_id, kind, tag, label, video_id, thumb, push):
    name = f"hype-{label} · {tag}"
    spec = {"page_id": PAGE, "video_data": video_data(kind, label, video_id, thumb)}
    if not push:
        print(f"    [dry] ad '{name}' -> adset {adset_id}  (CTA {'SIGN_UP/form' if kind=='form' else 'LEARN_MORE/site'})")
        return
    r = api("POST", f"{ACCT}/ads", {"name": name, "adset_id": adset_id, "status": "PAUSED",
            "creative": json.dumps({"object_story_spec": spec}), "access_token": TOKEN})
    print(f"    + ad {r['id']}  {name}")

def ensure_new_campaign(push):
    """Create a fresh PAUSED Leads campaign + ad set mirroring the paused Lead Ads targeting."""
    tgt = api("GET", LEAD_ADSET, {"fields": "targeting", "access_token": TOKEN}).get("targeting", {})
    if not push:
        print("  [dry] would create PAUSED campaign 'Hype Video · Home Services US 2026' + ad set (LEAD_GENERATION, form, $10/day, PAUSED)")
        return "DRY_ADSET"
    c = api("POST", f"{ACCT}/campaigns", {"name": "Hype Video · Home Services US 2026",
            "objective": "OUTCOME_LEADS", "status": "PAUSED", "special_ad_categories": "[]",
            "is_adset_budget_sharing_enabled": "false", "access_token": TOKEN})
    print(f"  + campaign {c['id']} (PAUSED)")
    a = api("POST", f"{ACCT}/adsets", {"name": "Hype Video · US · leads", "campaign_id": c["id"],
            "optimization_goal": "LEAD_GENERATION", "billing_event": "IMPRESSIONS",
            "bid_strategy": "LOWEST_COST_WITHOUT_CAP", "daily_budget": "1000",
            "destination_type": "ON_AD", "promoted_object": json.dumps({"page_id": PAGE}),
            "targeting": json.dumps(tgt), "status": "PAUSED", "access_token": TOKEN})
    print(f"  + ad set {a['id']} (PAUSED)")
    return a["id"]

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--push", action="store_true"); args = ap.parse_args()
    push = args.push
    print(f"{'PUSH' if push else 'DRY-RUN'} — 5 hype reels x 3 destinations = 15 PAUSED ads\n")
    print("1) upload videos")
    vids = {slug: upload_video(slug, label, push) for slug, label in VIDEOS}
    print("\n2) new PAUSED Leads campaign")
    new_adset = ensure_new_campaign(push)
    dests = [("form", new_adset, "lead-new"), ("form", LEAD_ADSET, "lead"), ("link", CONV_ADSET, "conv")]
    for kind, adset_id, tag in dests:
        print(f"\n3) ads -> {tag} (adset {adset_id})")
        for slug, label in VIDEOS:
            vid, thumb = vids[slug]
            make_ad(adset_id, kind, tag, label, vid, thumb, push)
    print("\nDONE." if push else "\nDRY-RUN complete — re-run with --push to create.")

if __name__ == "__main__":
    main()
