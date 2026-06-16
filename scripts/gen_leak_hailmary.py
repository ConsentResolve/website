#!/usr/bin/env python3
"""HAIL MARY (leak-contrarian slot). No avatar, no rules — a kinetic 'GHOSTED'
data-horror-to-hope reel: 100 visitors appear, 98 vanish before your eyes while a
counter climbs, two survive and glow, then the turn. Motion + sound carry the
emotion. CR voice (no fabricated identity). Output overwrites leak-contrarian."""
import math, random, subprocess
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
FF = "/opt/homebrew/bin/ffmpeg"
DISP = str(ROOT/"scripts/.fonts/Bricolage.ttf"); SANS = str(ROOT/"scripts/.fonts/Hanken.ttf")
MUSIC = str(ROOT/"assets/audio/CR1.mp3")
W, Hh, FPS = 1080, 1920, 30
NAVY=(8,17,33); NAVY2=(13,27,42); MINT=(0,229,160); PAPER=(248,250,252); RED=(255,90,90); SLATE=(90,105,130)
WORK = ROOT/"build/hailmary"; WORK.mkdir(parents=True, exist_ok=True)
FR = WORK/"frames";
import shutil; shutil.rmtree(FR, ignore_errors=True); FR.mkdir()
disp=lambda p:ImageFont.truetype(DISP,p); sans=lambda p:ImageFont.truetype(SANS,p)
SCR=ImageDraw.Draw(Image.new("RGB",(8,8)))
def fit(t,maxw,hi,lo,fn):
    s=hi
    while s>lo and SCR.textlength(t,font=fn(s))>maxw: s-=3
    return fn(s)
