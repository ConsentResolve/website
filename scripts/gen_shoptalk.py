#!/usr/bin/env python3
"""SHOP TALK with AAAA-RON — render each one-liner as the full show:
cover poster + 1.3s cold-open hook + the bit (timed lower-third captions, punchline
in mint) + branded outro. HeyGen Avatar IV (caption:true -> word-accurate SRT),
voice 0.9, periods drive the beats. Uploads reel + cover to R2 social/shoptalk/.
Usage: python3 scripts/gen_shoptalk.py 10 11 30   (ids)   |   ... pilot   |   ... all"""
import sys, re, json, subprocess, time, urllib.request, urllib.error
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT/"scripts"))
from shop_talk_lines import BY_ID, LINES, PILOT, VOICE, DELETED
FF, FP = "/opt/homebrew/bin/ffmpeg", "/opt/homebrew/bin/ffprobe"
KEY = open("/tmp/heygen_key.txt").read().strip()
DISP = str(ROOT/"scripts/.fonts/Bricolage.ttf"); SANS = str(ROOT/"scripts/.fonts/Hanken.ttf")
W, H = 1080, 1920
HOLD = 1.1  # deadpan face-hold after the last word (the end-pause)
HOOK_DUR = 0.9  # front hook card hold (tight — avatar arrives fast)
MUSIC = str(ROOT/"assets/audio/CR1.mp3")  # outro bed (same as UGC end-cards)
LAUGHS = [str(ROOT/f"assets/audio/laugh-{i}.mp3") for i in (1, 2, 3)]  # rotated across reels by id
FILL = f"scale=trunc({W}*1.05/2)*2:trunc({H}*1.05/2)*2,crop={W}:{H}"  # overscan-crop the cream bg edge
NAVY = (10, 22, 40); MINT = (0, 229, 160); PAPER = (248, 250, 252)
SERIES, SUB, HANDLE = "SHOP TALK", "with AA-Ron", "@consentresolve"
MOTION = ("Casual deadpan comedian on a small stage. Face mostly neutral, dry delivery, "
          "the faintest knowing look on the punchline. Relaxed, unhurried, in on the joke.")
disp = lambda p: ImageFont.truetype(DISP, p); sans = lambda p: ImageFont.truetype(SANS, p)
def fit(dr, t, fp, hi, lo, mw):
    s = hi
    while s > lo and dr.textlength(t, font=ImageFont.truetype(fp, s)) > mw: s -= 2
    return ImageFont.truetype(fp, max(14, s))
def wrap(dr, t, f, mw):
    o, c = [], ""
    for w in t.split():
        if dr.textlength((c+" "+w).strip(), font=f) <= mw: c = (c+" "+w).strip()
        else: o.append(c); c = w
    if c: o.append(c)
    return o
def ts(s): h, m, r = s.split(":"); sec, ms = r.split(","); return int(h)*3600+int(m)*60+int(sec)+int(ms)/1000.0
def brand_bg():
    img = Image.new("RGB", (W, H), NAVY); dr = ImageDraw.Draw(img, "RGBA")
    for gy in range(60, H, 60):
        for gx in range(60, W, 60): dr.ellipse([gx, gy, gx+2, gy+2], fill=(148, 163, 184))
    return img, dr
