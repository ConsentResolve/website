#!/usr/bin/env python3
"""Make registration-perfect open-mouth twins of the Style-A panels via Recraft inpaint
(mask the mouth/jaw, prompt open mouth). Closed = original panel, open = inpaint twin →
clean 2-frame lip-flap. Mouth centers (fraction of panel) read off the contact sheet."""
import json, uuid, urllib.request, urllib.error
from pathlib import Path
from PIL import Image, ImageDraw
from da_lib import ART, cut, log
KEY = (Path.home()/".config/recraft/key").read_text().strip()
SID = "e7a2d37d-a938-4860-8fcb-a1394eb91cef"
# (x_frac, y_frac) of the mouth per panel
MOUTH = {
 "mike_confident": (0.52, 0.41), "mike_pause": (0.45, 0.36), "mike_nervous": (0.48, 0.35),
 "mike_defeated": (0.43, 0.36), "frank_coffee": (0.42, 0.35), "frank_deadpan": (0.50, 0.35),
 "frank_eyebrow": (0.50, 0.36), "frank_camera": (0.50, 0.33), "frank_approve": (0.45, 0.33),
}
RX, RY = 0.085, 0.072

def inpaint_open(key, xf, yf):
    src = ART/"A"/f"{key}.png"
    im = Image.open(src).convert("RGB"); W, H = im.size
    mask = Image.new("L", (W, H), 0); d = ImageDraw.Draw(mask)
    cx, cy, rx, ry = int(xf*W), int(yf*H), int(RX*W), int(RY*H)
    d.ellipse([cx-rx, cy-ry, cx+rx, cy+ry], fill=255)
    mask = mask.point(lambda p: 255 if p > 127 else 0)
    mpath = ART/"A"/f"_{key}_mask.png"; mask.save(mpath)
    def fld(b,n,v): return f"--{b}\r\nContent-Disposition: form-data; name=\"{n}\"\r\n\r\n{v}\r\n".encode()
    def ff(b,n,fn,data): return (f"--{b}\r\nContent-Disposition: form-data; name=\"{n}\"; filename=\"{fn}\"\r\nContent-Type: image/png\r\n\r\n").encode()+data+b"\r\n"
    b = "----rc"+uuid.uuid4().hex
    body = (fld(b,"prompt","wide open mouth mid-speech, talking, mouth open")+fld(b,"style_id",SID)+fld(b,"response_format","url")+
            ff(b,"image","i.png",open(src,"rb").read())+ff(b,"mask","m.png",open(mpath,"rb").read())+f"--{b}--\r\n".encode())
    req = urllib.request.Request("https://external.api.recraft.ai/v1/images/inpaint", data=body,
        headers={"Authorization": f"Bearer {KEY}", "Content-Type": f"multipart/form-data; boundary={b}"})
    try:
        r = json.loads(urllib.request.urlopen(req, timeout=180).read()); url = (r.get("data") or [{}])[0].get("url")
        if not url: return False
        raw = ART/"A"/f"{key}_open.png"
        raw.write_bytes(urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent":"cr/1.0"}), timeout=120).read())
        cut(str(raw), str(ART/"A"/f"{key}_open.cut.png"))
        return True
    except urllib.error.HTTPError as e:
        log(f"inpaint FAIL {key}: {e.read().decode()[:160]}"); return False

def main():
    for key, (xf, yf) in MOUTH.items():
        log(f"inpaint open-mouth: {key} {'ok' if inpaint_open(key, xf, yf) else 'FAIL'}")
    log("LIP inpaint done")

if __name__ == "__main__":
    main()
