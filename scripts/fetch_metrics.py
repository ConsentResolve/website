#!/usr/bin/env python3
"""Pull engagement and write social/metrics.json to R2 for the dashboard.

BACKFILL MODE (default): query each platform's recent posts DIRECTLY — Facebook
Page videos, Instagram media (reels), YouTube uploads, and TikTok (via Buffer's
GraphQL post metrics, since TikTok's own API has no view endpoint for us) — so ALL
views count, including manual posts and ones made before delivery-logging existed.
Matches each post back to a reel name by caption when possible. (X is skipped — no
usable view API.) Creds from /tmp (same as the posters). Best-effort per call."""
import json, os, re, subprocess, urllib.request, urllib.parse, datetime
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
PUB = "https://pub-27fc71b9070247178d8756a59bef0b33.r2.dev"
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124 Safari/537.36"
GRAPH = "https://graph.facebook.com/v21.0"
def _read(p): return open(p).read().strip() if os.path.exists(p) else ""
FBTOK, PAGE, IG = _read("/tmp/fb_page_token.txt"), _read("/tmp/fb_page_id.txt"), _read("/tmp/cr_ig_id.txt")

def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    return json.loads(urllib.request.urlopen(req, timeout=45).read())

# caption-snippet -> reel name, so platform posts map back to our reels
def norm(s): return re.sub(r"[^a-z0-9]", "", (s or "").lower())[:40]
NAMEMAP = {}
try:
    for items in json.loads((ROOT / "social/schedule.json").read_text()).values():
        for it in items:
            NAMEMAP[norm(it.get("caption", ""))] = it.get("name", "")
except Exception: pass
def match(desc):
    k = norm(desc)
    return NAMEMAP.get(k) or next((v for nk, v in NAMEMAP.items() if nk and (nk[:24] in k or k[:24] in nk)), "") or (desc or "")[:32]

def fb_backfill():
    if not (FBTOK and PAGE): return []
    q = urllib.parse.quote(FBTOK); seen = {}
    for edge in ("video_reels", "videos"):  # Reels live on a separate edge from regular videos
        try:
            d = get(f"{GRAPH}/{PAGE}/{edge}?fields=id,description,permalink_url&limit=50&access_token={q}")
            for v in d.get("data", []):
                seen.setdefault(v["id"], (v.get("description", ""), v.get("permalink_url", "")))
        except Exception as e: print(f"fb {edge}:", e)
    rows = []
    for vid, (desc, url) in seen.items():
        views = likes = comments = shares = reach = None
        try:
            d = get(f"{GRAPH}/{vid}?fields=views,likes.summary(true),comments.summary(true),shares&access_token={q}")
            views = d.get("views"); likes = (d.get("likes", {}).get("summary", {}) or {}).get("total_count")
            comments = (d.get("comments", {}).get("summary", {}) or {}).get("total_count")
            shares = (d.get("shares") or {}).get("count")
            if views is None:  # Reels often need video_insights instead of the views field
                ins = get(f"{GRAPH}/{vid}/video_insights?metric=total_video_views&access_token={q}")
                views = (ins.get("data") or [{}])[0].get("values", [{}])[0].get("value")
        except Exception as e: print(f"fb views {vid}:", e)
        # Reach (proper denom) — try the post-reach insight; falls back to views in the scorer.
        try:
            ri = get(f"{GRAPH}/{vid}/video_insights?metric=post_impressions_unique&access_token={q}")
            reach = (ri.get("data") or [{}])[0].get("values", [{}])[0].get("value")
        except Exception: pass
        rows.append({"name": match(desc), "platform": "fb", "views": views, "likes": likes,
                     "comments": comments, "shares": shares, "reach": reach, "url": url})
    return rows

