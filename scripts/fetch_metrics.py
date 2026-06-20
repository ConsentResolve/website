#!/usr/bin/env python3
"""Pull engagement and write social/metrics.json to R2 for the dashboard.

BACKFILL MODE (default): query each platform's recent posts DIRECTLY — Facebook
Page videos, Instagram media (reels), YouTube uploads, and TikTok (via Buffer's
GraphQL post metrics, since TikTok's own API has no view endpoint for us) — so ALL
views count, including manual posts and ones made before delivery-logging existed.
Matches each post back to a reel name by caption when possible. (X is skipped — no
usable view API.) Creds from /tmp (same as the posters). Best-effort per call."""
import json, os, re, subprocess, urllib.request, urllib.parse
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
        views = likes = None
        try:
            d = get(f"{GRAPH}/{vid}?fields=views,likes.summary(true)&access_token={q}")
            views = d.get("views"); likes = (d.get("likes", {}).get("summary", {}) or {}).get("total_count")
            if views is None:  # Reels often need video_insights instead of the views field
                ins = get(f"{GRAPH}/{vid}/video_insights?metric=total_video_views&access_token={q}")
                views = (ins.get("data") or [{}])[0].get("values", [{}])[0].get("value")
        except Exception as e: print(f"fb views {vid}:", e)
        rows.append({"name": match(desc), "platform": "fb", "views": views, "likes": likes, "url": url})
    return rows

def ig_backfill():
    if not (FBTOK and IG): return []
    rows = []
    try:
        d = get(f"{GRAPH}/{IG}/media?fields=id,caption,permalink,media_product_type,like_count&limit=40&access_token={urllib.parse.quote(FBTOK)}")
        for m in d.get("data", []):
            if m.get("media_product_type") not in ("REELS", "VIDEO"): continue
            views = None
            for metric in ("views", "plays", "reach"):  # Meta renamed reel "plays" -> "views"; reach is the last-resort fallback
                try:
                    ins = get(f"{GRAPH}/{m['id']}/insights?metric={metric}&access_token={urllib.parse.quote(FBTOK)}")
                    views = (ins.get("data") or [{}])[0].get("values", [{}])[0].get("value")
                    if views is not None: break
                except Exception: continue
            rows.append({"name": match(m.get("caption")), "platform": "ig", "views": views, "likes": m.get("like_count"), "url": m.get("permalink", "")})
    except Exception as e: print("ig backfill:", e)
    return rows

def tk_backfill():
    """TikTok views/engagement via Buffer's GraphQL (api.buffer.com) — Buffer surfaces
    per-post Views/Reach/Reactions for the connected TikTok channel, which TikTok's own
    API does not expose to us. Token from /tmp/buffer_token.txt (same as the poster)."""
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
        chans = [c["id"] for c in (acc.get("channels") or []) if (c.get("service") or "").lower() == "tiktok"]
        if not (org and chans): return []
        Q = ("query($in:PostsInput!,$f:Int){ posts(input:$in, first:$f){ edges { node { "
             "status text metrics { name value } } } } }")
        d = bq(Q, {"in": {"organizationId": org, "filter": {"channelIds": chans}}, "f": 100})
        for e in (((d.get("data") or {}).get("posts") or {}).get("edges")) or []:
            nd = e.get("node") or {}
            if nd.get("status") != "sent": continue
            mm = {m["name"]: m["value"] for m in (nd.get("metrics") or [])}
            rows.append({"name": match(nd.get("text")), "platform": "tk",
                         "views": mm.get("Views"), "likes": mm.get("Reactions"),
                         "url": ""})
    except Exception as e: print("tk backfill:", e)
    return rows

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
        ids = ",".join(i["contentDetails"]["videoId"] for i in pl.get("items", []))
        if ids:
            vd = get(f"https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id={ids}&access_token={tok}")
            for v in vd.get("items", []):
                s = v.get("statistics", {})
                rows.append({"name": match(v["snippet"].get("title")), "platform": "yt",
                             "views": int(s.get("viewCount", 0)) or None, "likes": int(s["likeCount"]) if "likeCount" in s else None,
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
    rows = fb_backfill() + ig_backfill() + yt_backfill() + tk_backfill() + x_backfill()
    rows = [r for r in rows if (r.get("views") or 0) > 0 or r.get("likes")]
    tmp = "/tmp/metrics.json"; Path(tmp).write_text(json.dumps(rows))
    subprocess.run(["/usr/bin/python3", str(ROOT / "scripts/r2_upload.py"), tmp, "social/metrics.json", "application/json"], check=False)
    tv = sum(r.get("views") or 0 for r in rows)
    print(f"wrote social/metrics.json — {len(rows)} posts, {tv:,} total views (fb/ig/yt/tk/x direct backfill)")

if __name__ == "__main__":
    main()
