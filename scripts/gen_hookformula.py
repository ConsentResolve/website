#!/usr/bin/env python3
"""Hook-formula rebuilds (invoice + robot): visual-disruption open card, cuts every
2-4s, open loop, ONE idea, karaoke (captions low/off-face), soft CTA ~70%, branded
end-card. CR voice (no fabricated identity). Jason, real voice. Replaces the two
scrapped reels at <slug>-new.mp4. Usage: python3 scripts/gen_hookformula.py [slug]"""
import json, re, subprocess, time, urllib.request, urllib.error, sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT/"scripts"))
from video_scripts import job_for
KEY = open("/tmp/heygen_key.txt").read().strip()
FF, FP = "/opt/homebrew/bin/ffmpeg", "/opt/homebrew/bin/ffprobe"
DISP=str(ROOT/"scripts/.fonts/Bricolage.ttf"); SANS=str(ROOT/"scripts/.fonts/Hanken.ttf"); LOGO=ROOT/"public/logo-on-dark.png"; MUSIC=str(ROOT/"assets/audio/CR1.mp3")
W,H=1080,1920; NAVY=(8,17,33); MINT=(0,229,160); PAPER=(248,250,252)
WORK=ROOT/"build/hookf"; WORK.mkdir(parents=True,exist_ok=True)
CUTS=[2.6,3.2,2.4,3.4,2.8]; ZOOMS=[1.0,1.15,1.06,1.20,1.08]   # 2-4s cuts, punchy
MOTION="Confident and direct, a touch of dry humor. Leans in on the hook, eyebrow raise on the numbers, a wry half-smile. Talking straight to another contractor."
PRON={r"\bleads\b":"leeds",r"\blead\b":"leed"}
def spoken(t):
    for rx,rep in PRON.items(): t=re.sub(rx,rep,t,flags=re.I)
    return t
def capfix(t):
    t=re.sub(r"\bleeds\b","leads",t,flags=re.I); return re.sub(r"\bleed\b","lead",t,flags=re.I)

ITEMS = {
 "invoice-new": (job_for("invoice")["look"], job_for("invoice")["voice"], ["ADD UP YOUR","LEAD SPEND"],
   "Add up what you spent on leads last month. Now sit down for this. Most of the people you paid to bring to your site, they left. No name, no email, nothing. You bought the clicks, and watched the bounce. But the ones who opt in don't have to vanish. We hand them back to you, real, named, exclusive, seven dollars. Your own traffic, finally working for you.",
   "See your number  →"),
 "robot-new": (job_for("robot")["look"], job_for("robot")["voice"], ["BILLED $400","FOR HIS OWN CUSTOMER"],
   "A contractor got charged four hundred bucks. Want to know why? His own customer called him back, from a number the system didn't recognize. So an algorithm flagged it, and billed him. No appeal. No human. That's the bought-lead machine, it decides what you owe and you just pay. Your own website never does that. The people who opt in come back to you, real, named, exclusive, seven dollars. Nobody writes your invoices but you.",
   "Take it back  →"),
}
want = sys.argv[1:] or list(ITEMS)

def api(u,b=None):
    data=json.dumps(b).encode() if b else None
    r=urllib.request.Request(u,data=data,headers={"X-Api-Key":KEY,"Content-Type":"application/json"})
    try: return json.load(urllib.request.urlopen(r,timeout=180))
    except urllib.error.HTTPError as e: return {"error":e.read().decode()[:200]}
def dur(f): return float(subprocess.check_output([FP,"-v","error","-show_entries","format=duration","-of","csv=p=0",f]).strip())
def fit(d,t,fp,hi,lo,mw):
    s=hi
    while s>lo and d.textlength(t,font=ImageFont.truetype(fp,s))>mw: s-=3
    return ImageFont.truetype(fp,max(12,s))