def ig_insights(mid, metrics):
    """One insights call -> {metric_name: value}. Best-effort; missing metrics omitted."""
    out = {}
    try:
        ins = get(f"{GRAPH}/{mid}/insights?metric={metrics}&access_token={urllib.parse.quote(FBTOK)}")
        for it in ins.get("data", []):
            out[it.get("name")] = (it.get("values") or [{}])[0].get("value")
    except Exception:
        pass
    return out

def ig_backfill():
    if not (FBTOK and IG): return []
    rows = []
    try:
        d = get(f"{GRAPH}/{IG}/media?fields=id,caption,permalink,media_product_type,like_count,comments_count&limit=40&access_token={urllib.parse.quote(FBTOK)}")
        for m in d.get("data", []):
            if m.get("media_product_type") not in ("REELS", "VIDEO"): continue
            views = None
            for metric in ("views", "plays", "reach"):  # Meta renamed reel "plays" -> "views"; reach is the last-resort fallback
                try:
                    ins = get(f"{GRAPH}/{m['id']}/insights?metric={metric}&access_token={urllib.parse.quote(FBTOK)}")
                    views = (ins.get("data") or [{}])[0].get("values", [{}])[0].get("value")
                    if views is not None: break
                except Exception: continue
            # Rich scoring signals (highest-weight first): reach (denom), saved, shares.
            # ig_reels_avg_watch_time enables hold rate. reelsSkipRatePct = newest metric
            # (Apr 2026) — confirm the exact key against a live response; left out until then.
            ri = ig_insights(m["id"], "reach,saved,shares,ig_reels_avg_watch_time")
            rows.append({
                "name": match(m.get("caption")), "platform": "ig",
                "views": views, "likes": m.get("like_count"), "comments": m.get("comments_count"),
                "reach": ri.get("reach"), "saved": ri.get("saved"), "shares": ri.get("shares"),
                "igReelsAvgWatchTimeMs": ri.get("ig_reels_avg_watch_time"),
                "url": m.get("permalink", ""),
            })
    except Exception as e: print("ig backfill:", e)
    return rows

def buffer_backfill(service, platform):
    """Per-post views/engagement for a Buffer-managed channel (TikTok, LinkedIn) via
    Buffer's GraphQL — Buffer surfaces metrics the platform's own API doesn't give us.
    views<-Views|Impressions, likes<-Reactions|Likes. Token from /tmp/buffer_token.txt."""
    tok = _read("/tmp/buffer_token.txt") or os.environ.get("BUFFER_TOKEN", "")
    if not tok: return []
    def bq(query, var=None):
        body = {"query": query}
        if var: body["variables"] = var
        req = urllib.request.Request("https://api.buffer.com", data=json.dumps(body).encode(),
            headers={"Authorization": f"Bearer {tok}", "Content-Type": "application/json"})
        return json.loads(urllib.request.urlopen(req, timeout=45).read())
    rows = []
    try:
        acc = (bq("{ account { organizations { id } channels { id service } } }").get("data") or {}).get("account") or {}
        org = ((acc.get("organizations") or [{}])[0]).get("id")
        chans = [c["id"] for c in (acc.get("channels") or []) if (c.get("service") or "").lower() == service]
        if not (org and chans): return []
        Q = ("query($in:PostsInput!,$f:Int){ posts(input:$in, first:$f){ edges { node { "
             "status text metrics { name value } } } } }")
        d = bq(Q, {"in": {"organizationId": org, "filter": {"channelIds": chans}}, "f": 100})
        for e in (((d.get("data") or {}).get("posts") or {}).get("edges")) or []:
            nd = e.get("node") or {}
            if nd.get("status") != "sent": continue
            mm = {m["name"]: m["value"] for m in (nd.get("metrics") or [])}
            views = mm.get("Views") if mm.get("Views") is not None else mm.get("Impressions")
            likes = mm.get("Reactions") if mm.get("Reactions") is not None else mm.get("Likes")
            rows.append({"name": match(nd.get("text")), "platform": platform, "views": views, "likes": likes, "url": ""})
    except Exception as e: print(f"{platform} backfill:", e)
    return rows

