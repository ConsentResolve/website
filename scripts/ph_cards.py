#!/usr/bin/env python3
"""Branded 1:1 social cards for the 10-day Product Hunt campaign — one per day.
Locked navy/mint Consent Resolve brand, Bricolage/Hanken, real logo. Layer-B only
(deterministic text + logo), so no AI gibberish. Renders public/images/ph/dayNN.png.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = Path("/Users/aaronphillips/GIT/consentresolve2")
OUT = ROOT / "public/images/ph"; OUT.mkdir(parents=True, exist_ok=True)
NAVY9=(10,22,40); NAVY8=(13,27,42); MINT=(0,229,160); MINT3=(0,245,176); WHITE=(245,248,250); SLATE=(148,163,184); INK=(6,40,31)
BRI=str(ROOT/"scripts/.fonts/Bricolage.ttf"); HAN=str(ROOT/"scripts/.fonts/Hanken.ttf")
LOGO=Image.open(ROOT/"public/logo-on-dark.png").convert("RGBA")
SCR=ImageDraw.Draw(Image.new("RGB",(10,10)))
def disp(px): return ImageFont.truetype(BRI,px)
def sans(px): return ImageFont.truetype(HAN,px)
def fit(text,maxw,hi,lo,fn):
    s=hi
    while s>lo and SCR.textlength(text,font=fn(s))>maxw: s-=2
    return fn(s)
def wrap(text,fn,maxw):
    out,cur=[],""
    for w in text.split():
        t=(cur+" "+w).strip()
        if SCR.textlength(t,font=fn)<=maxw: cur=t
        else:
            if cur: out.append(cur)
            cur=w
    if cur: out.append(cur)
    return out

W=H=1080; PAD=84
def bg():
    im=Image.new("RGB",(W,H),NAVY9)
    d=ImageDraw.Draw(im)
    for y in range(H):  # subtle vertical navy gradient
        t=y/H; c=tuple(int(NAVY9[i]+(NAVY8[i]-NAVY9[i])*t) for i in range(3)); d.line([(0,y),(W,y)],fill=c)
    # mint glow top-right
    glow=Image.new("RGBA",(W,H),(0,0,0,0)); gd=ImageDraw.Draw(glow)
    gd.ellipse([W-620,-360,W+300,360],fill=(0,229,160,60)); glow=glow.filter(ImageFilter.GaussianBlur(150))
    im=Image.alpha_composite(im.convert("RGBA"),glow).convert("RGB"); d=ImageDraw.Draw(im)
    # inner mint frame
    d.rounded_rectangle([28,28,W-28,H-28],radius=34,outline=MINT,width=3)
    return im,d

def pill(d,x,y,text):
    f=sans(26); tw=SCR.textlength(text,font=f); w=tw+52; h=58
    d.rounded_rectangle([x,y,x+w,y+h],radius=h//2,fill=MINT)
    d.text((x+26,y+h/2),text,font=f,fill=INK,anchor="lm")
    return w

def card(n, event, main, accent="", sub="", hi=""):
    im,d=bg()
    # eyebrow
    eb=f"DAY {n:02d}  ·  {event.upper()}"
    d.text((PAD,PAD),eb,font=sans(28),fill=MINT,anchor="lm")
    # PH pill top-right
    pt="PRODUCT HUNT"; f=sans(26); w=SCR.textlength(pt,font=f)+52
    pill(d,W-PAD-w,PAD-29,pt)
    # main hook (white), wrapped
    f=fit(main,W-2*PAD,120,58,disp)
    lines=wrap(main,f,W-2*PAD); lh=f.size*1.06
    block=len(lines)*lh + (f.size*0.98 if accent else 0)
    y=(H-block)/2 - 40
    for ln in lines:
        d.text((PAD,y),ln,font=f,fill=WHITE); y+=lh
    if accent:
        af=fit(accent,W-2*PAD,f.size,48,disp)
        d.text((PAD,y+10),accent,font=af,fill=MINT); y+=af.size*1.1
    if sub:
        sf=sans(38)
        for ln in wrap(sub,sf,W-2*PAD):
            d.text((PAD,y+22),ln,font=sf,fill=SLATE); y+=sf.size*1.3
    # logo bottom-left
    lw=300; lr=LOGO.resize((lw,int(LOGO.height*lw/LOGO.width)))
    im.paste(lr,(PAD, H-PAD-lr.height+8),lr)
    im.save(OUT/f"day{n:02d}.png","PNG")
    print(f"  day{n:02d}.png  {event}")

CARDS=[
 (1,"Opening Ceremony","We're live on Product Hunt.","Recover the 98%.","The homeowners you paid for, handed back."),
 (2,"On the Podium","We're on the board.","","Send an upvote up the leaderboard."),
 (3,"The Backstory","2,900 visitors. 11 calls.","Who were the other 2,889?","The gap that became the whole company."),
 (4,"Judges' Scores","Upvotes are the sprint.","Reviews are the marathon.","Leave one on our Product Hunt page."),
 (5,"Highlight Reel","Watch a “yes” become a lead.","","60 seconds. Anonymous visitor to your pipeline."),
 (6,"The Rivalry","A shared lead is sold five times.","Yours isn't.","Consent-first. $7. Yours alone."),
 (7,"Still Climbing","Still climbing.","","Ten seconds to upvote. We'll love you forever."),
 (8,"Meet the Team","The team behind the badge.","","Tired of watching shops lose 98% of their traffic."),
 (9,"Last Call","Last call on the podium.","","The Product Hunt run is winding down."),
 (10,"Closing Ceremony","Thank you.","$7. On record. Yours alone.","The door's open at consentresolve.com."),
]
for c in CARDS: card(*c)
print("done ->",OUT)
