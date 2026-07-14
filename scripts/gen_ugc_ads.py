#!/usr/bin/env python3
"""Render the 6 non-employee UGC Facebook ads (3 scripts x male/female).

HeyGen can't resolve raw ElevenLabs voice ids, so the VO is generated on the
ElevenLabs side and HeyGen animates the avatar OVER that audio:
  1. ElevenLabs /with-timestamps  -> mp3 + per-character alignment
  2. build a word-level SRT from the alignment (deterministic captions)
  3. upload the mp3 to HeyGen as an audio asset
  4. HeyGen v2/video/generate: character (Avatar IV) + voice{type:audio,asset}
  5. download the clean 9:16 clip, burn karaoke captions from our SRT

Keys: HeyGen = Keychain cr-heygen (fallback /tmp/heygen_key.txt); ElevenLabs =
Keychain cr-elevenlabs. Finished reels -> build/ugc-ads/<slug>.mp4, then uploaded
to R2 social/ugc-ads/ by the caller. Run in background (~3-5 min per clip).

  python3 scripts/gen_ugc_ads.py            # all 6
  python3 scripts/gen_ugc_ads.py math       # one script, both genders
"""
import os, sys, json, time, subprocess, urllib.request, urllib.error
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BUILD = ROOT / "build/ugc-ads"; BUILD.mkdir(parents=True, exist_ok=True)
FF = "/opt/homebrew/bin/ffmpeg"

def _kc(service):
    try:
        v = subprocess.run(["security", "find-generic-password", "-s", service, "-a", "cr", "-w"],
                           capture_output=True, text=True).stdout.strip()
        return v or None
    except Exception:
        return None
HG_KEY = _kc("cr-heygen") or (open("/tmp/heygen_key.txt").read().strip() if os.path.exists("/tmp/heygen_key.txt") else "")
EL_KEY = _kc("cr-elevenlabs")

PERSONAS = {
    "male":   {"avatar": "6730bfaabcff4ae7b1f3a084d02d7220", "voice": "D0xsoUB4EcwwTOZBXZcr"},
    "female": {"avatar": "4539ede585ef4bc9acaf5507cc0caca5", "voice": "m6aupUpGjuUWqecgDcBm"},
}
# Compliance-cleared: illustrative / spokesperson, no fabricated first-person results, consent-first accurate.
SCRIPTS = {
    "math": ("Say four hundred people visit your website in a month. Maybe eleven call. "
             "So who were the other three eighty-nine? The ones who tapped accept on your "
             "cookie banner gave you permission to reach out. Consent Resolve turns those "
             "into contacts you can actually follow up with. One line of code, about three "
             "minutes to set up. Tap the link and see who you're missing."),
    "banner": ("You know that cookie banner on your website? Every time a homeowner clicks "
               "accept, they're giving you permission to reach out. That's not a visitor "
               "anymore. That's a lead. Consent-based, compliant, and already sitting on "
               "your site. Tap the link and try it on yours."),
    "shared": ("Paying eighty-plus bucks for a lead they sold to four other plumbers too? "
               "With Consent Resolve, the leads come off your own website. Exclusive. "
               "Consent-based. Up in about three minutes. Tap the link and see it on your own site."),
}

