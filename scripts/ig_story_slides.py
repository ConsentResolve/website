#!/usr/bin/env python3
"""5 branded IG Story slides (1080x1920 JPEG) — one per Highlight topic.
Brand: navy #0a1628, mint #00e5a0. Heartbeat-v2 voice (no exclamation, no
competitor names, consent-first, email-first). Story-safe margins."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path("/Users/aaronphillips/GIT/consentresolve2")
OUT = ROOT / "build/ig/stories"; OUT.mkdir(parents=True, exist_ok=True)
NAVY=(10,22,40); MINT=(0,229,160); WHITE=(245,248,250); MUTE=(155,173,188)
W,H=1080,1920
BRI=str(ROOT/"scripts/.fonts/Bricolage.ttf"); HAN=str(ROOT/"scripts/.fonts/Hanken.ttf")

def font(p,s): return ImageFont.truetype(p,s)
def cx(d,text,f): b=d.textbbox((0,0),text,font=f); return (W-(b[2]-b[0]))//2 - b[0]
def wrap(d,text,f,maxw):
    words=text.split(); lines=[]; cur=""
    for w in words:
        t=(cur+" "+w).strip()
        if d.textlength(t,font=f)<=maxw: cur=t
        else: lines.append(cur); cur=w
    if cur: lines.append(cur)
    return lines

def slide(name, eyebrow, headline, body, big=None, footer="consentresolve.com/demo"):
    img=Image.new("RGB",(W,H),NAVY); d=ImageDraw.Draw(img)
    # top mint check mark
    cxp=W//2
    d.line([(cxp-70,250),(cxp-22,300),(cxp+82,196)],fill=MINT,width=34,joint="curve")
    y=470
    # eyebrow
    fe=font(HAN,46); ey=" ".join(eyebrow.upper()); d.text((cx(d,ey,fe),y),ey,font=fe,fill=MINT); y+=92
    if big:
        fb=font(BRI,300); d.text((cx(d,big,fb),y),big,font=fb,fill=MINT); y+= int(300*1.15)
    # headline (wrapped)
    fh=font(BRI,96)
    for ln in wrap(d,headline,fh,W-200):
        d.text((cx(d,ln,fh),y),ln,font=fh,fill=WHITE); y+=116
    # mint rule
    y+=20; d.rectangle([cxp-90,y,cxp+90,y+10],fill=MINT); y+=80
    # body
    fbd=font(HAN,54)
    for line in body:
        for ln in wrap(d,line,fbd,W-220):
            d.text((cx(d,ln,fbd),y),ln,font=fbd,fill=MUTE); y+=72
        y+=18
    # footer
    ff=font(HAN,48); d.text((cx(d,footer,ff),1660),footer,font=ff,fill=MINT)
    img.save(OUT/f"{name}.jpg","JPEG",quality=92)

slide("howitworks","How it works","Anonymous traffic, turned into leads",
      ["1 — Someone visits your website",
       "2 — We identify them, consent-first",
       "3 — You get a real, exclusive lead"])
slide("leak","The leak","leave without a trace",
      ["of the people who hit your website.",
       "And you paid for every click."], big="98/100")
slide("pricing","Pricing","per exclusive lead",
      ["Consent-first. Never resold.",
       "You only pay when a real,",
       "identified person lands in your funnel."], big="$7")
slide("consent","Consent-first","Leads that expect your call",
      ["Every person opted in.",
       "No scraped numbers. Email-first.",
       "Built for TCPA and CIPA compliance."])
slide("proof","Why it works","Your own traffic converts best",
      ["It is the highest-intent audience you have —",
       "you already paid to earn it.",
       "Recover it instead of renting strangers."])

print("slides ->", OUT)
for p in sorted(OUT.glob("*.jpg")): print("  ", p.name)
