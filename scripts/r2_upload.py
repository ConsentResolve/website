#!/usr/bin/env python3
"""Upload a file to Cloudflare R2 (S3-compatible) with pure-Python SigV4 — no
boto3/aws-cli needed. Returns the public r2.dev URL. Creds in /tmp/r2.json.
Usage: python3 scripts/r2_upload.py <local_file> [object_key]
"""
import sys, json, hashlib, hmac, datetime, urllib.request, urllib.error
from pathlib import Path

C = json.load(open("/tmp/r2.json"))
HOST = f"{C['account_id']}.r2.cloudflarestorage.com"
REGION, SERVICE = "auto", "s3"

def _sign(key, msg): return hmac.new(key, msg.encode(), hashlib.sha256).digest()

def upload(path, key, ctype="video/mp4"):
    body = Path(path).read_bytes()
    now = datetime.datetime.utcnow()
    amzdate = now.strftime("%Y%m%dT%H%M%SZ"); datestamp = now.strftime("%Y%m%d")
    phash = hashlib.sha256(body).hexdigest()
    uri = f"/{C['bucket']}/{key}"
    canon_headers = f"host:{HOST}\nx-amz-content-sha256:{phash}\nx-amz-date:{amzdate}\n"
    signed = "host;x-amz-content-sha256;x-amz-date"
    canon_req = f"PUT\n{uri}\n\n{canon_headers}\n{signed}\n{phash}"
    scope = f"{datestamp}/{REGION}/{SERVICE}/aws4_request"
    sts = f"AWS4-HMAC-SHA256\n{amzdate}\n{scope}\n{hashlib.sha256(canon_req.encode()).hexdigest()}"
    k = _sign(("AWS4" + C["secret_key"]).encode(), datestamp)
    k = _sign(k, REGION); k = _sign(k, SERVICE); k = _sign(k, "aws4_request")
    sig = hmac.new(k, sts.encode(), hashlib.sha256).hexdigest()
    auth = f"AWS4-HMAC-SHA256 Credential={C['access_key']}/{scope}, SignedHeaders={signed}, Signature={sig}"
    req = urllib.request.Request(f"https://{HOST}{uri}", data=body, method="PUT", headers={
        "Authorization": auth, "x-amz-content-sha256": phash, "x-amz-date": amzdate,
        "Content-Type": ctype, "Content-Length": str(len(body))})
    try:
        r = urllib.request.urlopen(req, timeout=300)
        pub = f"{C['public_base']}/{key}"
        print(f"uploaded {len(body)/1e6:.1f} MB -> HTTP {r.status}\n{pub}")
        return pub
    except urllib.error.HTTPError as e:
        print("UPLOAD err:", e.code, e.read().decode()[:500]); return None

if __name__ == "__main__":
    path = sys.argv[1]
    key = sys.argv[2] if len(sys.argv) > 2 else Path(path).name
    ctype = sys.argv[3] if len(sys.argv) > 3 else ("image/png" if key.lower().endswith(".png") else "video/mp4")
    upload(path, key, ctype)
