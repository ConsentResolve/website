#!/usr/bin/env python3
"""Generate word-level "karaoke" caption JSON for the trade-page videos.

For each public/video/*-intro.mp4 and *-resume.mp4: extract audio, transcribe with
ElevenLabs Scribe (word timings), group into short karaoke lines, and write
public/captions/<name>.lines.json  (same shape the /industries hero uses).

Idempotent: skips a video whose JSON already exists unless --force. Run:
  /usr/bin/python3 scripts/gen_captions.py [--force] [slug ...]
"""
import json, subprocess, sys, tempfile, os, glob
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from cr_secrets import secret

ROOT = Path(__file__).resolve().parent.parent
FF = "/opt/homebrew/bin/ffmpeg"
KEY = secret("elevenlabs")
VIDEO_DIR = ROOT / "public/video"
OUT_DIR = ROOT / "public/captions"
OUT_DIR.mkdir(parents=True, exist_ok=True)

force = "--force" in sys.argv
only = [a for a in sys.argv[1:] if not a.startswith("--")]

def stt(mp4: Path):
    with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as f:
        audio = f.name
    try:
        subprocess.run([FF, "-y", "-loglevel", "error", "-i", str(mp4), "-vn", "-ac", "1",
                        "-ar", "16000", "-acodec", "libmp3lame", "-q:a", "4", audio], check=True)
        out = subprocess.run(["curl", "-s", "-X", "POST",
                              "https://api.elevenlabs.io/v1/speech-to-text",
                              "-H", f"xi-api-key: {KEY}", "-F", "model_id=scribe_v1",
                              "-F", f"file=@{audio}"], capture_output=True, text=True, timeout=180)
    finally:
        os.unlink(audio)
    return json.loads(out.stdout)

def lines_from(words):
    lines, cur = [], []
    for w in words:
        cur.append(w)
        dur = cur[-1]["end"] - cur[0]["start"]
        ends = w["text"].rstrip()[-1:] in ".!?"
        if (ends and len(cur) >= 2) or len(cur) >= 6 or dur >= 2.6:
            lines.append(cur); cur = []
    if cur:
        lines.append(cur)
    out = []
    for c in lines:
        out.append({"start": round(c[0]["start"], 3), "end": round(c[-1]["end"] + 0.15, 3),
                    "words": [{"w": w["text"], "s": round(w["start"], 3), "e": round(w["end"], 3)} for w in c]})
    return out

vids = sorted(glob.glob(str(VIDEO_DIR / "*-intro.mp4")) + glob.glob(str(VIDEO_DIR / "*-resume.mp4")))
if only:
    vids = [v for v in vids if any(o in Path(v).name for o in only)]

done = skipped = failed = 0
for v in vids:
    name = Path(v).stem  # e.g. hvac-intro
    out_path = OUT_DIR / f"{name}.lines.json"
    if out_path.exists() and not force:
        skipped += 1; print(f"skip  {name} (exists)", flush=True); continue
    try:
        d = stt(Path(v))
        words = [w for w in d.get("words", []) if w.get("type") == "word"]
        if not words:
            print(f"WARN  {name}: no words ({json.dumps(d)[:100]})", flush=True); failed += 1; continue
        json.dump(lines_from(words), open(out_path, "w"))
        done += 1; print(f"ok    {name}: {len(words)} words -> {out_path.name}", flush=True)
    except Exception as e:
        failed += 1; print(f"FAIL  {name}: {str(e)[:120]}", flush=True)

print(f"\ndone={done} skipped={skipped} failed={failed} / {len(vids)} videos", flush=True)
