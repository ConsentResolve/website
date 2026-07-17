#!/usr/bin/env python3
"""IndexNow — instantly notify Bing/Yandex/etc. of new/updated URLs.
Reads the live sitemap-index, collects all URLs, and submits them in one batch.
Run after each deploy (or pass specific URLs). Key file must be live at
https://consentresolve.com/<key>.txt (committed in public/).

Usage:
  python3 scripts/indexnow.py                 # submit every URL in the sitemap
  python3 scripts/indexnow.py <url> [<url>..] # submit only these URLs
"""
import sys, os, json, re, urllib.request, urllib.error

HOST = "consentresolve.com"
BASE = f"https://{HOST}"
KEY = open(os.path.join(os.path.dirname(__file__), "..", ".indexnow-key")).read().strip()
KEY_LOCATION = f"{BASE}/{KEY}.txt"

def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "CR-IndexNow/1.0"})
    return urllib.request.urlopen(req, timeout=30).read().decode("utf-8", "replace")

def sitemap_urls():
    """Walk sitemap-index -> child sitemaps -> all <loc> page URLs."""
    urls = []
    try:
        idx = fetch(f"{BASE}/sitemap-index.xml")
    except Exception as e:
        print("could not fetch sitemap-index:", e); return urls
    children = re.findall(r"<loc>\s*([^<\s]+)\s*</loc>", idx)
    # sitemap-index contains child sitemap URLs; if it's a flat sitemap, these are pages
    sitemaps = [u for u in children if u.endswith(".xml")]
    if not sitemaps:
        return [u for u in children if u.startswith("http")]
    for sm in sitemaps:
        try:
            body = fetch(sm)
            urls += [u for u in re.findall(r"<loc>\s*([^<\s]+)\s*</loc>", body) if u.startswith("http") and not u.endswith(".xml")]
        except Exception as e:
            print("skip", sm, e)
    return sorted(set(urls))

def submit(urls):
    if not urls:
        print("no URLs to submit"); return
    # IndexNow accepts up to 10,000 per request
    for i in range(0, len(urls), 10000):
        batch = urls[i:i+10000]
        payload = json.dumps({"host": HOST, "key": KEY, "keyLocation": KEY_LOCATION, "urlList": batch}).encode()
        req = urllib.request.Request("https://api.indexnow.org/indexnow", data=payload,
            headers={"Content-Type": "application/json; charset=utf-8"}, method="POST")
        try:
            r = urllib.request.urlopen(req, timeout=45)
            print(f"submitted {len(batch)} URLs -> HTTP {r.status} (202 = accepted)")
        except urllib.error.HTTPError as e:
            print(f"submitted {len(batch)} URLs -> HTTP {e.code}: {e.read().decode()[:200]}")

if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if a.startswith("http")]
    urls = args if args else sitemap_urls()
    print(f"IndexNow key {KEY[:8]}… | keyLocation {KEY_LOCATION}")
    print(f"{len(urls)} URLs")
    submit(urls)
