#!/usr/bin/env python3
"""Shared helpers for the Mafia Marketing overnight build: paths, run log, Recraft
image gen, HeyGen TTS, ffmpeg/ffprobe. Every step imports from here."""
import os, json, time, datetime, subprocess, urllib.request, urllib.error
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MAF = ROOT / "mafia"
ART, VO, SCENES, OUT, SHORTS, SFX = MAF/"art", MAF/"vo", MAF/"scenes", MAF/"out", MAF/"shorts", MAF/"sfx"
for d in (ART, VO, SCENES, OUT, SHORTS, SFX): d.mkdir(parents=True, exist_ok=True)
FF, FP = "/opt/homebrew/bin/ffmpeg", "/opt/homebrew/bin/ffprobe"
RUNLOG = MAF / "RUNLOG.md"

HEYGEN_KEY = open("/tmp/heygen_key.txt").read().strip()
RECRAFT_KEY = (Path.home()/".config/recraft/key").read_text().strip()

# Global style suffix appended to EVERY image prompt (locks the look).
STYLE = ("mid-century UPA cartoon, flat colors, limited palette, thick bold ink outlines, "
         "grainy litho paper texture, Jay Ward 1960s TV animation, larger-than-life mob "
         "caricature, simple geometric shapes, clean vector-like shading, retro halftone")

def log(msg):
    ts = datetime.datetime.now().strftime("%H:%M:%S")
    line = f"- `{ts}` {msg}"
    print(line, flush=True)
    with open(RUNLOG, "a") as f: f.write(line + "\n")

# ── Recraft ──────────────────────────────────────────────────────────────────
def recraft(prompt, out_png, size="1820x1024", style="digital_illustration", substyle="2d_art_poster", retries=1):
    """Generate one image and save to out_png. Returns True/False. Logs + retries once."""
    body = {"model": "recraftv3", "size": size, "response_format": "url",
            "style": style, "prompt": prompt[:1000]}
    if substyle: body["substyle"] = substyle
    for attempt in range(retries + 1):
        try:
            req = urllib.request.Request("https://external.api.recraft.ai/v1/images/generations",
                data=json.dumps(body).encode(),
                headers={"Authorization": f"Bearer {RECRAFT_KEY}", "Content-Type": "application/json"})
            payload = json.loads(urllib.request.urlopen(req, timeout=300).read())
            url = (payload.get("data") or [{}])[0].get("url")
            if not url: raise RuntimeError(f"no url: {str(payload)[:160]}")
            dl = urllib.request.Request(url, headers={"User-Agent": "mafia/1.0"})
            Path(out_png).write_bytes(urllib.request.urlopen(dl, timeout=180).read())
            return True
        except Exception as e:
            log(f"recraft FAIL ({attempt}) {Path(out_png).name}: {str(e)[:140]}")
            time.sleep(4)
    return False

# ── HeyGen TTS (audio-only via talking_photo; video discarded) ────────────────
_LOOK = "b8cf5419ad5247d38bb000fd0df239a6"   # arbitrary look; we keep only the audio
def _hg(url, body=None):
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(url, data=data, headers={"X-Api-Key": HEYGEN_KEY, "Content-Type": "application/json"})
    try: return json.load(urllib.request.urlopen(req, timeout=180))
    except urllib.error.HTTPError as e: return {"error": e.read().decode()[:200]}

def heygen_tts(voice_id, text, out_wav, speed=1.0, retries=1):
    for attempt in range(retries + 1):
        r = _hg("https://api.heygen.com/v2/video/generate", {"caption": False, "video_inputs": [{
            "character": {"type": "talking_photo", "talking_photo_id": _LOOK, "use_avatar_iv_model": True},
            "voice": {"type": "text", "voice_id": voice_id, "input_text": text, "speed": speed}}],
            "dimension": {"width": 720, "height": 1280}})
        vid = (r.get("data") or {}).get("video_id")
        if not vid: log(f"tts submit FAIL ({attempt}) {Path(out_wav).name}: {str(r)[:120]}"); time.sleep(5); continue
        for _ in range(90):
            d = (_hg(f"https://api.heygen.com/v1/video_status.get?video_id={vid}").get("data") or {})
            if d.get("status") == "completed":
                mp4 = str(out_wav) + ".src.mp4"; urllib.request.urlretrieve(d["video_url"], mp4)
                subprocess.run([FF, "-y", "-loglevel", "error", "-i", mp4, "-vn", "-ar", "44100", "-ac", "2", out_wav], check=True)
                os.remove(mp4); return True
            if d.get("status") == "failed": log(f"tts render FAIL ({attempt}) {Path(out_wav).name}"); break
            time.sleep(8)
    return False

def dur(f):
    return float(subprocess.check_output([FP, "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(f)]).strip())

def script():
    return json.loads((MAF/"script.json").read_text())
