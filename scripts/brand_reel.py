import math, os, subprocess
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter
os.chdir("/Users/aaronphillips/GIT/consentresolve2/public/reels")
FF="/opt/homebrew/bin/ffmpeg"; FP="/opt/homebrew/bin/ffprobe"
ROOT=Path("/Users/aaronphillips/GIT/consentresolve2"); MUSIC="/Users/aaronphillips/Downloads/CR1.mp3"
W,Hh,FPS=1080,1920,30
NAVY900=(10,22,40);NAVY800=(13,27,42);NAVY700=(30,41,59)
MINT=(0,229,160);MINT300=(0,245,176);RED=(255,107,107);PAPER=(248,250,252);SLATE=(148,163,184)
disp=lambda px:ImageFont.truetype(str(ROOT/"scripts/.fonts/Bricolage.ttf"),px)
sans=lambda px:ImageFont.truetype(str(ROOT/"scripts/.fonts/Hanken.ttf"),px)
LOGO=Image.open(ROOT/"public/logo-on-dark.png").convert("RGBA")
SCR=ImageDraw.Draw(Image.new("RGB",(10,10)))
def clamp(x,a=0.0,b=1.0): return max(a,min(b,x))
def eo(x): x=clamp(x); return 1-(1-x)**3
def eob(x): x=clamp(x); return 1+2.70158*((x-1)**3)+1.70158*((x-1)**2)  # slight overshoot
def acol(c,a): return (c[0],c[1],c[2],int(max(0,min(255,a))))
def fit(text,maxw,hi,lo,fn):
    s=hi
    while s>lo and SCR.textlength(text,font=fn(s))>maxw: s-=2
    return fn(s)
