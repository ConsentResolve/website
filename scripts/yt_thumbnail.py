#!/usr/bin/env python3
"""Set a custom thumbnail on a video (CTR -> ranking). Needs force-ssl scope +
a verified channel. Image: JPG/PNG, <=2MB, 1280x720 recommended.
  python3 scripts/yt_thumbnail.py <videoId> <image.png>
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from yt_api import token, upload_media

def main():
    vid, img = sys.argv[1], sys.argv[2]
    ctype = "image/png" if img.lower().endswith(".png") else "image/jpeg"
    r = upload_media(img, ctype,
                     {"_endpoint": "/thumbnails/set", "videoId": vid, "uploadType": "media"},
                     token())
    url = (r.get("items", [{}])[0].get("default", {}) or {}).get("url", "")
    print("thumbnail set on", vid, url)

if __name__ == "__main__":
    main()
