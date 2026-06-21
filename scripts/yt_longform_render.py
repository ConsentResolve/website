#!/usr/bin/env python3
"""Render a long-form 16:9 YouTube video from social/longform/<slug>.json.
Hybrid format: HeyGen avatar intro/outro (on-camera) + branded slides narrated by the
cloned voice. Also writes captions.srt + a 16:9 thumbnail.

  python3 scripts/yt_longform_render.py <slug>
Output: build/longform/<slug>/final.mp4, captions.srt, thumb.png
Needs /tmp/heygen_key.txt + ffmpeg/ffprobe. Does NOT upload (review first).
"""
import json, re, subprocess, time, textwrap, urllib.request, urllib.error, sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
ROOT = Path(__file__).resolve().parent.parent
KEY = open("/tmp/heygen_key.txt").read().strip()
FF, FP = "/opt/homebrew/bin/ffmpeg", "/opt/homebrew/bin/ffprobe"
FONT = str(ROOT / "scripts/.fonts/Hanken.ttf")
AVATAR = "ceff9efa4fcc40de9f750bfae36c8dd5"          # real-footage video avatar (Aaron)
VOICE = "9d5497bed1f144049861da9389addc96"           # real voice clone
LOOK = "b8cf5419ad5247d38bb000fd0df239a6"            # talking_photo look (audio-only VO)
W, H = 1920, 1080
BG, ACCENT, TEXT, SUB = (10, 22, 40), (0, 229, 160), (245, 248, 250), (148, 163, 184)
PRON = {r"consentresolve\.com/demo": "consent resolve dot com slash demo", r"\bleads\b": "leeds", r"\blead\b": "leed"}

def spoken(t):
    for rx, rep in PRON.items(): t = re.sub(rx, rep, t, flags=re.I)
    return t

def api(u, body=None):
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(u, data=data, headers={"X-Api-Key": KEY, "Content-Type": "application/json"})
    try: return json.load(urllib.request.urlopen(req, timeout=180))
    except urllib.error.HTTPError as e: return {"error": e.read().decode()[:300]}

