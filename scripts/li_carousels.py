#!/usr/bin/env python3
"""LinkedIn Document/carousel slides for the 30-day company-page calendar.
Reuses the locked brand renderer from social_cards.py (cover/step/cmp_slide/
cta_slide helpers) — same navy/mint palette, same fonts, same logo lockup.
Renders to build/social-cards/*.png. Upload each set to LinkedIn as a native
Document post (PDF), not a multi-image post — see skill guidance.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from social_cards import cslide, cover, step, cmp_slide, cta_slide, RED, MINT3

CTA = ("Get Started.", "consentresolve.com/demo")

# Day 3 — How it works (reuses the existing howA-1..5 set as-is, no new render needed)

# Day 6 — Formless Contact Capture
cslide("li06-1", cover("FORMLESS CAPTURE", "The lead you'd have lost to a blank form"))
cslide("li06-2", step(1, "The old way", "A contact form. Most visitors bail before filling one out."))
cslide("li06-3", step(2, "The new way", "Just consent. No fields, nothing to abandon."))
cslide("li06-4", step(3, "What lands in your CRM", "A consented email, enriched with a name where available."))
cslide("li06-5", cta_slide(*CTA))

# Day 8 — Angi membership fee
cslide("li08-1", cover("THE MEMBERSHIP TAX", "What lead sellers charge, whether you win or not"))
cslide("li08-2", cmp_slide("Angi", RED, "$300–500/yr", "membership fee, charged on top of per-lead pricing — whether the homeowner answers or not."))
cslide("li08-3", cmp_slide("Consent Resolve", MINT3, "$0", "no membership, no annual fee. Pay per lead, flat $7, nothing else."))
cslide("li08-4", cta_slide(*CTA))

# Day 11 — CRM delivery
cslide("li11-1", cover("WHERE LEADS LAND", "Straight into the CRM you already use"))
cslide("li11-2", step(1, "Jobber · Housecall Pro · ServiceTitan", "Direct delivery, no manual entry."))
cslide("li11-3", step(2, "HubSpot · Klaviyo · any webhook", "Or wherever your pipeline actually lives."))
cslide("li11-4", step(3, "No copy-paste, no spreadsheet", "It's there before you'd have finished typing it in."))
cslide("li11-5", cta_slide(*CTA))

# Day 14 — 87-second window
cslide("li14-1", cover("THE 87-SECOND WINDOW", "How long you actually have"))
cslide("li14-2", cmp_slide("Average browse time", RED, "87s", "before an unconverted visitor gives up and leaves."))
cslide("li14-3", step(1, "What happens after second 88", "They leave anonymous — no name, no way to follow up."))
cslide("li14-4", step(2, "The fix", "Catch the ones who'd say yes, the moment they say it."))
cslide("li14-5", cta_slide(*CTA))

# Day 16 — Lead scoring
cslide("li16-1", cover("LEAD SCORING", "Know who to call first"))
cslide("li16-2", step(1, "Every visitor gets scored", "Fit and intent, calculated automatically."))
cslide("li16-3", step(2, "What the score means", "Higher score, hotter lead — not just who called first."))
cslide("li16-4", step(3, "Who to call first", "Work the list in the order that actually books jobs."))
cslide("li16-5", cta_slide(*CTA))

# Day 18 — LSA complement, not competitor
cslide("li18-1", cover("NOT A REPLACEMENT", "Keep the ads and channels that work"))
cslide("li18-2", step(1, "Google LSA still works", "We don't touch it, don't compete with it."))
cslide("li18-3", step(2, "We catch what LSA can't", "The traffic your OWN site gets that leaves with no name."))
cslide("li18-4", step(3, "Both, running together", "Your channels bring them. We keep the ones who'd otherwise vanish."))
cslide("li18-5", cta_slide(*CTA))

# Day 19 — $53 vs $7 math
cslide("li19-1", cover("THE COST-PER-LEAD MATH", "Same intent, different economics"))
cslide("li19-2", cmp_slide("Google LSA", RED, "$53", "average cost per lead, home-services blended."))
cslide("li19-3", cmp_slide("Consent Resolve", MINT3, "$7", "flat, exclusive, never resold — from traffic you already paid for."))
cslide("li19-4", cta_slide("Run your own numbers.", "consentresolve.com/lead-math"))

# Day 20 — Retargeting
cslide("li20-1", cover("INSTANT RETARGET", "Your ad spend, working harder"))
cslide("li20-2", step(1, "A consented visitor leaves your site", "They showed real interest — then they're gone."))
cslide("li20-3", step(2, "They flow into your retargeting audience", "Automatically, the moment they consent."))
cslide("li20-4", step(3, "Your own ad spend closes the loop", "Following up on interest you already paid to generate."))
cslide("li20-5", cta_slide(*CTA))

# Day 22 — Timestamped consent / trust
cslide("li22-1", cover("PROOF, NOT A PROMISE", "What happens if a homeowner asks"))
cslide("li22-2", step(1, "“How did you get my info?”", "A question every contractor should be able to answer."))
cslide("li22-3", step(2, "Every reveal is timestamped and signed", "Not a shrug — a real, documented record."))
cslide("li22-4", step(3, "Consent-first, from the first click", "Nothing happens until the homeowner says yes."))
cslide("li22-5", cta_slide(*CTA))

# Day 25 — 17 trades, nationwide
cslide("li25-1", cover("17 TRADES. ONE MECHANISM.", "Runs on your own site — geography doesn't matter"))
cslide("li25-2", cmp_slide("Coverage", MINT3, "17", "trades supported — roofing, HVAC, plumbing, electrical, and more."))
cslide("li25-3", step(1, "Nationwide, US", "Same mechanism, no matter the market."))
cslide("li25-4", cta_slide(*CTA))

# Day 30 — Month recap
cslide("li30-1", cover("ONE MONTH OF MATH", "The four numbers that actually matter"))
cslide("li30-2", cmp_slide("Stay anonymous", RED, "98%", "of visitors leave without a name, even after you paid for the click."))
cslide("li30-3", cmp_slide("Hire the first responder", MINT3, "78%", "of homeowners hire whoever calls first — not the cheapest, not the best-rated."))
cslide("li30-4", cmp_slide("Shared-lead cost", RED, "$25–100+", "per lead, split with 4–5 other contractors, on marketplaces like Thumbtack and Angi."))
cslide("li30-5", cmp_slide("Consent Resolve", MINT3, "$7", "flat, exclusive, never resold."))
cslide("li30-6", cta_slide(*CTA))

print("done")
