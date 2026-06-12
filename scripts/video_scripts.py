#!/usr/bin/env python3
"""~30s video scripts for the short-form video track (TikTok/Shorts/Reels).

Sized for the 30-45s completion-rate sweet spot: ~6 scenes, ~85-95 spoken words
(our Avatar IV renders ~3 words/sec, so ~90 words ≈ ~30s). One angle per video,
one persona, one locked look (location), per the production standards +
.docs/avatar-casting.md.

Voice = Heartbeat v2 (social/ad): dry contractor-peer, no exclamation points, no
spoken competitor names (euphemisms), no trial pricing, $7 exclusive + 98/100 OK
(never claims % identified), soft /demo CTA. Spoken "lead"->"leed" and the URL
are normalized in gen_avatar_scenes.py spoken(); CAPTIONS show the real spelling.

Each scene = (caption/spoken text, HeyGen emotion, speed).
Consumed by:  ANGLE=invoice,leak python3 scripts/gen_avatar_scenes.py
"""

# Voice IDs (synced Jun 2026)
VOICE = {
    "aaron": "f365d990e89f4c55810722ef4788b85b",
    "tyler": "0c76e4a9be91456da07c3c9e1160db1e",
    "jason": "0e671a523e3d4cd7b6d5c580de70931e",
}
# Trade looks per persona (location variety across angles) — ids from the
# re-themed avatar groups.
LOOK = {
    "aaron_office":  "b5dc5a22eb684b959e36d2c0a1834461",
    "aaron_hvac":    "72c934cce9784b98b3cf9fd7a40f341a",
    "aaron_breaker": "88773e53d22d45c2baa228335ceaf6fb",
    "aaron_remodel": "508d65961dac4265ae0f24902834283c",
    "jason_truck":   "26e04090a6124f48b27623c888c6996b",
    "jason_plumb":   "beff1b28f1d242c28bb0b0051feef263",
    "jason_drive":   "1d4009b32ec140a69564f4065f8c96fb",
    "jason_roof":    "46fee5fcd8e642da9476b4b1f999ea19",
    "jason_garage":  "9c8d011c319f47438a1f18def6bbc875",
    "tyler_lawn":    "7a317560c0d54461a38666bc965cac72",
    "tyler_pest":    "14a3864dbeda4771800055a48aac5521",
    "tyler_drive":   "d3cca390c1f4480ba459c70c189738cb",
    "tyler_pool":    "f913c841468a40f4b9355a45883b32a9",
}

F, S = "Friendly", "Serious"

