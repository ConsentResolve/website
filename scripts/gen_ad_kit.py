#!/usr/bin/env python3
"""Paste-ready Meta/TikTok ad kit for the sprint creative test (noindex).
Per-angle ad copy (primary text + headline + CTA), the UTM scheme, and the
Round-1 test matrix. Voice-locked: dry contractor-peer, email-not-phone,
$7/exclusive/consent-first, 98-of-100, sourced $7.2M only, no competitor names.
Output: public/ad-kit.html
"""
import html
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
def esc(s): return html.escape(s)

LANDING = "https://consentresolve.com/demo"
UTM = "?utm_source={src}&utm_medium=paid_social&utm_campaign=sprint_test&utm_content={creative}&utm_term={persona}"

# angle -> (persona, headline, primary_text)
ADS = {
 "leak": ("Tyler", "Stop paying for visitors who vanish",
   "Roughly 98 of 100 people who land on your website leave without a trace — and you paid for every click. We hand those visitors back as real, consent-first leads. $7 each, exclusive, never resold. See it work on your own site."),
 "race": ("Jason", "A shared lead isn't a lead",
   "The shared lead you bought went to four other contractors the same second. By the time you call, it's a footrace you paid to enter. Recover the visitors already on your own site instead — exclusive, $7, yours alone."),
 "ftc": ("Aaron", "Your bad leads, finally explained",
   "The biggest lead site was fined $7.2M for lying about lead quality. If your bought leads have felt like junk, it isn't you. Recover your own website traffic instead — consent-first, exclusive, $7 a lead."),
 "robot": ("Jason", "Stop letting an algorithm write your invoices",
   "Getting auto-charged for your own returning customers? Your own website traffic never bills you by algorithm. Consent-first, exclusive leads at $7 — from the traffic you already paid for."),
 "ghost": ("Jason", "Done chasing dead numbers",
   "Thirty leads, thirty ghosts — paid for every one. The people already on your website actually want the work. We hand them back, consent-first, $7 exclusive. They're expecting your email, not dodging your call."),
 "math": ("Tyler", "The lead math nobody runs",
   "Do the math: about $100 for a shared lead you close maybe 1 in 20, split four ways — or $7 for an exclusive lead from someone already on your site. One builds your business. The other builds theirs."),
 "credit": ("Aaron", "A credit just keeps you on the hook",
   "Bad-lead disputes don't get refunded — you get a credit to buy more bad leads. We do it backwards: $7 only when a real, consented person lands in your funnel, from the website you already paid to fill."),
 "creepy": ("Tyler", "Consent-first, not creepy",
   "Visitor-ID tools that surface strangers who never opted in feel invasive — and risky. Consent-first means the person actually expects to hear from you. $7, exclusive, no scraped numbers."),
 "twice": ("Jason", "Exclusive should mean exclusive",
   "Ever get sold the same homeowner twice? Shared means sold again. Exclusive means sold once — to you. Recover your own site traffic at $7 a lead, never resold."),
 "ownership": ("Aaron", "Own your traffic",
   "Every dollar you hand the lead sites builds their brand, not yours. Your website is the one pipe you actually own. Recover it — consent-first, exclusive, $7 a lead."),
 # Leah (office-manager voice)
 "leah-roofing": ("Leah", "The 98% nobody follows up",
   "From a front-desk manager: almost everyone who lands on our site leaves — no name, no email, nothing to follow up on. Now we recover those visitors as real, opted-in leads. Same traffic, just not wasted."),
 "leah-speed": ("Leah", "Reach them while they're still warm",
   "Speed-to-lead is everything — but the leads we used to buy were stale before they hit my inbox. Now we catch the people on our own site while they're still looking, with a real email."),
 "leah-cost": ("Leah", "The real cost per booked job",
   "What does a shared lead actually cost per booked job? Rough. $7 for an exclusive, opted-in lead from your own traffic beats $100 for a name four other companies are also calling."),
}

# Round-1 test set (best hook per angle) -> hypothesis
R1 = [
 ("leak-stat","Tyler","The hard 98% stat is the strongest cold pattern-interrupt"),
 ("ftc-stat","Aaron","Authority/3rd-party proof ($7.2M) lowers skepticism fastest"),
 ("race-confession","Jason","First-person 'lost a job' regret out-pulls the stat for Jason"),
 ("math-contrarian","Tyler","The $7-vs-$100 reframe converts the price-sensitive"),
 ("ghost-stat","Jason","'Thirty ghosts' concreteness beats abstract pain"),
 ("ownership-contrarian","Aaron","'Own your traffic' reframe resonates with owners"),
 ("credit-stat","Aaron","The refund-vs-credit trap is a fresh angle few have heard"),
 ("creepy-contrarian","Tyler","Consent-first as the differentiator vs visitor-ID tools"),
 ("leah-roofing","Leah","A relatable non-operator face widens the audience"),
 ("leah-cost","Leah","Office-manager doing the math humanizes the price story"),
 ("nonugc-leak-stat","brand","Does animated brand creative beat UGC on cost/lead?"),
 ("twice-confession","Jason","'Sold twice' betrayal story for the burned buyer"),
]

