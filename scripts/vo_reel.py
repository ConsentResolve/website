#!/usr/bin/env python3
"""Voice-over non-UGC reel: the locked brand_reel.py visual story, narrated in a
matched avatar (cloned) voice instead of music-only.

Pipeline:
  1. per-scene Heartbeat-v2 narration (one line per brand_reel beat)
  2. HeyGen generates a clip in the angle's cloned voice; we keep only the audio
  3. each scene duration = its narration length + gap -> DURS for brand_reel
  4. narration segments are padded to scene length and concatenated -> VO track
  5. brand_reel renders the animated scenes to DURS and muxes VO over a ducked
     instrumental bed

Usage:  ANGLE=leak python3 scripts/vo_reel.py
Output: public/reels/reel-<angle>-vo.mp4   (+ social/nonugc/<angle>.mp4 on upload)
"""
import json, os, re, subprocess, time, urllib.request, urllib.error
from pathlib import Path

ROOT = Path("/Users/aaronphillips/GIT/consentresolve2")
TMP = ROOT / "build/vo"; FF = "/opt/homebrew/bin/ffmpeg"; FP = "/opt/homebrew/bin/ffprobe"
KEY = open("/tmp/heygen_key.txt").read().strip()
GAP = 0.35
BED = "assets/audio/cr-music/no-vocals/inst-fp1.mp3"   # quiet instrumental bed under the VO

# matched cloned voice + its look (look is required by talking_photo even though
# we discard the video and keep only the audio).
VOICES = {
    "jason": ("26e04090a6124f48b27623c888c6996b", "0e671a523e3d4cd7b6d5c580de70931e"),
    "tyler": ("7a317560c0d54461a38666bc965cac72", "0c76e4a9be91456da07c3c9e1160db1e"),
    "aaron": ("b5dc5a22eb684b959e36d2c0a1834461", "f365d990e89f4c55810722ef4788b85b"),
}

_KEYS = ["hook", "agitate", "vanish", "reveal", "deliver", "offer", "cta"]

# Narration per beat. Heartbeat-v2: dry contractor-peer, no exclamation, email
# (never phone), $7 / exclusive / consent-first, "the big lead sites", /demo.
SCRIPTS = {
    "leak": {"voice": "jason", "emotion": {"hook": "Serious", "reveal": "Friendly", "offer": "Friendly", "cta": "Friendly"}, "lines": {
        "hook": "Ninety-eight out of a hundred people who hit your site just leave.",
        "agitate": "And you paid for every one of those clicks.",
        "vanish": "No name. Nothing to follow up on.",
        "reveal": "We hand those visitors back as real, consent-first leads.",
        "deliver": "A real name, a real email, and what they came looking for.",
        "offer": "Seven bucks a lead. Exclusive, never resold.",
        "cta": "Watch it work on your own site, at consentresolve.com/demo."}},
    "ftc": {"voice": "tyler", "emotion": {"hook": "Serious", "vanish": "Serious", "reveal": "Friendly", "cta": "Friendly"}, "lines": {
        "hook": "The biggest lead site in the country got fined seven point two million dollars.",
        "agitate": "For lying about lead quality.",
        "vanish": "Suddenly all those garbage leads made sense.",
        "reveal": "So I stopped buying them, and started recovering my own traffic.",
        "deliver": "A real name, a real email, and what they wanted.",
        "offer": "Seven dollars each. Exclusive, never resold.",
        "cta": "See how it works at consentresolve.com/demo."}},
    "ownership": {"voice": "aaron", "emotion": {"hook": "Serious", "vanish": "Serious", "reveal": "Friendly", "cta": "Friendly"}, "lines": {
        "hook": "Your whole pipeline lives in someone else's dashboard.",
        "agitate": "Their rules. Their prices.",
        "vanish": "One policy change, and it's gone.",
        "reveal": "Your website is the one pipe you actually own.",
        "deliver": "Every visitor handed back with a name, an email, and intent.",
        "offer": "Seven dollars a lead. Exclusive, consent-first.",
        "cta": "Build your pipeline, not theirs. Consentresolve.com/demo."}},
}

