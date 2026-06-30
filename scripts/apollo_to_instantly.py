#!/usr/bin/env python3
"""Wave engine (automation-lite): score an Apollo CSV export by buying signals,
then optionally create the industry Instantly campaign and load the ranked leads.

Flow:  Apollo UI search + export (CSV, with verified emails)  ->  this script.
  1) DRY RUN (default): parse + score + rank, write a scored CSV + print top leads.
     No API calls, no keys needed, nothing spent.
  2) --push: create/find the Instantly campaign (sequence + schedule + inboxes) and
     add the top --top leads, PAUSED for your review. Needs INSTANTLY_API_KEY
     (env var, or /tmp/instantly_key.txt). The key never prints.

Usage:
  python3 scripts/apollo_to_instantly.py hvac_apollo.csv              # dry-run report
  python3 scripts/apollo_to_instantly.py hvac_apollo.csv --top 300 --push

Per-industry: copy WAVE below and adjust. HVAC Wave #1 is pre-loaded.
"""
import argparse, csv, html, json, os, sys, urllib.request, urllib.error
from pathlib import Path

# ── Wave config (HVAC #1) ─────────────────────────────────────────────────────
# Point cold email at the HVAC industry landing page (message-matched per email:
# email 2 = the "$149 vs $7" math angle, email 3 = the "98% leave" hook). fn is last
# so a rare space-in-name only truncates harmlessly. co/city omitted on purpose —
# they often contain spaces that break auto-linkified plain-text URLs in email.
_LP = "https://consentresolve.com/hvac-leads/?utm_source=instantly&utm_medium=email&utm_campaign=hvac_2026"
LP_MATH = _LP + "&utm_content=math&fn={{firstName}}"
LP_HOOK = _LP + "&utm_content=hook&fn={{firstName}}"
WAVE = {
    "name": "Contractors – Consent-First · HVAC TX (2026)",
    "timezone": "America/Chicago",                       # Central
    "inboxes": ["aaron@getconsentresolve.com", "tyler@getconsentresolve.com",
                "aaron@tryconsentresolve.com", "tyler@tryconsentresolve.com"],
    "daily_limit": 20, "send_from": "08:00", "send_to": "17:00",
    # Research-backed (2026): short (<90w), company-specific personalization, ONE binary
    # low-friction CTA, numbers/$ in subjects, NO link in email 1 (deliverability + reply),
    # spintax openers, breakup finale. Link appears from email 2 (list-based retargeting
    # doesn't need the email click, so removing it from #1 costs nothing).
    # Instantly syntax: spintax = {{RANDOM | a | b | c}}; sender = {{sendingAccountFirstName}};
    # signature (carries physical address + unsubscribe for CAN-SPAM) = {{accountSignature}}.
    # Custom var {{city}} used plain (100% coverage). Link only from email 2.
    "sequence": [
        {"delay": 0, "variants": [
            {"subject": "the 98% leaving {{companyName}}'s site",
             "body": ("Hi {{firstName}},\n\n"
                      "{{RANDOM | Quick question | One quick thing | Quick one}} — most {{city}}-area homeowners who land on {{companyName}}'s site leave without ever calling. Around 98%, and you never find out who they were.\n\n"
                      "We hand those visitors back as exclusive, consent-first leads — real name, email, and what they need. $7 each, yours alone, never resold.\n\n"
                      "Want me to send a 2-minute demo on a site like yours?\n\n"
                      "— {{sendingAccountFirstName}}\n\n{{accountSignature}}")},
            {"subject": "{{companyName}}'s website visitors",
             "body": ("Hi {{firstName}},\n\n"
                      "{{RANDOM | Quick one | Fast question}} — roughly 98% of the homeowners who visit {{companyName}}'s site around {{city}} leave without calling, and you never learn who they were.\n\n"
                      "We turn them into exclusive, consent-first leads: name, email, what they need. $7 each, only yours, never resold.\n\n"
                      "Worth a 2-minute demo on a site like yours?\n\n"
                      "— {{sendingAccountFirstName}}\n\n{{accountSignature}}")},
        ]},
        {"delay": 3, "variants": [
            {"subject": "$149 vs $7",
             "body": ("{{firstName}} — quick follow-up.\n\n"
                      "A shared HVAC lead from the big platforms runs $35–150 and gets sold to 4–5 contractors. A consent-first lead is $7 and only yours.\n\n"
                      "Here's a 2-minute demo on a site like yours: " + LP_MATH + "\n\n"
                      "Not a fit? Just reply \"no\" and I'll close it out.\n\n"
                      "— {{sendingAccountFirstName}}\n\n{{accountSignature}}")},
        ]},
        {"delay": 4, "variants": [
            {"subject": "should I close your file, {{firstName}}?",
             "body": ("I don't want to clutter your inbox, {{firstName}}.\n\n"
                      "If turning the {{city}} homeowners who leave {{companyName}}'s site into $7 exclusive leads is ever worth 2 minutes, here's the demo: " + LP_HOOK + "\n\n"
                      "Otherwise I'll leave you to it — good luck this season.\n\n"
                      "— {{sendingAccountFirstName}}\n\n{{accountSignature}}")},
        ]},
    ],
}