# angle -> {persona, look, scenes:[(text, emotion, speed)]}  (~90 words ≈ ~30s)
ANGLES = {
 "invoice": {"persona": "jason", "look": "jason_truck", "scenes": [
    ("I added up last month's lead spend the other night, sitting right here in the truck.", F, 1.04),
    ("Then I counted how many of those people actually picked up when I called. It was not close.", S, 1.04),
    ("Here is the part that stings. Ninety-eight out of a hundred people who hit your website leave without a trace.", S, 1.04),
    ("You paid for every one of those clicks, to bring them to your own site. Then they vanish.", S, 1.04),
    ("We hand them back. Real people, consent-first, seven dollars a lead. Exclusive, never resold.", F, 1.05),
    ("See exactly how it works at consentresolve.com/demo.", F, 1.05),
 ]},
 "race": {"persona": "jason", "look": "jason_roof", "scenes": [
    ("Every shared lead I buy, four other guys get the same name the same second.", S, 1.04),
    ("By the time I call, two of them already left a voicemail. That is not a lead.", S, 1.04),
    ("That is a footrace, and I am paying just to stand at the starting line.", S, 1.04),
    ("The traffic already on your own website is different. Those people are yours alone.", F, 1.04),
    ("We hand them back as exclusive leads. Seven dollars. Sold once, to you, never resold.", F, 1.05),
    ("It's all at consentresolve.com/demo.", F, 1.05),
 ]},
 "ftc": {"persona": "aaron", "look": "aaron_office", "scenes": [
    ("The biggest lead site in the country was ordered to pay seven point two million dollars.", S, 1.03),
    ("The reason was lying about lead quality. And honestly, suddenly all my garbage leads made sense.", S, 1.03),
    ("I had spent years blaming myself for a pipeline somebody else completely controlled.", S, 1.03),
    ("So I stopped. Now I just recover the people already on my own website.", F, 1.04),
    ("No marketplace, no middleman, no robot deciding what I owe. Consent-first, exclusive, seven dollars.", F, 1.05),
    ("consentresolve.com/demo.", F, 1.05),
 ]},
 "leak": {"persona": "tyler", "look": "tyler_lawn", "scenes": [
    ("Here is the number that stopped me cold. Ninety-eight out of a hundred.", F, 1.05),
    ("That is how many people visit your website and leave without ever raising a hand.", S, 1.04),
    ("You paid for every one of those clicks. The traffic was already yours.", S, 1.04),
    ("We identify those visitors and hand them back as real, consent-first leads.", F, 1.05),
    ("Not a name scraped off a list. A person who actually wants the work. Seven dollars, exclusive.", F, 1.05),
    ("See it work at consentresolve.com/demo.", F, 1.05),
 ]},
 "twice": {"persona": "jason", "look": "jason_plumb", "scenes": [
    ("A lead site once sold me the exact same homeowner twice.", S, 1.04),
    ("Second time I called, the job was already done. I had done it the week before.", S, 1.04),
    ("Same lead, three other contractors, and nobody told me. I paid full price to chase my own finished work.", S, 1.04),
    ("The math never works when you are buying other people's leftovers.", S, 1.04),
    ("Exclusive used to mean something. With us it still does. Sold once, to you. Seven bucks.", F, 1.05),
    ("consentresolve.com/demo.", F, 1.05),
 ]},
 "ghost": {"persona": "jason", "look": "jason_drive", "scenes": [
    ("Thirty leads last month. I called every single one of them.", S, 1.04),
    ("Thirty ghosts. No answer, wrong number, or never heard of me. A thousand bucks to talk to nobody.", S, 1.04),
    ("Meanwhile the people already on your website actually want the work done.", F, 1.04),
    ("We hand those visitors back, consent-first, the moment they land on your site.", F, 1.05),
    ("Seven dollars. Exclusive. They are expecting your call, not dodging it.", F, 1.05),
    ("I am done renting dead phone numbers. consentresolve.com/demo.", F, 1.05),
 ]},
 "credit": {"persona": "aaron", "look": "aaron_breaker", "scenes": [
    ("You flag a fake lead. They review it. And they do not refund you.", S, 1.03),
    ("They hand you a credit, to go buy more leads from the same place.", S, 1.03),
    ("Sit with that. The penalty for selling you junk is making you buy more junk.", S, 1.03),
    ("We do it backwards. You pay seven dollars only when a real, identified person lands in your funnel.", F, 1.04),
    ("From the website you already paid to fill. Exclusive, consent-first.", F, 1.05),
    ("I wanted off that treadmill. consentresolve.com/demo.", F, 1.05),
 ]},
 "robot": {"persona": "jason", "look": "jason_garage", "scenes": [
    ("A robot charged me four hundred dollars last month.", S, 1.04),
    ("Why. Because my own customer called me back from a number it did not recognize.", S, 1.04),
    ("No appeal. No person to call. Just a bill and a shrug.", S, 1.03),
    ("I am paying a machine to misunderstand my own business.", S, 1.04),
    ("The traffic on your own website never bills you by algorithm. Exclusive, consent-first, seven dollars.", F, 1.05),
    ("That was the last invoice I let an algorithm write. consentresolve.com/demo.", F, 1.05),
 ]},
 "policy": {"persona": "aaron", "look": "aaron_remodel", "scenes": [
    ("Your entire pipeline lives inside somebody else's dashboard.", S, 1.03),
    ("One policy change on their end, one suspended account, and it is just gone.", S, 1.03),
    ("I have watched it happen to two guys I know. Overnight, no warning, no recourse.", S, 1.03),
    ("Years of reviews and ranking, and you built equity in their company, not yours.", S, 1.03),
    ("Your website is the one pipe you actually own. And ninety-eight of a hundred visitors leave it anonymous. We fix that.", F, 1.04),
    ("Exclusive, consent-first, seven dollars a lead. consentresolve.com/demo.", F, 1.05),
 ]},
 "creepy": {"persona": "tyler", "look": "tyler_pest", "scenes": [
    ("I tried one of those visitor-identification tools once. Just once.", S, 1.04),
    ("First week, somebody replied and asked why they were on a list.", S, 1.04),
    ("I did not have a good answer. That was the end of that.", S, 1.04),
    ("You cannot build a business on people feeling watched.", S, 1.04),
    ("Consent-first is the whole difference. They opted in, they expect to hear from you. Seven dollars, no scraped numbers.", F, 1.05),
    ("See how the consent part works at consentresolve.com/demo.", F, 1.05),
 ]},
 "math": {"persona": "tyler", "look": "tyler_drive", "scenes": [
    ("Let me just do the math out loud for a second.", F, 1.05),
    ("Option one. A hundred bucks for a shared lead I close maybe five percent of the time.", S, 1.04),
    ("And I split that lead with three other guys, all calling at once.", S, 1.04),
    ("Option two. Seven dollars for an exclusive lead from somebody already on my website.", F, 1.04),
    ("One of those builds a business. The other one builds theirs.", F, 1.05),
    ("I think I can figure that one out. consentresolve.com/demo.", F, 1.05),
 ]},
 "ownership": {"persona": "aaron", "look": "aaron_hvac", "scenes": [
    ("Every dollar I handed the lead sites built their brand, not mine.", S, 1.03),
    ("I was renting access to customers I was already paying to create.", S, 1.03),
    ("The dollars I spend now build something I actually keep.", F, 1.04),
    ("Same money. Except it compounds for me instead of for them.", F, 1.04),
    ("Recover the visitors you already paid to bring to your own website. Exclusive, consent-first, seven dollars.", F, 1.05),
    ("That is the part nobody on those platforms wants you to notice. consentresolve.com/demo.", F, 1.05),
 ]},
 "contrarian": {"persona": "tyler", "look": "tyler_pool", "scenes": [
    ("Hot take. The lead sites are not actually broken.", F, 1.05),
    ("They work exactly the way they were designed to work. For them.", S, 1.04),
    ("Shared leads, surge pricing, no refunds. That is not a bug, that is the model.", S, 1.04),
    ("You are not the customer there. You are the product. Once you see it, you cannot unsee it.", S, 1.04),
    ("The fix is not a better marketplace. It is owning the traffic you already have. Your own website.", F, 1.05),
    ("Exclusive, seven-dollar leads, consent-first. consentresolve.com/demo.", F, 1.05),
 ]},
}

def job_for(angle):
    a = ANGLES[angle]
    return {"name": angle, "look": LOOK[a["look"]], "voice": VOICE[a["persona"]],
            "persona": a["persona"], "scenes": a["scenes"]}
