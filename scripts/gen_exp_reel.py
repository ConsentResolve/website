#!/usr/bin/env python3
"""Composite one experimental reel from reels_16.py:
  1. render the avatar speaking the full VO once (HeyGen Avatar IV, caption:true)
  2. align each scene to the real audio timeline via the SRT word timings
  3. build the visual: AVATAR scenes use the avatar footage; ASSET scenes show the
     brand-style icon centered on an off-white card with a top super; SPLIT = asset
     + avatar PiP. Subtle zoom keeps stills alive.
  4. burn lower-third karaoke captions (spoken VO) + an early persona-name super
  5. append the /demo end card; mux the continuous VO.
Caches the HeyGen render in build/expreel/<NN>/. Usage: python3 scripts/gen_exp_reel.py 10
"""
import sys, re, json, subprocess, time, urllib.request, urllib.error
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
from reels_16 import REELS, CAST, CTA
KEY = open("/tmp/heygen_key.txt").read().strip()
FF, FP = "/opt/homebrew/bin/ffmpeg", "/opt/homebrew/bin/ffprobe"
DISP = str(ROOT / "scripts/.fonts/Bricolage.ttf"); SANS = str(ROOT / "scripts/.fonts/Hanken.ttf")
LOGO = ROOT / "public/logo-on-dark.png"; MUSIC = str(ROOT / "assets/audio/CR1.mp3")
W, H = 1080, 1920
NAVY = (10, 22, 40); MINT = (0, 229, 160); PAPER = (248, 250, 252); INK = (13, 27, 42)
MOTION = "Confident, warm, direct. Talking straight to a contractor who's a peer. Calm authority, slight smile on the wins."
disp = lambda p: ImageFont.truetype(DISP, p); sans = lambda p: ImageFont.truetype(SANS, p)

def api(u, b=None):
    data = json.dumps(b).encode() if b else None
    r = urllib.request.Request(u, data=data, headers={"X-Api-Key": KEY, "Content-Type": "application/json"})
    try: return json.load(urllib.request.urlopen(r, timeout=180))
    except urllib.error.HTTPError as e: return {"error": e.read().decode()[:200]}
