#!/usr/bin/env python3
"""Two supporting pinned-post graphics (1200x630), on-brand with the cover/reels:
  - fb-support-how.png : 'How it works' 3-step
  - fb-support-vs.png  : '$7 vs the lead sites' comparison
Outputs to public/social/ + uploads to R2."""
import subprocess
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter
ROOT = Path(__file__).resolve().parent.parent
DISP=str(ROOT/"scripts/.fonts/Bricolage.ttf"); SANS=str(ROOT/"scripts/.fonts/Hanken.ttf")
LOGO=ROOT/"public/logo-on-dark.png"
NAVY=(10,22,40); NAVY2=(13,27,42); MINT=(0,229,160); PAPER=(248,250,252); SLATE=(148,163,184); RED=(255,90,90)
disp=lambda p:ImageFont.truetype(DISP,p); sans=lambda p:ImageFont.truetype(SANS,p)
OUT=ROOT/"public/social"; OUT.mkdir(parents=True,exist_ok=True); W,H=1200,630
def fit(d,t,fp,hi,lo,mw):
    s=hi
    while s>lo and d.textlength(t,font=ImageFont.truetype(fp,s))>mw: s-=2
    return ImageFont.truetype(fp,max(12,s))
def bg():
    img=Image.new("RGB",(W,H),NAVY); d=ImageDraw.Draw(img,"RGBA")
    for y in range(H): f=y/H; d.line([(0,y),(W,y)],fill=tuple(int(NAVY2[i]+(NAVY[i]-NAVY2[i])*f) for i in range(3)))
    for gy in range(36,H,46):
        for gx in range(36,W,46): d.ellipse([gx,gy,gx+2,gy+2],fill=(148,163,184,14))
    gl=Image.new("RGBA",(W,H),(0,0,0,0)); ImageDraw.Draw(gl).ellipse([W//2-440,-300,W//2+440,240],fill=(0,229,160,36))
    return Image.alpha_composite(img.convert("RGBA"),gl.filter(ImageFilter.GaussianBlur(150))).convert("RGB")
def logo(img,y=44,w=240):
    lg=Image.open(LOGO).convert("RGBA"); h=int(lg.height*w/lg.width); lg=lg.resize((w,h),Image.LANCZOS); img.paste(lg,(W//2-w//2,y),lg)
def up(p,key): subprocess.run(["/usr/bin/python3",str(ROOT/"scripts/r2_upload.py"),str(p),key,"image/png"],check=False)

# ---- A) How it works (3 steps) ----
img=bg(); d=ImageDraw.Draw(img,"RGBA"); logo(img); cx=W//2
d.text((cx,168),"How it works",font=disp(72),fill=PAPER,anchor="mm")
steps=[("1","Someone lands on","your website"),("2","They opt in","consent-first"),("3","You get a named lead","$7 · exclusive")]
colw=W//3
for i,(n,a,b) in enumerate(steps):
    ccx=colw*i+colw//2; ry=330; r=46
    d.ellipse([ccx-r,ry-r,ccx+r,ry+r],fill=(0,229,160,28),outline=MINT,width=3)
    d.text((ccx,ry),n,font=disp(56),fill=MINT,anchor="mm")
    d.text((ccx,ry+96),a,font=fit(d,a,SANS,32,22,colw-40),fill=PAPER,anchor="mm")
    d.text((ccx,ry+138),b,font=fit(d,b,SANS,30,20,colw-40),fill=SLATE,anchor="mm")
    if i<2: d.text((colw*i+colw-14,ry),"→",font=disp(48),fill=SLATE,anchor="mm")
d.text((cx,590),"consentresolve.com/demo",font=disp(38),fill=MINT,anchor="mm")
pA=OUT/"fb-support-how.png"; img.save(pA); up(pA,"social/brand/fb-support-how.png")

# ---- B) $7 vs the lead sites ----
img=bg(); d=ImageDraw.Draw(img,"RGBA"); logo(img); cx=W//2
d.text((cx,168),"Same job. Different math.",font=disp(60),fill=PAPER,anchor="mm")
def col(x0,x1,title,tcol,rows):
    d.rounded_rectangle([x0,250,x1,560],radius=18,fill=(255,255,255,8),outline=(tcol[0],tcol[1],tcol[2],120),width=2)
    cxx=(x0+x1)//2
    d.text((cxx,300),title,font=fit(d,title,DISP,40,26,x1-x0-40),fill=tcol,anchor="mm")
    y=370
    for r in rows: d.text((cxx,y),r,font=fit(d,r,SANS,30,20,x1-x0-50),fill=PAPER if tcol==MINT else SLATE,anchor="mm"); y+=52
col(70,560,"The lead sites",RED,["$100+ a lead","Sold to 4 contractors","A credit, not a refund","You stay anonymous"])
col(640,1130,"Consent Resolve",MINT,["$7 a lead","Exclusive to you","Consent-first","Never resold"])
d.text((cx,405),"vs",font=disp(44),fill=PAPER,anchor="mm")
pB=OUT/"fb-support-vs.png"; img.save(pB); up(pB,"social/brand/fb-support-vs.png")
print("wrote",pA.name,pB.name)
