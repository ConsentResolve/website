#!/usr/bin/env python3
"""Reframe + re-cut the REST of the avatar reels to the locked new style:
honest CR voice (second person, no fabricated contractor identity), warm delivery
(expressiveness high + pauses + 0.92x), cold-open disruption card, FEW gentle cuts,
karaoke captions from the real SRT, soft CTA, and a BRANDED END CARD so nothing
ends abruptly (the #1 feedback). Uploads to social/sprint/<slug>-new.mp4 (angles),
overwrites leak-stat/leak-confession (feedback fixes) and leah-* slots.
Designed to run in the BACKGROUND. Usage: python3 scripts/gen_reframe_all.py [slug ...]
"""
import json, re, subprocess, time, urllib.request, urllib.error, sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT/"scripts"))
from video_scripts import job_for, VOICE, LOOK
from cr_secrets import secret  # Keychain -> env -> /tmp/heygen_key.txt fallback

KEY = secret("heygen")
FF, FP = "/opt/homebrew/bin/ffmpeg", "/opt/homebrew/bin/ffprobe"
DISP = str(ROOT/"scripts/.fonts/Bricolage.ttf"); SANS = str(ROOT/"scripts/.fonts/Hanken.ttf")
MUSIC = str(ROOT/"assets/audio/CR1.mp3"); LOGO = ROOT/"public/logo-on-dark.png"
W, H = 1080, 1920
NAVY=(8,17,33); MINT=(0,229,160); PAPER=(248,250,252)
WORK = ROOT/"build/reframe"; WORK.mkdir(parents=True, exist_ok=True)
CUTS=[6.5,7.0,6.0,7.5]; ZOOMS=[1.0,1.07,1.03,1.09]
MOTION="Warm and sincere, like he genuinely cares about the person watching. Slows on the key lines, eyebrows lift on emphasis, a small empathetic smile that comes and goes. Real, conversational, not salesy."
# Spoken pronunciation: "lead/leads" must say leed/leeds. Captions are corrected back.
PRON = {r"\bleads\b": "leeds", r"\blead\b": "leed"}
def spoken(t):
    for rx, rep in PRON.items(): t = re.sub(rx, rep, t, flags=re.I)
    return t
def caption_fix(t):
    t = re.sub(r"\bleeds\b", "leads", t, flags=re.I); t = re.sub(r"\bleed\b", "lead", t, flags=re.I); return t
LEAH_VOICE="1d92f4e36247492d9ad806b59fd3434a"

# slug -> (look, voice, card_lines, script, cta, r2name)
def J(a): j=job_for(a); return j["look"], j["voice"]
A = {}
def add(slug, look, voice, card, script, cta, r2):
    A[slug]=(look,voice,card,script,cta,r2)

# --- feedback fixes to the 2 leak talking-heads (proper endings + smooth phrasing) ---
lk_look, lk_voice = J("leak")
add("leak-stat", lk_look, lk_voice, ["98 OF 100","GONE"],
    "Ninety-eight... out of a hundred. That's how many people find your website... and just leave. No name. No email. Nothing you can do with it. The ones who actually opt in, though, don't have to disappear. We hand them back to you, a real person, a real email, exactly what they came looking for. Seven dollars, yours alone, never resold. Everyone else? You're buying the clicks... and watching the bounce.",
    "See who you missed  →", "leak-stat")
add("leak-confession", lk_look, lk_voice, ["YOUR SITE","ISN'T BROKEN"],
    "Your website... isn't broken. I know it can feel like it is. But it's leaking exactly the way it was built to. All those people who land on it, the ones already interested, most of them just slip away. No name, no email. And you paid for every click. But here's the thing. There's a version where they don't vanish. The ones who opted in come back to you as real, named leads, seven dollars, exclusive, never resold. You don't need more traffic. You need to stop losing the traffic you've already got.",
    "Watch it on your site  →", "leak-confession")
# --- orig leak reel rebuilt in Real Tyler's clone (92071), straight narrative. Uploads to the originals path. ---
add("leak-orig", lk_look, lk_voice, ["98 OF 100","LEAVE"],
    "Here is the number that stopped me cold. Ninety-eight out of a hundred. Most people who land on your website leave without ever raising a hand. You paid for every one of those clicks, and the traffic was already yours. The ones who opt in, though, don't have to vanish. We hand them back to you as real, consent-first leads. Not a name scraped off a list, a person who actually wants the work. Seven dollars each, exclusive, never resold. See it work at consentresolve.com/demo.",
    "See who you missed  →", "orig/test-leak-tiktok")