def dur(f): return float(subprocess.check_output([FP, "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).strip())
def ts(s):
    h, m, rest = s.split(":"); sec, ms = rest.split(","); return int(h)*3600 + int(m)*60 + int(sec) + int(ms)/1000.0
def fit(d, t, fp, hi, lo, mw):
    s = hi
    while s > lo and d.textlength(t, font=ImageFont.truetype(fp, s)) > mw: s -= 2
    return ImageFont.truetype(fp, max(14, s))

def render_heygen(reel, d):
    look, voice, _name = CAST[REELS[reel]["avatar"]]
    src = str(d / "src.mp4"); srt = str(d / "cap.srt")
    if Path(src).exists() and Path(srt).exists() and Path(src).stat().st_size > 80000:
        print("  (cached HeyGen render)", flush=True); return src, srt
    full = " ".join(sc[5] for sc in REELS[reel]["scenes"] if sc[5])
    body = {"caption": True, "video_inputs": [{"character": {"type": "talking_photo", "talking_photo_id": look,
            "use_avatar_iv_model": True, "talking_style": "expressive", "super_resolution": True,
            "expressiveness": "high", "custom_motion_prompt": MOTION},
            "voice": {"type": "text", "voice_id": voice, "input_text": full, "speed": 0.96}}],
            "dimension": {"width": W, "height": H}}
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
        time.sleep(10)
    if not vurl: raise RuntimeError("no video_url")
    urllib.request.urlretrieve(vurl, src)
    if cu: urllib.request.urlretrieve(cu, srt)
    return src, srt

def word_timeline(srt):
    """Flatten SRT cues into (word, start, end), interpolating within each cue."""
    words = []
    for blk in re.split(r"\n\s*\n", Path(srt).read_text().strip()):
        L = [x for x in blk.splitlines() if x.strip()]
        tl = next((x for x in L if "-->" in x), None)
        if not tl: continue
        a, b = [x.strip() for x in tl.split("-->")]; a, b = ts(a), ts(b)
        txt = " ".join(L[L.index(tl)+1:]).strip()
        ws = txt.split()
        if not ws: continue
        for i, w in enumerate(ws):
            s = a + (b-a)*i/len(ws); e = a + (b-a)*(i+1)/len(ws)
            words.append((re.sub(r"[^a-z0-9]", "", w.lower()), s, e, w))
    return words

def scene_times(reel, words):
    """Map each scene to [start,end] by consuming words in order."""
    times = []; wi = 0; n = len(words)
    scenes = REELS[reel]["scenes"]
    for idx, sc in enumerate(scenes):
        vo = sc[5] or ""
        nw = len([x for x in re.sub(r"[^a-z0-9 ]", " ", vo.lower()).split() if x])
        if nw == 0:  # asset with no VO (text-only) — give it ~2.2s after prev
            st = times[-1][1] if times else 0.0; times.append((st, st + 2.2)); continue
        start = words[wi][1] if wi < n else (times[-1][1] if times else 0.0)
        wi_end = min(n, wi + nw)
        end = words[wi_end-1][2] if wi_end > wi and wi_end-1 < n else start + 2.2
        times.append((start, end)); wi = wi_end
    return times

def asset_card(slug, super_text, reel, out):
    img = Image.new("RGB", (W, H), PAPER); d = ImageDraw.Draw(img)
    p = ROOT / f"public/exp-reels/{reel}/{slug}.png"
    if p.exists():
        ic = Image.open(p).convert("RGBA"); m = int(W*0.82); r = m/ic.width
        ic = ic.resize((m, int(ic.height*r)), Image.LANCZOS)
        img.paste(ic, (W//2 - ic.width//2, H//2 - ic.height//2 - 40), ic)
    if super_text:
        f = fit(d, super_text, DISP, 78, 40, W-140)
        bw = d.textlength(super_text, font=f); x = W//2 - bw/2; y = int(H*0.10)
        d.rounded_rectangle([x-26, y-14, x+bw+26, y+f.size+18], radius=18, fill=MINT)
        d.text((W//2, y+f.size//2+2), super_text, font=f, fill=NAVY, anchor="mm")
    img.save(out)

def karaoke_png(words, active, out):
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(img); CAP = sans(56); lh = 70
    lines, cur = [], []
    for w in words:
        if not cur or d.textlength(" ".join(cur+[w]), font=CAP) <= W-220: cur.append(w)
        else: lines.append(cur); cur = [w]
    if cur: lines.append(cur)
    tw = max(d.textlength(" ".join(l), font=CAP) for l in lines); bw = int(tw)+60; bh = lh*len(lines)+30
    cx = W//2; y0 = int(H*0.82) - bh
    box = Image.new("RGBA", (bw, bh), (0, 0, 0, 0)); ImageDraw.Draw(box).rounded_rectangle([0, 0, bw, bh], radius=18, fill=(0, 0, 0, 225))
    img.alpha_composite(box, (cx-bw//2, y0)); gi = 0; ty = y0+15
    for l in lines:
        lw = d.textlength(" ".join(l), font=CAP); x = cx-lw/2
        for w in l:
            d.text((x, ty), w, font=CAP, fill=(MINT+(255,)) if gi == active else (255, 255, 255, 255)); x += d.textlength(w+" ", font=CAP); gi += 1
        ty += lh
    img.save(out)

def build_endcard(d):
    out = str(d/"end.mp4"); png = str(d/"end.png")
    img = Image.new("RGB", (W, H), NAVY); dr = ImageDraw.Draw(img)
    for gy in range(60, H, 60):
        for gx in range(60, W, 60): dr.ellipse([gx, gy, gx+2, gy+2], fill=(148, 163, 184))
    try:
        lg = Image.open(LOGO).convert("RGBA"); lw = 560; lg = lg.resize((lw, int(lg.height*lw/lg.width)), Image.LANCZOS); img.paste(lg, (W//2-lw//2, 560), lg)
    except Exception: pass
    dr.text((W//2, 1000), "Consent-first. $7 each. Yours alone.", font=fit(dr, "Consent-first. $7 each. Yours alone.", DISP, 54, 34, 940), fill=PAPER, anchor="mm")
    dr.rounded_rectangle([W//2-360, 1180, W//2+360, 1300], radius=60, fill=MINT); dr.text((W//2, 1240), CTA, font=fit(dr, CTA, DISP, 50, 30, 660), fill=NAVY, anchor="mm")
    img.save(png)
    subprocess.run([FF, "-y", "-loglevel", "error", "-loop", "1", "-t", "2.6", "-i", png, "-stream_loop", "-1", "-i", MUSIC,
        "-filter_complex", "[0:v]fps=30,format=yuv420p[v];[1:a]atrim=0:2.6,afade=t=out:st=2.0:d=0.6,volume=0.4[a]",
        "-map", "[v]", "-map", "[a]", "-t", "2.6", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-r", "30", "-c:a", "aac", "-b:a", "160k", out], check=True)
    return out

def main(reel):
    d = ROOT / f"build/expreel/{reel}"; d.mkdir(parents=True, exist_ok=True)
    print(f">>> reel {reel} ({REELS[reel]['title']})", flush=True)
    src, srt = render_heygen(reel, d)
    words = word_timeline(srt); D = dur(src)
    sc_times = scene_times(reel, words)
    scenes = REELS[reel]["scenes"]
    # 1) visual segments
    segs = []
    for i, sc in enumerate(scenes):
        s, e = sc_times[i]; e = min(e, D); durr = max(0.6, e-s)
        tok, slug, _prompt, _vo, cap = sc[2], sc[3], sc[4], sc[5], sc[6]
        seg = str(d/f"v{i}.mp4")
        if tok == "AVATAR" or (tok == "SPLIT" and not slug):
            subprocess.run([FF, "-y", "-loglevel", "error", "-ss", f"{s:.3f}", "-to", f"{e:.3f}", "-i", src,
                "-vf", f"fps=30,scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H}", "-an",
                "-c:v", "libx264", "-crf", "18", "-pix_fmt", "yuv420p", "-r", "30", seg], check=True)
        else:
            card = str(d/f"card{i}.png"); asset_card(slug, cap, reel, card)
            z = "zoompan=z='min(zoom+0.0008,1.08)':d=1:s=%dx%d:fps=30" % (W, H)
            subprocess.run([FF, "-y", "-loglevel", "error", "-loop", "1", "-t", f"{durr:.3f}", "-i", card,
                "-vf", f"{z},format=yuv420p", "-an", "-c:v", "libx264", "-crf", "18", "-pix_fmt", "yuv420p", "-r", "30", seg], check=True)
        segs.append(seg)
    lst = d/"segs.txt"; lst.write_text("".join(f"file '{Path(s).resolve()}'\n" for s in segs))
    visual = str(d/"visual.mp4"); subprocess.run([FF, "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", str(lst), "-c", "copy", visual], check=True)
    # 2) karaoke caption overlays
    cues = []
    for blk in re.split(r"\n\s*\n", Path(srt).read_text().strip()):
        L = [x for x in blk.splitlines() if x.strip()]; tl = next((x for x in L if "-->" in x), None)
        if not tl: continue
        a, b = [x.strip() for x in tl.split("-->")]; txt = " ".join(L[L.index(tl)+1:]).strip()
        if txt: cues.append((ts(a), ts(b), txt))
    wp = []; ww = []; gi = 0
    for a, b, txt in cues:
        wlist = txt.split(); wt = [len(x)+1 for x in wlist]; tot = sum(wt); tt = a
        for k, w in enumerate(wlist):
            e2 = b if k == len(wlist)-1 else tt + (b-a)*wt[k]/tot
            p = str(d/f"w{gi}.png"); karaoke_png(wlist, k, p); wp.append(p); ww.append((tt, e2)); tt = e2; gi += 1
    ins = ["-i", visual, "-i", src] + sum([["-i", p] for p in wp], [])
    fc = "[0:v]null[b0]"
    for k, (s, e) in enumerate(ww): fc += f";[b{k}][{2+k}:v]overlay=0:0:enable='between(t,{s:.3f},{e:.3f})'[b{k+1}]"
    fc += f";[b{len(wp)}]null[v];[1:a]loudnorm=I=-14:TP=-1.5:LRA=11[a]"
    body = str(d/"body.mp4")
    subprocess.run([FF, "-y", "-loglevel", "error", *ins, "-filter_complex", fc, "-map", "[v]", "-map", "[a]",
        "-c:v", "libx264", "-b:v", "4M", "-pix_fmt", "yuv420p", "-r", "30", "-c:a", "aac", "-b:a", "160k", "-t", f"{D:.2f}", body], check=True)
    # 3) end card
    end = build_endcard(d)
    out = str(ROOT/f"public/reels/exp-{reel}.mp4")
    subprocess.run([FF, "-y", "-loglevel", "error", "-i", body, "-i", end,
        "-filter_complex", "[0:v][0:a][1:v][1:a]concat=n=2:v=1:a=1[v][a]", "-map", "[v]", "-map", "[a]",
        "-c:v", "libx264", "-b:v", "4M", "-pix_fmt", "yuv420p", "-r", "30", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", out], check=True)
    print(f"<<< reel {reel} -> {out} ({dur(out):.1f}s)", flush=True)

if __name__ == "__main__":
    for r in (sys.argv[1:] or ["10"]):
        main(r)
