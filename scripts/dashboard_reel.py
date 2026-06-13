#!/usr/bin/env python3
"""Non-UGC 'product-beat' reel: the real Consent Resolve dashboard in the locked
brand style (navy/mint, logo, Suno music). 3 panels (headline -> dashboard ->
CTA) with ken-burns + crossfade. 1080x1920, ~14s. No person (non-UGC).
Output: public/reels/reel-dashboard-locked.mp4
"""
import subprocess
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT=Path("/Users/aaronphillips/GIT/consentresolve2")
OUT=ROOT/"public/reels"; TMP=ROOT/"build/dash"; TMP.mkdir(parents=True,exist_ok=True)
FF="/opt/homebrew/bin/ffmpeg"
NAVY=(10,22,40); NAVY8=(13,27,42); MINT=(0,229,160); WHITE=(245,248,250); SLATE=(150,170,185)
W,H=1080,1920
BRI=str(ROOT/"scripts/.fonts/Bricolage.ttf"); HAN=str(ROOT/"scripts/.fonts/Hanken.ttf")
MUSIC=str(ROOT/"assets/audio/cr-music/no-vocals/inst-new4.mp3")
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

LOGO=Image.open(ROOT/"public/logo-on-dark.png").convert("RGBA")
def base():
    img=Image.new("RGB",(W,H),NAVY); d=ImageDraw.Draw(img,"RGBA")
    for y in range(H):
        f=y/H; d.line([(0,y),(W,y)],fill=tuple(int(NAVY8[i]+(NAVY[i]-NAVY8[i])*f) for i in range(3)))
    for gx in range(60,W,56):
        for gy in range(60,H,56): d.ellipse([gx,gy,gx+2,gy+2],fill=(148,163,184,12))
    lw=460; lh=int(LOGO.height*lw/LOGO.width); img.paste(LOGO.resize((lw,lh),Image.LANCZOS),(W//2-lw//2,120),LOGO.resize((lw,lh),Image.LANCZOS))
    return img

def panelA(p):
    img=base(); d=ImageDraw.Draw(img)
    fe=F(HAN,46); ey=" ".join("THE PRODUCT"); d.text((cx(d,ey,fe),520),ey,font=fe,fill=MINT)
    fh=F(BRI,92); y=720
    for ln in ["This is what recovering","your own traffic","looks like."]:
        d.text((cx(d,ln,fh),y),ln,font=fh,fill=WHITE); y+=110
    img.save(p)

def panelB(p):
    img=base(); d=ImageDraw.Draw(img)
    fh=F(BRI,60); d.text((cx(d,"Your dashboard, live.",fh),470),"Your dashboard, live.",font=fh,fill=WHITE)
    dash=Image.open(ROOT/"assets/img/dashboard.png").convert("RGB")
    cw=1000; ch=int(dash.height*cw/dash.width); dash=dash.resize((cw,ch),Image.LANCZOS)
    mask=Image.new("L",(cw,ch),0); ImageDraw.Draw(mask).rounded_rectangle([0,0,cw,ch],radius=24,fill=255)
    cy=600; cxp=W//2-cw//2
    d.rounded_rectangle([cxp-4,cy-4,cxp+cw+4,cy+ch+4],radius=28,outline=MINT,width=4)
    img.paste(dash,(cxp,cy),mask)
    fb=F(HAN,44); sub="Real metrics from traffic you already paid for."
    d.text((cx(d,sub,fb),cy+ch+44),sub,font=fb,fill=SLATE)
    img.save(p)

def panelC(p):
    img=base(); d=ImageDraw.Draw(img)
    fh=F(BRI,76); d.text((cx(d,"See it on your own site.",fh),760),"See it on your own site.",font=fh,fill=MINT)
    bw,bh=720,118; bx=W//2-bw//2; by=940
    d.rounded_rectangle([bx,by,bx+bw,by+bh],radius=bh//2,fill=MINT)
    fp=F(BRI,52); d.text((cx(d,"consentresolve.com/demo",fp),by+bh//2-30),"consentresolve.com/demo",font=fp,fill=NAVY)
    fs=F(HAN,42); s="Exclusive, consent-first leads · $7 each"
    d.text((cx(d,s,fs),1120),s,font=fs,fill=SLATE)
    img.save(p)

def kb(png,out,zin,secs):
    z="min(zoom+0.0004,1.05)" if zin else "if(eq(on,1),1.05,max(zoom-0.0004,1.0))"
    nf=int(secs*25)
    subprocess.run([FF,"-y","-loglevel","error","-loop","1","-i",png,
        "-vf",f"scale=1296:2304,zoompan=z='{z}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={nf}:s=1080x1920:fps=25,format=yuv420p",
        "-frames:v",str(nf),"-r","25","-c:v","libx264","-crf","18",out],check=True)

A,B,C=str(TMP/"a.png"),str(TMP/"b.png"),str(TMP/"c.png")
panelA(A); panelB(B); panelC(C)
ca,cb,cc=str(TMP/"a.mp4"),str(TMP/"b.mp4"),str(TMP/"c.mp4")
kb(A,ca,True,3.6); kb(B,cb,True,8.0); kb(C,cc,False,4.0)
silent=str(TMP/"silent.mp4")
subprocess.run([FF,"-y","-loglevel","error","-i",ca,"-i",cb,"-i",cc,"-filter_complex",
  "[0][1]xfade=transition=fade:duration=0.6:offset=3.0[ab];[ab][2]xfade=transition=fade:duration=0.6:offset=10.4,"
  "fade=t=in:st=0:d=0.4,fade=t=out:st=13.4:d=0.4,format=yuv420p[v]","-map","[v]",silent],check=True)
out=str(OUT/"reel-dashboard-locked.mp4")
subprocess.run([FF,"-y","-loglevel","error","-i",silent,"-stream_loop","-1","-i",MUSIC,
  "-map","0:v","-map","1:a","-af","loudnorm=I=-14:TP=-1.5:LRA=11","-c:v","libx264","-b:v","3.5M",
  "-pix_fmt","yuv420p","-c:a","aac","-b:a","160k","-shortest","-movflags","+faststart",out],check=True)
print("built ->",out)