# ---- Batch re-voice of the original UGC reels: each angle's original narrative
# (job_for scenes) rebuilt in its persona's REAL clone voice, output to the
# originals path (orig/test-<angle>-tiktok). leak handled above. ----
_ORIG_CARDCTA = {
  "ftc": (["$7.2M","FINE"], "See the better way  →"),
  "math": (["$100","vs  $7"], "Run your numbers  →"),
  "invoice": (["ADD UP YOUR","LEAD SPEND"], "See your number  →"),
  "ghost": (["30 LEADS","30 GHOSTS"], "Reach real people  →"),
  "policy": (["THEIR DASHBOARD","THEIR RULES"], "Own your pipeline  →"),
  "twice": (["PAID TWICE","SAME LEAD"], "Exclusive, for real  →"),
  "contrarian": (["THE LEAK ISN'T","A BUG"], "See the fix  →"),
  "ownership": (["STOP RENTING","YOUR LEADS"], "Own your traffic  →"),
  "robot": (["BILLED $400","BY A ROBOT"], "Take it back  →"),
  "credit": (["NO REFUNDS","ONLY CREDIT"], "Don't be a hostage  →"),
  "creepy": (["WHY AM I","ON THIS LIST?"], "See the right way  →"),
}
for _a, (_card, _cta) in _ORIG_CARDCTA.items():
    _j = job_for(_a); _script = " ".join(s[0] for s in _j["scenes"])
    add(f"{_a}-orig", _j["look"], _j["voice"], _card, _script, _cta, f"orig/test-{_a}-tiktok")

# Persona casting reels (recovered 3-scene script; scene 3 reframed off the
# "tells you who they were" identification claim to consent-first).
_PERSONA_SCRIPT = ("Look, ninety-eight out of a hundred people hit your website... and just leave. "
    "You paid for every single one of those clicks. Every one. "
    "The ones who opt in, we hand back to you. Seven bucks a lead, exclusive, never resold.")
add("jason-orig", LOOK["jason_truck"], VOICE["jason"], ["98 OF 100","JUST LEAVE"],
    _PERSONA_SCRIPT, "See who you missed  →", "orig/test-jason-tiktok")
add("tyler-orig", LOOK["tyler_lawn"], VOICE["tyler"], ["98 OF 100","JUST LEAVE"],
    _PERSONA_SCRIPT, "See who you missed  →", "orig/test-tyler-tiktok")
# Styled/cinematic casting reels — original avatars (a7ffbaf6 / 972e62f2) are RETIRED
# in HeyGen, so rebuild on current real-clone looks: pickup->jason_truck (Real Jason),
# style/cinematic tyler->tyler_lawn/tyler_drive (Real Tyler).
add("style-pickup-orig", LOOK["jason_truck"], VOICE["jason"], ["98 OF 100","JUST LEAVE"],
    _PERSONA_SCRIPT, "See who you missed  →", "orig/reel-style-pickup")
add("style-tyler-orig", LOOK["tyler_lawn"], VOICE["tyler"], ["98 OF 100","JUST LEAVE"],
    _PERSONA_SCRIPT, "See who you missed  →", "orig/reel-style-tyler")
add("tyler-cinematic-orig", LOOK["tyler_drive"], VOICE["tyler"], ["98 OF 100","JUST LEAVE"],
    _PERSONA_SCRIPT, "See who you missed  →", "orig/reel-tyler-cinematic")

