#!/usr/bin/env python3
"""Shared helpers for the '$2,000 Lead Disaster' 3-style MVP: HeyGen VO, Recraft
(by style_id, with SVG->PNG rasterize), PIL cutout + scene compositing, ffmpeg."""
import os, json, time, datetime, subprocess, urllib.request, urllib.error
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
DA = ROOT / "disaster"
VO, ART, ASSETS, SCENES, OUT = DA/"vo", DA/"art", DA/"assets", DA/"scenes", DA/"out"
for d in (VO, ART, ASSETS, SCENES, OUT): d.mkdir(parents=True, exist_ok=True)
FF, FP = "/opt/homebrew/bin/ffmpeg", "/opt/homebrew/bin/ffprobe"
W, H, FPS = 1920, 1080, 30
HANKEN = str(ROOT / "scripts/.fonts/Hanken.ttf")
HEYGEN_KEY = open("/tmp/heygen_key.txt").read().strip() if os.path.exists("/tmp/heygen_key.txt") else ""
RECRAFT_KEY = (Path.home()/".config/recraft/key").read_text().strip()
# B&W comic palette; green ONLY on positive beats
BG = (244, 244, 242); INK = (16, 22, 28); NAVY = (10, 22, 40); GREEN = (0, 200, 140)
def font(s): return ImageFont.truetype(HANKEN, s)
def log(m):
    ts = datetime.datetime.now().strftime("%H:%M:%S"); line = f"- `{ts}` {m}"
    print(line, flush=True)
    with open(DA/"RUNLOG.md", "a") as f: f.write(line + "\n")
def dur(f): return float(subprocess.check_output([FP,"-v","error","-show_entries","format=duration","-of","csv=p=0",str(f)]).strip())

# ── Recraft (style_id; rasterize SVG via qlmanage) ───────────────────────────
def recraft(prompt, out_png, style_id, size="1024x1024", retries=1):
    body = {"model": "recraftv3", "size": size, "response_format": "url", "style_id": style_id, "prompt": prompt[:1000]}
    for a in range(retries+1):
        try:
            req = urllib.request.Request("https://external.api.recraft.ai/v1/images/generations",
                data=json.dumps(body).encode(), headers={"Authorization": f"Bearer {RECRAFT_KEY}", "Content-Type": "application/json"})
            url = (json.loads(urllib.request.urlopen(req, timeout=300).read()).get("data") or [{}])[0].get("url")
            if not url: raise RuntimeError("no url")
            raw = urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "cr/1.0"}), timeout=120).read()
            if raw[:5] == b"<?xml" or raw[:4] == b"<svg":      # vector style -> rasterize
                svg = str(out_png) + ".svg"; Path(svg).write_bytes(raw)
                subprocess.run(["qlmanage", "-t", "-s", "1024", "-o", str(Path(out_png).parent), svg],
                               check=False, capture_output=True)
                ql = Path(svg + ".png")
                if ql.exists(): ql.replace(out_png)
                else: raise RuntimeError("svg rasterize failed")
            else:
                Path(out_png).write_bytes(raw)
            return True
        except Exception as e:
            log(f"recraft FAIL({a}) {Path(out_png).name}: {str(e)[:120]}"); time.sleep(4)
    return False

def cut(in_png, out_png, thresh=64):
    """Flood-fill a near-uniform corner background to transparent (works for white/light bg)."""
    im = Image.open(in_png).convert("RGB"); w, h = im.size; key = (255, 0, 255)
    for seed in [(2, 2), (w-3, 2), (2, h-3), (w-3, h-3)]:
        try: ImageDraw.floodfill(im, seed, key, thresh=thresh)
        except Exception: pass
    im = im.convert("RGBA"); px = im.load()
    for y in range(h):
        for x in range(w):
            if px[x, y][:3] == key: px[x, y] = (0, 0, 0, 0)
    im.save(out_png)

# ── HeyGen TTS (audio only) ──────────────────────────────────────────────────
_LOOK = "b8cf5419ad5247d38bb000fd0df239a6"
def _hg(url, body=None):
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(url, data=data, headers={"X-Api-Key": HEYGEN_KEY, "Content-Type": "application/json"})
    try: return json.load(urllib.request.urlopen(req, timeout=180))
    except urllib.error.HTTPError as e: return {"error": e.read().decode()[:200]}
def tts(voice_id, text, out_wav, speed=1.0, retries=1):
    for a in range(retries+1):
        r = _hg("https://api.heygen.com/v2/video/generate", {"caption": False, "video_inputs": [{
            "character": {"type": "talking_photo", "talking_photo_id": _LOOK, "use_avatar_iv_model": True},
            "voice": {"type": "text", "voice_id": voice_id, "input_text": text, "speed": speed}}],
            "dimension": {"width": 720, "height": 1280}})
        vid = (r.get("data") or {}).get("video_id")
        if not vid: log(f"tts submit FAIL {Path(out_wav).name}: {str(r)[:100]}"); time.sleep(5); continue
        for _ in range(90):
            d = (_hg(f"https://api.heygen.com/v1/video_status.get?video_id={vid}").get("data") or {})
            if d.get("status") == "completed":
                mp4 = str(out_wav)+".src.mp4"; urllib.request.urlretrieve(d["video_url"], mp4)
                subprocess.run([FF,"-y","-loglevel","error","-i",mp4,"-vn","-ar","44100","-ac","2",out_wav], check=True)
                os.remove(mp4); return True
            if d.get("status") == "failed": break
            time.sleep(8)
    return False