def dur(f): return float(subprocess.check_output([FP, "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).strip())

def heygen(body, poll=120):
    r = api("https://api.heygen.com/v2/video/generate", body)
    vid = (r.get("data") or {}).get("video_id")
    if not vid: raise SystemExit(f"submit failed: {r}")
    for _ in range(poll):
        d = api(f"https://api.heygen.com/v1/video_status.get?video_id={vid}").get("data") or {}
        if d.get("status") == "completed": return d["video_url"]
        if d.get("status") == "failed": raise SystemExit(f"render failed: {d.get('error')}")
        time.sleep(10)
    raise SystemExit("render timeout")

def avatar_clip(text, out):
    url = heygen({"caption": False, "video_inputs": [{
        "character": {"type": "avatar", "avatar_id": AVATAR, "avatar_style": "normal"},
        "voice": {"type": "text", "voice_id": VOICE, "input_text": spoken(text), "speed": 0.97}}],
        "dimension": {"width": W, "height": H}})
    urllib.request.urlretrieve(url, out)

def vo_audio(text, out_wav):
    url = heygen({"caption": False, "video_inputs": [{
        "character": {"type": "talking_photo", "talking_photo_id": LOOK, "use_avatar_iv_model": True},
        "voice": {"type": "text", "voice_id": VOICE, "input_text": spoken(text), "speed": 1.0}}],
        "dimension": {"width": 720, "height": 1280}})
    mp4 = out_wav + ".src.mp4"; urllib.request.urlretrieve(url, mp4)
    subprocess.run([FF, "-y", "-loglevel", "error", "-i", mp4, "-vn", "-ar", "44100", "-ac", "2", out_wav], check=True)

def slide_png(heading, bullets, out):
    img = Image.new("RGB", (W, H), BG); d = ImageDraw.Draw(img)
    fh = ImageFont.truetype(FONT, 76); fb = ImageFont.truetype(FONT, 46); fk = ImageFont.truetype(FONT, 30)
    d.rectangle([120, 150, 210, 162], fill=ACCENT)
    y = 200
    for ln in textwrap.wrap(heading, width=26): d.text((120, y), ln, font=fh, fill=TEXT); y += 92
    y += 46
    for b in bullets[:4]:
        d.ellipse([124, y + 18, 144, y + 38], fill=ACCENT)
        for j, ln in enumerate(textwrap.wrap(b, width=44)):
            d.text((176, y), ln, font=fb, fill=(TEXT if j == 0 else SUB)); y += 58
        y += 26
    d.text((120, H - 78), "CONSENT RESOLVE", font=fk, fill=ACCENT)
    cta = "consentresolve.com/demo"
    d.text((W - 120 - d.textlength(cta, font=fk), H - 78), cta, font=fk, fill=SUB)
    img.save(out)

def norm(seg_in, seg_out):  # canonical encode so concat is seamless
    subprocess.run([FF, "-y", "-loglevel", "error", "-i", seg_in,
        "-vf", "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30",
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-ar", "44100", "-ac", "2", "-b:a", "160k",
        "-movflags", "+faststart", seg_out], check=True)

def slide_clip(png, wav, out):
    length = dur(wav) + 0.5
    subprocess.run([FF, "-y", "-loglevel", "error", "-loop", "1", "-i", png, "-i", wav,
        "-t", f"{length:.2f}", "-vf", "scale=1920:1080,fps=30", "-c:v", "libx264", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-ar", "44100", "-ac", "2", "-b:a", "160k", "-af", "apad", "-movflags", "+faststart", out], check=True)

def ts(s):
    h = int(s // 3600); m = int(s % 3600 // 60); sec = s % 60
    return f"{h:02d}:{m:02d}:{sec:06.3f}".replace(".", ",")

def main():
    slug = sys.argv[1]
    pkg = json.loads((ROOT / f"social/longform/{slug}.json").read_text())
    work = ROOT / "build/longform" / slug; work.mkdir(parents=True, exist_ok=True)
    segs, srt_rows, clock = [], [], 0.0

    def add_caption(text, seg_dur):
        nonlocal clock
        words = text.split(); chunk, t = [], clock
        per = seg_dur / max(1, len(words))
        # ~9-word caption cues across the segment
        i = 0
        while i < len(words):
            grp = words[i:i + 9]; start = clock + i * per; end = clock + min(len(words), i + 9) * per
            srt_rows.append((start, end, " ".join(grp))); i += 9
        clock += seg_dur

    # 1) avatar intro
    print("intro avatar...", flush=True)
    raw = str(work / "intro.raw.mp4"); avatar_clip(pkg["avatar_intro"], raw)
    seg = str(work / "00_intro.mp4"); norm(raw, seg); segs.append(seg); add_caption(pkg["avatar_intro"], dur(seg))

    # 2) body slides
    for n, s in enumerate(pkg["body"], 1):
        print(f"body {n}/{len(pkg['body'])}: {s['heading']}", flush=True)
        wav = str(work / f"b{n}.wav"); vo_audio(s["narration"], wav)
        png = str(work / f"b{n}.png"); slide_png(s["heading"], s.get("bullets", []), png)
        clip = str(work / f"{n:02d}_body.mp4"); slide_clip(png, wav, clip); segs.append(clip)
        add_caption(s["narration"], dur(clip))

    # 3) avatar outro
    print("outro avatar...", flush=True)
    raw = str(work / "outro.raw.mp4"); avatar_clip(pkg["avatar_outro"], raw)
    seg = str(work / "99_outro.mp4"); norm(raw, seg); segs.append(seg); add_caption(pkg["avatar_outro"], dur(seg))

    # 4) concat
    lst = work / "concat.txt"; lst.write_text("".join(f"file '{s}'\n" for s in segs))
    final = str(work / "final.mp4")
    subprocess.run([FF, "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", str(lst),
        "-c", "copy", "-movflags", "+faststart", final], check=True)

    # 5) captions.srt
    srt = "\n".join(f"{i+1}\n{ts(a)} --> {ts(b)}\n{txt}\n" for i, (a, b, txt) in enumerate(srt_rows))
    (work / "captions.srt").write_text(srt)

    # 6) thumbnail (1280x720)
    tw, th = 1280, 720; timg = Image.new("RGB", (tw, th), BG); td = ImageDraw.Draw(timg)
    tf = ImageFont.truetype(FONT, 96); sf = ImageFont.truetype(FONT, 40)
    td.rectangle([80, 110, 200, 124], fill=ACCENT)
    yy = 170
    for ln in textwrap.wrap(pkg.get("thumbnail_text", pkg["title"]), width=16): td.text((80, yy), ln, font=tf, fill=TEXT); yy += 110
    td.text((80, th - 80), "CONSENT RESOLVE", font=sf, fill=ACCENT)
    timg.save(str(work / "thumb.png"))

    print(f"\nDONE -> {final}")
    print(f"  duration: {dur(final)/60:.1f} min | segments: {len(segs)} | captions: {len(srt_rows)} cues")
    print(f"  thumb: {work/'thumb.png'} | srt: {work/'captions.srt'}")

if __name__ == "__main__":
    main()
