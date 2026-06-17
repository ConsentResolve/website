"""Encoded spec for the 16 experimental reels (round one, v2). Single source of
truth for per-reel avatar + voice and an ordered scene list. Each scene:
  (start, end, token, asset_slug|None, asset_prompt|None, vo, caption)
token: ASSET (full-screen brand-icon + VO) · AVATAR (talking head) · SPLIT ·
HOOK (open hook screen — the scroll-stopper). VO is CASUAL + EXCITED, like a guy
answering a question in simple words — short lines, ~85-word budget per reel so it
lands ~33-40s at the deliberate 0.90 pace with sentence pauses. asset_prompt is
None: every slug's PNG is already generated under public/exp-reels/<NN>/ (regen
prompts live in git history); hookcard/leadcard/grid-anon are drawn in the composite.

Rulings: exclamations only in parody reels (04,05,08,16); "the lead sites" (no
Thumbtack); CTA consentresolve.com/demo; Leah name-only; #03 at the "strictest
privacy standard" ceiling; "$100+/split" not "$89"; banned words avoided.
Every lead/consented reveal uses the standard Sam Paul card (slug 'leadcard')."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from video_scripts import VOICE, LOOK

LEAH_VOICE = "1d92f4e36247492d9ad806b59fd3434a"
LEAH_LOOK = "de4dc68d9cb249219aa96287c458bae4"
CAST = {
    "aaron": (LOOK["aaron_office"], VOICE["aaron"], "Aaron · Co-Founder & CMO"),
    "jason": (LOOK["jason_truck"],  VOICE["jason"], "Jason · COO"),
    "tyler": (LOOK["tyler_lawn"],   VOICE["tyler"], "Tyler · Account Manager"),
    "leah":  (LEAH_LOOK,            LEAH_VOICE,     "Leah"),
}
CTA = "consentresolve.com/demo"
N = None

REELS = {
"01": {"avatar":"leah","title":"98 Ghosts","hook":"98 out of 100 just vanish","scenes":[
 (0,3,"HOOK","hookcard",N,"Want to know what actually happens to almost everyone who hits your site today? Watch.","98 out of 100 just vanish"),
 (3,6,"ASSET","doorway",N,"So say a hundred people land on your site today.","100 visitors"),
 (6,9,"ASSET","ghosts",N,"Watch. 98 of them just vanish. No name, no trace.","98 = ghosts"),
 (9,12,"AVATAR",N,N,"And everybody thinks that's just how the web works. It's not.","not a tech problem"),
 (12,15,"ASSET","gate",N,"A visitor's only a ghost until they say yes to your consent banner.","consent = the gate"),
 (15,19,"ASSET","leadcard",N,"The second they do? Boom. A real name, a real email.","email + intent"),
 (19,22,"AVATAR",N,N,"No yes, no name. We're never guessing who anybody is.","no guessing"),
 (22,26,"ASSET","callback",N,"So don't ask how much traffic you get. Ask how many you can call back.","Who can you call back?"),
]},
"02": {"avatar":"aaron","title":"Invoice Shredder","hook":"One lead. Sold to four of you.","scenes":[
 (0,3,"HOOK","hookcard",N,"Ever buy an exclusive lead, then find out three other guys already called that same person? Here's why.","One lead. Sold to four of you."),
 (3,6,"ASSET","invoice",N,"So this is what one shared lead really costs you.","sold 4 ways"),
 (6,9,"ASSET","shred",N,"A hundred bucks. Sold to four of you. First to call wins.",""),
 (9,12,"AVATAR",N,N,"So we built the opposite. Honestly? Stupid simple.",""),
 (12,15,"AVATAR",N,N,"Keep your ads. Same traffic. You change nothing.","keep your ads"),
 (15,19,"ASSET","leadcard",N,"Someone taps Accept on your banner, and boom, real email.","real email"),
 (19,22,"AVATAR",N,N,"You never cold-call. They just come back and call you.","warm inbound"),
 (22,25,"ASSET","tag",N,"Best part? It's yours. Never resold.","yours alone"),
 (25,29,"ASSET","code",N,"Seven bucks, flat. One line of code. That's it.","$7/lead · "+CTA),
]},
"03": {"avatar":"jason","title":"Isn't This Illegal","hook":"\"Isn't this illegal?\"","scenes":[
 (0,3,"HOOK","hookcard",N,"I get this question literally every week. So let me just answer it straight.","\"Isn't this illegal?\""),
 (3,7,"AVATAR",N,N,"Isn't this kind of illegal? Honestly? We built it to the strictest privacy standard there is.","Jason · COO"),
 (7,11,"ASSET","banner",N,"And here's the thing. Nothing happens until the homeowner taps Accept.","consent first"),
 (11,15,"AVATAR",N,N,"No accept, no name. We never fingerprint. We never guess who someone is.","no guessing"),
 (15,19,"ASSET","receipt",N,"And every reveal is timestamped and signed. You get a receipt.","receipts"),
 (19,23,"AVATAR",N,N,"So you're not the one guessing. They told you. On the record.","on the record"),
 (23,27,"ASSET","accept",N,"The real question isn't whether this is allowed. It's why anyone ever did it without asking.",""),
]},
"04": {"avatar":"tyler","title":"Bad Tinder Date","hook":"Your site keeps getting ghosted","scenes":[
 (0,3,"HOOK","hookcard",N,"Your website is basically a bad first date. Want me to explain?","Your site keeps getting ghosted"),
 (3,6,"ASSET","datecard",N,"Think about it. They show up, they check you out, they look at your prices...",""),
 (6,9,"ASSET","ghosted",N,"...and then they ghost you! No name, no number, nothing.","ghosted (again)"),
 (9,12,"AVATAR",N,N,"And you can't even chase 'em. You don't have a number to text!",""),
 (12,16,"ASSET","match",N,"Unless they opt in. Then they hand you their email themselves.","consent = they opted in"),
 (16,20,"ASSET","leadcard",N,"Now you know exactly who they are and what they wanted.","real match"),
 (20,24,"AVATAR",N,N,"So stop getting ghosted by your own website! They opt in, they call you.","they call you"),
 (24,27,"ASSET","itsamatch",N,N,CTA),
]},
"05": {"avatar":"tyler","title":"Confession Booth","hook":"Every visitor has a confession","scenes":[
 (0,3,"HOOK","hookcard",N,"You ever think about what your website visitors would confess if they actually could?","Every visitor has a confession"),
 (3,6,"ASSET","booth",N,"Because every single one of 'em has a confession.",""),
 (6,9,"ASSET","speech",N,"Forgive me. I visited 3 roofers today... and I called none of them.",""),
 (9,12,"AVATAR",N,N,"Happens all day! They look, they leave, you never even knew they came.",""),
 (12,16,"ASSET","absolve",N,"But here's what actually absolves you. They tap Accept on your banner...","consent = contact"),
 (16,20,"ASSET","leadcard",N,"...and that confession becomes a contact. A real email, what they wanted.","email + intent"),
 (20,24,"AVATAR",N,N,"You don't chase the sinner! They come back and call you.","they call you"),
 (24,27,"ASSET","peace",N,N,CTA),
]},
"06": {"avatar":"aaron","title":"10-Minute Speedrun","hook":"Stranger to real lead in 10 minutes","scenes":[
 (0,3,"HOOK","hookcard",N,"How fast can you turn a total stranger on your site into a real lead? Let's time it.","Stranger to real lead in 10 minutes"),
 (3,6,"ASSET","timer0",N,"Timer starts now. Anonymous traffic, to a real lead.","00:00"),
 (6,9,"ASSET","code",N,"One line of code. You paste it, you save it.","1 line"),
 (9,12,"ASSET","live",N,"Boom. Consent banner's live. That's the whole install.","live"),
 (12,15,"AVATAR",N,N,"Now a homeowner visits, looks at your prices, taps Accept.",""),
 (15,19,"ASSET","leadcard",N,"Real email, their name, what they wanted. Under ten minutes.","~08:40"),
 (19,22,"AVATAR",N,N,"No phone number, no cold call. They come back and call you.","warm inbound"),
 (22,26,"ASSET","stamp",N,"Seven bucks a lead, yours alone. Faster than finding your coffee mug.","$7/lead · "+CTA),
]},
"07": {"avatar":"leah","title":"POV Anonymous Visitor","hook":"What he'll never know about you","scenes":[
 (0,3,"HOOK","hookcard",N,"Ever leave a contractor's website without a trace? Here's what that looks like from his side.","What he'll never know about you"),
 (3,6,"ASSET","povphone",N,"So you land on a roofer's site, you're just scrolling.",""),
 (6,9,"ASSET","leave",N,"You check the price, you leave, you forget it even happened.",""),
 (9,12,"ASSET","blur",N,"To that roofer? You were a gray blur. 98 out of 100 people are.","98% anonymous"),
 (12,15,"ASSET","rewind",N,"But rewind a sec. What if, on the way in, you'd tapped Accept?",""),
 (15,19,"ASSET","leadcard",N,"Now he's got your name, your email, and that you wanted a roof repair.","email + intent"),
 (19,23,"AVATAR",N,N,"Not because he spied. Because you said yes.","because you said yes"),
 (23,27,"AVATAR",N,N,"That's the whole difference between a visitor and a lead. One tap.",""),
]},
"08": {"avatar":"aaron","title":"The Price Is Wrong","hook":"Guess what one lead costs","scenes":[
 (0,3,"HOOK","hookcard",N,"Want to play a quick game? Guess what one lead should actually cost you.","Guess what one lead costs"),
 (3,6,"ASSET","board",N,"Contractors, come on down!",""),
 (6,9,"ASSET","wheel1",N,"A shared lead? That's a hundred-plus. Split four ways.","$100+ 😬"),
 (9,12,"ASSET","wheel2",N,"And get this. They pick who wins it.","they pick 😬"),
 (12,15,"AVATAR",N,N,"Wrong! Both wrong!",""),
 (15,19,"ASSET","wheel7",N,"Seven dollars. Flat. And it's yours, nobody else's!","$7 · yours alone"),
 (19,23,"AVATAR",N,N,"Consented email, real name, what they wanted. They call you.","warm inbound"),
 (23,27,"ASSET","boardcta",N,"Same traffic you already pay for. You just keep it. Cancel anytime.","$7 · "+CTA),
]},
"09": {"avatar":"jason","title":"Two Truths and a Lie","hook":"Two truths and a lie","scenes":[
 (0,3,"HOOK","hookcard",N,"Two truths and a lie about your website visitors. Can you spot the lie?","Two truths and a lie"),
 (3,7,"ASSET","card1",N,"One. About 98% of your visitors leave with no name.","#1"),
 (7,11,"ASSET","card2",N,"Two. You can get their email, but only if they consent first.","#2"),
 (11,15,"ASSET","card3",N,"Three. You also get their phone number to cold-call 'em.","#3"),
 (15,18,"AVATAR",N,N,"Take a second. Which one's the lie?","which one?"),
 (18,22,"ASSET","reveal",N,"It's three. There's no phone number. We never cold-call anybody.","#3 = the lie"),
 (22,26,"AVATAR",N,N,"It's email, after consent. Then they come back and call you.","warm inbound"),
]},
"10": {"avatar":"leah","title":"Gray to Green","hook":"Watch a stranger become a customer","scenes":[
 (0,3,"HOOK","hookcard",N,"Want to see a stranger on your site turn into someone you can actually call? Watch.","Watch a stranger become a customer"),
 (3,6,"ASSET","grid-anon",N,"This is your traffic. Right now, every one of them's a stranger.","your traffic"),
 (6,9,"AVATAR",N,N,"And you can't call a stranger. You don't know who they are.",""),
 (9,12,"ASSET","a2-accept",N,"But the second one taps Accept on your consent banner...",""),
 (12,16,"ASSET","leadcard",N,"...that stranger becomes a name, an email, what they came for.","consented"),
 (16,19,"ASSET","a4-some",N,"Just the ones who say yes. That's the deal.",""),
 (19,22,"AVATAR",N,N,"We never guess. No yes, no name.","no guessing"),
 (22,26,"AVATAR",N,N,"Your job's getting more to say yes. We make that yes callable.",""),
 (26,29,"ASSET","a5-phone",N,"That's it. Consent calls you back.",""),
]},
"11": {"avatar":"jason","title":"Missed-Call Graveyard","hook":"A graveyard of jobs you almost had","scenes":[
 (0,3,"HOOK","hookcard",N,"Every one of these was a job you could've had. Want to know why you lost it?","A graveyard of jobs you almost had"),
 (3,6,"ASSET","graves",N,"This right here? It's a graveyard of jobs you almost had.",""),
 (6,9,"ASSET","rows",N,"Every stone is somebody who visited your site and left with no name.","98% of them"),
 (9,12,"AVATAR",N,N,"You paid to get 'em there. And then they just vanished.",""),
 (12,16,"ASSET","rise",N,"But here's the resurrection. They tap Accept on your consent banner...","consent = resurrection"),
 (16,20,"ASSET","leadcard",N,"...and a dead visitor becomes a real email in your inbox.","email + intent"),
 (20,23,"AVATAR",N,N,"No cold call. They walk back through your door and call you.","warm inbound"),
 (23,27,"ASSET","empty",N,"Seven bucks a lead, yours alone. How many stones you filling this month?","$7/lead · "+CTA),
]},
"12": {"avatar":"tyler","title":"A Vibe Is Not a Name","hook":"Your analytics is lying to you","scenes":[
 (0,3,"HOOK","hookcard",N,"Your analytics says traffic's up 12%. Cool. Can you name one of them?","Your analytics is lying to you"),
 (3,6,"ASSET","squiggle",N,"You can't, right? It's a line. That's a vibe, not a name.","a vibe, not a name"),
 (6,9,"AVATAR",N,N,"Analytics tells you a crowd showed up. Not who's in it.",""),
 (9,12,"ASSET","labels",N,"Users. Great. Which one needs a water heater? Hello?",""),
 (12,16,"ASSET","leadcard",N,"This is what a name looks like. Email, what they wanted. After they consent.","this is a name"),
 (16,20,"AVATAR",N,N,"Keep your analytics for the vibe. Get this for the actual jobs.",""),
 (20,24,"AVATAR",N,N,"They opt in, they come back, they call you.","they call you · "+CTA),
]},
"13": {"avatar":"aaron","title":"Start at the Win","hook":"She booked me. I never called.","scenes":[
 (0,3,"HOOK","hookcard",N,"A homeowner just booked me, and I never called her once. Want to know how?","She booked me. I never called."),
 (3,6,"ASSET","booked",N,"See that? Booked job. And I never picked up the phone.",""),
 (6,9,"AVATAR",N,N,"No cold call, no chasing. So how'd it happen? Rewind.","how? ⏪"),
 (9,12,"ASSET","unland",N,"Three days ago, she was just an anonymous visitor on my site.",""),
 (12,15,"ASSET","tap",N,"On her way in, she tapped Accept on my consent banner. That's it.","consent = the start"),
 (15,19,"ASSET","leadcard",N,"So I had her email and what she wanted, sitting in my inbox.","email + intent"),
 (19,22,"AVATAR",N,N,"I followed up through my own funnel. She came back and called me.","warm inbound"),
 (22,26,"ASSET","ff",N,"Same traffic you already have. You're just keeping it. Seven bucks a lead.","$7/lead · "+CTA),
]},
"14": {"avatar":"jason","title":"Oddly Satisfying Receipts","hook":"Every lead comes with a receipt","scenes":[
 (0,3,"HOOK","hookcard",N,"What if every single lead came with a receipt? Watch this.","Every lead comes with a receipt"),
 (3,6,"ASSET","print1",N,"Because they do. Every lead, a receipt.",""),
 (6,9,"ASSET","rhythm",N,"Email. Timestamp. Consent, on the record. Every single time.","timestamped ✓"),
 (9,12,"ASSET","stack",N,"No consent, no receipt, no lead. That's the order it happens in.","consent first"),
 (12,16,"AVATAR",N,N,"We don't guess who anybody is. The homeowner tells you. On the record.","no guessing"),
 (16,20,"ASSET","leadcard",N,"And then it becomes this. A real person who actually wanted your work.","email + intent"),
 (20,24,"AVATAR",N,N,"Built to the strictest privacy standard there is. You hold the receipts.",""),
]},
"15": {"avatar":"leah","title":"What We DON'T Do","hook":"Most of these tools are creepy","scenes":[
 (0,3,"HOOK","hookcard",N,"Most tools that identify visitors are kind of creepy. Want to see what we don't do?","Most of these tools are creepy"),
 (3,7,"ASSET","dontlist",N,"We don't fingerprint your device. We don't guess. We don't hand you a phone number.","what we DON'T do"),
 (7,10,"ASSET","nocold",N,"And we never, ever cold-call a homeowner. That's just not the deal.","no cold calls"),
 (10,14,"ASSET","dolist",N,"Here's all we actually do. We ask first. They say yes, you get an email.","consent first"),
 (14,18,"AVATAR",N,N,"Then they come back through your funnel and call you. That's the whole thing.","warm inbound"),
 (18,22,"AVATAR",N,N,"Turns out asking permission is a feature. Who knew.",""),
 (22,26,"ASSET","resolve",N,"Consent-first identification. The boring, honest kind.",""),
]},
"16": {"avatar":"tyler","title":"But Wait There's More","hook":"Tired of visitors just... leaving?","scenes":[
 (0,3,"HOOK","hookcard",N,"Tired of people visiting your site and just... leaving? Well, get this.","Tired of visitors just... leaving?"),
 (3,6,"ASSET","bw",N,"Look at this poor guy, refreshing his analytics, baffled!",""),
 (6,9,"ASSET","flood",N,"98 out of 100, gone! No name! No way to reach 'em!","98% gone!"),
 (9,11,"ASSET","snap",N,"But NOW...",""),
 (11,15,"AVATAR",N,N,"When a homeowner taps Accept on your consent banner, you get a REAL email!","real email"),
 (15,18,"ASSET","spin",N,"Their name! What they wanted! Right in your inbox!","name + intent"),
 (18,22,"ASSET","slash",N,"And how much? NOT a hundred-plus... seven bucks. Flat. Yours alone!","$7 · yours alone"),
 (22,26,"AVATAR",N,N,"And no, we will NOT cold-call 'em. They call you. Wild, I know.","warm inbound"),
]},
}

def assets_for(reel):
    return [(sc[3], sc[4]) for sc in REELS[reel]["scenes"] if sc[3] and sc[4]]
