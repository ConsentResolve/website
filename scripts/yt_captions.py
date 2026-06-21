#!/usr/bin/env python3
"""Upload a caption/transcript track to a video — indexable text = direct AEO win.
Needs force-ssl scope. Accepts SRT (we already generate SRTs for reels via add_captions_srt).
  python3 scripts/yt_captions.py <videoId> <captions.srt> ["Track name"] [lang]
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from yt_api import token, upload_media

def main():
    vid, srt = sys.argv[1], sys.argv[2]
    name = sys.argv[3] if len(sys.argv) > 3 else "English"
    lang = sys.argv[4] if len(sys.argv) > 4 else "en"
    meta = {"snippet": {"videoId": vid, "language": lang, "name": name, "isDraft": False}}
    r = upload_media(srt, "application/octet-stream",
                     {"_endpoint": "/captions", "part": "snippet", "uploadType": "multipart"},
                     token(), extra_meta=meta)
    print("caption uploaded:", r.get("id"), "->", vid)

if __name__ == "__main__":
    main()
