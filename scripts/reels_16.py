"""Encoded spec for the 16 experimental reels (round one). Single source of truth
for: per-reel avatar + voice, and an ordered scene list. Each scene:
  (start, end, token, asset_slug|None, asset_prompt|None, vo, caption)
token: ASSET (full-screen brand-icon + VO over it) · AVATAR (talking head) ·
SPLIT (avatar + asset). Asset prompts are written for the site's locked Brand
Style (clean line-art icons) — single clean subjects, no crowded scenes.

Rulings applied vs the source brief:
 · exclamation points only in the parody reels (04, 05, 08, 16); others de-exclaimed
 · competitors stay "the lead sites" (no Thumbtack/Angi/HomeAdvisor)
 · CTA is consentresolve.com/demo
 · Leah is captioned by name only (no title)
 · #03 stays at the "built to the strictest privacy standard" ceiling (no outright legal claim)
 · "$89" → "$100+ , split 3-4 ways" (our sourced line; no invented constant)
Banned words avoided: leverage, solution, seamless, game-changer, instant, free, unlock, revolutionary, supercharge, effortless.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from video_scripts import VOICE, LOOK

LEAH_VOICE = "1d92f4e36247492d9ad806b59fd3434a"
LEAH_LOOK = "de4dc68d9cb249219aa96287c458bae4"
# persona -> (heygen talking_photo look, voice_id, caption name)
CAST = {
    "aaron": (LOOK["aaron_office"], VOICE["aaron"], "Aaron · Co-Founder & CMO"),
    "jason": (LOOK["jason_truck"],  VOICE["jason"], "Jason · COO"),
    "tyler": (LOOK["tyler_lawn"],   VOICE["tyler"], "Tyler · Account Manager"),
    "leah":  (LEAH_LOOK,            LEAH_VOICE,     "Leah"),
}
CTA = "consentresolve.com/demo"

# Reel := {avatar, title, scenes:[(s,e,token,slug,prompt,vo,caption)]}
REELS = {
"01": {"avatar":"leah","title":"98 Ghosts","scenes":[
 (0,2,"ASSET","doorway","many small person icons streaming through a glowing doorway labeled as a website entrance","A hundred people walked into your site today.","100 visitors"),
 (2,5,"ASSET","ghosts","a few solid person icons while most turn into faint translucent ghost outlines drifting upward","Watch. 98 of them just vanished. No name, no trace.","98 = ghosts"),
 (5,8,"AVATAR",None,None,"Most contractors think that's a tech limit. It's not.","not a tech problem"),
 (8,12,"ASSET","gate","a single ghost-outline person pausing at a checkmark consent banner and turning solid","A visitor's only a ghost until they say yes to your consent banner.","consent = the gate"),
 (12,16,"SPLIT","leadcard","a clean contact card icon with a person avatar and two placeholder lines","Then you get a real email. A name. What they came for.","email + intent"),
 (16,21,"AVATAR",None,None,"No yes, no name. No guessing, no fingerprinting. That's the rule.","no guessing"),
 (21,26,"AVATAR",None,None,"It's called consent-based visitor identification. Now you know the term.",""),
 (26,30,"ASSET","callback","two solid person icons walking toward a ringing telephone","So don't ask how much traffic you get. Ask how many you're allowed to call back.","Who can you call back?"),
]},
"02": {"avatar":"aaron","title":"Invoice Shredder","hook":"One lead. Sold to four of you.","scenes":[
 (0,3,"HOOK","hookcard",None,"Ever buy an exclusive lead, then find out three other guys already called that same person? Here's why.","One lead. Sold to four of you."),
 (3,6,"ASSET","invoice","a paper invoice icon stamped 'shared lead, sold to 4' held above a paper shredder","So this is what one shared lead really costs you.","sold 4 ways"),
 (6,9,"ASSET","shred","an invoice icon feeding into a shredder, strips falling","A hundred bucks. Sold to four of you. First to call wins.",""),
 (9,12,"AVATAR",None,None,"So we built the opposite. Honestly? Stupid simple.",""),
 (12,15,"AVATAR",None,None,"Keep your ads. Same traffic. You change nothing.","keep your ads"),
 (15,19,"ASSET","leadcard",None,"Someone taps Accept on your banner, and boom, real email.","real email"),
 (19,22,"AVATAR",None,None,"You never cold-call. They just come back and call you.","warm inbound"),
 (22,25,"ASSET","tag","a price tag icon reading '$7 yours alone'","Best part? It's yours. Never resold.","yours alone"),
 (25,29,"ASSET","code","a code editor window icon with one line highlighted","Seven bucks, flat. One line of code. That's it.","$7/lead · "+CTA),
]},
"03": {"avatar":"jason","title":"Isn't This Illegal","scenes":[
 (0,2,"AVATAR",None,None,"Isn't this kind of illegal? I get asked that every week.","Jason · COO"),
 (2,5,"AVATAR",None,None,"Honest answer? We built it to the strictest privacy standard there is. Here's how.",""),
 (5,9,"ASSET","banner","a clean phone icon showing a consent banner with a large checkmark accept button","Nothing happens until the homeowner taps Accept.","consent first"),
 (9,13,"AVATAR",None,None,"No accept, no name. We never fingerprint. We never guess who someone is.","no guessing"),
 (13,18,"ASSET","receipt","a printed receipt icon with a checkmark and a small clock for a timestamp","Every reveal is timestamped and signed. You get a receipt.","receipts"),
 (18,22,"AVATAR",None,None,"You're not the one guessing. The homeowner told you, on the record.","on the record"),
 (22,26,"AVATAR",None,None,"It's consent-first. The consent isn't a nice-to-have. It's the whole point.",""),
 (26,30,"ASSET","accept","a single large checkmark consent banner icon, confident and clean","So the real question isn't whether this is allowed. It's why anyone ever did it without asking.",""),
]},
"04": {"avatar":"tyler","title":"Bad Tinder Date","scenes":[
 (0,2,"ASSET","datecard","a dating-app style profile card icon with a faceless question-mark silhouette","Your website visitors treat you like a bad first date.",""),
 (2,5,"AVATAR",None,None,"They show up. They check you out. They look at your prices...",""),
 (5,8,"ASSET","ghosted","a profile card swiping away as a faint ghost outline walks off","...and they ghost. No name. No number. Nothing.","ghosted (again)"),
 (8,11,"AVATAR",None,None,"And you can't chase 'em. You don't even have a number to text.",""),
 (11,15,"ASSET","match","a profile card with a checkmark heart, the silhouette filling into a solid person","Unless they opt in. Then they hand you their email themselves.","consent = they opted in"),
 (15,19,"SPLIT","leadcard","a clean lead card icon with a person avatar and a roof-shape intent tag","Now you know who they are and what they wanted.","real match"),
 (19,23,"AVATAR",None,None,"Stop getting ghosted by your own website! They opt in, they come back, they call you.","they call you"),
 (23,26,"ASSET","itsamatch","a celebratory 'it's a match' style banner icon, clean and on-brand",None,CTA),
]},
"05": {"avatar":"tyler","title":"Confession Booth","scenes":[
 (0,2,"ASSET","booth","a confession-booth icon with a faceless question-mark silhouette behind the screen","Every homeowner who visits your site has a confession.",""),
 (2,5,"ASSET","speech","a confession booth icon with a speech bubble","Forgive me. I visited 3 roofers today and called none of them.",""),
 (5,8,"AVATAR",None,None,"Happens all day. They look. They leave. You never even knew they came.",""),
 (8,11,"AVATAR",None,None,"Here's the part that actually absolves you.",""),
 (11,15,"ASSET","absolve","a checkmark consent banner sliding into a booth window, silhouette turning solid","When they accept your consent banner, the confession becomes a contact.","consent = contact"),
 (15,19,"SPLIT","leadcard","a clean lead card icon, person avatar plus a metal-roof intent tag","A real email. What they were shopping for. Sitting in your inbox.","email + intent"),
 (19,23,"AVATAR",None,None,"You don't chase the sinner. They come back and call you!","they call you · "+CTA),
 (23,26,"ASSET","peace","a calm glowing checkmark booth-window icon, 'go in peace' energy",None,""),
]},
"06": {"avatar":"aaron","title":"10-Minute Speedrun","scenes":[
 (0,2,"ASSET","timer0","a speedrun stopwatch icon reading zero, over a website backend window","Anonymous traffic into a real lead. Timer starts now.","00:00"),
 (2,5,"SPLIT","code","a code editor window icon with one line and a checkmark","One line of code. Paste. Save.","1 line"),
 (5,8,"ASSET","live","a website preview icon with a consent banner appearing live","Consent banner's live. That's the whole install.","live"),
 (8,12,"AVATAR",None,None,"Now a homeowner visits. Looks at your prices. Taps Accept.",""),
 (12,16,"ASSET","inbox","a clean lead card landing in an inbox icon with a small stopwatch","Real email. Their name. What they wanted. Under ten minutes.","~08:40"),
 (16,20,"AVATAR",None,None,"No phone number, no cold call. They come back and call you.","warm inbound"),
 (20,24,"AVATAR",None,None,"Most shops take longer to find their coffee mug.",""),
 (24,28,"ASSET","stamp","a stopwatch frozen with a '$7/lead' price tag stamped beside it","Seven dollars a lead, yours alone.","$7/lead · "+CTA),
]},
"07": {"avatar":"leah","title":"POV Anonymous Visitor","scenes":[
 (0,2,"ASSET","povphone","a first-person phone icon scrolling a roofer's website","POV: you just landed on a roofer's website.",""),
 (2,5,"ASSET","leave","a phone icon leaving a pricing page, a home button tap","You check the price. You leave. You forget it happened.",""),
 (5,8,"SPLIT","blur","a faceless question-mark profile icon, a gray blur","To that roofer, you were a blur. 98 out of 100 people are.","98% anonymous"),
 (8,12,"ASSET","rewind","a rewind arrow over a phone icon showing a consent banner","But rewind. What if, on the way in, you'd tapped Accept?",""),
 (12,16,"ASSET","fillin","a question-mark profile filling into a solid lead card with a roof intent tag","Now he knows your name, your email, and that you wanted a roof repair.","email + intent"),
 (16,20,"AVATAR",None,None,"Not because he spied. Because you said yes.","because you said yes"),
 (20,25,"AVATAR",None,None,"That's the whole difference between a visitor and a lead. One tap.",""),
 (25,29,"ASSET","slidein","a clean lead card sliding into an inbox icon","Consent turns the blur into a person.",""),
]},
"08": {"avatar":"aaron","title":"The Price Is Wrong","scenes":[
 (0,2,"ASSET","board","a bright game-show board icon reading 'guess the lead price'","Contractors, come on down! Guess what one lead should cost.",""),
 (2,5,"ASSET","wheel1","a spinning prize-wheel icon landing on a wedge marked 'shared lead, $100+'","A shared lead? A hundred-plus. Split four ways.","$100+ 😬"),
 (5,8,"ASSET","wheel2","a prize-wheel wedge marked 'they pick the winner'","Another one? And they choose who wins it.","they pick 😬"),
 (8,11,"AVATAR",None,None,"Wrong. Wrong. Both wrong!",""),
 (11,15,"ASSET","wheel7","a prize-wheel slamming onto a green wedge marked '$7 yours alone', confetti","Seven dollars. Flat. And it's yours, nobody else's!","$7 · yours alone"),
 (15,19,"AVATAR",None,None,"Consented email. Real name. What they wanted. They come back and call you.","warm inbound"),
 (19,23,"AVATAR",None,None,"Same traffic you already pay for. You just actually get to keep it.",""),
 (23,27,"ASSET","boardcta","the game-show board flipping to a clean checkmark and a price tag","Cancel anytime.","$7 · "+CTA),
]},
"09": {"avatar":"jason","title":"Two Truths and a Lie","scenes":[
 (0,2,"AVATAR",None,None,"Two truths and a lie about identifying website visitors. Go.",""),
 (2,6,"ASSET","card1","a numbered card icon '1', neutral","One: about 98% of your visitors leave with no name.","#1"),
 (6,10,"ASSET","card2","a numbered card icon '2', neutral","Two: you can get their email, but only if they consent first.","#2"),
 (10,14,"ASSET","card3","a numbered card icon '3', faintly red","Three: you also get their phone number to cold-call them.","#3"),
 (14,17,"AVATAR",None,None,"Take a second. Which one's the lie?","which one?"),
 (17,21,"ASSET","reveal","card 3 stamped 'lie' in red, cards 1 and 2 marked true with checkmarks","Three. There's no phone number. We never cold-call anyone.","#3 = the lie"),
 (21,25,"AVATAR",None,None,"It's email, after consent. Then they come back and call you. That's the model.","warm inbound"),
 (25,29,"ASSET","nophone","a clean lead card icon with an email field and no phone field","Consent in. Email out. No creepy stuff.",""),
]},
"10": {"avatar":"leah","title":"Gray to Green","hook":"Watch a stranger become a customer","scenes":[
 (0,3,"HOOK","hookcard",None,"Want to see a stranger on your site turn into someone you can actually call? Watch.","Watch a stranger become a customer"),
 (3,6,"ASSET","grid-anon",None,"This is your traffic. Right now, every one of them's a stranger.","your traffic"),
 (6,9,"AVATAR",None,None,"And you can't call a stranger. You don't know who they are.",""),
 (9,12,"ASSET","a2-accept","a hand tapping a large rounded checkmark consent button, a small person icon beside it","But the second one taps Accept on your consent banner...",""),
 (12,16,"ASSET","leadcard-sam",None,"...that stranger becomes a name, an email, what they came for.","consented"),
 (16,19,"ASSET","a4-some","a small three-by-three grid of identical person icons, a few of them marked with a small checkmark badge","Just the ones who say yes. That's the deal.",""),
 (19,22,"AVATAR",None,None,"We never guess. No yes, no name.","no guessing"),
 (22,26,"AVATAR",None,None,"Your job's getting more to say yes. We make that yes callable.",""),
 (26,29,"ASSET","a5-phone","a person icon linked by a connecting line to a ringing telephone, a friendly callback","That's it. Consent calls you back.",""),
]},
"11": {"avatar":"jason","title":"Missed-Call Graveyard","scenes":[
 (0,2,"ASSET","graves","a few simple headstone icons each marked 'anonymous visitor'","This is a graveyard of jobs you almost had.",""),
 (2,5,"ASSET","rows","a row of identical headstone icons receding back","Every stone is someone who visited your site and left with no name.","98% of them"),
 (5,8,"AVATAR",None,None,"You paid to get them there. Then they vanished.",""),
 (8,12,"ASSET","rise","one headstone cracking open as a solid person icon steps out holding a lead card","Here's the resurrection. They tap Accept on your consent banner.","consent = resurrection"),
 (12,16,"SPLIT","leadcard","a clean lead card icon, person avatar plus a water-heater intent tag","And a dead visitor becomes a real email in your inbox.","email + intent"),
 (16,20,"AVATAR",None,None,"No cold call. They walk back through your door and call you.","warm inbound"),
 (20,24,"AVATAR",None,None,"How many headstones is your site filling this month?",""),
 (24,28,"ASSET","empty","an empty plot with a person icon walking toward a phone, a small price tag '$7'","Seven dollars a lead, yours alone.","$7/lead · "+CTA),
]},
"12": {"avatar":"tyler","title":"A Vibe Is Not a Name","scenes":[
 (0,2,"ASSET","squiggle","a vague analytics dashboard icon, one squiggly line and an up-arrow, zero names","Your analytics says traffic's up 12%. Cool. Name one of them.",""),
 (2,5,"AVATAR",None,None,"You can't. It's a line. This is a vibe, not a name.","a vibe, not a name"),
 (5,8,"ASSET","labels","an analytics chart icon with vague labels and a question mark","'Users.' Cool. Which one needs a water heater?",""),
 (8,11,"AVATAR",None,None,"Analytics tells you a crowd showed up. Not who's in it.",""),
 (11,15,"ASSET","name","the squiggly line resolving into a single clean lead card with a person and email","This is what a name looks like. Email. What they wanted. After they consent.","this is a name"),
 (15,19,"AVATAR",None,None,"Keep your analytics for the vibe. Get this for the jobs.",""),
 (19,23,"AVATAR",None,None,"They opt in, they come back, they call you.","they call you · "+CTA),
]},
"13": {"avatar":"aaron","title":"Start at the Win","scenes":[
 (0,2,"ASSET","booked","a calendar icon with a slot lit up: a booked water-heater job","A homeowner just booked me. I never called her once.",""),
 (2,5,"AVATAR",None,None,"No cold call. No chasing. How? Rewind.","how? ⏪"),
 (5,8,"ASSET","unland","a rewind arrow as a lead card un-lands back toward an inbox icon","Three days ago she was an anonymous visitor on my site.",""),
 (8,12,"ASSET","tap","a rewind to a hand tapping a checkmark consent banner","On her way in, she accepted my consent banner. That's it.","consent = the start"),
 (12,16,"SPLIT","leadcard","a clean lead card icon, person avatar plus a water-heater intent tag","So I got her email and what she wanted. Sitting in my inbox.","email + intent"),
 (16,20,"AVATAR",None,None,"I followed up through my own funnel. She came back and called me.","warm inbound"),
 (20,24,"AVATAR",None,None,"Same traffic you already have. This is just keeping it.",""),
 (24,28,"ASSET","ff","a fast-forward to the lit calendar slot with a '$7/lead' price tag","Seven dollars a lead, yours alone.","$7/lead · "+CTA),
]},
"14": {"avatar":"jason","title":"Oddly Satisfying Receipts","scenes":[
 (0,2,"ASSET","print1","a crisp single receipt printing, a checkmark and a clock timestamp","Every single lead comes with a receipt. Watch.",""),
 (2,5,"ASSET","rhythm","several receipts printing in a neat rhythm, each with a checkmark","Email. Timestamp. Consent on the record. Every time.","timestamped ✓"),
 (5,8,"ASSET","stack","a neat fanned stack of checkmarked receipts","No consent, no receipt, no lead. That's the order it happens in.","consent first"),
 (8,12,"AVATAR",None,None,"We don't guess who anyone is. The homeowner tells you, on the record.","no guessing"),
 (12,16,"ASSET","becomes","one receipt turning into a clean lead card with a person and email","Then it becomes this. A real person who wanted your work.","email + intent"),
 (16,20,"AVATAR",None,None,"Built to the strictest privacy standard there is. You hold the receipts.",""),
 (20,24,"ASSET","fade","receipts printing, resolving to a clean checkmark",CTA,CTA),
]},
"15": {"avatar":"leah","title":"What We DON'T Do","scenes":[
 (0,2,"AVATAR",None,None,"Most tools that 'identify visitors' are kind of creepy. Let me show you what we don't do.",""),
 (2,6,"ASSET","dontlist","a red crossed-out list icon: fingerprint, guess, phone number","We don't fingerprint your device. We don't guess. We don't hand over a phone number.","what we DON'T do"),
 (6,10,"ASSET","nocold","a red cold-call phone icon crossed out","And we never, ever cold-call a homeowner. That's not the deal.","no cold calls"),
 (10,14,"ASSET","dolist","a clean green checkmark list: ask first, email only, they call you","Here's all we do. Ask first. If they say yes, you get an email.","consent first"),
 (14,18,"AVATAR",None,None,"Then they come back through your funnel and call you. That's the whole thing.","warm inbound"),
 (18,22,"AVATAR",None,None,"Turns out asking permission is a feature. Who knew.",""),
 (22,26,"ASSET","resolve","the checkmark list resolving into a single clean lead card","Consent-first identification. The boring, honest kind.",""),
]},
"16": {"avatar":"tyler","title":"But Wait There's More","scenes":[
 (0,2,"ASSET","bw","a retro black-and-white infomercial icon: a baffled contractor at a screen","Tired of THIS? People visiting your site and just... leaving?",""),
 (2,5,"ASSET","flood","exaggerated ghost outlines flooding out a door","98 out of 100, gone! No name! No way to reach 'em!","98% gone!"),
 (5,8,"ASSET","snap","a screen snapping from black-and-white into bright color with a sparkle","Well, NOW...",""),
 (8,11,"AVATAR",None,None,"When a homeowner taps Accept on your consent banner, you get a REAL email!","real email"),
 (11,14,"ASSET","spin","a clean lead card spinning in with a sparkle, person and intent","Their name! What they wanted! Delivered to your inbox!","name + intent"),
 (14,17,"ASSET","slash","a big price tag with '$100+' slashed out and replaced by '$7'","But how much?! NOT a hundred-plus... SEVEN. Flat. Yours alone!","$7 · yours alone"),
 (17,21,"AVATAR",None,None,"And no, we will NOT cold-call them. They come back and call you. Wild, I know.","warm inbound"),
 (21,25,"ASSET","actnow","an 'act now' parody banner resolving into a clean checkmark","One line of code. Cancel anytime. We mean it.",CTA),
]},
}

# Assets to generate per reel: scenes with a slug + a prompt (ASSET/SPLIT). Reel 10
# reuses the already-approved a1..a5 slugs.
def assets_for(reel):
    return [(sc[3], sc[4]) for sc in REELS[reel]["scenes"] if sc[3] and sc[4]]