def el_tts(voice_id, text, mp3_path, srt_path):
    """ElevenLabs TTS with char timestamps -> mp3 + word-level SRT."""
    import base64
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}/with-timestamps"
    body = json.dumps({"text": text, "model_id": "eleven_multilingual_v2",
                       "voice_settings": {"stability": 0.5, "similarity_boost": 0.75, "style": 0.0}}).encode()
    req = urllib.request.Request(url, data=body, headers={"xi-api-key": EL_KEY, "Content-Type": "application/json"})
    d = json.load(urllib.request.urlopen(req, timeout=120))
    Path(mp3_path).write_bytes(base64.b64decode(d["audio_base64"]))
    al = d.get("alignment") or d.get("normalized_alignment") or {}
    chars = al.get("characters", []); starts = al.get("character_start_times_seconds", []); ends = al.get("character_end_times_seconds", [])
    # group chars into words, then words into ~4-word caption lines
    words, cur, cs = [], "", None
    for i, ch in enumerate(chars):
        if cs is None: cs = starts[i]
        if ch == " ":
            if cur.strip(): words.append((cur, cs, ends[i - 1] if i else starts[i])); cur, cs = "", None
        else:
            cur += ch
    if cur.strip(): words.append((cur, cs if cs is not None else 0.0, ends[-1] if ends else 0.0))
    def ts(t):
        h = int(t // 3600); m = int((t % 3600) // 60); s = t % 60
        return f"{h:02d}:{m:02d}:{s:06.3f}".replace(".", ",")
    lines, n = [], 0
    for i in range(0, len(words), 4):
        grp = words[i:i + 4]
        if not grp: continue
        n += 1
        lines.append(f"{n}\n{ts(grp[0][1])} --> {ts(grp[-1][2])}\n{' '.join(w[0] for w in grp)}\n")
    Path(srt_path).write_text("\n".join(lines))
    return len(words)

def hg_upload_audio(mp3_path):
    data = Path(mp3_path).read_bytes()
    req = urllib.request.Request("https://upload.heygen.com/v1/asset", data=data,
                                 headers={"X-Api-Key": HG_KEY, "Content-Type": "audio/mpeg"})
    r = json.load(urllib.request.urlopen(req, timeout=120))
    dd = r.get("data") or {}
    return dd.get("id") or dd.get("asset_id") or dd.get("audio_asset_id")

def hg_api(url, body=None):
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(url, data=data, headers={"X-Api-Key": HG_KEY, "Content-Type": "application/json"})
    try: return json.load(urllib.request.urlopen(req, timeout=120))
    except urllib.error.HTTPError as e: return {"error": e.read().decode()[:240]}

def hg_render(avatar_id, audio_asset_id, out_mp4):
    """Try talking_photo (Avatar IV) then avatar; voice = uploaded audio. Returns raw mp4 path or None."""
    for ctype in ("talking_photo", "avatar"):
        char = {"type": ctype, ("talking_photo_id" if ctype == "talking_photo" else "avatar_id"): avatar_id,
                "use_avatar_iv_model": True, "talking_style": "expressive", "super_resolution": True}
        if ctype == "avatar": char["avatar_style"] = "normal"
        body = {"caption": False, "video_inputs": [{"character": char,
                "voice": {"type": "audio", "audio_asset_id": audio_asset_id}}],
                "dimension": {"width": 1080, "height": 1920}}
        r = hg_api("https://api.heygen.com/v2/video/generate", body)
        vid = (r.get("data") or {}).get("video_id")
        if not vid:
            print(f"    [{ctype}] submit failed: {str(r)[:160]}", flush=True); continue
        print(f"    [{ctype}] video_id {vid} — polling", flush=True)
        for _ in range(120):
            d = (hg_api(f"https://api.heygen.com/v1/video_status.get?video_id={vid}").get("data") or {})
            s = d.get("status")
            if s == "completed":
                urllib.request.urlretrieve(d["video_url"], out_mp4); return out_mp4
            if s in ("failed", "error"):
                print(f"    [{ctype}] render failed: {json.dumps(d)[:160]}", flush=True); break
            time.sleep(10)
    return None

def render(script_key, persona):
    p = PERSONAS[persona]; slug = f"{script_key}-{persona}"
    out = BUILD / f"{slug}.mp4"
    if out.exists() and out.stat().st_size > 20000:
        print(f"  skip {slug} (exists)", flush=True); return slug
    mp3 = BUILD / f"{slug}.mp3"; srt = BUILD / f"{slug}.srt"; raw = BUILD / f"{slug}.raw.mp4"
    print(f"  {slug}: ElevenLabs VO ...", flush=True)
    try:
        el_tts(p["voice"], SCRIPTS[script_key], str(mp3), str(srt))
    except Exception as e:
        print(f"  !! {slug} ElevenLabs failed: {str(e)[:160]}", flush=True); return None
    print(f"  {slug}: upload audio to HeyGen ...", flush=True)
    asset = hg_upload_audio(str(mp3))
    if not asset:
        print(f"  !! {slug} HeyGen audio upload failed", flush=True); return None
    print(f"  {slug}: render avatar (asset {asset}) ...", flush=True)
    if not hg_render(p["avatar"], asset, str(raw)):
        print(f"  !! {slug} HeyGen render failed", flush=True); return None
    # burn karaoke captions from our SRT; fall back to the clean clip if captioner errors
    try:
        subprocess.run(["/usr/bin/python3", str(ROOT / "scripts/add_captions_srt.py"), str(raw), str(srt), str(out)],
                       cwd=ROOT, check=True)
    except Exception as e:
        print(f"  {slug}: caption step failed ({str(e)[:80]}) — shipping clean clip", flush=True)
        out.write_bytes(raw.read_bytes())
    print(f"  OK -> build/ugc-ads/{slug}.mp4", flush=True)
    return slug

def main():
    if not HG_KEY: sys.exit("HeyGen key missing (cr-heygen / /tmp/heygen_key.txt)")
    if not EL_KEY: sys.exit("ElevenLabs key missing (cr-elevenlabs)")
    want = sys.argv[1:] or list(SCRIPTS.keys())
    done = []
    for sk in want:
        if sk not in SCRIPTS: print(f"skip unknown '{sk}'"); continue
        for persona in ("male", "female"):
            r = render(sk, persona)
            if r: done.append(r)
    print(f"\nDONE: {len(done)} rendered -> {done}", flush=True)

if __name__ == "__main__":
    main()