def ct(dr,y,t,font,c,a=255,anchor="mm"): dr.text((W//2,y),t,font=font,fill=acol(c,a),anchor=anchor)

def base_img():
    img=Image.new("RGB",(W,Hh),NAVY900);dr=ImageDraw.Draw(img,"RGBA")
    for y in range(Hh):
        f=y/Hh;dr.line([(0,y),(W,y)],fill=tuple(int(NAVY800[i]+(NAVY900[i]-NAVY800[i])*f) for i in range(3)))
    gl=Image.new("RGBA",(W,Hh),(0,0,0,0));ImageDraw.Draw(gl).ellipse([W//2-380,-300,W//2+380,320],fill=(0,229,160,46))
    gl=gl.filter(ImageFilter.GaussianBlur(150));img=Image.alpha_composite(img.convert("RGBA"),gl)
    dr=ImageDraw.Draw(img,"RGBA")
    for gx in range(60,W,56):
        for gy in range(60,Hh,56): dr.ellipse([gx,gy,gx+2,gy+2],fill=(148,163,184,12))
    lw=650;lh=int(LOGO.height*lw/LOGO.width);lg=LOGO.resize((lw,lh),Image.LANCZOS);img.alpha_composite(lg,(W//2-lw//2,110))  # 2.5x logo
    return img
BASE=base_img()

def icon(dr,cx,cy,kind,a,r=40):
    dr.ellipse([cx-r,cy-r,cx+r,cy+r],fill=acol(MINT,int(255*a)))
    nv=acol(NAVY900,int(255*a)); w=max(2,int(5*a))
    if kind=="person":
        dr.ellipse([cx-15,cy-20,cx+15,cy+8],fill=nv); dr.pieslice([cx-24,cy-2,cx+24,cy+40],180,360,fill=nv)
    elif kind=="mail":
        dr.rounded_rectangle([cx-22,cy-15,cx+22,cy+15],radius=5,outline=nv,width=w)
        dr.line([(cx-22,cy-15),(cx,cy+2)],fill=nv,width=w);dr.line([(cx+22,cy-15),(cx,cy+2)],fill=nv,width=w)
    elif kind=="search":
        dr.ellipse([cx-20,cy-20,cx+6,cy+6],outline=nv,width=w); dr.line([(cx+4,cy+4),(cx+20,cy+20)],fill=nv,width=w+1)

def chip(dr,y,label,kind,a):
    cw,ch=780,118; x0=W//2-cw//2; xo=int((1-eob(a))*-140)  # slide from left
    bx0=x0+xo
    dr.rounded_rectangle([bx0,y,bx0+cw,y+ch],radius=24,fill=acol(NAVY700,int(255*a)),outline=acol(MINT,int(170*a)),width=3)
    icon(dr,bx0+70,y+ch//2,kind,a,r=38)
    f=fit(label,cw-200,46,30,sans)
    dr.text((bx0+138,y+ch//2),label,font=f,fill=acol(PAPER,int(255*a)),anchor="lm")

def lead_card(dr,t):
    a=clamp(t/0.3); xo=int((1-eo(a))*170)
    x0,y0,x1,y1=140+xo,700,940+xo,1320
    dr.rounded_rectangle([x0,y0,x1,y1],radius=30,fill=acol(NAVY700,int(255*a)),outline=acol(MINT,int(150*a)),width=3)
    px,py=x0+44,y0+40
    dr.ellipse([px,py+6,px+18,py+24],fill=acol(MINT,int(255*a)));dr.text((px+30,py),"Lead identified",font=sans(30),fill=acol(MINT,int(255*a)))
    dr.text((x1-44,py),"just now",font=sans(26),fill=acol(SLATE,int(255*a)),anchor="ra")
    dr.line([(px,py+62),(x1-44,py+62)],fill=(255,255,255,int(30*a)),width=2)
    ax,ay,ar=px+54,py+185,58
    dr.ellipse([ax-ar,ay-ar,ax+ar,ay+ar],fill=acol(MINT,int(255*a)))
    dr.ellipse([ax-22,ay-30,ax+22,ay+14],fill=acol(NAVY900,int(255*a)));dr.pieslice([ax-40,ay-2,ax+40,ay+70],180,360,fill=acol(NAVY900,int(255*a)))
    nx=px+140;dr.text((nx,py+118),"Sam Paul",font=disp(58),fill=acol(PAPER,int(255*a)))
    # tag styled to MATCH the deliverable chips: dark chip + mint border + mint tag-dot + mint text
    tag="Roofing · quote request";tf=sans(30);tw=SCR.textlength(tag,font=tf);ty=py+200;tcw=int(tw)+108
    dr.rounded_rectangle([nx,ty,nx+tcw,ty+62],radius=18,fill=acol(NAVY900,int(255*a)),outline=acol(MINT,int(170*a)),width=3)
    dr.ellipse([nx+26,ty+22,nx+44,ty+40],fill=acol(MINT,int(255*a)))
    dr.text((nx+62,ty+31),tag,font=tf,fill=acol(MINT300,int(255*a)),anchor="lm")
    dr.text((px,py+360),"sam.paul@roofingco.com",font=sans(36),fill=acol(PAPER,int(255*a)))
    dr.text((px,py+428),"Wants: roof replacement quote",font=sans(33),fill=acol(SLATE,int(255*a)))
    dr.text((px,py+486),"Illustrative example",font=sans(24),fill=acol(SLATE,int(170*a)))

# --- per-angle config (locked style, current voice; CPL confirmed correct) ---
ANGLE=os.environ.get("ANGLE","leak")
REELS={
 "leak":{"hook":"leak","agitate":["You paid for","every single click."],"vanish":["Then they vanish.","Anonymous. Untraceable."],"reveal":"We turn the bounce into a real lead."},
 "invoice":{"hook":"num","stat":"$1,900","unit":"in shared-lead spend","tail":"…for one closed job.","agitate":["Then you checked","your own analytics."],"vanish":["2,300 visitors.","Nearly all anonymous."],"reveal":"Recover the visitors you already paid for."},
 "math":{"hook":"num","stat":"$100","unit":"per shared lead","tail":"closed ~5% of the time.","agitate":["Split four ways,","called in seconds."],"vanish":["A footrace,","not a lead."],"reveal":"$7 buys an exclusive lead from your own site."},
 "robot":{"hook":"num","stat":"$400","unit":"auto-charged by a robot","tail":"for your own callback.","agitate":["No appeal.","No one to call."],"vanish":["Just the bill,","and a shrug."],"reveal":"Your own traffic never bills you by algorithm."},
 "ftc":{"hook":"num","stat":"$7.2M","unit":"fine for the biggest lead site","tail":"for lying about lead quality.","agitate":["Suddenly the garbage","leads made sense."],"vanish":["Years of blaming","yourself."],"reveal":"So recover your own traffic instead."},
 "twice":{"hook":"num","stat":"2×","unit":"the same homeowner","tail":"sold to me twice.","agitate":["Second call,","the job was done."],"vanish":["Shared means","sold again."],"reveal":"Exclusive means sold once — to you."},
 "ghost":{"hook":"num","stat":"30","unit":"leads, 30 ghosts","tail":"paid for every one.","agitate":["No answer.","Wrong number."],"vanish":["A thousand bucks","to talk to no one."],"reveal":"The people on your site actually want the work."},
 "ownership":{"hook":"num","stat":"1","unit":"pipe you actually own","tail":"your website.","agitate":["Their dashboard,","their rules."],"vanish":["One policy change,","it's gone."],"reveal":"Build your pipeline, not theirs."},
}
CFG=REELS.get(ANGLE, REELS["leak"])

def render(key,dr,t,dur):
    if key=="hook":
        if CFG["hook"]=="leak":
            p=min(t/0.7,1); val=int(round(98*eo(p)))
            ct(dr,500,str(val),disp(230),RED)
            ct(dr,648,"out of 100 visitors",sans(48),PAPER)
            cols=rows=10;sp=58;r=10;gx0=W//2-(cols-1)*sp//2;gy0=760
            ng=int(round(98*clamp((t-0.2)/1.6)));i=0
            for ry in range(rows):
                for cx in range(cols):
                    x=gx0+cx*sp;y=gy0+ry*sp;col=SLATE if i<ng else MINT
                    dr.ellipse([x-r,y-r,x+r,y+r],fill=acol(col,255));i+=1
            if t>1.7: ct(dr,1360,"leave anonymous.",sans(48),SLATE,int(230*clamp((t-1.7)/0.3)))
        else:
            a=clamp(t/0.5)
            ct(dr,560,CFG["stat"],disp(210),RED,int(255*a))
            ct(dr,740,CFG["unit"],fit(CFG["unit"],920,52,32,sans),PAPER,int(255*a))
            if t>1.0: ct(dr,1320,CFG["tail"],fit(CFG["tail"],900,48,30,sans),SLATE,int(230*clamp((t-1.0)/0.3)))
    elif key=="agitate":
        a=clamp(t/0.3);yo=int((1-eo(a))*40)
        ct(dr,840-yo,CFG["agitate"][0],fit(CFG["agitate"][0],900,96,54,disp),PAPER,int(255*a))
        ct(dr,970-yo,CFG["agitate"][1],fit(CFG["agitate"][1],900,96,54,disp),PAPER,int(255*a))
    elif key=="vanish":
        a=clamp(t/0.3)
        ct(dr,880,CFG["vanish"][0],fit(CFG["vanish"][0],900,110,60,disp),RED,int(255*a))
        ct(dr,1010,CFG["vanish"][1],sans(50),SLATE,int(220*a))
    elif key=="reveal":
        ct(dr,600,CFG["reveal"],fit(CFG["reveal"],920,56,36,sans),PAPER,int(255*clamp(t/0.3)))
        lead_card(dr,t)
    elif key=="deliver":
        ct(dr,600,"Every lead comes with:",disp(56),PAPER,int(255*clamp(t/0.25)))
        chip(dr,740,"A real name","person",clamp((t-0.10)/0.3))
        chip(dr,896,"A real email","mail",clamp((t-0.40)/0.3))
        chip(dr,1052,"What they were looking for","search",clamp((t-0.70)/0.3))
    elif key=="offer":
        a=clamp(t/0.3)
        ct(dr,780,"$7 a lead.",disp(130),MINT,int(255*a))
        ct(dr,940,"Exclusive. Never resold.",fit("Exclusive. Never resold.",900,76,48,disp),PAPER,int(255*a))
        ct(dr,1090,"Shared leads cost $80+ and go to 4 competitors.",fit("Shared leads cost $80+ and go to 4 competitors.",940,38,26,sans),SLATE,int(220*clamp((t-0.3)/0.3)))
    elif key=="cta":
        a=clamp(t/0.3)
        ct(dr,690,"See it work — live.",fit("See it work — live.",900,82,52,disp),MINT,int(255*a))
        ct(dr,812,"Watch a visitor turn into a real, named lead.",fit("Watch a visitor turn into a real, named lead.",950,44,28,sans),PAPER,int(255*a))
        pulse=1+0.04*math.sin(2*math.pi*t*2.0); bw=int(700*pulse);bh=int(120*pulse);bx=W//2-bw//2;by=950
        dr.rounded_rectangle([bx,by,bx+bw,by+bh],radius=bh//2,fill=MINT)
        ct(dr,by+bh//2,"consentresolve.com/demo",fit("consentresolve.com/demo",bw-70,52,32,disp),NAVY900)
        ct(dr,1150,"Exclusive leads · $7 each",sans(42),SLATE,int(235*clamp((t-0.3)/0.3)))

def _d(f):
    import subprocess as _sp
    return round(float(_sp.check_output([FP,"-v","error","-show_entries","format=duration","-of","csv=p=0",f]).strip()),3)
_keys=["hook","agitate","vanish","reveal","deliver","offer","cta"]
# Fixed, VO-independent timing — silent animated reel + Suno music (better for
# silent autoplay anyway). Sums to ~25.4s to sit under CR1.mp3 (25.8s).
_FIXED={"hook":4.4,"agitate":2.2,"vanish":2.2,"reveal":4.6,"deliver":4.2,"offer":3.6,"cta":4.2}
DUR=[(k,_FIXED[k]) for k in _keys]
TOTAL=round(sum(d for _,d in DUR),2); print("TOTAL",TOTAL)
import shutil; shutil.rmtree("build/frames",ignore_errors=True); Path("build/frames").mkdir(parents=True,exist_ok=True)
gi=0; bar_x0,bar_x1,bar_y=160,920,300; TF=TOTAL*FPS
for key,d in DUR:
    n=int(round(d*FPS))
    for f in range(n):
        t=f/FPS; fr=BASE.copy(); dr=ImageDraw.Draw(fr,"RGBA")
        render(key,dr,t,d)
        gt=gi/TF
        dr.line([(bar_x0,bar_y),(bar_x1,bar_y)],fill=(148,163,184,70),width=4)
        dr.line([(bar_x0,bar_y),(int(bar_x0+(bar_x1-bar_x0)*clamp(gt)),bar_y)],fill=acol(MINT,255),width=4)
        fr.convert("RGB").save(f"build/frames/{gi:05d}.png");gi+=1
print("frames",gi)
subprocess.run([FF,"-y","-loglevel","error","-framerate","30","-i","build/frames/%05d.png","-c:v","libx264","-profile:v","high","-pix_fmt","yuv420p","-b:v","10M","-minrate","8M","-maxrate","12M","-bufsize","12M","-r","30","build/video_v3.mp4"],check=True)
print("video_v3 (silent) rebuilt")
# mux Suno music (loudnorm, loop-to-length) -> on-voice locked-style reel.
# Override per render:  MUSIC=<path> OUTNAME=<name> python3 scripts/brand_reel.py
MUSIC=os.environ.get("MUSIC", str(ROOT/"assets/audio/CR1.mp3"))
if not os.path.isabs(MUSIC): MUSIC=str(ROOT/MUSIC)   # cwd is public/reels (chdir above)
OUTNAME=os.environ.get("OUTNAME",f"reel-{ANGLE}-locked")
subprocess.run([FF,"-y","-loglevel","error","-i","build/video_v3.mp4","-stream_loop","-1","-i",MUSIC,
  "-map","0:v","-map","1:a","-af","loudnorm=I=-14:TP=-1.5:LRA=11","-c:v","copy","-c:a","aac","-b:a","160k",
  "-shortest","-movflags","+faststart",str(ROOT/f"public/reels/{OUTNAME}.mp4")],check=True)
print(f"{OUTNAME}.mp4 built (music: {Path(MUSIC).name}) ->", ROOT/f"public/reels/{OUTNAME}.mp4")