def lockup(dr, y):
    lf = disp(52); lw = dr.textlength(SERIES, font=lf)
    dr.rounded_rectangle([W//2-lw//2-34, y, W//2+lw//2+34, y+90], radius=45, fill=MINT)
    dr.text((W//2, y+45), SERIES, font=lf, fill=NAVY, anchor="mm")
    dr.text((W//2, y+90+36), SUB, font=disp(36), fill=(MINT+(255,)), anchor="mm")
def show_lockup(dr, cy):
    """Big, badged SHOP TALK title + 'with AA-Ron' tab — the hero lockup shared by
    intro & outro: chunky mint badge, navy keyline, drop shadow, contrasting sub-pill."""
    big = 138; lf = disp(big); tw = dr.textlength(SERIES, font=lf)
    px, sh = 58, int(big*1.36); x0, x1 = W//2-tw//2-px, W//2+tw//2+px
    y0, y1 = cy-sh//2, cy+sh//2; r = sh//2
    dr.rounded_rectangle([x0+9, y0+14, x1+9, y1+14], radius=r, fill=(4, 10, 20, 150))     # drop shadow
    dr.rounded_rectangle([x0, y0, x1, y1], radius=r, fill=MINT, outline=NAVY, width=6)     # mint badge
    dr.text((W//2, cy-4), SERIES, font=lf, fill=NAVY, anchor="mm")
    sp = 56; sf = disp(sp); sw = dr.textlength(SUB, font=sf); sy = y1 + 56                  # 'with AA-Ron' tab
    dr.rounded_rectangle([W//2-sw//2-32, sy-int(sp*0.8), W//2+sw//2+32, sy+int(sp*0.8)], radius=sp, fill=NAVY, outline=MINT, width=3)
    dr.text((W//2, sy), SUB, font=sf, fill=(MINT+(255,)), anchor="mm")
    return sy + sp

def api(u, b=None):
    data = json.dumps(b).encode() if b else None
    r = urllib.request.Request(u, data=data, headers={"X-Api-Key": KEY, "Content-Type": "application/json"})
    try: return json.load(urllib.request.urlopen(r, timeout=180))
    except urllib.error.HTTPError as e: return {"error": e.read().decode()[:200]}
def render_heygen(line, d):
    src, srt = str(d/"src.mp4"), str(d/"cap.srt")
    if Path(src).exists() and Path(srt).exists() and Path(src).stat().st_size > 80000: return src, srt
    body = {"caption": True, "video_inputs": [{
        "character": {"type": "avatar", "avatar_id": line["avatar"], "avatar_style": "normal", "motion_prompt": MOTION, "expressiveness": "low"},
        "voice": {"type": "text", "voice_id": VOICE, "input_text": line["text"], "speed": 0.9},
        "background": {"type": "color", "value": "#EAE3D6"}}], "dimension": {"width": W, "height": H}}
    vid = (api("https://api.heygen.com/v2/video/generate", body).get("data") or {}).get("video_id")
    if not vid: raise RuntimeError("no video_id")
    vurl = cu = None
    for _ in range(120):
        st = api(f"https://api.heygen.com/v1/video_status.get?video_id={vid}").get("data") or {}
        if st.get("status") == "completed":
            vurl = st.get("video_url")
            for _ in range(15):
                cu = (api(f"https://api.heygen.com/v1/video_status.get?video_id={vid}").get("data") or {}).get("caption_url")
                if cu: break
                time.sleep(3)
            break
        if st.get("status") == "failed": raise RuntimeError("heygen failed")
        time.sleep(8)
    urllib.request.urlretrieve(vurl, src)
    if cu: urllib.request.urlretrieve(cu, srt)
    return src, srt

def hook_teaser(text):
    first = re.split(r"(?<=[.!?])\s", text.strip())[0]
    m = re.search(r"\bis\b", first)
    if m and m.start() < 40: return first[:m.start()].strip().rstrip(",") + " is..."
    w = first.split()
    return (" ".join(w[:7]) + ("..." if len(w) > 7 else "")) if w else text

def cap_png(text, mint, out):
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0)); dr = ImageDraw.Draw(img); f = sans(58)
    lines = wrap(dr, text, f, W-200); lh = 76; bh = lh*len(lines)+34
    bw = int(max(dr.textlength(" ".join([ln]), font=f) for ln in lines))+72; cx = W//2; y0 = int(H*0.72)-bh
    box = Image.new("RGBA", (bw, bh), (0, 0, 0, 0)); ImageDraw.Draw(box).rounded_rectangle([0, 0, bw, bh], radius=22, fill=(10, 22, 40, 235))
    img.alpha_composite(box, (cx-bw//2, y0)); ty = y0+17
    col = (MINT+(255,)) if mint else (255, 255, 255, 255)
    for ln in lines: dr.text((cx, ty+lh//2), ln, font=f, fill=col, anchor="mm"); ty += lh
    img.save(out)

def card_clip(png, dur_s, out, music=None):
    if music:  # CR1 outro bed: fade in/out, ducked
        af = f"[1:a]atrim=0:{dur_s},afade=t=in:st=0:d=0.3,afade=t=out:st={dur_s-0.6:.2f}:d=0.6,volume=0.5[a]"
        subprocess.run([FF, "-y", "-loglevel", "error", "-loop", "1", "-t", f"{dur_s}", "-i", png, "-stream_loop", "-1", "-i", music,
            "-filter_complex", f"[0:v]scale={W}:{H},fps=30,format=yuv420p[v];{af}", "-map", "[v]", "-map", "[a]",
            "-c:v", "libx264", "-r", "30", "-c:a", "aac", "-b:a", "160k", "-t", f"{dur_s}", out], check=True)
    else:
        subprocess.run([FF, "-y", "-loglevel", "error", "-loop", "1", "-t", f"{dur_s}", "-i", png,
            "-f", "lavfi", "-t", f"{dur_s}", "-i", "anullsrc=r=44100:cl=stereo",
            "-vf", f"scale={W}:{H},fps=30,format=yuv420p", "-c:v", "libx264", "-r", "30", "-c:a", "aac", "-b:a", "160k", "-shortest", out], check=True)

def main(rid):
    if rid in DELETED: print(f"--- skip {rid} (cut during review)", flush=True); return
    line = BY_ID[rid]; d = ROOT/f"build/shoptalk/{rid}"; d.mkdir(parents=True, exist_ok=True)
    print(f">>> {rid} [{line['cat']}] {line['text'][:48]}...", flush=True)
    src, srt = render_heygen(line, d)
    dur = float(subprocess.check_output([FP, "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", src]).strip())
    laugh = True; laugh_path = LAUGHS[int(rid) % len(LAUGHS)]  # rotate the laugh track per reel
    # caption cues from SRT; mint the last cue (punchline kicker)
    cues = []
    for blk in re.split(r"\n\s*\n", Path(srt).read_text().strip()):
        L = [x for x in blk.splitlines() if x.strip()]; tl = next((x for x in L if "-->" in x), None)
        if not tl: continue
        a, b = [x.strip() for x in tl.split("-->")]; txt = " ".join(L[L.index(tl)+1:]).strip()
        if txt: cues.append((ts(a), ts(b), txt))
    # Build-up lines stay white per-cue; the PUNCHLINE (final sentence) shows as ONE
    # mint caption that pops on its first word and holds through the face-hold (muted-readable).
    sents = re.split(r"(?<=[.!?])\s+", line["text"].strip())
    punch = sents[-1] if len(sents) > 1 else line["text"].strip()
    np_words = len(" ".join(sents[:-1]).split()) if len(sents) > 1 else 0
    build = []; cum = 0; punch_start = None
    for (a, b, txt) in cues:
        if punch_start is None and cum >= np_words and np_words > 0: punch_start = a
        if punch_start is None: build.append((a, b, txt))
        cum += len(txt.split())
    if punch_start is None: punch_start = cues[-1][0] if cues else 0.0
    # laugh starts in the MIDDLE of the very last word; the hold stretches to fit the whole laugh
    lstart = llen = 0.0
    if laugh and cues:
        llen = float(subprocess.check_output([FP, "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", laugh_path]).strip())
        la, lb, ltx = cues[-1]; nw = max(1, len(ltx.split()))
        lstart = lb - 0.5 * (lb - la) / nw  # midpoint of the final word
    hold = max(HOLD, lstart + llen + 0.35 - dur) if laugh else HOLD
    multi = len(sents) > 1
    cap_imgs = []
    for i, (a, b, txt) in enumerate(build):
        nxt = build[i+1][0] if i+1 < len(build) else (punch_start if multi else b)
        p = str(d/f"c{i}.png"); cap_png(txt, False, p); cap_imgs.append((p, a, nxt))
    if multi:  # held mint tag only for two/three-part jokes; single-liners don't repeat the whole joke
        pp = str(d/"cpunch.png"); cap_png(punch, True, pp); cap_imgs.append((pp, punch_start, dur+hold))
    # chrome pills
    chrome = Image.new("RGBA", (W, H), (0, 0, 0, 0)); cd = ImageDraw.Draw(chrome)
    # Series branding lives on the intro/outro only — during playback keep just the handle watermark.
    hf = sans(42); hw = cd.textlength(HANDLE, font=hf); hy = int(H*0.88)
    cd.rounded_rectangle([W//2-hw//2-28, hy-36, W//2+hw//2+28, hy+36], radius=36, fill=(10, 22, 40, 215)); cd.text((W//2, hy), HANDLE, font=hf, fill=(255, 255, 255, 255), anchor="mm")
    chrome_p = str(d/"chrome.png"); chrome.save(chrome_p)
    # hook + outro cards
    teaser = hook_teaser(line["text"])
    img, dr = brand_bg(); show_lockup(dr, int(H*0.29))
    f = fit(dr, teaser, DISP, 100, 54, W-150); ls = wrap(dr, teaser, f, W-150); y = int(H*0.56)
    for ln in ls: dr.text((W//2, y), ln, font=f, fill=PAPER, anchor="mm"); y += int(f.size*1.14)
    hook_png = str(d/"hook.png"); img.save(hook_png)
    img, dr = brand_bg(); show_lockup(dr, int(H*0.33)); dr.text((W//2, int(H*0.60)), "follow for more", font=disp(84), fill=PAPER, anchor="mm")
    hw2 = dr.textlength(HANDLE, font=sans(48)); hy2 = int(H*0.70)
    dr.rounded_rectangle([W//2-hw2//2-30, hy2-40, W//2+hw2//2+30, hy2+40], radius=40, fill=MINT); dr.text((W//2, hy2), HANDLE, font=sans(48), fill=NAVY, anchor="mm")
    outro_png = str(d/"outro.png"); img.save(outro_png)
    # cover poster
    frame = str(d/"frame.png"); subprocess.run([FF, "-y", "-loglevel", "error", "-ss", f"{dur*0.45:.2f}", "-i", src, "-frames:v", "1", "-vf", FILL, frame], check=True)
    cov = Image.open(frame).convert("RGB"); c2 = ImageDraw.Draw(cov, "RGBA")
    c2.rectangle([0, 0, W, 270], fill=(10, 22, 40, 150)); c2.rectangle([0, H-470, W, H], fill=(10, 22, 40, 150)); lockup(c2, 60)
    cf = fit(c2, teaser, DISP, 92, 52, W-120); cls = wrap(c2, teaser, cf, W-120); cy = H-380
    for ln in cls: c2.text((W//2, cy), ln, font=cf, fill=PAPER, anchor="mm"); cy += int(cf.size*1.1)
    c2.text((W//2, H-90), HANDLE, font=sans(40), fill=(MINT+(255,)), anchor="mm")
    cover_p = str(ROOT/f"public/reels/shoptalk-{rid}-cover.png"); cov.save(cover_p)
    # bit
    ins = ["-i", src, "-i", chrome_p] + sum([["-i", p] for p, _a, _b in cap_imgs], [])
    # scale up, clone-extend for the hold, then a slow handheld drift over the whole clip — so the
    # held tail keeps MOVING (Ken-Burns on the freeze) instead of going dead under the laugh.
    fc = (f"[0:v]scale=trunc({W}*1.08/2)*2:trunc({H}*1.08/2)*2,tpad=stop_mode=clone:stop_duration={hold},fps=30,"
          f"crop={W}:{H}:x='(in_w-{W})/2+14*sin(2*PI*t/3)':y='(in_h-{H})/2+10*sin(2*PI*t/3.7)',setsar=1[v0];[v0][1:v]overlay=0:0[b0]")
    k = 0
    for j, (p, a, b) in enumerate(cap_imgs):
        fc += f";[b{k}][{2+j}:v]overlay=0:0:enable='between(t,{a:.2f},{b:.2f})'[b{k+1}]"; k += 1
    fc += f";[b{k}]null[v];[0:a]apad=pad_dur={hold},loudnorm=I=-14:TP=-1.0:LRA=11[sp]"
    if laugh:  # laugh begins mid-last-word; ducked, faded; speech sets the length
        li = 2 + len(cap_imgs); ins += ["-i", laugh_path]; dly = int(lstart * 1000); fo = max(0.2, llen - 0.5)
        fc += (f";[{li}:a]afade=t=in:st=0:d=0.08,afade=t=out:st={fo:.2f}:d=0.5,volume=0.9,"
               f"adelay={dly}|{dly}[lg];[sp][lg]amix=inputs=2:duration=first:normalize=0,alimiter=limit=0.95[a]")
    else:
        fc += ";[sp]anull[a]"
    bit = str(d/"bit.mp4")
    subprocess.run([FF, "-y", "-loglevel", "error", *ins, "-filter_complex", fc, "-map", "[v]", "-map", "[a]",
        "-c:v", "libx264", "-b:v", "5M", "-pix_fmt", "yuv420p", "-r", "30", "-c:a", "aac", "-b:a", "160k", bit], check=True)
    hook_c, outro_c = str(d/"hookc.mp4"), str(d/"outroc.mp4")
    card_clip(hook_png, HOOK_DUR, hook_c); card_clip(outro_png, 1.6, outro_c, music=MUSIC)
    out = str(ROOT/f"public/reels/shoptalk-{rid}.mp4")
    subprocess.run([FF, "-y", "-loglevel", "error", "-i", hook_c, "-i", bit, "-i", outro_c,
        "-filter_complex", "[0:v][0:a][1:v][1:a][2:v][2:a]concat=n=3:v=1:a=1[v][a]", "-map", "[v]", "-map", "[a]",
        "-c:v", "libx264", "-b:v", "5M", "-pix_fmt", "yuv420p", "-r", "30", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", out], check=True)
    subprocess.run(["/usr/bin/python3", str(ROOT/"scripts/r2_upload.py"), out, f"social/shoptalk/shoptalk-{rid}.mp4", "video/mp4"], cwd=str(ROOT))
    subprocess.run(["/usr/bin/python3", str(ROOT/"scripts/r2_upload.py"), cover_p, f"social/shoptalk/shoptalk-{rid}-cover.png", "image/png"], cwd=str(ROOT))
    print(f"<<< {rid} done ({dur:.1f}s clip)", flush=True)

if __name__ == "__main__":
    arg = sys.argv[1:] or ["pilot"]
    ids = [l["id"] for l in LINES] if arg == ["all"] else (PILOT if arg == ["pilot"] else arg)
    for rid in ids: main(rid)
    print("=== shoptalk done ===", flush=True)
