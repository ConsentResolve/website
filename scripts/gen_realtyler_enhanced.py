#!/usr/bin/env python3
"""Real Tyler — ENHANCED single test reel. Stacks 5 naturalness features:
  #4 motion photo-avatar look (026f9397…)
  #3 real voice (92071a, no emotion) + pause-punctuated cadence @0.94x
  #5 per-scene jump-cut zoom punches
  #1 word-level karaoke captions (active word in mint)
  #2 low ambient audio bed under the VO (kills the dead-silence TTS tell)
Output: public/reels/test-realtyler-enhanced-tiktok.mp4. Review only.
"""
import json, os, re, subprocess, time, hashlib, math, urllib.request, urllib.error
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
KEY = open("/tmp/heygen_key.txt").read().strip()
FF, FP = "/opt/homebrew/bin/ffmpeg", "/opt/homebrew/bin/ffprobe"
FONT = str(ROOT / "scripts/.fonts/Hanken.ttf")
LOOK = "026f9397e4e9415b9cb54bab179ab59f"      # motion version of the lawn look (#4)
VOICE = "92071a8742744d17bc92a02baab2941f"     # Real Tyler real voice (no emotion)
NAME = "realtyler-enhanced"
W, H, CAP_BOTTOM = 1080, 1920, 0.80
WORK = ROOT / "build/tyler_enh"; WORK.mkdir(parents=True, exist_ok=True)
REELS = ROOT / "public/reels"
ZOOM = [1.0, 1.12, 1.05, 1.14, 1.03, 1.10]     # jump-cut energy between scenes (#5)
PRON = {r"consentresolve\.com/demo": "consent resolve dot com slash demo", r"\bleads\b": "leeds", r"\blead\b": "leed"}

# (caption text [clean], spoken text [pause-punctuated], speed)   (#3)
SCENES = [
    ("Here is the number that stopped me cold. Ninety-eight out of a hundred.",
     "Here is the number... that stopped me cold. Ninety-eight... out of a hundred.", 0.94),
    ("That is how many people visit your website and leave without ever raising a hand.",
     "That is how many people visit your website... and leave. Without ever raising a hand.", 0.94),
    ("You paid for every one of those clicks. The traffic was already yours.",
     "You paid for every one of those clicks. The traffic... was already yours.", 0.94),
    ("We identify those visitors and hand them back as real, consent-first leads.",
     "We identify those visitors... and hand them back. As real, consent-first leads.", 0.94),
    ("Not a name scraped off a list. A person who actually wants the work. Seven dollars, exclusive.",
     "Not a name scraped off a list. A person who actually wants the work. Seven dollars... exclusive.", 0.94),
    ("See it work at consentresolve.com/demo.",
     "See it work at consentresolve.com/demo.", 0.97),
]

def spoken(t):
    for rx, rep in PRON.items(): t = re.sub(rx, rep, t, flags=re.I)
    return t

def api(url, body=None):
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(url, data=data, headers={"X-Api-Key": KEY, "Content-Type": "application/json"})
    try: return json.load(urllib.request.urlopen(req, timeout=120))
    except urllib.error.HTTPError as e: return {"error": json.loads(e.read().decode())}

def quota(): return (api("https://api.heygen.com/v2/user/remaining_quota").get("data") or {}).get("remaining_quota")

def submit(text, speed):
    body = {"caption": False, "video_inputs": [{
        "character": {"type": "talking_photo", "talking_photo_id": LOOK, "use_avatar_iv_model": True,
                      "talking_style": "expressive", "super_resolution": True},
        "voice": {"type": "text", "voice_id": VOICE, "input_text": text, "speed": speed}}],
        "dimension": {"width": 1080, "height": 1920}}
    r = api("https://api.heygen.com/v2/video/generate", body)
    if r.get("error"): print("  submit err:", r["error"]); return None
    return (r.get("data") or {}).get("video_id")

def poll(vid):
    for _ in range(72):
        d = api(f"https://api.heygen.com/v1/video_status.get?video_id={vid}").get("data") or {}
        if d.get("status") == "completed": return d.get("video_url")
        if d.get("status") == "failed": print("  failed:", d.get("error")); return None
        time.sleep(10)
    return None

def dur(f): return round(float(subprocess.check_output([FP,"-v","error","-show_entries","format=duration","-of","csv=p=0",f]).strip()), 3)

# ---- karaoke caption rendering (#1) ----
FONTOBJ = ImageFont.truetype(FONT, 54)
def _lines(words, d, max_w):
    lines, cur = [], []
    for w in words:
        if not cur or d.textlength(" ".join(cur+[w]), font=FONTOBJ) <= max_w: cur.append(w)
        else: lines.append(cur); cur = [w]
    if cur: lines.append(cur)
    return lines

