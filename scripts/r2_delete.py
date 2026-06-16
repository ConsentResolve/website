#!/usr/bin/env python3
"""Delete an object from Cloudflare R2 (S3-compatible) with pure-Python SigV4.
Usage: python3 scripts/r2_delete.py <object_key>
Creds in /tmp/r2.json. Prints HTTP status (204 = deleted, 404 = already gone)."""
import sys, json, hashlib, hmac, datetime, urllib.request, urllib.error

C = json.load(open("/tmp/r2.json"))
HOST = f"{C['account_id']}.r2.cloudflarestorage.com"
REGION, SERVICE = "auto", "s3"

def _sign(key, msg): return hmac.new(key, msg.encode(), hashlib.sha256).digest()

def delete(key):
    now = datetime.datetime.utcnow()
    amzdate = now.strftime("%Y%m%dT%H%M%SZ"); datestamp = now.strftime("%Y%m%d")
    phash = hashlib.sha256(b"").hexdigest()
    uri = f"/{C['bucket']}/{key}"
    canon_headers = f"host:{HOST}\nx-amz-content-sha256:{phash}\nx-amz-date:{amzdate}\n"
    signed = "host;x-amz-content-sha256;x-amz-date"
    canon_req = f"DELETE\n{uri}\n\n{canon_headers}\n{signed}\n{phash}"
    scope = f"{datestamp}/{REGION}/{SERVICE}/aws4_request"
    sts = f"AWS4-HMAC-SHA256\n{amzdate}\n{scope}\n{hashlib.sha256(canon_req.encode()).hexdigest()}"
    k = _sign(("AWS4" + C["secret_key"]).encode(), datestamp)
    k = _sign(k, REGION); k = _sign(k, SERVICE); k = _sign(k, "aws4_request")
    sig = hmac.new(k, sts.encode(), hashlib.sha256).hexdigest()
    auth = f"AWS4-HMAC-SHA256 Credential={C['access_key']}/{scope}, SignedHeaders={signed}, Signature={sig}"
    req = urllib.request.Request(f"https://{HOST}{uri}", method="DELETE", headers={
        "Authorization": auth, "x-amz-content-sha256": phash, "x-amz-date": amzdate})
    try:
        r = urllib.request.urlopen(req, timeout=60)
        print(f"deleted {key} -> HTTP {r.status}"); return True
    except urllib.error.HTTPError as e:
        print(f"DELETE err {key}: {e.code} {e.read().decode()[:200]}"); return e.code == 404

if __name__ == "__main__":
    delete(sys.argv[1])
