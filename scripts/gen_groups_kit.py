#!/usr/bin/env python3
"""Deployed manual-distribution kit for the cold-start growth play (Groups can't
be posted to via API — Meta deprecated it — so these are paste-ready by hand).

Output: public/groups-kit.html (noindex). Two parts:
  1) Page setup copy (CTA button, pinned-post options, About, bio link).
  2) Groups value-pack — non-promotional posts/prompts/reply templates to drop
     into trade groups as the founder (Tyler), with one-click copy buttons.

Voice: Heartbeat-v2 / "Own Your Traffic" — dry, peer, no exclamation, no
competitor names (the lead sites / the machine), email not phone, links to
/lead-math and /demo. Sourced facts only ($7.2M FTC fine, ~98% bounce).
"""
import html
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
def esc(s): return html.escape(s)

PAGE = {
    "cta": "Set the Page action button to <b>Sign Up</b> → <code>https://consentresolve.com/demo</code> (captures a consented email via the live demo). 'Learn More' → /lead-math is a fine alternative.",
    "about": "Consent Resolve turns the traffic you already have — your website, ads, and social — into named, exclusive, consent-first leads at a flat $7 each. Own your traffic. consentresolve.com/demo",
    "pins": [
        ("Pinned post — the manifesto",
         "Here's the thing nobody in this trade says out loud: you didn't get worse at marketing — the lead-site game is built to work against you. The same \"exclusive\" lead gets sold to four of you. Bad-lead disputes get denied. A robot bills you when your own customer calls back.\n\nWe built Consent Resolve to flip it: recover the visitors already on your own site as named, exclusive leads — $7 each, never resold. See what it'd do to your numbers → consentresolve.com/lead-math"),
        ("Pinned post — the calculator",
         "Pick your trade and see what a shared lead really costs you per booked job — then what recovering your own traffic costs instead. No signup, no email wall: consentresolve.com/lead-math"),
    ],
}

# (category, note, [posts])
GROUPS = [
    ("Conversation starters", "Pure engagement — no link. These get contractors talking, which sends them to your profile.", [
        "Honest question for the group: what's the most you've ever paid for a single lead that ghosted you?",
        "How many of you have gotten the same \"exclusive\" lead as a couple other guys you know? Asking for a reason.",
        "What's your real follow-up time on a new lead — minutes, hours, or next day? No judgment, just curious where everyone's at.",
        "Anyone else add up last month's lead-site spend and feel a little sick? Or just me.",
        "What finally made you cut a lead source — the price, the lead quality, or the billing games?",
    ]),
    ("Insight / value", "Builds authority — no link. Drop these as standalone posts or in relevant threads.", [
        "PSA: the biggest lead site got fined $7.2M for lying about lead quality. If your leads have felt like garbage, it isn't you.",
        "Reminder that ~98% of the people who hit your website leave without ever calling. You paid for those clicks too — they're not gone, they're just not getting captured.",
        "The math nobody mentions: a shared lead sold to four of you that closes maybe 1 in 12 can cost more to land a job than a small-ticket job is even worth.",
        "Speed-to-lead is the whole game — reaching someone in 5 minutes vs 30 is night and day. Most lead-site leads are stale before you even open them.",
    ]),
    ("Soft tool-share", "Use sparingly, only where the group allows links or someone asks. Lead with the value, not the brand.", [
        "I got tired of guessing what shared leads actually cost me per booked job, so I built a little calculator — pick your trade, it shows the number. Free, no signup: consentresolve.com/lead-math",
        "Made a quick before/after thing showing what your website traffic does now vs if you actually captured it. No email wall: consentresolve.com/lead-math",
    ]),
    ("Reply templates", "For jumping into other people's threads (where most of your reach comes from).", [
        "Been there. What helped me was treating my own website traffic as the lead source instead of buying shared ones — happy to share what I did if it's useful.",
        "Depends on your traffic. If you're already running ads, GBP, or socials, you're paying for visitors who mostly leave — capturing those is cheaper than buying new shared leads. I put the math in a free calc if you want it.",
        "If you do nothing else: turn on Google Business Profile messaging and reply within minutes. Free, and it beats half the paid leads.",
    ]),
]