# ── Scoring (buying signals from the playbook) ────────────────────────────────
SENIOR = ["owner", "founder", "president", "ceo", "principal", "partner", "general manager", " gm", "vp", "director", "marketing"]
# Buying-signal tech, tiered by how strongly it implies "buys leads / has ad budget".
# NOTE: Apollo technographics detect WEB-visible tech (call tracking, ad pixels, chat,
# review widgets) reliably; back-office FSM (ServiceTitan etc.) is detected less reliably
# (via job postings), so FSM is weighted lower here as a signal.
TECH_T1 = ["callrail", "calltrackingmetrics", "marchex", "whatconverts", "dialpad",        # call tracking = measures bought leads
           "google ads", "adwords", "bing ads", "microsoft advertising", "doubleclick",    # running paid ads NOW
           "scorpion", "blue corona", "hibu"]                                              # hired a marketing agency
TECH_T2 = ["servicetitan", "housecall", "jobber", "fieldedge", "service fusion",           # FSM/CRM = sophisticated operator
           "servicefusion", "workiz", "podium", "birdeye", "nicejob"]                      # + reputation/reviews = invests in growth
TECH_T3 = ["intercom", "drift", "tawk", "hubspot", "hotjar", "calendly", "acuity"]         # growth-minded / web-savvy
METROS = ["dallas", "fort worth", "houston", "san antonio", "austin", "arlington", "plano", "irving", "frisco", "the woodlands", "sugar land", "round rock"]

def get(row, *names):
    low = {k.lower().strip(): (v or "").strip() for k, v in row.items()}
    for n in names:
        if n in low and low[n]:
            return low[n]
    return ""

def score(row):
    title = get(row, "title", "person title").lower()
    emp = get(row, "# employees", "num employees", "employees", "company size")
    tech = get(row, "technologies", "technology", "keywords").lower()
    state = get(row, "company state", "state", "company location").lower()
    city = get(row, "company city", "city").lower()
    email = get(row, "email", "work email")
    pts, why = 0, []
    if any(t in title for t in ["owner", "founder", "president", "ceo", "principal"]): pts += 30; why.append("decision-maker")
    elif any(t in title for t in ["general manager", " gm", "vp", "director", "marketing"]): pts += 18; why.append("senior")
    try:
        n = int("".join(ch for ch in emp if ch.isdigit()) or 0)
        if 10 <= n <= 50: pts += 20; why.append(f"size {n}")
        elif 5 <= n <= 75: pts += 12; why.append(f"size {n}")
    except ValueError:
        pass
    t1 = [t for t in TECH_T1 if t in tech]; t2 = [t for t in TECH_T2 if t in tech]; t3 = [t for t in TECH_T3 if t in tech]
    if t1: pts += min(36, 12 * len(t1)); why.append("buys-leads:" + "/".join(t1))
    if t2: pts += min(20, 8 * len(t2)); why.append("ops:" + "/".join(t2))
    if t3: pts += min(10, 4 * len(t3)); why.append("growth:" + "/".join(t3))
    if any(m in city for m in METROS) or "tx" in state or "texas" in state: pts += 10; why.append("TX metro")
    if email and "@" in email: pts += 10
    else: pts -= 50; why.append("NO EMAIL")
    return pts, "; ".join(why)

# ── Instantly API (V2, Bearer) ────────────────────────────────────────────────
BASE = "https://api.instantly.ai/api/v2"
def to_html(t):
    """Instantly stores email bodies as HTML — convert plain text (\\n) to <div> lines
    and escape & < > (so the UTM URL's & doesn't break the body)."""
    return "".join((f"<div>{html.escape(ln)}</div>" if ln.strip() else "<div><br></div>") for ln in t.split("\n"))
