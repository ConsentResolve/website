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
# jason = "Real Jason" — his REAL cloned voice (9d5497) from the original uploaded
# footage. This is the UGC default (replaced the old AI-Jason persona voice
# 0e671a, now kept only for the non-UGC VO mix in vo_reel.py). NOTE: this clone
# has emotion_support=false, so generators must OMIT the emotion field for it
# (see NO_EMOTION in gen_reel_sprint.py / gen_avatar_scenes.py).
VOICE = {
    "aaron": "41c46ea57c0a4dd29e3acd1de0765c05",  # Real Aaron (real clone, no emotion)
    "tyler": "92071a8742744d17bc92a02baab2941f",  # Real Tyler (real clone, no emotion)
    "jason": "9d5497bed1f144049861da9389addc96",  # Real Jason (real clone, no emotion)
}
# Trade looks per persona (location variety across angles) — ids from the
# re-themed avatar groups. jason_* now point at the "Real Jason" group
# (276733…); the old AI-Jason group a24e2bd4 is retired for UGC.
LOOK = {
    "aaron_office":  "4480e202d425486b9364928f426b195a",  # Real Aaron — Heather-Grey Henley at Desk
    "aaron_hvac":    "bb9f43820c2740679a59b8c487b0a8be",  # Real Aaron — Navy Polo by AC Unit
    "aaron_breaker": "a75bc443051043c4ad83e1803b9bd4b4",  # Real Aaron — Charcoal by Breaker Panel
    "aaron_remodel": "2a426180d5744e9fad0ecf8db4611017",  # Real Aaron — Navy Quarter-Zip, Mid-Remodel
    "jason_truck":   "b8cf5419ad5247d38bb000fd0df239a6",  # Grey-Goatee Pickup Driver
    "jason_plumb":   "cfcaef6ccfc7494f996e26e96266cd74",  # Charcoal Garage Workman
    "jason_drive":   "aa549ac4f24d49f6b5fa09fbf4bb700c",  # Navy by Fresh Driveway
    "jason_roof":    "a53ae05876a741039e5bd2bd3f15f701",  # Grey T-Shirt, Dark Cap Man
    "jason_garage":  "d1489419d50542d3af6a9b0deec230d9",  # Older Navy Polo Garage Man
    "tyler_lawn":    "9b790b0358e344ea91040c2041e6279c",  # Real Tyler — Green Hat, Matching Shirt (lawn)
    "tyler_pest":    "cf120b166c84480a83e8b7107645657e",  # Real Tyler — Black Hat, No Logo
    "tyler_drive":   "ba22e1b95b454c33890b21da5cb63ac3",  # Real Tyler — Short Visor
    "tyler_pool":    "00f79819d42743babd2017e6e5766604",  # Real Tyler — Navy by the midday pool
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
    ("By the time I get to it, the homeowner has already heard from three other companies.", S, 1.04),
    ("That is a footrace, and I am paying just to stand at the starting line.", S, 1.04),
    ("The traffic already on your own website is different. Those people are yours alone.", F, 1.04),
    ("We hand them back as exclusive leads. Seven dollars. Sold once, to you, never resold.", F, 1.05),
    ("It's all at consentresolve.com/demo.", F, 1.05),
 ]},
 "ftc": {"persona": "aaron", "look": "aaron_office", "scenes": [
    ("The biggest lead site in the country was ordered to pay seven point two million dollars.", S, 1.03),
    ("And honestly, that explained every junk lead I had ever been handed.", S, 1.03),
    ("I had spent years blaming myself for a pipeline somebody else completely controlled.", S, 1.03),
    ("So I stopped. Now I just recover the people already on my own website.", F, 1.04),
    ("No marketplace, no middleman, no robot deciding what I owe. Consent-first, exclusive, seven dollars.", F, 1.05),
    ("consentresolve.com/demo.", F, 1.05),
 ]},
 "leak": {"persona": "tyler", "look": "tyler_lawn", "scenes": [
    ("Here is the number that stopped me cold. Ninety-eight out of a hundred.", F, 1.05),
    ("Most people who land on your website leave without ever raising a hand.", S, 1.04),
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
    ("No answer, wrong number, or never heard of me. A thousand bucks to talk to nobody.", S, 1.04),
    ("Meanwhile the people already on your website actually want the work done.", F, 1.04),
    ("We hand those visitors back, consent-first, the moment they land on your site.", F, 1.05),
    ("Seven dollars. Exclusive. They are expecting your call, not dodging it.", F, 1.05),
    ("I am done renting dead phone numbers. consentresolve.com/demo.", F, 1.05),
 ]},
 "credit": {"persona": "aaron", "look": "aaron_breaker", "scenes": [
    ("You flag a fake lead. They review it. And they do not refund you.", S, 1.03),
    ("You are not getting your money back. You are getting tokens for the same machine.", S, 1.03),
    ("Sit with that. The penalty for selling you junk is making you buy more junk.", S, 1.03),
    ("We do it backwards. You pay seven dollars only when a real, identified person lands in your funnel.", F, 1.04),
    ("From the website you already paid to fill. Exclusive, consent-first.", F, 1.05),
    ("I wanted off that treadmill. consentresolve.com/demo.", F, 1.05),
 ]},
 "robot": {"persona": "jason", "look": "jason_garage", "scenes": [
    ("A robot charged me four hundred dollars last month.", S, 1.04),
    ("It billed me for my own returning customer, and there was nothing I could do about it.", S, 1.04),
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
    ("A shared lead runs about a hundred bucks, and I close maybe one in twenty.", S, 1.04),
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
