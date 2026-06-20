#!/usr/bin/env python3
"""Pull engagement and write social/metrics.json to R2 for the dashboard.

BACKFILL MODE (default): query each platform's recent posts DIRECTLY — Facebook
Page videos, Instagram media (reels), YouTube uploads — so ALL views count,
including manual posts and ones made before delivery-logging existed. Matches each
post back to a reel name by caption when possible. (TikTok/X have no usable view
API and are skipped.) Creds from /tmp (same as the posters). Best-effort per call."""
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
    rows = []
    try:
        d = get(f"{GRAPH}/{PAGE}/videos?fields=id,description,permalink_url,views,likes.summary(true)&limit=60&access_token={urllib.parse.quote(FBTOK)}")
        for v in d.get("data", []):
            rows.append({"name": match(v.get("description")), "platform": "fb", "views": v.get("views"),
                         "likes": (v.get("likes", {}).get("summary", {}) or {}).get("total_count"), "url": v.get("permalink_url", "")})
    except Exception as e: print("fb backfill:", e)
    return rows

def ig_backfill():
    if not (FBTOK and IG): return []
    rows = []
    try:
        d = get(f"{GRAPH}/{IG}/media?fields=id,caption,permalink,media_product_type,like_count&limit=40&access_token={urllib.parse.quote(FBTOK)}")
        for m in d.get("data", []):
            if m.get("media_product_type") not in ("REELS", "VIDEO"): continue
            views = None
            try:
                ins = get(f"{GRAPH}/{m['id']}/insights?metric=plays&access_token={urllib.parse.quote(FBTOK)}")
                views = (ins.get("data") or [{}])[0].get("values", [{}])[0].get("value")
            except Exception: pass
            rows.append({"name": match(m.get("caption")), "platform": "ig", "views": views, "likes": m.get("like_count"), "url": m.get("permalink", "")})
    except Exception as e: print("ig backfill:", e)
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

def main():
    rows = fb_backfill() + ig_backfill() + yt_backfill()
    rows = [r for r in rows if (r.get("views") or 0) > 0 or r.get("likes")]
    tmp = "/tmp/metrics.json"; Path(tmp).write_text(json.dumps(rows))
    subprocess.run(["/usr/bin/python3", str(ROOT / "scripts/r2_upload.py"), tmp, "social/metrics.json", "application/json"], check=False)
    tv = sum(r.get("views") or 0 for r in rows)
    print(f"wrote social/metrics.json — {len(rows)} posts, {tv:,} total views (fb/ig/yt direct backfill)")

if __name__ == "__main__":
    main()
