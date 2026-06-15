#!/usr/bin/env python3
"""Post Consent Resolve photo cards / carousels / stories natively to the Facebook
Page via the Graph API (byte upload — no Buffer). Reads page id/token from
/tmp/fb_page_id.txt and /tmp/fb_page_token.txt (same creds as post_video.py).

Photos are uploaded as multipart bytes (not by URL) to avoid the (#200) error the
URL-photo endpoint can throw on Pages. The outbound link goes in the FIRST COMMENT
(not the post body) so the native post isn't reach-throttled.

Usage:
  python3 scripts/post_fb_card.py photo    <image> "<caption>" [--link URL] [--dry-run]
  python3 scripts/post_fb_card.py carousel "<caption>" <img1> <img2> ... [--link URL] [--dry-run]
  python3 scripts/post_fb_card.py story    <image> [--dry-run]
<image> = local path or https URL (e.g. an R2 social-cards/*.png).
"""
import sys, os, io, json, urllib.request, urllib.parse, urllib.error
from pathlib import Path

GRAPH = "https://graph.facebook.com/v21.0"
def _read(p): return open(p).read().strip() if os.path.exists(p) else ""
PID = _read("/tmp/fb_page_id.txt")
TOK = _read("/tmp/fb_page_token.txt")

def fetch(ref):
    if ref.startswith("http"):
        return urllib.request.urlopen(ref, timeout=90).read()
    return Path(ref).read_bytes()

def _form(url, fields):
    req = urllib.request.Request(url, data=urllib.parse.urlencode(fields).encode())
    try: return json.load(urllib.request.urlopen(req, timeout=120))
    except urllib.error.HTTPError as e: return {"_err": json.loads(e.read().decode())}

def _multipart(url, fields, file_field, file_bytes, filename="card.png"):
    boundary = "----crcard" + os.urandom(8).hex(); body = io.BytesIO()
    for k, v in fields.items():
        body.write(f"--{boundary}\r\nContent-Disposition: form-data; name=\"{k}\"\r\n\r\n{v}\r\n".encode())
    body.write(f"--{boundary}\r\nContent-Disposition: form-data; name=\"{file_field}\"; filename=\"{filename}\"\r\nContent-Type: image/png\r\n\r\n".encode())
    body.write(file_bytes); body.write(f"\r\n--{boundary}--\r\n".encode())
    req = urllib.request.Request(url, data=body.getvalue(), headers={"Content-Type": f"multipart/form-data; boundary={boundary}"})
    try: return json.load(urllib.request.urlopen(req, timeout=180))
    except urllib.error.HTTPError as e: return {"_err": json.loads(e.read().decode())}

def upload_photo(ref, published, message=None):
    """Upload one photo. published=False leaves it unpublished (for carousels/stories)."""
    fields = {"access_token": TOK, "published": "true" if published else "false"}
    if not published: fields["temporary"] = "false"
    if message is not None: fields["message"] = message
    return _multipart(f"{GRAPH}/{PID}/photos", fields, "source", fetch(ref))

def comment_link(post_id, link):
    return _form(f"{GRAPH}/{post_id}/comments", {"access_token": TOK, "message": link})

def post_photo(ref, caption, link, dry):
    if dry: print(f"[dry] FB photo · {ref}\n      caption: {caption}\n      link-in-comment: {link or '—'}"); return {"dry": True}
    r = upload_photo(ref, True, caption)
    if r.get("_err"): print("photo err:", r["_err"]); return r
    pid = r.get("post_id") or r.get("id"); print("posted:", pid)
    if link and pid: print("comment:", comment_link(pid, link))
    return r

def post_carousel(caption, refs, link, dry):
    if dry: print(f"[dry] FB carousel ({len(refs)}) · {refs}\n      caption: {caption}\n      link-in-comment: {link or '—'}"); return {"dry": True}
    ids = []
    for r in refs:
        u = upload_photo(r, False)
        if u.get("_err"): print("child err:", u["_err"]); return u
        ids.append(u["id"])
    fields = {"access_token": TOK, "message": caption}
    for i, pid in enumerate(ids): fields[f"attached_media[{i}]"] = json.dumps({"media_fbid": pid})
    res = _form(f"{GRAPH}/{PID}/feed", fields)
    if res.get("_err"): print("feed err:", res["_err"]); return res
    post_id = res.get("id"); print("posted carousel:", post_id)
    if link and post_id: print("comment:", comment_link(post_id, link))
    return res

def post_story(ref, dry):
    if dry: print(f"[dry] FB story · {ref}"); return {"dry": True}
    u = upload_photo(ref, False)
    if u.get("_err"): print("upload err:", u["_err"]); return u
    res = _form(f"{GRAPH}/{PID}/photo_stories", {"access_token": TOK, "photo_id": u["id"]})
    print("story:", res); return res

if __name__ == "__main__":
    a = sys.argv[1:]
    dry = "--dry-run" in a; a = [x for x in a if x != "--dry-run"]
    link = None
    if "--link" in a: i = a.index("--link"); link = a[i + 1]; del a[i:i + 2]
    kind = a[0]
    if kind == "photo":
        post_photo(a[1], a[2], link, dry)
    elif kind == "carousel":
        post_carousel(a[1], a[2:], link, dry)
    elif kind == "story":
        post_story(a[1], dry)
    else:
        sys.exit("kind must be photo|carousel|story")
