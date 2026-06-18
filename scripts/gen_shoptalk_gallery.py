#!/usr/bin/env python3
"""RETIRED. The SHOP TALK with AA-Ron reels now live in the /sprint showcase
(see gen_sprint_gallery.py). This writes /shop-talk as a redirect to /sprint so
any saved links still resolve. (Full review-gallery code is in git history.)"""
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
HTML = ('<!doctype html><html lang="en"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1">'
        '<meta name="robots" content="noindex,nofollow">'
        '<meta http-equiv="refresh" content="0; url=/sprint">'
        '<link rel="canonical" href="/sprint"><title>Moved to /sprint</title>'
        '<script>location.replace("/sprint")</script></head>'
        '<body style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:#0a1628;color:#f5f8fa;text-align:center;padding:64px 24px">'
        '<p>This review page has moved.</p><p><a href="/sprint" style="color:#00e5a0;font-weight:700">Continue to /sprint →</a></p>'
        '</body></html>')
(ROOT / "public/shop-talk.html").write_text(HTML)
print("wrote public/shop-talk.html — redirect to /sprint (retired)")
