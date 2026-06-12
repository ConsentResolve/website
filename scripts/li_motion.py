#!/usr/bin/env python3
"""Non-UGC branded motion clips for the personal LinkedIn feed (no avatar/person).
Each clip = 2 brand panels (problem -> flip) with slow ken-burns + crossfade,
1080x1350 (4:5, LinkedIn feed), silent (text-driven). Navy/mint, Heartbeat-v2.
Output: build/li/<topic>.mp4
"""
import subprocess
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT=Path("/Users/aaronphillips/GIT/consentresolve2")
OUT=ROOT/"build/li"; OUT.mkdir(parents=True,exist_ok=True)
TMP=OUT/"panels"; TMP.mkdir(exist_ok=True)
FF="/opt/homebrew/bin/ffmpeg"
NAVY=(10,22,40); MINT=(0,229,160); WHITE=(245,248,250); MUTE=(150,170,185)
W,H=1080,1350
BRI=str(ROOT/"scripts/.fonts/Bricolage.ttf"); HAN=str(ROOT/"scripts/.fonts/Hanken.ttf")

def F(p,s): return ImageFont.truetype(p,s)
def cx(d,t,f): b=d.textbbox((0,0),t,font=f); return (W-(b[2]-b[0]))//2-b[0]
def wrap(d,t,f,mw):
    out=[];cur=""
    for w in t.split():
        s=(cur+" "+w).strip()
        if d.textlength(s,font=f)<=mw: cur=s
        else: out.append(cur);cur=w
    if cur: out.append(cur)
    return out

def panel(path, eyebrow, big, lines, footer=None):
    img=Image.new("RGB",(W,H),NAVY); d=ImageDraw.Draw(img)
    # mint check top
    d.line([(W//2-55,210),(W//2-17,250),(W//2+66,158)],fill=MINT,width=28,joint="curve")
    y=380
    fe=F(HAN,44); ey=" ".join(eyebrow.upper()); d.text((cx(d,ey,fe),y),ey,font=fe,fill=MINT); y+=120
    fb=F(BRI,250); d.text((cx(d,big,fb),y),big,font=fb,fill=MINT); y+=300
    fl=F(HAN,52)
    for line in lines:
        for ln in wrap(d,line,fl,W-200):
            d.text((cx(d,ln,fl),y),ln,font=fl,fill=WHITE if line is lines[0] else MUTE); y+=70
        y+=12
    if footer:
        ff=F(HAN,46); d.text((cx(d,footer,ff),H-150),footer,font=ff,fill=MINT)
    img.save(path)

def kb(png,out,zin):  # ken-burns 5s (125 output frames @25fps from one looped image)
    z = "min(zoom+0.00045,1.06)" if zin else "if(eq(on,1),1.06,max(zoom-0.00045,1.0))"
    subprocess.run([FF,"-y","-loglevel","error","-loop","1","-i",png,
        "-vf",f"scale=1296:1620,zoompan=z='{z}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=125:s=1080x1350:fps=25,format=yuv420p",
        "-frames:v","125","-r","25","-c:v","libx264","-crf","18",out],check=True)

def clip(topic, A, B):
    a=str(TMP/f"{topic}-a.png"); b=str(TMP/f"{topic}-b.png")
    panel(a,*A); panel(b,*B)
    ca=str(TMP/f"{topic}-a.mp4"); cb=str(TMP/f"{topic}-b.mp4")
    kb(a,ca,True); kb(b,cb,False)
    out=str(OUT/f"{topic}.mp4")
    subprocess.run([FF,"-y","-loglevel","error","-i",ca,"-i",cb,
        "-filter_complex","[0][1]xfade=transition=fade:duration=0.6:offset=4.4,fade=t=in:st=0:d=0.4,fade=t=out:st=9:d=0.4,format=yuv420p",
        "-c:v","libx264","-b:v","3.5M","-pix_fmt","yuv420p","-movflags","+faststart",out],check=True)
    print("  ->",out)

TOPICS=[
 ("leak",
  ("The leak","98/100",["leave your website without a trace.","You paid for every click."]),
  ("The fix","$7",["Real, consent-first leads from your own traffic.","Exclusive. Never resold.","consentresolve.com"])),
 ("math",
  ("Shared lead","$100",["for a lead you split with three others","and close maybe 5% of the time."]),
  ("Your traffic","$7",["for an exclusive lead from someone","already on your website.","consentresolve.com"])),
 ("ownership",
  ("Rented","Gone",["Your leads live in someone else's dashboard.","One policy change and it vanishes."]),
  ("Owned","Yours",["Your website is the one pipe you control.","Recover the visitors you paid for.","consentresolve.com"])),
]
for t in TOPICS:
    print(t[0]); clip(*t)
print("done")