CSS = """*{box-sizing:border-box}body{margin:0;background:#0a1628;color:#f5f8fa;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif}
header{padding:26px 24px 6px;text-align:center}h1{margin:0;font-size:25px}header p{color:#94a3b8;margin:6px 0 0;font-size:14px}
.wrap{max-width:920px;margin:0 auto;padding:0 22px 60px}
h2.sec{margin:32px 0 6px;font-size:14px;letter-spacing:.1em;text-transform:uppercase;color:#00e5a0}
.note{color:#94a3b8;font-size:13px;margin:0 0 12px}
.card{background:#0e1d33;border:1px solid #1e293b;border-radius:12px;padding:14px 16px;margin:12px 0}
.card h3{margin:0 0 2px;font-size:15px;color:#fff}.card .who{color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px}
.lbl{font-size:11px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:#00e5a0;margin:10px 0 3px}
.b{position:relative;background:#0a1628;border:1px solid #1e293b;border-radius:9px;padding:11px 84px 11px 13px;margin:4px 0}
.b pre{margin:0;white-space:pre-wrap;font:inherit;font-size:13.5px;line-height:1.5;color:#dbe4ea}
.cp{position:absolute;top:8px;right:8px;background:#00e5a0;color:#06281f;border:none;border-radius:7px;padding:6px 11px;font-size:12px;font-weight:700;cursor:pointer}
.cp.done{background:#1e293b;color:#00e5a0}
code{background:#16233a;padding:2px 6px;border-radius:5px;font-size:12.5px;word-break:break-all}
table{width:100%;border-collapse:collapse;font-size:13px;margin-top:8px}
td,th{border:1px solid #1e293b;padding:9px 11px;text-align:left;vertical-align:top}th{background:#0e1d33;color:#cbd5e1;font-size:11px;letter-spacing:.05em;text-transform:uppercase}
ul{margin:6px 0 0;padding-left:20px}li{color:#cbd5e1;font-size:13.5px;line-height:1.55}
"""
JS = """document.querySelectorAll('.cp').forEach(b=>b.onclick=async()=>{try{await navigator.clipboard.writeText(b.dataset.t);b.textContent='Copied';b.classList.add('done');setTimeout(()=>{b.textContent='Copy';b.classList.remove('done')},1300)}catch(e){}});"""

def block(text): return f'<div class="b"><pre>{esc(text)}</pre><button class="cp" data-t="{esc(text)}">Copy</button></div>'

ads_html = ""
for key,(who,hl,pt) in ADS.items():
    ads_html += (f'<div class="card"><h3>{esc(key)}</h3><div class="who">{esc(who)}</div>'
                 f'<div class="lbl">Primary text</div>{block(pt)}'
                 f'<div class="lbl">Headline</div>{block(hl)}'
                 f'<div class="lbl">CTA button</div><p class="note" style="margin:2px 0 0">Sign Up → {LANDING} (captures a consented email). "Learn More" is a fine alt.</p></div>')

rows = "".join(f"<tr><td><code>{esc(c)}</code></td><td>{esc(p)}</td><td>{esc(h)}</td></tr>" for c,p,h in R1)
utm_fb = LANDING + UTM.format(src="facebook", creative="ANGLE-ARCH", persona="PERSONA")
utm_tt = LANDING + UTM.format(src="tiktok", creative="ANGLE-ARCH", persona="PERSONA")

HTML = f"""<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>Consent Resolve — ad kit</title>
<style>{CSS}</style></head><body>
<header><h1>Meta / TikTok ad kit — sprint creative test</h1>
<p>Paste-ready copy, UTM scheme, and the Round-1 test matrix. Pair each with the matching reel from the gallery.</p></header>
<div class="wrap">
  <h2 class="sec">UTM scheme (set destination URL to this)</h2>
  <p class="note">Replace <code>ANGLE-ARCH</code> with the reel name (e.g. <code>leak-stat</code>) and <code>PERSONA</code> (jason/tyler/aaron/leah). Lets <code>/demo</code> conversions trace to the exact creative.</p>
  {block(utm_fb)}{block(utm_tt)}
  <h2 class="sec">Round-1 test matrix (~12 creatives — start broad, read in 72h)</h2>
  <table><tr><th>Creative</th><th>Persona</th><th>Hypothesis</th></tr>{rows}</table>
  <h2 class="sec">Targeting + budget (max-aggressive)</h2>
  <div class="card"><ul>
    <li><b>Objective:</b> Leads / conversions on the <code>/demo</code> event (Pixel must be live). North star = cost per /demo lead; leading indicator = hook rate (3-sec) + thruplay.</li>
    <li><b>Audience:</b> broad + Advantage+ placements (Reels/Feed/Stories); layer home-service / small-business-owner / contractor interests; build lookalikes once /demo conversions accumulate.</li>
    <li><b>Budget:</b> ~$40–60/creative/day × 3 days → readable signal fast. Round 1 ≈ $1.5–2k across ~12 creatives.</li>
    <li><b>Scale rule:</b> at 48–72h kill anything with weak hook rate or cost/lead &gt;2× median; pour budget into the top 3–4; scale winners 20–50%/day; refresh weekly.</li>
    <li><b>TikTok:</b> organic daily + Spark Ads boosting the organic posts that pop.</li>
  </ul></div>
  <h2 class="sec">Per-angle ad copy</h2><p class="note">Primary text + headline reused across that angle's 3 hook variants (the hook lives in the video).</p>
  {ads_html}
</div><script>{JS}</script></body></html>"""
out = ROOT / "public/ad-kit.html"; out.write_text(HTML)
print(f"wrote {out} — {len(ADS)} ad-copy blocks, {len(R1)} Round-1 creatives")
