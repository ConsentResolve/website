#!/usr/bin/env python3
"""Leak section — 3 creative-risk experiments (REFRAMED to honest CR voice:
second person, no fabricated contractor identity). Each tests a different hook
mechanism, with jump-cuts (~2-3s), a visual-disruption open card, karaoke
captions from the real SRT, ONE idea, and a SOFT CTA buried at ~70%.
Overwrites the leak-stat/confession/contrarian gallery slots.
"""
import json, re, subprocess, time, urllib.request, urllib.error
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
KEY = open("/tmp/heygen_key.txt").read().strip()
FF, FP = "/opt/homebrew/bin/ffmpeg", "/opt/homebrew/bin/ffprobe"
DISP = str(ROOT / "scripts/.fonts/Bricolage.ttf"); SANS = str(ROOT / "scripts/.fonts/Hanken.ttf")
LOOK = "9b790b0358e344ea91040c2041e6279c"      # Tyler lawn (leak persona)
VOICE = "92071a8742744d17bc92a02baab2941f"     # Real Tyler (no emotion)
W, H = 1080, 1920
NAVY = (10, 22, 40); MINT = (0, 229, 160); PAPER = (248, 250, 252)
WORK = ROOT / "build/leakx"; WORK.mkdir(parents=True, exist_ok=True)
CUTS = [6.5, 7.0, 6.0, 7.5]                    # FEW, gentle reframes (~3 cuts total) — let the delivery breathe
ZOOMS = [1.0, 1.07, 1.03, 1.09]                # subtle punch, not aggressive

# Warm CR-voice scripts (pause-punctuated for emotional cadence). Reframed: second
# person, no fabricated contractor identity. Paired with expressiveness:high + cues.
VARIANTS = [
 ("leak-stat", ["98 OF 100", "GONE"],
  "Ninety-eight... out of a hundred. That's how many people find your website... and just leave. No name. No email. Nothing you can do with it. And the part that really gets me? You paid for every single one of those clicks. But here's what nobody tells you. The ones who actually opted in — they don't have to disappear. We hand them back to you. A real person. A real email. What they came looking for. Seven dollars, yours alone. If you want, the link shows you who you've been missing.",
  "See who you missed  →"),
 ("leak-confession", ["YOUR SITE", "ISN'T BROKEN"],
  "Your website... isn't broken. I know it can feel like it is. But it's leaking exactly the way it was built to. All those people who land on it — the ones already interested — most of them just slip away. No name, no email. And you paid for every click. But here's the thing. There's a version where they don't vanish. The ones who opted in come back to you... as real, named leads. Seven dollars. Exclusive, never resold. Want to see it on your own site? The link's right there.",
  "Watch it on your site  →"),
]

def api(u, b=None):
    data = json.dumps(b).encode() if b else None
    r = urllib.request.Request(u, data=data, headers={"X-Api-Key": KEY, "Content-Type": "application/json"})
    try: return json.load(urllib.request.urlopen(r, timeout=180))
    except urllib.error.HTTPError as e: return {"error": e.read().decode()[:200]}
def dur(f): return float(subprocess.check_output([FP,"-v","error","-show_entries","format=duration","-of","csv=p=0",f]).strip())

def fit(draw, text, font_path, hi, lo, maxw):
    s = hi
    while s > lo and draw.textlength(text, font=ImageFont.truetype(font_path, s)) > maxw: s -= 4
    return ImageFont.truetype(font_path, s)

