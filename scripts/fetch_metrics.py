#!/usr/bin/env python3
"""Pull engagement and write social/metrics.json to R2 for the dashboard.

BACKFILL MODE (default): query each platform's recent posts DIRECTLY — Facebook
Page videos, Instagram media (reels), YouTube uploads, and TikTok (via Buffer's
GraphQL post metrics, since TikTok's own API has no view endpoint for us) — so ALL
views count, including manual posts and ones made before delivery-logging existed.
Matches each post back to a reel name by caption when possible. (X is skipped — no
usable view API.) Creds from /tmp (same as the posters). Best-effort per call."""
import json, os, re, subprocess, urllib.request, urllib.parse, urllib.error, datetime
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
        try:  # core (proven) — views + likes; never bundle unknown fields here or a bad one 400s the lot
            d = get(f"{GRAPH}/{vid}?fields=views,likes.summary(true)&access_token={q}")
            views = d.get("views"); likes = (d.get("likes", {}).get("summary", {}) or {}).get("total_count")
            if views is None:  # Reels often need video_insights instead of the views field
                ins = get(f"{GRAPH}/{vid}/video_insights?metric=total_video_views&access_token={q}")
                views = (ins.get("data") or [{}])[0].get("values", [{}])[0].get("value")
        except Exception as e: print(f"fb views {vid}:", e)
        # Rich signals — each in its own best-effort call so an unsupported field (e.g.
        # `shares` on Reels) only loses itself, never the core views/likes.
        try:
            dc = get(f"{GRAPH}/{vid}?fields=comments.summary(true)&access_token={q}")
            comments = (dc.get("comments", {}).get("summary", {}) or {}).get("total_count")
        except Exception: pass
        try:
            ds = get(f"{GRAPH}/{vid}?fields=shares&access_token={q}")
            shares = (ds.get("shares") or {}).get("count")
        except Exception: pass
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
        d = get(f"{GRAPH}/{IG}/media?fields=id,caption,permalink,media_type,media_product_type,like_count,comments_count&limit=50&access_token={urllib.parse.quote(FBTOK)}")
        data = d.get("data", [])
        types = {}
        for m in data:
            k = (m.get("media_product_type") or "?") + "/" + (m.get("media_type") or "?")
            types[k] = types.get(k, 0) + 1
        print(f"ig media: {len(data)} items, types {types}")  # diagnostic — see what IG returns
        if data:  # one-time: show exactly what Instagram returns for the first reel's insights
            try:
                ins = get(f"{GRAPH}/{data[0]['id']}/insights?metric=reach,views,saved,shares&access_token={urllib.parse.quote(FBTOK)}")
                print("ig insights sample:", json.dumps(ins)[:400])
            except urllib.error.HTTPError as e:
                print("ig insights ERROR:", e.code, e.read().decode("utf-8", "replace")[:300])
            except Exception as e:
                print("ig insights err:", str(e)[:200])
        for m in data:
            if m.get("media_product_type") == "STORY": continue   # stories expire; not a creative test
            is_video = m.get("media_type") == "VIDEO"             # REELS + feed videos are media_type VIDEO
            # denom: reach works for images + video; reels also expose views/plays
            views = None
            for metric in (("views", "reach") if is_video else ("reach",)):  # 'plays' deprecated by Meta
                try:
                    ins = get(f"{GRAPH}/{m['id']}/insights?metric={metric}&access_token={urllib.parse.quote(FBTOK)}")
                    views = (ins.get("data") or [{}])[0].get("values", [{}])[0].get("value")
                    if views is not None: break
                except Exception: continue
            ri = ig_insights(m["id"], "reach,saved,shares" + (",ig_reels_avg_watch_time" if is_video else ""))
            rows.append({
                "name": match(m.get("caption")), "platform": "ig", "isVideo": is_video,
                "views": views, "reach": ri.get("reach"), "saved": ri.get("saved"), "shares": ri.get("shares"),
                "comments": m.get("comments_count"), "likes": m.get("like_count"),
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
    if not tok: print(f"{platform}: no BUFFER_TOKEN"); return []
    def bq(query, var=None):
        body = {"query": query}
        if var: body["variables"] = var
        req = urllib.request.Request("https://api.buffer.com", data=json.dumps(body).encode(),
            headers={"Authorization": f"Bearer {tok}", "Content-Type": "application/json"})
        return json.loads(urllib.request.urlopen(req, timeout=45).read())
    rows = []
    try:
        # 1) organization id (account.organizations is allowed; account.channels is NOT).
        orgr = bq("{ account { organizations { id } } }")
        if orgr.get("errors"): print(f"{platform} org errors:", str(orgr.get("errors"))[:200])
        org = (((orgr.get("data") or {}).get("account") or {}).get("organizations") or [{}])[0].get("id")
        if not org: print(f"{platform}: no organization"); return []
        # 2) channels via the top-level channels(input:{organizationId}) query (per docs).
        chq = '{ channels(input:{organizationId:"' + org + '"}){ id service name } }'
        cr = bq(chq)
        if cr.get("errors"): print(f"{platform} channels errors:", str(cr.get("errors"))[:200])
        chans_all = (cr.get("data") or {}).get("channels") or []
        services = [(c.get("service") or "?") for c in chans_all]
        chans = [c["id"] for c in chans_all if (c.get("service") or "").lower() == service]
        print(f"{platform}: channel_services={services} matched={len(chans)}")
        if not chans: return []
        # 3) sent posts + metrics for those channels (IDs inlined to avoid GraphQL var-type issues).
        ids = json.dumps(chans)
        Q = ('{ posts(input:{organizationId:"' + org + '", filter:{status:sent, channelIds:' + ids +
             '}}){ edges { node { text metrics { name value } } } } }')
        d = bq(Q)
        if d.get("errors"): print(f"{platform} posts errors:", str(d.get("errors"))[:200])
        edges = (((d.get("data") or {}).get("posts") or {}).get("edges")) or []
        print(f"{platform}: {len(edges)} sent posts")
        sampled = [False]
        for e in edges:
            nd = e.get("node") or {}
            mm = {}
            for m in (nd.get("metrics") or []):
                key = str(m.get("name") or m.get("type") or "").lower()
                if key: mm[key] = m.get("value")
            if mm and not sampled[0]:
                print(f"{platform} metric names: {list(mm.keys())}"); sampled[0] = True  # learn Buffer's exact names
            def pick(*ks):
                for k in ks:
                    if mm.get(k) is not None: return mm.get(k)
                return None
            rows.append({"name": match(nd.get("text")), "platform": platform,
                "views": pick("views", "impressions", "plays", "reach"),
                "likes": pick("reactions", "likes"),
                "shares": pick("shares", "reposts", "retweets"),
                "comments": pick("comments", "replies"), "url": ""})
    except Exception as e: print(f"{platform} backfill:", e)
    return rows

def tk_backfill(): return buffer_backfill("tiktok", "tk")
def li_backfill(): return buffer_backfill("linkedin", "li")

def yt_backfill():
    p = Path("/tmp/yt_token.json")
    if not p.exists(): return []
    rows = []
    try:
        t = json.loads(p.read_text().strip().lstrip("﻿"))  # tolerate BOM/whitespace from secret paste
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
                "filters": "video==" + ",".join(vid_ids), "access_token": tok}))  # comma-separated, not ;
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