CAPF=ImageFont.truetype(SANS,56)
def hook_card(lines,out):
    img=Image.new("RGB",(W,H),NAVY); d=ImageDraw.Draw(img)
    for gy in range(60,H,60):
        for gx in range(60,W,60): d.ellipse([gx,gy,gx+2,gy+2],fill=(148,163,184))
    y=H//2-len(lines)*95
    for i,ln in enumerate(lines):
        f=fit(d,ln,DISP,168,70,W-120); d.text((W//2,y),ln,font=f,fill=(MINT if i==len(lines)-1 else PAPER),anchor="mm"); y+=190
    img.save(out)
def cta_card(text,out):
    img=Image.new("RGBA",(W,H),(0,0,0,0)); d=ImageDraw.Draw(img)
    f=fit(d,text,DISP,64,40,W-220); tw=d.textlength(text,font=f); bw=int(tw)+90; bh=116; x=W//2-bw//2; y=int(H*0.80)
    d.rounded_rectangle([x,y,x+bw,y+bh],radius=bh//2,fill=MINT); d.text((W//2,y+bh//2),text,font=f,fill=NAVY,anchor="mm"); img.save(out)
def karaoke(words,active,out):
    img=Image.new("RGBA",(W,H),(0,0,0,0)); d=ImageDraw.Draw(img); lh=70
    lines,cur=[],[]
    for w in words:
        if not cur or d.textlength(" ".join(cur+[w]),font=CAPF)<=W-220: cur.append(w)
        else: lines.append(cur); cur=[w]
    if cur: lines.append(cur)
    tw=max(d.textlength(" ".join(l),font=CAPF) for l in lines); bw=int(tw)+60; bh=lh*len(lines)+30; cx=W//2; y0=int(H*0.82)-bh
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

# branded end-card (built once)
ENDPNG=str(WORK/"end.png")
img=Image.new("RGB",(W,H),NAVY); d=ImageDraw.Draw(img)
for gy in range(60,H,60):
    for gx in range(60,W,60): d.ellipse([gx,gy,gx+2,gy+2],fill=(148,163,184))
try:
    lg=Image.open(LOGO).convert("RGBA"); lw=560; lh2=int(lg.height*lw/lg.width); lg=lg.resize((lw,lh2),Image.LANCZOS); img.paste(lg,(W//2-lw//2,560),lg)
except Exception: pass
d.text((W//2,980),"Exclusive, consent-first leads.",font=fit(d,"Exclusive, consent-first leads.",DISP,56,36,940),fill=PAPER,anchor="mm")
d.text((W//2,1090),"$7 each  ·  never resold",font=ImageFont.truetype(SANS,46),fill=MINT,anchor="mm")
d.rounded_rectangle([W//2-360,1230,W//2+360,1350],radius=60,fill=MINT); d.text((W//2,1290),"consentresolve.com/demo",font=fit(d,"consentresolve.com/demo",DISP,52,32,660),fill=NAVY,anchor="mm")
img.save(ENDPNG)
ENDCLIP=str(WORK/"end.mp4")
subprocess.run([FF,"-y","-loglevel","error","-loop","1","-t","2.6","-i",ENDPNG,"-stream_loop","-1","-i",MUSIC,
  "-filter_complex","[0:v]fps=30,format=yuv420p[v];[1:a]atrim=0:2.6,afade=t=in:st=0:d=0.4,afade=t=out:st=2.0:d=0.6,volume=0.5[a]",
  "-map","[v]","-map","[a]","-t","2.6","-c:v","libx264","-pix_fmt","yuv420p","-r","30","-c:a","aac","-b:a","160k",ENDCLIP],check=True)

for slug in want:
    look,voice,card,script,cta=ITEMS[slug]; d=WORK/slug; d.mkdir(exist_ok=True); print(f">>> {slug}",flush=True)
    body={"caption":True,"video_inputs":[{"character":{"type":"talking_photo","talking_photo_id":look,"use_avatar_iv_model":True,"talking_style":"expressive","super_resolution":True,"expressiveness":"high","custom_motion_prompt":MOTION},
          "voice":{"type":"text","voice_id":voice,"input_text":spoken(script),"speed":0.95}}],"dimension":{"width":W,"height":H}}
    vid=(api("https://api.heygen.com/v2/video/generate",body).get("data") or {}).get("video_id")
    src=str(d/"src.mp4"); srt=str(d/"cap.srt"); vurl=cu=None
    for _ in range(80):
        st=api(f"https://api.heygen.com/v1/video_status.get?video_id={vid}").get("data") or {}
        if st.get("status")=="completed":
            vurl=st.get("video_url")
            for _ in range(12):
                cu=(api(f"https://api.heygen.com/v1/video_status.get?video_id={vid}").get("data") or {}).get("caption_url")
                if cu: break
                time.sleep(3)
            break
        if st.get("status")=="failed": print(f"!!! {slug} failed"); break
        time.sleep(10)
    if not vurl: print(f"!!! {slug} no video"); continue
    urllib.request.urlretrieve(vurl,src)
    if cu: urllib.request.urlretrieve(cu,srt)
    D=dur(src)
    segs=[]; t=0.0; i=0
    while t<D-0.05:
        e=min(D,t+CUTS[i%len(CUTS)]); z=ZOOMS[i%len(ZOOMS)]; sf=str(d/f"s{i}.mp4")
        subprocess.run([FF,"-y","-loglevel","error","-ss",f"{t:.3f}","-to",f"{e:.3f}","-i",src,"-vf",f"fps=30,scale=trunc({W}*{z}/2)*2:trunc({H}*{z}/2)*2,crop={W}:{H}","-an","-c:v","libx264","-crf","18","-pix_fmt","yuv420p","-r","30",sf],check=True)
        segs.append(sf); t=e; i+=1
    lst=d/"segs.txt"; lst.write_text("".join(f"file '{Path(s).resolve()}'\n" for s in segs))
    jc=str(d/"jc.mp4"); subprocess.run([FF,"-y","-loglevel","error","-f","concat","-safe","0","-i",str(lst),"-c","copy",jc],check=True)
    hc=str(d/"hook.png"); cc=str(d/"cta.png"); hook_card(card,hc); cta_card(cta,cc)
    cues=[]
    if Path(srt).exists():
        for blk in re.split(r"\n\s*\n",Path(srt).read_text().strip()):
            L=[x for x in blk.splitlines() if x.strip()]; tl=next((x for x in L if "-->" in x),None)
            if not tl: continue
            a,b=[x.strip() for x in tl.split("-->")]; txt=" ".join(L[L.index(tl)+1:]).strip()
            if txt: cues.append((ts(a),ts(b),capfix(txt)))
    wp=[]; ww=[]; gi=0
    for a,b,txt in cues:
        ws=txt.split(); wt=[len(x)+1 for x in ws]; tot=sum(wt); tt=a
        for k,w in enumerate(ws):
            e=b if k==len(ws)-1 else tt+(b-a)*wt[k]/tot
            p=str(d/f"w{gi}.png"); karaoke(ws,k,p); wp.append(p); ww.append((tt,e)); tt=e; gi+=1
    ins=["-i",jc,"-i",src,"-i",hc,"-i",cc]+sum([["-i",p] for p in wp],[])
    fc="[0:v]noise=alls=8:allf=t+u,setsar=1[b0]"
    for k,(s,e) in enumerate(ww): fc+=f";[b{k}][{4+k}:v]overlay=0:0:enable='between(t,{s:.3f},{e:.3f})'[b{k+1}]"
    bw=len(wp); cs=0.70*D; ce=min(D-0.2,cs+3.0)
    fc+=f";[b{bw}][2:v]overlay=0:0:enable='between(t,0,1.6)'[bh];[bh][3:v]overlay=0:0:enable='between(t,{cs:.2f},{ce:.2f})'[v]"
    fc+=";[1:a]highpass=f=85,loudnorm=I=-14:TP=-1:LRA=7[a]"
    bodymp4=str(d/"body.mp4")
    subprocess.run([FF,"-y","-loglevel","error",*ins,"-filter_complex",fc,"-map","[v]","-map","[a]","-c:v","libx264","-b:v","3.5M","-maxrate","3.8M","-bufsize","5M","-pix_fmt","yuv420p","-r","30","-c:a","aac","-b:a","160k",bodymp4],check=True)
    out=str(ROOT/f"public/reels/test-sprint-{slug}-tiktok.mp4")
    subprocess.run([FF,"-y","-loglevel","error","-i",bodymp4,"-i",ENDCLIP,"-filter_complex","[0:v][0:a][1:v][1:a]concat=n=2:v=1:a=1[v][a]","-map","[v]","-map","[a]","-c:v","libx264","-b:v","3.5M","-maxrate","3.8M","-bufsize","5M","-pix_fmt","yuv420p","-r","30","-c:a","aac","-b:a","160k","-movflags","+faststart",out],check=True)
    subprocess.run(["/usr/bin/python3",str(ROOT/"scripts/r2_upload.py"),out,f"social/sprint/{slug}.mp4","video/mp4"])
    print(f"<<< {slug} done",flush=True)
print("=== hookformula done ===",flush=True)