# --- 12 reframed angles (CR voice, proper endings) ---
ANG = {
 "race": (["1 LEAD","4 CONTRACTORS"], "Here's something the lead sites leave out of the brochure. That exclusive lead you just bought? Four other contractors got the exact same name, the exact same second. By the time you call, the homeowner's already talked to two of them. You didn't buy a lead, you bought a footrace. The visitors on your own website are different. They're yours, nobody else's. When they opt in, we hand them to you. Real, named, exclusive, seven dollars, never resold. Quit paying to race strangers.", "Own your leads  →"),
 "ftc": (["$7.2M","FINE"], "This one isn't an opinion, it's on the record. The biggest lead site in the country was ordered to pay seven point two million dollars, for lying about lead quality. So if the leads you've been buying feel like junk, that's not on you, it's documented. The fix isn't a better marketplace. It's recovering the people already on your own website, the ones who opt in. Real, named, exclusive leads at seven dollars each. No middleman deciding what you owe. Your bad leads finally make sense.", "See the better way  →"),
 "ghost": (["30 LEADS","30 GHOSTS"], "Thirty leads. Thirty dead ends. Wrong numbers, no answers, people who never heard of you, and you paid for every single one. The people already on your website are different. They actually want the work. When they opt in, we hand them to you, a real name, a real email, ready to hear from you. Seven dollars, exclusive. Quit paying to talk to no one.", "Reach real people  →"),
 "math": (["$100","vs  $7"], "Let's do the math out loud. A shared lead runs you around a hundred bucks. You split it with three other contractors, and you close maybe one in twenty. Now compare that to seven dollars, for an exclusive lead from someone already on your website who opted in to hear from you. One of those builds your business. The other builds theirs. You can figure that one out.", "Run your numbers  →"),
 "credit": (["NO REFUNDS","ONLY MORE CREDIT"], "So get this. You buy a lead, it's garbage. Wrong number, never heard of you. You complain, and the lead site goes, no problem, here's a credit. A credit. To buy more leads. From us. The same us that just sold you the garbage. It's like returning spoiled milk and the store hands you a coupon for more spoiled milk. That's not a refund, that's a hostage situation. We went the other way. Seven dollars, and you only pay when a real person who opted in actually shows up. Wild concept, I know.", "Don't be a hostage  →"),
 "creepy": (["WHY AM I","ON THIS LIST?"], "A quick warning about those see-who-visited-your-site tools. They surface strangers who never asked to hear from you, and that gets uncomfortable fast. Why am I on this list is not a great opening line. Consent first is the whole difference. The people we hand you actually opted in. They expect your email. Not creepy, not risky, just someone who raised their hand. Seven dollars, exclusive. There's a right way to do this.", "See the right way  →"),
 "twice": (["PAID TWICE","SAME LEAD"], "Here's one that'll make you mad. Ever buy a lead from one site, then realize you'd already bought the exact same person from a different site? Same homeowner. Two lead sites. You paid twice for one lead. That's the shared-lead game, the same name sold all over town. The visitors on your own website are yours alone. When they opt in, we hand them to you. Sold once. Seven dollars. Never to anyone else.", "Exclusive, for real  →"),
 "policy": (["THEIR DASHBOARD","THEIR RULES"], "Here's a risk most contractors never think about. Your entire pipeline lives inside someone else's dashboard. Their rules, their prices. One policy change, one suspended account, and it's gone. Years of reviews and ranking, equity you built in their company, not yours. Your website is the one pipe you actually own. Recover the visitors who opt in, as real, exclusive leads. Seven dollars each. Build something they can't switch off.", "Own your pipeline  →"),
 "ownership": (["STOP RENTING","YOUR LEADS"], "Here's the part nobody on those platforms wants you to notice. Every dollar you spend with the lead sites builds their brand, not yours. You're renting access to customers you're already paying to create. Your website is the one pipe you actually own. Recover the people on it who opt in, as real, exclusive leads. Seven dollars each. Same money, except now it compounds for you.", "Own your traffic  →"),
}
for a,(card,script,cta) in ANG.items():
    look,voice=J(a); add(f"{a}-new", look, voice, card, script, cta, f"{a}-new")

# --- Leah's 5 (already CR voice; re-cut with end card + cold-open card) ---
LEAH = {
 "leah-roofing":("de4dc68d9cb249219aa96287c458bae4",["MOST OF THEM","JUST LEAVE"],"Hey, I'm Leah, I'm on the team here at Consent Resolve. And the thing we hear from contractors all day is the same. I'm paying for traffic, but barely anyone reaches out. They're not wrong. On most sites, about 98 of 100 visitors leave without a trace. So here's what we do. The ones who opt in, we hand back to you as real people, a name, an email, what they came looking for. Same traffic you're already paying for. We just stop letting it disappear.","See what you're missing  →"),
 "leah-speed":("de4dc68d9cb249219aa96287c458bae4",["SPEED","WINS JOBS"],"I'm Leah, with Consent Resolve. Here's something we see constantly. The faster you reach a lead, the more likely they book. But bought leads are stale before they hit your inbox, four other companies already called. The people on your own site are different. We catch the ones who opt in while they're still warm and hand them straight to you, with a real email. You reach out while they still remember you. That's the whole game.","Reach them warm  →"),
 "leah-ghost":("d83a225562764506a47f334a1a2b249d",["WRONG NUMBER","NO ANSWER"],"Leah here, from the Consent Resolve team. A contractor told me he spends his mornings calling leads that go nowhere. Wrong numbers, no answers, people who never heard of him. He paid for every one. That's the bought-lead game. What we do is different. The people already on your site who opt in come back to you as real people, with a name and a reason they reached out. No more chasing ghosts. Just folks who actually raised their hand.","Stop chasing ghosts  →"),
 "leah-consent":("6d3166f5a77545b1ab06a110a189c225",["WHY AM I","ON THIS LIST?"],"I'm Leah, I work at Consent Resolve, and this part matters to us. A lot of tools just surface strangers who never asked to hear from you. That feels invasive, because it is. We built the opposite. Everyone we hand you actually opted in. They raised their hand. So when you follow up, they're expecting it. Consent first isn't a feature for us. It's the whole point.","The right way  →"),
 "leah-cost":("62380983788d4b278868a6ca3db6fe0d",["$100","vs  $7"],"Leah from Consent Resolve here. Let's talk money for a second. A shared lead runs a hundred bucks or more, sold to four contractors, and most never turn into anything. Do the math per booked job and it's rough. The visitors on your own site, you already paid to bring them. The ones who opt in, we hand back to you for seven dollars, exclusive, yours alone. Seven dollars for someone who actually wants you beats a hundred for a name everybody's calling.","Run the real math  →"),
}
for slug,(look,card,script,cta) in LEAH.items():
    add(slug, look, LEAH_VOICE, card, script, cta, slug)