def tk_backfill(): return buffer_backfill("tiktok", "tk")
def li_backfill(): return buffer_backfill("linkedin", "li")

def yt_backfill():
    p = Path("/tmp/yt_token.json")
    if not p.exists(): return []
    rows = []
    try:
        t = json.loads(p.read_text())
        data = urllib.parse.urlencode({"client_id": t["client_id"], "client_secret": t["client_secret"],
            "refresh_token": t["refresh_token"], "grant_type": "refresh_token"}).encode()
        tok = json.loads(urllib.request.urlopen(urllib.request.Request("https://oauth2.googleapis.com/token", data=data), timeout=30).read())["access_token"]
        ch = get(f"https://www.googleapis.com/youtube/v3/channels?part=contentDetails&mine=true&access_token={tok}")
        up = ch["items"][0]["contentDetails"]["relatedPlaylists"]["uploads"]
        pl = get(f"https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&maxResults=40&playlistId={up}&access_token={tok}")
        vid_ids = [i["contentDetails"]["videoId"] for i in pl.get("items", [])]
        ids = ",".join(vid_ids)
        # Rich signals come from the YouTube *Analytics* API (separate from Data API
        # statistics): averageViewPercentage (hold rate) + shares, one query keyed by video.
        analytics = {}
        try:
            today = datetime.date.today().isoformat()
            ar = get("https://youtubeanalytics.googleapis.com/v2/reports?" + urllib.parse.urlencode({
                "ids": "channel==MINE", "startDate": "2020-01-01", "endDate": today,
                "metrics": "averageViewPercentage,shares", "dimensions": "video",
                "filters": "video==" + ";".join(vid_ids), "access_token": tok}))
            cols = [c["name"] for c in ar.get("columnHeaders", [])]
            for row in ar.get("rows", []):
                rec = dict(zip(cols, row))
                analytics[rec.get("video")] = rec
        except Exception as e: print("yt analytics:", e)
        if ids:
            vd = get(f"https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id={ids}&access_token={tok}")
            for v in vd.get("items", []):
                s = v.get("statistics", {}); a = analytics.get(v["id"], {})
                rows.append({"name": match(v["snippet"].get("title")), "platform": "yt",
                             "views": int(s.get("viewCount", 0)) or None, "likes": int(s["likeCount"]) if "likeCount" in s else None,
                             "comments": int(s["commentCount"]) if "commentCount" in s else None,
                             "shares": a.get("shares"), "averageViewPercentage": a.get("averageViewPercentage"),
                             "url": f"https://www.youtube.com/shorts/{v['id']}"})
    except Exception as e: print("yt backfill:", e)
    return rows

def x_backfill():
    """X tweet impressions/likes via our own worker endpoint (it holds the X token in
    D1 and reads public_metrics off the tweets we posted). Keeps token use server-side
    on the 6h cadence rather than on every dashboard load."""
    key = os.environ.get("ANALYTICS_KEY") or "fixme"
    try:
        d = get(f"https://consentresolve.com/api/x-metrics?key={urllib.parse.quote(key)}")
        return d.get("rows") or []
    except Exception as e:
        print("x backfill:", e); return []

def main():
    rows = fb_backfill() + ig_backfill() + yt_backfill() + tk_backfill() + x_backfill() + li_backfill()
    rows = [r for r in rows if (r.get("views") or 0) > 0 or r.get("likes")]
    tmp = "/tmp/metrics.json"; Path(tmp).write_text(json.dumps(rows))
    subprocess.run(["/usr/bin/python3", str(ROOT / "scripts/r2_upload.py"), tmp, "social/metrics.json", "application/json"], check=False)
    tv = sum(r.get("views") or 0 for r in rows)
    print(f"wrote social/metrics.json — {len(rows)} posts, {tv:,} total views (fb/ig/yt/tk/x/li direct backfill)")

if __name__ == "__main__":
    main()