def clamp(x,a=0,b=1): return max(a,min(b,x))
def eo(x): x=clamp(x); return 1-(1-x)**3
def eob(x): x=clamp(x); return 1+2.7*((x-1)**3)+1.7*((x-1)**2)
def ct(dr,y,t,fn,c,a=255,dx=0):
    r,g,b=c; dr.text((W//2+dx,y),t,font=fn,fill=(r,g,b,int(a)),anchor="mm")

# dot grid (10x10), shuffled vanish order; last 2 are the survivors
COLS=ROWS=10; SP=78; R=19; GX0=W//2-(COLS-1)*SP//2; GY0=720
DOTS=[(GX0+c*SP, GY0+r*SP) for r in range(ROWS) for c in range(COLS)]
order=list(range(100)); random.Random(7).shuffle(order)
SURV=order[-2:]                          # two that survive
vanish_order=[i for i in order if i not in SURV]

def base(bright=0.0):
    img=Image.new("RGB",(W,Hh),tuple(int(NAVY[i]+(NAVY2[i]-NAVY[i])*0.5) for i in range(3)))
    dr=ImageDraw.Draw(img,"RGBA")
    for gy in range(60,Hh,60):
        for gx in range(60,W,60): dr.ellipse([gx,gy,gx+2,gy+2],fill=(148,163,184,14))
    if bright>0:
        gl=Image.new("RGBA",(W,Hh),(0,0,0,0)); ImageDraw.Draw(gl).ellipse([W//2-460,420,W//2+460,1180],fill=(0,229,160,int(60*bright)))
        img=Image.alpha_composite(img.convert("RGBA"),gl.filter(ImageFilter.GaussianBlur(150))).convert("RGB")
    return img

SCENES=[("open",1.4),("fill",2.0),("vanish",3.2),("hold",1.4),("flip",3.2),("cta",2.6)]
TOTAL=sum(d for _,d in SCENES)

def draw_dots(dr,present_set,glow=False,a=255):
    for i,(x,y) in enumerate(DOTS):
        if i in present_set:
            col=MINT
            if glow and i in SURV:
                pr=R+6
                dr.ellipse([x-pr,y-pr,x+pr,y+pr],fill=(0,229,160,70))
            dr.ellipse([x-R,y-R,x+R,y+R],fill=(col[0],col[1],col[2],a))

def render(scene,t,d,gi):
    bright=eo(t/d) if scene=="flip" else (1.0 if scene=="cta" else 0.0)
    img=base(bright); dr=ImageDraw.Draw(img,"RGBA"); jit=random.Random(gi)
    if scene=="open":
        s=eob(t/0.5); a=clamp(t/0.25)*255
        dx=jit.randint(-5,5) if t<0.9 else 0
        ct(dr,Hh//2-40,"GHOSTED",disp(max(14,int(190*min(1,s)))),RED,a,dx)
        if t>0.7: ct(dr,Hh//2+150,"your website, every day.",sans(46),SLATE,int(220*clamp((t-0.7)/0.3)))
    elif scene=="fill":
        a=clamp(t/0.4)
        ct(dr,470,"100 people found you today.",fit("100 people found you today.",940,60,40,sans),PAPER,int(255*a))
        draw_dots(dr,set(range(100)),a=int(255*a))
    elif scene=="vanish":
        p=eo(t/d); gone=int(round(98*p)); present=set(range(100))-set(vanish_order[:gone])
        sh=jit.randint(-3,3)  # tension jitter
        draw_dots(dr,present,a=255)
        ct(dr,430,str(gone),disp(150),RED,255,sh)
        ct(dr,565,"gone — anonymous.",fit("gone — anonymous.",900,52,34,sans),SLATE)
        if t>1.2: ct(dr,1500,"you paid for every click.",fit("you paid for every click.",900,52,34,sans),PAPER,int(230*clamp((t-1.2)/0.3)))
    elif scene=="hold":
        pulse=0.6+0.4*math.sin(2*math.pi*t*1.6)
        draw_dots(dr,set(SURV),glow=True,a=int(255*(0.7+0.3*pulse)))
        ct(dr,420,"2 opted in.",fit("2 opted in.",900,90,56,disp),MINT)
        ct(dr,560,"You can actually reach them.",fit("You can actually reach them.",940,46,30,sans),PAPER,230)
    elif scene=="flip":
        a=clamp(t/0.3)
        ct(dr,560,"The two who opted in?",fit("The two who opted in?",980,72,46,disp),PAPER,int(255*a))
        ct(dr,690,"We turn them into real, named leads.",fit("We turn them into real, named leads.",1000,58,36,disp),MINT,int(255*a))
        if t>1.0:
            b=clamp((t-1.0)/0.4)
            ct(dr,1000,"Real  ·  Named  ·  Exclusive",fit("Real  ·  Named  ·  Exclusive",960,52,34,sans),PAPER,int(235*b))
            ct(dr,1130,"$7",disp(max(14,int(150*eob(b)))),MINT,int(255*b)); ct(dr,1250,"never resold",sans(40),SLATE,int(220*b))
    elif scene=="cta":
        a=clamp(t/0.3); pulse=1+0.03*math.sin(2*math.pi*t*2)
        ct(dr,820,"See who you're losing.",fit("See who you're losing.",940,72,46,disp),PAPER,int(255*a))
        bw=int(720*pulse); bh=int(118*pulse); bx=W//2-bw//2; by=960
        dr.rounded_rectangle([bx,by,bx+bw,by+bh],radius=bh//2,fill=MINT)
        ct(dr,by+bh//2,"consentresolve.com/demo",fit("consentresolve.com/demo",bw-60,50,32,disp),NAVY)
    return img.convert("RGB")

gi=0
for scene,d in SCENES:
    n=int(round(d*FPS))
    for f in range(n):
        render(scene,f/FPS,d,gi).save(f"{FR}/{gi:05d}.png"); gi+=1
print("frames",gi,flush=True)
sil=str(WORK/"v.mp4")
subprocess.run([FF,"-y","-loglevel","error","-framerate","30","-i",f"{FR}/%05d.png","-c:v","libx264","-pix_fmt","yuv420p","-b:v","10M","-r","30",sil],check=True)
# audio: music bed + a low dread drone during the vanish (3.4-6.6s), then loudnorm
out=str(ROOT/"public/reels/test-sprint-leak-contrarian-tiktok.mp4")
subprocess.run([FF,"-y","-loglevel","error","-i",sil,
  "-stream_loop","-1","-i",MUSIC,
  "-f","lavfi","-t",f"{TOTAL:.2f}","-i","sine=frequency=46",
  "-filter_complex",
  f"[1:a]atrim=0:{TOTAL:.2f},volume=0.5[m];[2:a]volume='0.28*between(t,3.4,6.6)':eval=frame[d];[m][d]amix=inputs=2:duration=first,loudnorm=I=-14:TP=-1:LRA=7[a]",
  "-map","0:v","-map","[a]","-t",f"{TOTAL:.2f}",
  "-c:v","libx264","-b:v","3.5M","-maxrate","3.8M","-bufsize","5M","-pix_fmt","yuv420p","-r","30",
  "-c:a","aac","-b:a","160k","-movflags","+faststart",out],check=True)
subprocess.run(["/usr/bin/python3",str(ROOT/"scripts/r2_upload.py"),out,"social/sprint/leak-contrarian.mp4","video/mp4"])
print("hailmary done ->",out,flush=True)