def hook_card(lines, out):
    img = Image.new("RGB", (W, H), NAVY); d = ImageDraw.Draw(img)
    for gy in range(60, H, 60):
        for gx in range(60, W, 60): d.ellipse([gx, gy, gx+2, gy+2], fill=(148,163,184))
    y = H//2 - len(lines)*95
    for i, ln in enumerate(lines):
        f = fit(d, ln, DISP, 168, 70, W-120); col = MINT if i == len(lines)-1 else PAPER
        d.text((W//2, y), ln, font=f, fill=col, anchor="mm"); y += 190
    img.save(out)

def cta_card(text, out):
    img = Image.new("RGBA", (W, H), (0,0,0,0)); d = ImageDraw.Draw(img)
    f = fit(d, text, DISP, 64, 40, W-220); tw = d.textlength(text, font=f)
    bw = int(tw)+90; bh = 116; x = W//2-bw//2; y = int(H*0.80)
    d.rounded_rectangle([x, y, x+bw, y+bh], radius=bh//2, fill=MINT)
    d.text((W//2, y+bh//2), text, font=f, fill=NAVY, anchor="mm"); img.save(out)

CAPF = ImageFont.truetype(SANS, 56)
def karaoke_png(words, active, out):
    img = Image.new("RGBA", (W, H), (0,0,0,0)); d = ImageDraw.Draw(img); lh = 70
    # one-line wrap (<=4 words/cue here), center, black box, mint active word
    lines, cur = [], []
    for w in words:
        if not cur or d.textlength(" ".join(cur+[w]), font=CAPF) <= W-220: cur.append(w)
        else: lines.append(cur); cur=[w]
    if cur: lines.append(cur)
    tw = max(d.textlength(" ".join(l), font=CAPF) for l in lines); bw=int(tw)+60; bh=lh*len(lines)+30
    cx=W//2; y0=int(H*0.66)-bh
    box=Image.new("RGBA",(bw,bh),(0,0,0,0)); ImageDraw.Draw(box).rounded_rectangle([0,0,bw,bh],radius=18,fill=(0,0,0,225))
    img.alpha_composite(box,(cx-bw//2,y0)); gi=0; ty=y0+15
    for l in lines:
        lw=d.textlength(" ".join(l),font=CAPF); x=cx-lw/2
        for w in l:
            d.text((x,ty),w,font=CAPF,fill=(MINT+(255,)) if gi==active else (255,255,255,255)); x+=d.textlength(w+" ",font=CAPF); gi+=1
        ty+=lh
    img.save(out)

def ts(s):
    h,m,rest=s.split(":"); sec,ms=rest.split(","); return int(h)*3600+int(m)*60+int(sec)+int(ms)/1000.0

for slug, cardlines, script, cta in VARIANTS:
    d = WORK/slug; d.mkdir(exist_ok=True)
    print(f">>> {slug}", flush=True)
    # 1) generate caption:true -> clean video + SRT
    body={"caption":True,"video_inputs":[{"character":{"type":"talking_photo","talking_photo_id":LOOK,"use_avatar_iv_model":True,"talking_style":"expressive","super_resolution":True,
            "expressiveness":"high","custom_motion_prompt":"Warm and sincere, like he genuinely cares about the person watching. Slows on the key lines, eyebrows lift on emphasis, a small empathetic smile that comes and goes. Real, conversational, not salesy."},
          "voice":{"type":"text","voice_id":VOICE,"input_text":script,"speed":0.92}}],"dimension":{"width":W,"height":H}}
    vid=(api("https://api.heygen.com/v2/video/generate",body).get("data") or {}).get("video_id")
    src=str(d/"src.mp4"); srt=str(d/"cap.srt"); vurl=curl=None
    for _ in range(72):
        st=api(f"https://api.heygen.com/v1/video_status.get?video_id={vid}").get("data") or {}
        if st.get("status")=="completed":
            vurl=st.get("video_url")
            for _ in range(12):
                curl=(api(f"https://api.heygen.com/v1/video_status.get?video_id={vid}").get("data") or {}).get("caption_url")
                if curl: break
                time.sleep(3)
            break
        if st.get("status")=="failed": raise SystemExit(f"{slug} render failed")
        time.sleep(10)
    urllib.request.urlretrieve(vurl, src)
    if curl: urllib.request.urlretrieve(curl, srt)
    D = dur(src); print(f"  take {D:.1f}s", flush=True)

    # 2) jump-cut segments (preserve duration; per-seg punch)
    segs=[]; t=0.0; i=0
    while t < D-0.05:
        seg_end=min(D, t+CUTS[i%len(CUTS)]); z=ZOOMS[i%len(ZOOMS)]; sf=str(d/f"s{i}.mp4")
        subprocess.run([FF,"-y","-loglevel","error","-ss",f"{t:.3f}","-to",f"{seg_end:.3f}","-i",src,
            "-vf",f"fps=30,scale=trunc({W}*{z}/2)*2:trunc({H}*{z}/2)*2,crop={W}:{H}","-an",
            "-c:v","libx264","-crf","18","-pix_fmt","yuv420p","-r","30",sf],check=True)
        segs.append(sf); t=seg_end; i+=1
    lst=d/"segs.txt"; lst.write_text("".join(f"file '{Path(s).resolve()}'\n" for s in segs))
    jc=str(d/"jc.mp4"); subprocess.run([FF,"-y","-loglevel","error","-f","concat","-safe","0","-i",str(lst),"-c","copy",jc],check=True)

    # 3) cards + karaoke
    hc=str(d/"hook.png"); cc=str(d/"cta.png"); hook_card(cardlines,hc); cta_card(cta,cc)
    cues=[]
    if Path(srt).exists():
        for blk in re.split(r"\n\s*\n", Path(srt).read_text().strip()):
            L=[x for x in blk.splitlines() if x.strip()]; tl=next((x for x in L if "-->" in x),None)
            if not tl: continue
            a,b=[x.strip() for x in tl.split("-->")]; txt=" ".join(L[L.index(tl)+1:]).strip()
            if txt: cues.append((ts(a),ts(b),txt))
    wpng=[]; wwin=[]; gi=0
    for a,b,txt in cues:
        ws=txt.split(); wt=[len(x)+1 for x in ws]; tot=sum(wt); tt=a
        for k,w in enumerate(ws):
            e=b if k==len(ws)-1 else tt+(b-a)*wt[k]/tot
            p=str(d/f"w{gi}.png"); karaoke_png(ws,k,p); wpng.append(p); wwin.append((tt,e)); tt=e; gi+=1

    # 4) compose: jc video + src audio + karaoke + hook card (0-1.8) + soft CTA (~70%)
    ins=["-i",jc,"-i",src,"-i",hc,"-i",cc]+sum([["-i",p] for p in wpng],[])
    fc="[0:v]noise=alls=8:allf=t+u,setsar=1[b0]"
    for k,(s,e) in enumerate(wwin): fc+=f";[b{k}][{4+k}:v]overlay=0:0:enable='between(t,{s:.3f},{e:.3f})'[b{k+1}]"
    bw=len(wpng); cs=0.70*D; ce=min(D-0.2,cs+3.0)
    fc+=f";[b{bw}][2:v]overlay=0:0:enable='between(t,0,1.8)'[bh];[bh][3:v]overlay=0:0:enable='between(t,{cs:.2f},{ce:.2f})'[v]"
    fc+=";[1:a]highpass=f=85,loudnorm=I=-14:TP=-1:LRA=7[a]"
    out=str(ROOT/f"public/reels/test-sprint-{slug}-tiktok.mp4")
    subprocess.run([FF,"-y","-loglevel","error",*ins,"-filter_complex",fc,"-map","[v]","-map","[a]",
        "-c:v","libx264","-b:v","3.5M","-maxrate","3.8M","-bufsize","5M","-pix_fmt","yuv420p","-r","30",
        "-c:a","aac","-b:a","160k","-movflags","+faststart",out],check=True)
    subprocess.run(["/usr/bin/python3",str(ROOT/"scripts/r2_upload.py"),out,f"social/sprint/{slug}.mp4","video/mp4"])
    print(f"<<< {slug} done", flush=True)
print("=== leak experiments done ===", flush=True)