want = sys.argv[1:] or list(A)

def api(u,b=None):
    data=json.dumps(b).encode() if b else None
    r=urllib.request.Request(u,data=data,headers={"X-Api-Key":KEY,"Content-Type":"application/json"})
    try: return json.load(urllib.request.urlopen(r,timeout=180))
    except urllib.error.HTTPError as e: return {"error":e.read().decode()[:200]}
def dur(f): return float(subprocess.check_output([FP,"-v","error","-show_entries","format=duration","-of","csv=p=0",f]).strip())
def fitf(d,t,fp,hi,lo,mw):
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
        f=fitf(d,ln,DISP,168,70,W-120); d.text((W//2,y),ln,font=f,fill=(MINT if i==len(lines)-1 else PAPER),anchor="mm"); y+=190
    img.save(out)
def cta_card(text,out):
    img=Image.new("RGBA",(W,H),(0,0,0,0)); d=ImageDraw.Draw(img)
    f=fitf(d,text,DISP,64,40,W-220); tw=d.textlength(text,font=f); bw=int(tw)+90; bh=116; x=W//2-bw//2; y=int(H*0.07)  # ABOVE the head (clears the low captions)
    d.rounded_rectangle([x,y,x+bw,y+bh],radius=bh//2,fill=MINT); d.text((W//2,y+bh//2),text,font=f,fill=NAVY,anchor="mm"); img.save(out)
def karaoke_png(words,active,out):
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

# branded end card (built once) — fixes abrupt endings
ENDPNG=str(WORK/"endcard.png")
def build_endcard():
    img=Image.new("RGB",(W,H),NAVY); d=ImageDraw.Draw(img)
    for gy in range(60,H,60):
        for gx in range(60,W,60): d.ellipse([gx,gy,gx+2,gy+2],fill=(148,163,184))
    try:
        lg=Image.open(LOGO).convert("RGBA"); lw=560; lh=int(lg.height*lw/lg.width); lg=lg.resize((lw,lh),Image.LANCZOS); img.paste(lg,(W//2-lw//2,560),lg)
    except Exception: pass
    d.text((W//2,980),"Exclusive, consent-first leads.",font=fitf(d,"Exclusive, consent-first leads.",DISP,56,36,940),fill=PAPER,anchor="mm")
    d.text((W//2,1090),"$7 each  ·  never resold",font=ImageFont.truetype(SANS,46),fill=MINT,anchor="mm")
    bw=720; bh=120; x=W//2-bw//2; y=1230; d.rounded_rectangle([x,y,x+bw,y+bh],radius=bh//2,fill=MINT)
    d.text((W//2,y+bh//2),"consentresolve.com/demo",font=fitf(d,"consentresolve.com/demo",DISP,52,32,bw-60),fill=NAVY,anchor="mm")
    img.save(ENDPNG)
build_endcard()
ENDCLIP=str(WORK/"endcard.mp4")
subprocess.run([FF,"-y","-loglevel","error","-loop","1","-t","2.6","-i",ENDPNG,
    "-stream_loop","-1","-i",MUSIC,"-filter_complex","[0:v]fps=30,format=yuv420p[v];[1:a]atrim=0:2.6,afade=t=in:st=0:d=0.4,afade=t=out:st=2.0:d=0.6,volume=0.5[a]",
    "-map","[v]","-map","[a]","-t","2.6","-c:v","libx264","-pix_fmt","yuv420p","-r","30","-c:a","aac","-b:a","160k",ENDCLIP],check=True)

for slug in want:
    look,voice,card,script,cta,r2 = A[slug]
    d=WORK/slug; d.mkdir(exist_ok=True)
    print(f">>> {slug}",flush=True)
    src=str(d/"src.mp4"); srt=str(d/"cap.srt")
    if Path(src).exists() and Path(srt).exists() and Path(src).stat().st_size>80000:
        print("  (cached render — post-only re-cut)",flush=True)
    else:
        body={"caption":True,"video_inputs":[{"character":{"type":"talking_photo","talking_photo_id":look,"use_avatar_iv_model":True,"talking_style":"expressive","super_resolution":True,"expressiveness":"high","custom_motion_prompt":MOTION},
              "voice":{"type":"text","voice_id":voice,"input_text":spoken(script),"speed":0.92}}],"dimension":{"width":W,"height":H}}
        vid=(api("https://api.heygen.com/v2/video/generate",body).get("data") or {}).get("video_id")
        vurl=curl=None
        for _ in range(80):
            st=api(f"https://api.heygen.com/v1/video_status.get?video_id={vid}").get("data") or {}
            if st.get("status")=="completed":
                vurl=st.get("video_url")
                for _ in range(12):
                    curl=(api(f"https://api.heygen.com/v1/video_status.get?video_id={vid}").get("data") or {}).get("caption_url")
                    if curl: break
                    time.sleep(3)
                break
            if st.get("status")=="failed": print(f"!!! {slug} failed"); break
            time.sleep(10)
        if not vurl: print(f"!!! {slug} no video"); continue
        urllib.request.urlretrieve(vurl,src)
        if curl: urllib.request.urlretrieve(curl,srt)
    D=dur(src)
    # jump-cut segments
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
            if txt: cues.append((ts(a),ts(b),caption_fix(txt)))
    wp=[]; ww=[]; gi=0
    for a,b,txt in cues:
        ws=txt.split(); wt=[len(x)+1 for x in ws]; tot=sum(wt); tt=a
        for k,w in enumerate(ws):
            e=b if k==len(ws)-1 else tt+(b-a)*wt[k]/tot
            p=str(d/f"w{gi}.png"); karaoke_png(ws,k,p); wp.append(p); ww.append((tt,e)); tt=e; gi+=1
    ins=["-i",jc,"-i",src,"-i",hc,"-i",cc]+sum([["-i",p] for p in wp],[])
    fc="[0:v]noise=alls=8:allf=t+u,setsar=1[b0]"
    for k,(s,e) in enumerate(ww): fc+=f";[b{k}][{4+k}:v]overlay=0:0:enable='between(t,{s:.3f},{e:.3f})'[b{k+1}]"
    bw=len(wp); cs=0.70*D; ce=min(D-0.2,cs+3.0)
    fc+=f";[b{bw}][2:v]overlay=0:0:enable='between(t,0,1.8)'[bh];[bh][3:v]overlay=0:0:enable='between(t,{cs:.2f},{ce:.2f})'[v]"
    fc+=";[1:a]highpass=f=85,loudnorm=I=-14:TP=-1:LRA=7[a]"
    bodymp4=str(d/"body.mp4")
    subprocess.run([FF,"-y","-loglevel","error",*ins,"-filter_complex",fc,"-map","[v]","-map","[a]","-c:v","libx264","-b:v","3.5M","-maxrate","3.8M","-bufsize","5M","-pix_fmt","yuv420p","-r","30","-c:a","aac","-b:a","160k",bodymp4],check=True)
    # append branded end card (proper finish)
    out=str(ROOT/f"public/reels/test-sprint-{slug}-tiktok.mp4")
    subprocess.run([FF,"-y","-loglevel","error","-i",bodymp4,"-i",ENDCLIP,"-filter_complex","[0:v][0:a][1:v][1:a]concat=n=2:v=1:a=1[v][a]","-map","[v]","-map","[a]","-c:v","libx264","-b:v","3.5M","-maxrate","3.8M","-bufsize","5M","-pix_fmt","yuv420p","-r","30","-c:a","aac","-b:a","160k","-movflags","+faststart",out],check=True)
    subprocess.run(["/usr/bin/python3",str(ROOT/"scripts/r2_upload.py"),out,f"social/sprint/{r2}.mp4","video/mp4"])
    print(f"<<< {slug} done -> {r2}.mp4",flush=True)
print("=== reframe-all done ===",flush=True)
