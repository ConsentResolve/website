#!/usr/bin/env python3
"""Reel hook test battery for the 2-week cold-start sprint.

The unit we A/B test is the HOOK (first ~3s), not the angle. Each angle gets 3
hook archetypes:
  stat        — a hard number, pattern-interrupt
  confession  — first-person rage/regret, peer-to-peer
  contrarian  — reframe / "it's not you, it's rigged"
The body (scenes 2..n) is shared per angle (reused at generation time from
video_scripts.py for UGC, brand_reel.py for non-UGC) so we only regenerate the
hook — keeps the UGC battery inside the HeyGen budget.

Voice locked: dry contractor-peer, NO exclamation, no competitor names (the lead
sites / the machine), email not phone, $7/exclusive/consent-first, /demo. Sourced
facts only ($7.2M FTC fine, ~98% bounce).

Run to (re)write the review page: python3 scripts/reel_hooks.py
"""
from pathlib import Path
import html

ROOT = Path(__file__).resolve().parent.parent

# format: "ugc" (avatar, persona) or "nonugc" (brand-animated)
UGC = [
    ("leak", "jason", {
        "stat": "Ninety-eight out of a hundred people hit your site and just leave.",
        "confession": "I spent four grand on clicks last month. Two of them called me.",
        "contrarian": "Your website isn't broken. It's leaking exactly the way they designed it."}),
    ("race", "jason", {
        "stat": "Every shared lead I buy goes to four other guys the same second.",
        "confession": "I lost a job to a guy who got my lead before I finished reading it.",
        "contrarian": "A shared lead isn't a lead. It's a footrace you paid to enter."}),
    ("ftc", "tyler", {
        "stat": "The biggest lead site got fined seven point two million for lying about lead quality.",
        "confession": "Turns out my garbage leads weren't my fault. There's a paper trail.",
        "contrarian": "If your leads feel like junk, they might literally be junk."}),
    ("robot", "aaron", {
        "stat": "A robot charged me four hundred bucks because my own customer called me back.",
        "confession": "I got billed for a lead that was already my customer. Couldn't even argue.",
        "contrarian": "Your own website traffic never bills you by algorithm."}),
    ("ghost", "jason", {
        "stat": "Thirty leads last month. Thirty ghosts. Paid for every one.",
        "confession": "I called the same dead number six times before I gave up.",
        "contrarian": "The people already on your site want the work. The bought ones don't."}),
    ("math", "aaron", {
        "stat": "A hundred bucks for a shared lead I close maybe five percent of the time.",
        "confession": "I did the math on my lead spend and almost parked the truck.",
        "contrarian": "Seven dollars for a lead that's mine, or a hundred for one that's everyone's."}),
    ("credit", "aaron", {
        "stat": "They don't refund bad leads. They give you credit to buy more bad leads.",
        "confession": "I disputed a fake lead and they credited me — to spend with them again.",
        "contrarian": "A refund gives your money back. A credit just keeps you on the hook."}),
    ("creepy", "tyler", {
        "stat": "I tried a visitor-ID tool once. First week, someone asked why they were on a list.",
        "confession": "Someone replied 'why am I on this list,' and I never opened it again.",
        "contrarian": "Consent-first means the person actually expects to hear from you."}),
    ("twice", "tyler", {
        "stat": "They sold me the same homeowner twice. Second time, the job was already done.",
        "confession": "I paid for a lead I'd already lost — same name, two weeks later.",
        "contrarian": "Exclusive used to mean something. With us it still does — sold once, to you."}),
    ("ownership", "jason", {
        "stat": "Every dollar I gave the lead sites built their brand, not mine.",
        "confession": "I built someone else's pipeline for three years before I noticed.",
        "contrarian": "You don't own a lead you rent. Your website is the one pipe that's yours."}),
]