def karaoke_png(words, active, out):
    img = Image.new("RGBA", (W, H), (0,0,0,0)); d = ImageDraw.Draw(img); lh = 66
    lines = _lines(words, d, W-200)
    tw = max(d.textlength(" ".join(l), font=FONTOBJ) for l in lines)
    bh = lh*len(lines)+36; bw = int(tw)+64; cx = W//2
    y0 = int(H*CAP_BOTTOM)-bh
    box = Image.new("RGBA",(bw,bh),(0,0,0,0))
    ImageDraw.Draw(box).rounded_rectangle([0,0,bw,bh],radius=18,fill=(0,0,0,160))
    img.alpha_composite(box,(cx-bw//2,y0))
    gi = 0; ty = y0+18
    for l in lines:
        lw = d.textlength(" ".join(l), font=FONTOBJ); x = cx-lw/2
        for w in l:
            col = (0,229,160,255) if gi==active else (255,255,255,255)
            d.text((x,ty), w, font=FONTOBJ, fill=col)
            x += d.textlength(w+" ", font=FONTOBJ); gi += 1
        ty += lh
    img.save(out)

def vp(seed):  # de-AI handheld drift
    import random; r = random.Random(int(hashlib.md5(seed.encode()).hexdigest()[:8],16))
    return dict(ax=round(r.uniform(10,20),1), ay=round(r.uniform(8,16),1), fx=round(r.uniform(.08,.15),3),
                fy=round(r.uniform(.10,.19),3), phx=round(r.uniform(0,6.28),2), phy=round(r.uniform(0,6.28),2),
                x0=round(r.uniform(-12,12),1), y0=round(r.uniform(-12,12),1), grain=r.choice([10,12,14]))

# ---- generate scenes ----
print("quota before:", quota(), flush=True)
clips = []
for i, (cap, sp, spd) in enumerate(SCENES):
    f = str(WORK / f"s{i}.mp4")
    vid = submit(spoken(sp), spd)
    if not vid: raise SystemExit(f"submit failed {i}")
    url = poll(vid)
    if not url: raise SystemExit(f"render failed {i}")
    urllib.request.urlretrieve(url, f)
    clips.append({"file": f, "dur": dur(f), "cap": cap}); print(f"  scene {i}: {clips[-1]['dur']}s", flush=True)
print("quota after:", quota(), flush=True)

# ---- per-scene finish: jump-cut zoom + karaoke overlays ----
parts = []
for i, sc in enumerate(clips):
    P = vp(f"{NAME}{i}"); scl = ZOOM[i % len(ZOOM)]
    words = sc["cap"].split(); n = len(words)
    wt = [len(w)+2 for w in words]; tot = sum(wt)
    # word windows local to this scene (slight 0.12s lead-in)
    lead = min(0.12, sc["dur"]*0.05); span = sc["dur"]-lead; t = lead; wins = []
    for w in wt: wins.append((t, t+span*w/tot)); t += span*w/tot
    pngs = []
    for k in range(n):
        p = str(WORK/f"k{i}_{k}.png"); karaoke_png(words, k, p); pngs.append(p)
    ins = ["-i", sc["file"]] + sum([["-i", p] for p in pngs], [])
    xexpr = f"(in_w-1080)/2+({P['x0']})+{P['ax']}*sin(2*PI*t*{P['fx']}+{P['phx']})"
    yexpr = f"(in_h-1920)/2+({P['y0']})+{P['ay']}*sin(2*PI*t*{P['fy']}+{P['phy']})"
    fc = f"[0:v]scale=trunc(iw*1.08/2)*2:trunc(ih*1.08/2)*2,crop=1080:1920:x='{xexpr}':y='{yexpr}'"
    if scl > 1.0:
        fc += f",crop=trunc(1080/{scl}/2)*2:trunc(1920/{scl}/2)*2:(in_w-ow)/2:(in_h-oh)/2,scale=1080:1920"
    fc += f",noise=alls={P['grain']}:allf=t+u,setsar=1[b0]"
    for k,(s,e) in enumerate(wins):
        fc += f";[b{k}][{k+1}:v]overlay=0:0:enable='between(t,{s:.3f},{e:.3f})'[b{k+1}]"
    part = str(WORK/f"part{i}.mp4"); parts.append(part)
    subprocess.run([FF,"-y","-loglevel","error",*ins,"-filter_complex",fc,"-map",f"[b{n}]","-an",
                    "-c:v","libx264","-crf","18","-pix_fmt","yuv420p","-r","30",part], check=True)

# concat video
lst = WORK/"list.txt"; lst.write_text("".join(f"file '{os.path.abspath(p)}'\n" for p in parts))
vcat = str(WORK/"vcat.mp4")
subprocess.run([FF,"-y","-loglevel","error","-f","concat","-safe","0","-i",str(lst),"-c","copy",vcat], check=True)

# ---- audio: concat VO + low ambient bed (#2) ----
total = sum(c["dur"] for c in clips)
ains = sum([["-i", c["file"]] for c in clips], [])   # become inputs 1..len(clips) (vcat is input 0)
amb = ["-f","lavfi","-t",f"{total:.3f}","-i","anoisesrc=color=brown:amplitude=0.22:sample_rate=44100"]
vchain = "".join(f"[{i+1}:a]" for i in range(len(clips))) + f"concat=n={len(clips)}:v=0:a=1[vo]"
ambchain = f"[{len(clips)+1}:a]lowpass=f=480,volume=0.5[amb]"
mix = "[vo][amb]amix=inputs=2:duration=first:weights=1 0.16,dynaudnorm=f=200[a]"
out = str(REELS/f"test-{NAME}-tiktok.mp4")
subprocess.run([FF,"-y","-loglevel","error","-i",vcat,*ains,*amb,
    "-filter_complex",f"{vchain};{ambchain};{mix}","-map","0:v","-map","[a]",
    "-c:v","libx264","-b:v","3.5M","-maxrate","3.8M","-bufsize","5M","-pix_fmt","yuv420p","-r","30",
    "-c:a","aac","-b:a","128k","-movflags","+faststart",out], check=True)
print(f"done -> {out}")