def channel_stats():
    """Snapshot follower/subscriber counts per channel -> appended dated history in
    social/channel-stats.json. Powers the warm-up (growth-trajectory) grades, which
    are meaningful even when posts are below the creative distribution floor."""
    snap = {"date": datetime.date.today().isoformat()}
    if FBTOK and PAGE:
        try:
            d = get(f"{GRAPH}/{PAGE}?fields=followers_count,fan_count&access_token={urllib.parse.quote(FBTOK)}")
            snap["fb"] = d.get("followers_count") or d.get("fan_count")
        except Exception as e: print("fb followers:", e)
    if FBTOK and IG:
        try:
            d = get(f"{GRAPH}/{IG}?fields=followers_count&access_token={urllib.parse.quote(FBTOK)}")
            snap["ig"] = d.get("followers_count")
        except Exception as e: print("ig followers:", e)
    p = Path("/tmp/yt_token.json")
    if p.exists():
        try:
            t = json.loads(p.read_text().strip().lstrip("﻿"))
            data = urllib.parse.urlencode({"client_id": t["client_id"], "client_secret": t["client_secret"],
                "refresh_token": t["refresh_token"], "grant_type": "refresh_token"}).encode()
            tok = json.loads(urllib.request.urlopen(urllib.request.Request("https://oauth2.googleapis.com/token", data=data), timeout=30).read())["access_token"]
            ch = get(f"https://www.googleapis.com/youtube/v3/channels?part=statistics&mine=true&access_token={tok}")
            snap["yt"] = int(ch["items"][0]["statistics"]["subscriberCount"])
        except Exception as e: print("yt subs:", e)
    try:
        hist = get(f"{PUB}/social/channel-stats.json")
        if not isinstance(hist, list): hist = []
    except Exception: hist = []
    hist = [h for h in hist if h.get("date") != snap["date"]]  # replace today's if re-run
    hist.append(snap)
    hist = sorted(hist, key=lambda h: h.get("date", ""))[-60:]
    tmp = "/tmp/channel-stats.json"; Path(tmp).write_text(json.dumps(hist))
    subprocess.run(["/usr/bin/python3", str(ROOT / "scripts/r2_upload.py"), tmp, "social/channel-stats.json", "application/json"], check=False)
    print(f"wrote social/channel-stats.json — {snap}")

def main():
    channel_stats()
    rows = fb_backfill() + ig_backfill() + yt_backfill() + tk_backfill() + x_backfill() + li_backfill()
    rows = [r for r in rows if (r.get("views") or 0) > 0 or r.get("likes") or r.get("reach")]
    tmp = "/tmp/metrics.json"; Path(tmp).write_text(json.dumps(rows))
    subprocess.run(["/usr/bin/python3", str(ROOT / "scripts/r2_upload.py"), tmp, "social/metrics.json", "application/json"], check=False)
    tv = sum(r.get("views") or 0 for r in rows)
    print(f"wrote social/metrics.json — {len(rows)} posts, {tv:,} total views (fb/ig/yt/tk/x/li direct backfill)")

if __name__ == "__main__":
    main()
