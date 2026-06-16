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
NAVY700 = (30, 41, 59); NAVY800 = (13, 27, 42); MINT300 = (0, 245, 176); SLATE = (148, 163, 184)
AMP_X, AMP_Y, ZB, ZR = 10, 8, 1.03, 0.03  # handheld float (matches leah_pipeline)
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

def _super(d, super_text):
    if not super_text: return
    f = fit(d, super_text, DISP, 78, 40, W-140)
    bw = d.textlength(super_text, font=f); x = W//2-bw/2; y = int(H*0.10)
    d.rounded_rectangle([x-26, y-14, x+bw+26, y+f.size+18], radius=18, fill=MINT)
    d.text((W//2, y+f.size//2+2), super_text, font=f, fill=NAVY, anchor="mm")

def sampaul_card(d):
    """The standard 'Sam Paul' lead card (replicates brand_reel.lead_card, static)."""
    x0, y0, x1, y1 = 140, 660, 940, 1280
    d.rounded_rectangle([x0, y0, x1, y1], radius=30, fill=NAVY700, outline=MINT, width=3)
    px, py = x0+44, y0+40
    d.ellipse([px, py+6, px+18, py+24], fill=MINT); d.text((px+30, py), "Lead identified", font=sans(30), fill=MINT)
    d.text((x1-44, py), "just now", font=sans(26), fill=SLATE, anchor="ra")
    d.line([(px, py+62), (x1-44, py+62)], fill=(255, 255, 255), width=2)
    ax, ay, ar = px+54, py+185, 58
    d.ellipse([ax-ar, ay-ar, ax+ar, ay+ar], fill=MINT)
    d.ellipse([ax-22, ay-30, ax+22, ay+14], fill=NAVY); d.pieslice([ax-40, ay-2, ax+40, ay+70], 180, 360, fill=NAVY)
    nx = px+140; d.text((nx, py+118), "Sam Paul", font=disp(58), fill=PAPER)
    tag = "Roofing · quote request"; tf = sans(30); tw = d.textlength(tag, font=tf); ty = py+200; tcw = int(tw)+108
    d.rounded_rectangle([nx, ty, nx+tcw, ty+62], radius=18, fill=NAVY, outline=MINT, width=3)
    d.ellipse([nx+26, ty+22, nx+44, ty+40], fill=MINT)
    d.text((nx+62, ty+31), tag, font=tf, fill=MINT300, anchor="lm")
    d.text((px, py+360), "sam.paul@roofingco.com", font=sans(36), fill=PAPER)
    d.text((px, py+428), "Wants: roof replacement quote", font=sans(33), fill=SLATE)
    d.text((px, py+486), "Illustrative example", font=sans(24), fill=SLATE)

def asset_card(slug, super_text, reel, out):
    # the standard lead card (Sam Paul) on navy — used for every consented/lead beat
    if slug and slug.startswith("leadcard"):
        img = Image.new("RGB", (W, H), NAVY); d = ImageDraw.Draw(img, "RGBA")
        for gy in range(60, H, 60):
            for gx in range(60, W, 60): d.ellipse([gx, gy, gx+2, gy+2], fill=(148, 163, 184))
        sampaul_card(d); _super(d, super_text); img.convert("RGB").save(out); return
    img = Image.new("RGB", (W, H), PAPER); d = ImageDraw.Draw(img)
    if slug == "grid-anon":  # 5x5 wall of the same anonymous icon
        tile = ROOT / f"public/exp-reels/{reel}/a1-anon.png"
        if tile.exists():
            cell = 176; t = Image.open(tile).convert("RGBA").resize((cell, cell), Image.LANCZOS)
            cols = rows = 5; gx = (W-cols*cell)//(cols+1); gy0 = int(H*0.20)
            for rr in range(rows):
                for cc in range(cols):
                    img.paste(t, (gx + cc*(cell+gx), gy0 + rr*(cell+18)), t)
        _super(d, super_text); img.save(out); return
    p = ROOT / f"public/exp-reels/{reel}/{slug}.png"
    if p.exists():
        ic = Image.open(p).convert("RGBA"); m = int(W*0.80); r = m/ic.width
        ic = ic.resize((m, int(ic.height*r)), Image.LANCZOS)
        img.paste(ic, (W//2 - ic.width//2, H//2 - ic.height//2 - 40), ic)
    _super(d, super_text); img.save(out)

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
    # 1) FLOAT base: the avatar stays one continuous, perfectly-synced track (leah-style
    #    handheld zoompan). Asset cards get OVERLAID on top during their beats — the
    #    avatar is never cut, so lips never drift.
    TF = max(1, int(D*30))
    base = str(d/"base.mp4")
    zp = (f"fps=30,zoompan=z='{ZB}+{ZR}*on/{TF}':d=1:"
          f"x='iw/2-(iw/zoom/2)+({AMP_X}*0.6)*sin(on/30*0.9)+({AMP_X}*0.4)*sin(on/30*2.3+1.1)':"
          f"y='ih/2-(ih/zoom/2)+({AMP_Y}*0.6)*sin(on/30*1.2+0.5)+({AMP_Y}*0.4)*sin(on/30*2.9+2.0)':s={W}x{H}:fps=30")
    subprocess.run([FF, "-y", "-loglevel", "error", "-i", src, "-vf", zp,
        "-c:v", "libx264", "-crf", "18", "-pix_fmt", "yuv420p", "-r", "30", "-c:a", "copy", base], check=True)
    # 2) asset cards for ASSET/SPLIT scenes -> overlaid over their time range
    overlays = []
    for i, sc in enumerate(scenes):
        tok, slug, cap = sc[2], sc[3], sc[6]
        if tok in ("ASSET", "SPLIT") and slug:
            s, e = sc_times[i]; e = min(e, D)
            card = str(d/f"card{i}.png"); asset_card(slug, cap, reel, card)
            overlays.append((card, s, e))
    # 3) karaoke caption word pngs (from SRT)
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
    # 4) one pass: base -> overlay asset cards -> overlay captions (audio stays from base)
    ins = ["-i", base] + sum([["-i", c[0]] for c in overlays], []) + sum([["-i", p] for p in wp], [])
    nov = len(overlays); fc = "[0:v]null[b0]"; k = 0
    for j, (card, s, e) in enumerate(overlays):
        fc += f";[b{k}][{1+j}:v]overlay=0:0:enable='between(t,{s:.3f},{e:.3f})'[b{k+1}]"; k += 1
    for j, (s, e) in enumerate(ww):
        fc += f";[b{k}][{1+nov+j}:v]overlay=0:0:enable='between(t,{s:.3f},{e:.3f})'[b{k+1}]"; k += 1
    fc += f";[b{k}]null[v];[0:a]loudnorm=I=-14:TP=-1.5:LRA=11[a]"
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
