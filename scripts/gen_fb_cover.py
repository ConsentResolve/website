#!/usr/bin/env python3
"""Facebook Page cover photo, on-brand with the reels (navy + mint + dot grid +
glow + logo, Bricolage/Hanken). 1640x624 (FB retina cover); key content kept in
the centered safe zone so both desktop (820x312) and mobile crops look right.
Output: public/social/fb-cover.png  (+ uploaded to R2 for easy download)."""
import subprocess
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
DISP = str(ROOT/"scripts/.fonts/Bricolage.ttf"); SANS = str(ROOT/"scripts/.fonts/Hanken.ttf")
LOGO = ROOT/"public/logo-on-dark.png"
W, H = 1640, 624
NAVY=(10,22,40); NAVY2=(13,27,42); MINT=(0,229,160); PAPER=(248,250,252); SLATE=(148,163,184)
disp=lambda p:ImageFont.truetype(DISP,p); sans=lambda p:ImageFont.truetype(SANS,p)

img=Image.new("RGB",(W,H),NAVY)
d=ImageDraw.Draw(img,"RGBA")
# vertical gradient
for y in range(H):
    f=y/H; d.line([(0,y),(W,y)],fill=tuple(int(NAVY2[i]+(NAVY[i]-NAVY2[i])*f) for i in range(3)))
# dot grid
for gy in range(40,H,48):
    for gx in range(40,W,48): d.ellipse([gx,gy,gx+2,gy+2],fill=(148,163,184,15))
# mint glow top-center
gl=Image.new("RGBA",(W,H),(0,0,0,0)); ImageDraw.Draw(gl).ellipse([W//2-520,-340,W//2+520,300],fill=(0,229,160,40))
img=Image.alpha_composite(img.convert("RGBA"),gl.filter(ImageFilter.GaussianBlur(160))).convert("RGB")
d=ImageDraw.Draw(img,"RGBA")
cx=W//2

# logo (centered, top of safe zone)
try:
    lg=Image.open(LOGO).convert("RGBA"); lw=440; lh=int(lg.height*lw/lg.width); lg=lg.resize((lw,lh),Image.LANCZOS)
    img.paste(lg,(cx-lw//2,72),lg)
except Exception: pass

# headline
d.text((cx,278),"Own your traffic.",font=disp(96),fill=PAPER,anchor="mm")
# subhead
sub="Recover the visitors you already paid for — as exclusive, consent-first leads."
f=sans(40)
while d.textlength(sub,font=f)>W-260 and f.size>28: f=sans(f.size-2)
d.text((cx,372),sub,font=f,fill=SLATE,anchor="mm")

# value chips
chips=["$7 a lead","Exclusive","Consent-first","Never resold"]
cf=sans(34); pad=26; gap=20
ws=[d.textlength(c,font=cf)+pad*2 for c in chips]; total=sum(ws)+gap*(len(chips)-1)
x=cx-total//2; y=452; bh=64
for c,w in zip(chips,ws):
    d.rounded_rectangle([x,y,x+w,y+bh],radius=bh//2,outline=MINT,width=2,fill=(0,229,160,22))
    d.text((x+w/2,y+bh/2),c,font=cf,fill=MINT,anchor="mm"); x+=w+gap

out=ROOT/"public/social/fb-cover.png"; out.parent.mkdir(parents=True,exist_ok=True)
img.save(out)
print("wrote",out)
subprocess.run(["/usr/bin/python3",str(ROOT/"scripts/r2_upload.py"),str(out),"social/brand/fb-cover.png","image/png"],check=False)
