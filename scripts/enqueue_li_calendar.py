#!/usr/bin/env python3
"""One-time enqueue of the 30-day LinkedIn company calendar into social_queue,
via the real /api/social-queue automation endpoint (not a raw DB write) so it
goes through the app's own dedup/validation. Insertion order = drip order
(oldest ready_to_publish row goes out first), so this MUST run days 1->30 in
sequence, not in parallel.
"""
import json
import urllib.request

BASE = "https://consentresolve.com/api/social-queue"
KEY = "6f2e0dd82c5aa71a5d5f8a5b1d3e9c47a1b6e9f3c2d84b0e97a5c1f6d8b3e2a9"
R2 = "https://pub-27fc71b9070247178d8756a59bef0b33.r2.dev"

VIDEO = lambda slug: f"{R2}/social/ugc-ads/{slug}.mp4"
DOC = lambda slug: f"{R2}/social/li-carousels/{slug}.pdf"

DAYS = [
  (1, "video", VIDEO("hype-visited-male"), "98% of your visitors leave anonymous. No email, no phone number, no way to follow up. You paid for that visit. They just paid your competitor instead."),
  (2, "video", VIDEO("hype-shared-male"), "Quick math: Thumbtack charges $25–$75 for a lead. That same lead gets sent to 4–5 other contractors at the same time. You're not buying a lead. You're buying a bidding war."),
  (3, "document", DOC("howA"), "Here's the mechanism, no magic: a homeowner visits your site → your own consent banner asks → they say yes → you get a name, an email, and what they were shopping for. That's it."),
  (4, "video", VIDEO("hype-stilldeciding-male"), "78% of homeowners hire whoever responds first — not the cheapest, not the highest-rated. Every minute a lead sits unworked is a minute closer to losing the job."),
  (5, "video", VIDEO("hype-ftc-male"), "The FTC ordered HomeAdvisor to pay up to $7.2 million to settle charges of misleading pros about lead quality. That's not a competitor took a shot at them — that's the FTC's own record."),
  (6, "document", DOC("li06"), "Formless Contact Capture: a consented visitor doesn't have to fill out a single field. No contact form to abandon — the consented email comes through anyway."),
  (7, "video", VIDEO("hype-pipelinegone-female"), "You're already paying for the traffic. Google Ads, SEO, your Google Business Profile — all of it drives people to a page that, statistically, 98 out of 100 of them will leave without a trace."),
  (8, "document", DOC("li08"), "Angi charges a $300–$500 annual membership — on top of per-lead fees — whether the homeowner ever picks up the phone or not."),
  (9, "video", VIDEO("hype-saidyes-female"), "We never fingerprint. We never guess. Identification only happens after a homeowner explicitly consents through your own site's banner — a trusted, deterministic match, not a probabilistic one."),
  (10, "video", VIDEO("hype-beattheclock-female"), "Contacted within 5 minutes vs. 30: 21× better odds of winning the job, per MIT. Speed isn't a nice-to-have in this business. It's the whole game."),
  (11, "document", DOC("li11"), "CRM delivery: leads land directly in Jobber, Housecall Pro, ServiceTitan, HubSpot, Klaviyo — or any webhook. No copy-pasting a spreadsheet into your pipeline."),
  (12, "document", DOC("li12"), "We're engineered to GDPR — the strictest privacy standard in the world — specifically so the US state patchwork (TCPA, CIPA, Texas's TDPSA) is covered by design, not bolted on after a lawsuit."),
  (13, "video", VIDEO("hype-splitfour-female"), "Every Thumbtack lead you quote, 3–4 other contractors are quoting too. The homeowner isn't choosing you. They're choosing whoever calls first with the best pitch — same as everyone else on that thread."),
  (14, "document", DOC("li14"), "Your website has an 87-second window before most visitors give up and leave. What happens after second 88, if they never gave you a way to reach them?"),
  (15, "document", DOC("li15"), "Setup is one script tag. Paste it once, live in about 10 minutes. Works on WordPress, Wix, Squarespace, ServiceTitan-hosted sites, most others."),
  (16, "document", DOC("li16"), "Lead Scoring: every identified visitor gets scored on fit and intent — so you know who to call first, not just who called first."),
  (17, "video", VIDEO("hype-badodds-male"), "The gap between a 5-minute response and a 30-minute response isn't a small edge. It's the difference between winning the job and being the second call they never answer."),
  (18, "document", DOC("li18"), "We complement Google LSA — we don't compete with it. Keep running what already works. We just catch the traffic that would've left anonymous."),
  (19, "document", DOC("li19"), "$53 average cost per lead on Google LSA, home-services blended. $7 flat, exclusive, never resold. Same homeowner intent — completely different economics."),
  (20, "document", DOC("li20"), "Instant Retarget: consented visitors flow straight into your retargeting audiences. Your own ad spend keeps working on people who already showed real interest."),
  (21, "video", VIDEO("hype-neveragain-male"), "Every contractor obsesses over ad spend efficiency. Almost nobody asks what happens to the 98% of visitors that spend brings in and never converts."),
  (22, "document", DOC("li22"), "Every reveal is timestamped and signed. If a homeowner ever asks 'how did you get my info,' the answer is documented, not a shrug."),
  (23, "video", VIDEO("hype-notyours-male"), "'Exclusive-ish' isn't a real word in this business, but it's how most lead sellers sell. One consent, one contractor — yours alone, actually never resold."),
  (24, "video", VIDEO("hype-costperjob-female"), "The fastest response wins more often than the best price. If your lead-response process still runs on 'get to it when I can,' that's the leak."),
  (25, "document", DOC("li25"), "17 trades supported, nationwide. Since it runs on your own site, your service area doesn't change how it works — roofer in Ohio, HVAC company in Texas, same mechanism."),
  (26, "document", DOC("li26"), "Cheapest lead isn't the same as best lead. A $7 exclusive beats a $75 lead split five ways, every time you actually do the math."),
  (27, "video", VIDEO("hype-ghostleads-male"), "The traffic you already paid for is still your best source of leads. Most of it just never had a way to say so."),
  (28, "video", VIDEO("hype-ghostleads-female"), "No sketchy list, no cold scrape. A homeowner said yes on your own site, to your own banner, about your own business. That's the entire data source."),
  (29, "document", DOC("li29"), "Shared-lead resellers make money whether you win the job or not. We only make sense if the lead is actually worth calling — that's the difference in the incentive."),
  (30, "document", DOC("li30"), "One month of math: 98% of your visitors leave anonymous, the fastest responder usually wins the job, and shared leads cost more for less. Fix the first one and the rest gets easier."),
]

def post(body):
    req = urllib.request.Request(BASE, data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json", "X-CR-Automation-Key": KEY,
                 "User-Agent": "Mozilla/5.0 (Consent Resolve calendar enqueue script)"}, method="POST")
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())

for day, media_type, url, caption in DAYS:
    slug = f"li-calendar-2026-08-day{day:02d}"
    payload = {"caption": caption, "media_type": media_type, "media_url": url}
    res = post({"action": "enqueue", "resource_slug": slug, "resource_type": "social",
                "items": [{"platform": "linkedin_company", "payload": payload}]})
    print(day, slug, res)
