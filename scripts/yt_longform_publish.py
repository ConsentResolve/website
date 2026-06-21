#!/usr/bin/env python3
"""Publish a rendered long-form video to YouTube with full SEO/AEO metadata:
16:9 upload + captions (transcript) + custom thumbnail + add to its topic playlist.
Needs the force-ssl token. Defaults to UNLISTED so you can review before going public.

  python3 scripts/yt_longform_publish.py <slug> [public|unlisted|private]
Reads social/longform/<slug>.json + build/longform/<slug>/{final.mp4,captions.srt,thumb.png}
"""
import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pathlib import Path
from yt_api import token, api, upload_media
ROOT = Path(__file__).resolve().parent.parent

def main():
    slug = sys.argv[1]
    privacy = sys.argv[2] if len(sys.argv) > 2 else "unlisted"
    pkg = json.loads((ROOT / f"social/longform/{slug}.json").read_text())
    work = ROOT / "build/longform" / slug
    final = work / "final.mp4"
    if not final.exists(): sys.exit(f"no render at {final} — run yt_longform_render.py first")
    tok = token()

    # 1) upload the 16:9 video with SEO metadata (category 22 = People & Blogs)
    snippet = {"title": pkg["title"][:100], "description": pkg["description"],
               "tags": pkg.get("tags", [])[:15], "categoryId": "22"}
    r = upload_media(str(final), "video/mp4",
                     {"_endpoint": "/videos", "part": "snippet,status", "uploadType": "multipart"}, tok,
                     extra_meta={"snippet": snippet, "status": {"privacyStatus": privacy, "selfDeclaredMadeForKids": False}})
    vid = r["id"]; print("uploaded:", f"https://www.youtube.com/watch?v={vid}", f"({privacy})")

    # 2) captions / transcript (AEO)
    srt = work / "captions.srt"
    if srt.exists():
        upload_media(str(srt), "application/octet-stream",
                     {"_endpoint": "/captions", "part": "snippet", "uploadType": "multipart"}, tok,
                     extra_meta={"snippet": {"videoId": vid, "language": "en", "name": "English", "isDraft": False}})
        print("  + captions uploaded")

    # 3) custom thumbnail
    thumb = work / "thumb.png"
    if thumb.exists():
        upload_media(str(thumb), "image/png",
                     {"_endpoint": "/thumbnails/set", "videoId": vid, "uploadType": "media"}, tok)
        print("  + thumbnail set")

    # 4) add to its topic playlist
    want = pkg.get("playlist", "")
    pls = api("GET", "/playlists", tok, {"part": "snippet", "mine": "true", "maxResults": 50}).get("items", [])
    pid = next((p["id"] for p in pls if p["snippet"]["title"] == want), None)
    if pid:
        api("POST", "/playlistItems", tok, {"part": "snippet"},
            {"snippet": {"playlistId": pid, "resourceId": {"kind": "youtube#video", "videoId": vid}}})
        print(f"  + added to playlist: {want}")
    else:
        print(f"  ! playlist '{want}' not found — skipped")

    print(f"\ndone -> https://www.youtube.com/watch?v={vid}")

if __name__ == "__main__":
    main()