def ikey():
    k = os.environ.get("INSTANTLY_API_KEY", "").strip()
    if not k and Path("/tmp/instantly_key.txt").exists():
        k = Path("/tmp/instantly_key.txt").read_text().strip()
    if not k:
        sys.exit("ERROR: set INSTANTLY_API_KEY (env) or /tmp/instantly_key.txt to --push.")
    return k

def api(method, path, body=None):
    req = urllib.request.Request(f"{BASE}{path}", method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={"Authorization": f"Bearer {ikey()}", "Content-Type": "application/json",
                 "Accept": "application/json",
                 # Instantly's API is behind Cloudflare; a browser-like UA avoids 403/1010 bot blocks.
                 "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.loads(r.read() or "{}")
    except urllib.error.HTTPError as e:
        sys.exit(f"Instantly API {method} {path} -> {e.code}: {e.read().decode()[:300]}")

def build_sequences():
    """The WAVE sequence in Instantly's API shape — shared by create + update so a
    campaign edit applies everywhere 'in one scoop'."""
    return [{"steps": [
        {"type": "email", "delay": s["delay"],
         "variants": [{"subject": v["subject"], "body": to_html(v["body"])} for v in s["variants"]]}
        for s in WAVE["sequence"]]}]

def create_campaign():
    payload = {
        "name": WAVE["name"],
        "campaign_schedule": {"schedules": [{
            "name": "Business hours (Central)",
            "timing": {"from": WAVE["send_from"], "to": WAVE["send_to"]},
            "days": {"1": True, "2": True, "3": True, "4": True, "5": True},
            "timezone": WAVE["timezone"]}]},
        "sequences": build_sequences(),
        "email_list": WAVE["inboxes"],
        "daily_limit": WAVE["daily_limit"],
        "stop_on_reply": True, "open_tracking": False, "link_tracking": False,
    }
    r = api("POST", "/campaigns", payload)
    cid = r.get("id") or r.get("campaign", {}).get("id")
    print(f"  created campaign id={cid} (PAUSED — review in Instantly before launch)")
    return cid

# Apollo columns → Instantly custom variables (usable as {{website}}, {{technologies}}, etc.)
CUSTOM_FIELDS = {
    "title": ("title",), "website": ("website",),
    "employees": ("# employees", "num employees", "employees", "company size"),
    "technologies": ("technologies",), "city": ("city", "company city"),
    "state": ("state", "company state"), "industry": ("industry",),
}
def custom_vars(row):
    cv = {}
    for var, cols in CUSTOM_FIELDS.items():
        v = get(row, *cols)
        if v: cv[var] = v
    return cv

def add_lead(cid, row):
    body = {"campaign": cid, "email": get(row, "email", "work email"),
            "first_name": get(row, "first name", "first"), "last_name": get(row, "last name", "last"),
            "company_name": get(row, "company", "company name", "organization", "company name for emails"),
            "custom_variables": custom_vars(row)}
    api("POST", "/leads", body)

def fix_empty_names(cid, rows):
    """Self-heal: Instantly silently ignores name fields for emails it already knows, so after
    a load some leads can have blank first/last names. Page the campaign and PATCH any blanks
    from the CSV (matched by email). Cheap when names already stuck (just reads)."""
    names = {}
    for r in rows:
        em = get(r, "email", "work email").lower()
        if em: names[em] = (get(r, "first name", "first"), get(r, "last name", "last"))
    fixed = 0; after = None
    while True:
        body = {"campaign": cid, "limit": 100}
        if after: body["starting_after"] = after
        resp = api("POST", "/leads/list", body); items = resp.get("items") or []
        if not items: break
        for L in items:
            fn, ln = names.get((L.get("email") or "").lower(), ("", ""))
            if fn and not L.get("first_name"):
                api("PATCH", f"/leads/{L['id']}", {"first_name": fn, "last_name": ln}); fixed += 1
        after = resp.get("next_starting_after")
        if not after: break
    if fixed: print(f"  self-heal: patched {fixed} blank names")
    return fixed

# ── Campaign list + update (apply WAVE to an existing/live campaign) ───────────
def list_campaigns():
    r = api("GET", "/campaigns?limit=100")
    items = r.get("items") or r.get("data") or (r if isinstance(r, list) else [])
    print(f"{'ID':38} {'STATUS':8} NAME")
    for c in items:
        print(f"{str(c.get('id','')):38} {str(c.get('status','')):8} {c.get('name','')}")
    print(f"\n{len(items)} campaign(s). (status: 0/1=draft/active varies by account)")
    return items

def _seq_summary(seq):
    steps = (seq[0].get("steps") if seq else []) or []
    if not steps:
        return "  (no steps)"
    out = []
    for i, st in enumerate(steps):
        subs = " | ".join(v.get("subject", "") for v in (st.get("variants") or []))
        out.append(f"  step {i+1} (delay {st.get('delay')}d): {subs}")
    return "\n".join(out)

def update_campaign(cid, apply=False):
    cur = api("GET", f"/campaigns/{cid}")
    print(f"Target campaign: {cur.get('name')}  (id={cid}, status={cur.get('status')})\n")
    print("CURRENT sequence (live):")
    print(_seq_summary(cur.get("sequences") or []))
    new_seq = build_sequences()
    print("\nNEW sequence (from WAVE config):")
    print(_seq_summary(new_seq))
    if not apply:
        print("\nDRY RUN — re-run with --apply to PATCH this campaign's sequence.")
        print("Campaign STATUS is left unchanged (a paused campaign stays paused — you launch it).")
        return
    api("PATCH", f"/campaigns/{cid}", {"sequences": new_seq})
    print(f"\n✅ Applied WAVE sequence to {cid}. Status unchanged — review + launch in Instantly when ready.")

# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("csv", nargs="?", help="Apollo CSV export")
    ap.add_argument("--top", type=int, default=200, help="how many top-ranked leads to push")
    ap.add_argument("--push", action="store_true", help="create campaign + add leads (else dry-run)")
    ap.add_argument("--campaign-id", help="add to an existing campaign instead of creating one")
    ap.add_argument("--list-campaigns", action="store_true", help="list Instantly campaigns (id/status/name)")
    ap.add_argument("--update-campaign", metavar="ID", help="apply the WAVE sequence to an existing/live campaign")
    ap.add_argument("--apply", action="store_true", help="with --update-campaign: PATCH for real (else dry-run diff)")
    a = ap.parse_args()

    if a.list_campaigns:
        list_campaigns(); return
    if a.update_campaign:
        update_campaign(a.update_campaign, apply=a.apply); return
    if not a.csv:
        ap.error("csv is required (or use --list-campaigns / --update-campaign ID)")

    rows = list(csv.DictReader(open(a.csv, newline="", encoding="utf-8-sig")))
    scored = sorted(((score(r), r) for r in rows), key=lambda x: x[0][0], reverse=True)
    withmail = [(s, r) for (s, r) in scored if get(r, "email", "work email")]
    out = Path(a.csv).with_suffix(".scored.csv")
    with open(out, "w", newline="") as f:
        w = csv.writer(f); w.writerow(["score", "why", "name", "title", "company", "email"])
        for (pts, why), r in scored:
            w.writerow([pts, why, get(r, "first name") + " " + get(r, "last name"),
                        get(r, "title"), get(r, "company", "company name"), get(r, "email", "work email")])
    print(f"\nParsed {len(rows)} rows · {len(withmail)} with email · wrote {out}")
    print(f"Top {min(10, len(scored))} by buying-signal score:")
    for (pts, why), r in scored[:10]:
        print(f"  [{pts:>3}] {get(r,'first name')} {get(r,'last name')[:1]}. — {get(r,'title')[:28]:28} @ {get(r,'company','company name')[:26]:26} · {why}")

    if not a.push:
        print(f"\nDRY RUN. Review {out}, then re-run with --push --top N to load the top leads into Instantly.")
        return
    push = withmail[:a.top]
    print(f"\n--push: loading top {len(push)} leads (with email) into Instantly…")
    cid = a.campaign_id or create_campaign()
    ok = 0
    for (_, r) in push:
        add_lead(cid, r); ok += 1
        if ok % 25 == 0: print(f"  …{ok}/{len(push)}")
    fix_empty_names(cid, [r for (_, r) in push])   # self-heal blank names (Instantly dedup quirk)
    print(f"DONE. Added {ok} leads to campaign {cid} (PAUSED). Review + launch in Instantly.")

if __name__ == "__main__":
    main()