PRONOUNCE = {r"consentresolve\.com/demo": "consent resolve dot com slash demo",
             r"\bleads\b": "leeds", r"\blead\b": "leed"}
def spoken(t):
    for rx, rep in PRONOUNCE.items(): t = re.sub(rx, rep, t, flags=re.I)
    return t

def api(url, body=None):
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(url, data=data, headers={"X-Api-Key": KEY, "Content-Type": "application/json"})
    try: return json.load(urllib.request.urlopen(req, timeout=120))
    except urllib.error.HTTPError as e: return {"error": json.loads(e.read().decode())}

def gen_audio(look, voice, text, emotion, out):
    body = {"caption": False, "video_inputs": [{
        "character": {"type": "talking_photo", "talking_photo_id": look, "use_avatar_iv_model": True},
        "voice": {"type": "text", "voice_id": voice, "input_text": spoken(text), "speed": 1.04, "emotion": emotion}}],
        "dimension": {"width": 720, "height": 1280}}
    r = api("https://api.heygen.com/v2/video/generate", body)
    vid = (r.get("data") or {}).get("video_id")
    if not vid: raise SystemExit(f"submit failed: {r}")
    for _ in range(60):
        d = (api(f"https://api.heygen.com/v1/video_status.get?video_id={vid}").get("data") or {})
        if d.get("status") == "completed":
            mp4 = str(out) + ".src.mp4"; urllib.request.urlretrieve(d["video_url"], mp4)
            subprocess.run([FF, "-y", "-loglevel", "error", "-i", mp4, "-vn", "-ar", "44100", "-ac", "2", out], check=True)
            return
        if d.get("status") == "failed": raise SystemExit("render failed")
        time.sleep(10)
    raise SystemExit("render timeout")

def dur(f):
    return float(subprocess.check_output([FP, "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).strip())

def main():
    angle = os.environ.get("ANGLE", "leak")
    if angle not in SCRIPTS: raise SystemExit(f"no VO script for '{angle}' (have {list(SCRIPTS)})")
    spec = SCRIPTS[angle]; look, voice = VOICES[spec["voice"]]
    d = TMP / angle; d.mkdir(parents=True, exist_ok=True)
    durs, padded = {}, []
    for k in _KEYS:
        wav = str(d / f"{k}.wav")
        if not (os.path.exists(wav) and os.path.getsize(wav) > 2000):
            gen_audio(look, voice, spec["lines"][k], spec["emotion"].get(k, "Friendly"), wav)
        sd = round(dur(wav) + GAP, 2); durs[k] = sd
        pad = str(d / f"{k}.pad.wav")
        subprocess.run([FF, "-y", "-loglevel", "error", "-i", wav, "-af", f"apad=whole_dur={sd}",
                        "-ar", "44100", "-ac", "2", pad], check=True)
        padded.append(pad); print(f"  {k}: {sd}s ({spec['voice']})", flush=True)
    # concat VO track
    lst = d / "vo_list.txt"; lst.write_text("".join(f"file '{os.path.abspath(p)}'\n" for p in padded))
    vo = str(d / "vo.m4a")
    subprocess.run([FF, "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", str(lst),
                    "-c:a", "aac", "-b:a", "160k", vo], check=True)
    # render the animated story to these durations, mux VO + ducked bed
    env = dict(os.environ, ANGLE=angle, DURS=json.dumps(durs), VO=vo, MUSIC=BED,
               OUTNAME=f"reel-{angle}-vo")
    subprocess.run(["/usr/bin/python3", "scripts/brand_reel.py"], cwd=ROOT, env=env, check=True)
    print(f"VO reel -> public/reels/reel-{angle}-vo.mp4  (total {round(sum(durs.values()),2)}s)")

if __name__ == "__main__":
    main()