NONUGC = [
    ("leak", {
        "stat": "98 of 100 visitors leave your site.",
        "confession": "You paid for every click — and most you never see again.",
        "contrarian": "The leak isn't a bug. It's the business model."}),
    ("math", {
        "stat": "$575 to land one job on shared leads.",
        "confession": "Add up your lead spend per booked job. Maybe sit down first.",
        "contrarian": "Same job — $575 the old way, $140 the new way."}),
    ("ftc", {
        "stat": "$7.2M fine for lying about lead quality.",
        "confession": "Your bad leads, finally explained.",
        "contrarian": "It isn't bad luck. It's documented."}),
    ("ownership", {
        "stat": "One pipe you actually own: your website.",
        "confession": "Rent your leads and one policy change can end you.",
        "contrarian": "Stop building their brand with your ad budget."}),
]

ARCH = ["stat", "confession", "contrarian"]
ARCH_LABEL = {"stat": "Stat / pattern-interrupt", "confession": "Confession / rage", "contrarian": "Contrarian / reframe"}


def _row(angle, fmt, persona, hooks):
    cells = "".join(f'<td><span class="ar">{a}</span>{html.escape(hooks[a])}</td>' for a in ARCH)
    who = f"{fmt}" + (f" · {persona}" if persona else "")
    return f'<tr><th>{html.escape(angle)}<span class="fmt">{who}</span></th>{cells}</tr>'


def render():
    rows_ugc = "".join(_row(a, "UGC", p, h) for a, p, h in UGC)
    rows_non = "".join(_row(a, "non-UGC", None, h) for a, h in NONUGC)
    n = (len(UGC) + len(NONUGC)) * 3
    css = """*{box-sizing:border-box}body{margin:0;background:#0a1628;color:#f5f8fa;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif}
header{padding:26px 24px 6px;text-align:center}h1{margin:0;font-size:24px}header p{color:#94a3b8;margin:6px 0 0;font-size:14px}
h2{max-width:1300px;margin:30px auto 8px;padding:0 22px;font-size:14px;letter-spacing:.1em;text-transform:uppercase;color:#00e5a0}
table{width:100%;max-width:1300px;margin:0 auto;border-collapse:collapse;padding:0 22px}
.w{max-width:1300px;margin:0 auto;padding:0 22px}
td,th{border:1px solid #1e293b;padding:12px 14px;vertical-align:top;text-align:left;font-size:14px;line-height:1.45;color:#dbe4ea;width:31%}
th{width:7%;background:#0e1d33;color:#fff;font-weight:700}
th .fmt{display:block;margin-top:4px;font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:.04em}
.ar{display:block;font-size:10.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#00e5a0;margin-bottom:5px}
thead th{background:#0e1d33;color:#cbd5e1;font-size:11px;letter-spacing:.06em;text-transform:uppercase;width:31%}
thead th:first-child{width:7%}"""
    head = f'<thead><tr><th>angle</th><th>{ARCH_LABEL["stat"]}</th><th>{ARCH_LABEL["confession"]}</th><th>{ARCH_LABEL["contrarian"]}</th></tr></thead>'
    doc = f"""<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>Consent Resolve — reel hook battery</title>
<style>{css}</style></head><body>
<header><h1>Reel hook battery — {n} hooks to test</h1>
<p>3 hook archetypes per angle. We A/B the first 3 seconds; the body is shared. Review/edit before we generate.</p></header>
<h2>UGC (avatar — {len(UGC)} angles × 3)</h2><div class="w"><table>{head}{rows_ugc}</table></div>
<h2>Non-UGC (brand-animated — {len(NONUGC)} angles × 3)</h2><div class="w"><table>{head}{rows_non}</table></div>
</body></html>"""
    out = ROOT / "public/reels-hooks.html"; out.write_text(doc)
    print(f"wrote {out} — {n} hooks ({len(UGC)} UGC + {len(NONUGC)} non-UGC angles × 3)")


if __name__ == "__main__":
    render()
