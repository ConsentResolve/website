#!/usr/bin/env python3
"""FB/IG brand graphics matched to the cover + reels: profile picture, a 1200x630
pinned/featured image, and a 5-piece story/highlight cover set. Navy + mint + dot
grid + glow, Bricolage/Hanken. Outputs to public/social/ + uploads to R2."""
import subprocess
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
DISP=str(ROOT/"scripts/.fonts/Bricolage.ttf"); SANS=str(ROOT/"scripts/.fonts/Hanken.ttf")
LOGO=ROOT/"public/logo-on-dark.png"; MARK=ROOT/"public/favicon.png"
NAVY=(10,22,40); NAVY2=(13,27,42); MINT=(0,229,160); PAPER=(248,250,252); SLATE=(148,163,184); RED=(255,90,90)
disp=lambda p:ImageFont.truetype(DISP,p); sans=lambda p:ImageFont.truetype(SANS,p)
OUT=ROOT/"public/social"; OUT.mkdir(parents=True,exist_ok=True)
def fit(d,t,fp,hi,lo,mw):
    s=hi
    while s>lo and d.textlength(t,font=ImageFont.truetype(fp,s))>mw: s-=3
    return ImageFont.truetype(fp,max(12,s))

def bg(W,H,glow_y=-0.4):
    img=Image.new("RGB",(W,H),NAVY); d=ImageDraw.Draw(img,"RGBA")
    for y in range(H): f=y/H; d.line([(0,y),(W,y)],fill=tuple(int(NAVY2[i]+(NAVY[i]-NAVY2[i])*f) for i in range(3)))
    step=max(40,W//34)
    for gy in range(40,H,step):
        for gx in range(40,W,step): d.ellipse([gx,gy,gx+2,gy+2],fill=(148,163,184,15))
    gl=Image.new("RGBA",(W,H),(0,0,0,0)); r=int(W*0.5); cyp=int(H*glow_y)
    ImageDraw.Draw(gl).ellipse([W//2-r,cyp,W//2+r,cyp+int(H*0.8)],fill=(0,229,160,40))
    return Image.alpha_composite(img.convert("RGBA"),gl.filter(ImageFilter.GaussianBlur(int(W*0.12)))).convert("RGB")

def up(p,key): subprocess.run(["/usr/bin/python3",str(ROOT/"scripts/r2_upload.py"),str(p),key,"image/png"],check=False)

# ---------- 1) PROFILE PICTURE (500x500, circle-safe) ----------
prof=bg(500,500,glow_y=-0.3); m=Image.open(MARK).convert("RGBA")
ms=360; m=m.resize((ms,ms),Image.LANCZOS)
# round the mark's own square corners so it sits cleanly on the grid bg
mask=Image.new("L",(ms,ms),0); ImageDraw.Draw(mask).rounded_rectangle([0,0,ms,ms],radius=110,fill=255)
prof.paste(m,(500//2-ms//2,500//2-ms//2),mask)
p1=OUT/"fb-profile.png"; prof.save(p1); up(p1,"social/brand/fb-profile.png")

# ---------- 2) PINNED / FEATURED IMAGE (1200x630) ----------
W,H=1200,630; img=bg(W,H); d=ImageDraw.Draw(img,"RGBA"); cx=W//2
lg=Image.open(LOGO).convert("RGBA"); lw=300; lh=int(lg.height*lw/lg.width); lg=lg.resize((lw,lh),Image.LANCZOS)
img.paste(lg,(cx-lw//2,52),lg)
d.text((cx,196),"98 of 100 visitors",font=disp(82),fill=PAPER,anchor="mm")
d.text((cx,286),"leave your site.",font=disp(82),fill=RED,anchor="mm")
d.text((cx,392),"You paid for every click. We hand them back —",font=fit(d,"You paid for every click. We hand them back —",SANS,38,28,W-160),fill=SLATE,anchor="mm")
d.text((cx,440),"exclusive, consent-first leads at $7 each.",font=fit(d,"exclusive, consent-first leads at $7 each.",SANS,38,28,W-160),fill=SLATE,anchor="mm")
bw=470; bh=86; x=cx-bw//2; y=512; d.rounded_rectangle([x,y,x+bw,y+bh],radius=bh//2,fill=MINT)
d.text((cx,y+bh//2),"consentresolve.com/demo",font=fit(d,"consentresolve.com/demo",DISP,40,26,bw-50),fill=NAVY,anchor="mm")
p2=OUT/"fb-pinned.png"; img.save(p2); up(p2,"social/brand/fb-pinned.png")

# ---------- 3) HIGHLIGHT COVER SET (1080x1920, circle-safe center) ----------
HW,HH=1080,1920; CY=HH//2
def cover(slug,label,draw_glyph):
    img=bg(HW,HH,glow_y=0.0); d=ImageDraw.Draw(img,"RGBA")
    draw_glyph(d,HW//2,CY-40)
    d.text((HW//2,CY+260),label,font=disp(64),fill=PAPER,anchor="mm")
    p=OUT/f"fb-highlight-{slug}.png"; img.save(p); up(p,f"social/brand/fb-highlight-{slug}.png"); return p
def g_play(d,x,y):
    s=150; d.ellipse([x-200,y-200,x+200,y+200],outline=MINT,width=10)
    d.polygon([(x-55,y-90),(x-55,y+90),(x+95,y)],fill=MINT)
def g_text(txt):
    def f(d,x,y):
        d.ellipse([x-200,y-200,x+200,y+200],outline=MINT,width=10)
        d.text((x,y),txt,font=disp(150 if len(txt)<=3 else 110),fill=MINT,anchor="mm")
    return f
def g_check(d,x,y):
    d.ellipse([x-200,y-200,x+200,y+200],outline=MINT,width=10)
    d.line([(x-80,y+5),(x-20,y+70),(x+95,y-70)],fill=MINT,width=26,joint="curve")
def g_mark(d,x,y):
    d.ellipse([x-200,y-200,x+200,y+200],outline=MINT,width=10)
    m=Image.open(MARK).convert("RGBA").resize((250,250),Image.LANCZOS)
    # paste handled outside (need img) — fallback to a drawn check instead
    d.line([(x-80,y+5),(x-20,y+70),(x+95,y-70)],fill=MINT,width=26,joint="curve")
covers=[
  ("demo","See the demo",g_play),
  ("how","How it works",g_text("1·2·3")),
  ("pricing","$7 a lead",g_text("$7")),
  ("proof","The proof",g_text("$7.2M")),
  ("own","Own your traffic",g_check),
]
hp=[cover(s,l,g) for s,l,g in covers]
print("wrote:", p1.name, p2.name, *[p.name for p in hp])