ETIQUETTE = [
    "Post as <b>yourself</b> (Tyler), not as the brand — groups reward people, not pages.",
    "Lead with value. Comment on other people's threads before you ever post your own.",
    "Don't drop links cold — most groups ban self-promo. Save links for the soft-share posts or when someone asks.",
    "Read each group's rules; some allow a weekly promo thread — use it.",
    "Rotate across 10–20 active trade groups; ~20–30 min/day. Reply to anyone who engages.",
]

def block(text):
    return (f'<div class="b"><pre>{esc(text)}</pre>'
            f'<button class="cp" data-t="{esc(text)}">Copy</button></div>')

CSS = """
*{box-sizing:border-box}body{margin:0;background:#0a1628;color:#f5f8fa;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif}
header{padding:28px 24px 6px;text-align:center}header h1{margin:0;font-size:26px}header p{color:#94a3b8;margin:6px 0 0;font-size:14px}
.wrap{max-width:860px;margin:0 auto;padding:0 22px 50px}
h2.sec{margin:34px 0 4px;font-size:15px;letter-spacing:.1em;text-transform:uppercase;color:#00e5a0}
.note{color:#94a3b8;font-size:13px;margin:0 0 12px}
.b{position:relative;background:#0e1d33;border:1px solid #1e293b;border-radius:12px;padding:14px 90px 14px 16px;margin:10px 0}
.b pre{margin:0;white-space:pre-wrap;font:inherit;font-size:14px;line-height:1.5;color:#dbe4ea}
.cp{position:absolute;top:10px;right:10px;background:#00e5a0;color:#06281f;border:none;border-radius:8px;padding:7px 12px;font-size:12px;font-weight:700;cursor:pointer}
.cp.done{background:#1e293b;color:#00e5a0}
.card{background:#0e1d33;border:1px solid #1e293b;border-radius:12px;padding:14px 16px;margin:10px 0}
.card h3{margin:0 0 6px;font-size:14px;color:#fff}
.card p,.card li{color:#cbd5e1;font-size:14px;line-height:1.55}
code{background:#16233a;padding:2px 6px;border-radius:5px;font-size:13px}
ul{margin:8px 0 0;padding-left:20px}
"""
JS = """
document.querySelectorAll('.cp').forEach(b=>b.onclick=async()=>{
  try{await navigator.clipboard.writeText(b.dataset.t);b.textContent='Copied';b.classList.add('done');
  setTimeout(()=>{b.textContent='Copy';b.classList.remove('done')},1400);}catch(e){}
});
"""

setup = (f'<div class="card"><h3>Page action button</h3><p>{PAGE["cta"]}</p></div>'
         f'<div class="card"><h3>About / short description</h3></div>' + block(PAGE["about"]))
for title, body in PAGE["pins"]:
    setup += f'<div class="card"><h3>{esc(title)}</h3></div>' + block(body)

groups_html = ""
for cat, note, posts in GROUPS:
    groups_html += f'<h2 class="sec" style="font-size:14px;color:#cbd5e1;letter-spacing:.04em">{esc(cat)}</h2><p class="note">{esc(note)}</p>'
    groups_html += "".join(block(p) for p in posts)

etiquette = '<ul>' + "".join(f"<li>{e}</li>" for e in ETIQUETTE) + '</ul>'

HTML = f"""<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>Consent Resolve — Groups & Page kit</title>
<style>{CSS}</style></head><body>
<header><h1>Groups value-pack &amp; Page setup</h1>
<p>The manual cold-start kit — paste-ready. Post in trade groups as yourself, not the brand.</p></header>
<div class="wrap">
  <h2 class="sec">Page setup (do once)</h2>
  {setup}
  <h2 class="sec">How to work the groups</h2>
  <div class="card">{etiquette}</div>
  <h2 class="sec">Groups value-pack</h2>
  <p class="note">Tap Copy, paste into a trade group. Mix it up — mostly the no-link ones; the soft tool-shares sparingly.</p>
  {groups_html}
</div>
<script>{JS}</script></body></html>"""

out = ROOT / "public/groups-kit.html"
out.write_text(HTML)
n = sum(len(p) for _, _, p in GROUPS)
print(f"wrote {out} — {n} group posts, {len(PAGE['pins'])} pinned options")
