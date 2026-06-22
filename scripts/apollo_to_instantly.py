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
import argparse, csv, json, os, sys, urllib.request, urllib.error
from pathlib import Path

# ── Wave config (HVAC #1) ─────────────────────────────────────────────────────
DEMO = "https://consentresolve.com/demo?utm_source=instantly&utm_medium=email&utm_campaign=hvac_2026"
WAVE = {
    "name": "Contractors – Consent-First · HVAC TX (2026)",
    "timezone": "America/Chicago",                       # Central
    "inboxes": ["aaron@getconsentresolve.com", "tyler@getconsentresolve.com",
                "aaron@tryconsentresolve.com", "tyler@tryconsentresolve.com"],
    "daily_limit": 20, "send_from": "08:00", "send_to": "17:00",
    "sequence": [
        {"delay": 0, "variants": [
            {"subject": "{{firstName}}, the 98% who leave your site",
             "body": ("Hi {{firstName}},\n\nQuick one. Most home-service sites lose ~98% of visitors — they look, they leave, you never know who they were.\n\n"
                      "Consent Resolve hands those visitors back as exclusive, consent-first leads: the homeowner opts in on your own site and comes back to you — real name, email, what they need. $7 a lead, yours alone, never resold. No shared-lead treadmill.\n\n"
                      f"2-minute demo on a site like yours: {DEMO}\n\nIf it's not relevant, just reply \"no thanks\" and I won't follow up.\n\n— {{{{senderName}}}}, Consent Resolve")},
            {"subject": "quick one about {{companyName}}'s website leads",
             "body": ("Hi {{firstName}},\n\nMost HVAC sites lose ~98% of visitors — they look, they leave, you never know who they were.\n\n"
                      "Consent Resolve gives those visitors back as exclusive, consent-first leads — the homeowner opts in on your site and comes back to you. $7 each, yours alone, never resold.\n\n"
                      f"2-min demo: {DEMO}\n\nNot relevant? Reply \"no thanks.\"\n\n— {{{{senderName}}}}, Consent Resolve")},
        ]},
        {"delay": 3, "variants": [
            {"subject": "re: the 98%",
             "body": ("{{firstName}} — following up once.\n\nA shared HVAC lead from the big platforms runs $35–150 and gets sold to 4–5 contractors. A consent-first lead is $7 and only yours.\n\n"
                      f"2-min demo: {DEMO}\n\nNot for you? Reply and I'll stop.\n\n— {{{{senderName}}}}")},
        ]},
        {"delay": 4, "variants": [
            {"subject": "last one, {{firstName}}",
             "body": ("I'll leave it here so I'm not cluttering your inbox, {{firstName}}.\n\n"
                      f"If recovering the visitors who leave {{{{companyName}}}}'s site without calling is ever worth 2 minutes: {DEMO}\n\nGood luck this season.\n\n— {{{{senderName}}}}")},
        ]},
    ],
}

# ── Scoring (buying signals from the playbook) ────────────────────────────────
SENIOR = ["owner", "founder", "president", "ceo", "principal", "partner", "general manager", " gm", "vp", "director", "marketing"]
TECH = ["callrail", "calltrackingmetrics", "servicetitan", "housecall", "google ads", "marchex", "hubspot"]
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
    hits = [t for t in TECH if t in tech]
    if hits: pts += min(30, 10 * len(hits)); why.append("tech:" + "/".join(hits))
    if any(m in city for m in METROS) or "tx" in state or "texas" in state: pts += 10; why.append("TX metro")
    if email and "@" in email: pts += 10
    else: pts -= 50; why.append("NO EMAIL")
    return pts, "; ".join(why)

# ── Instantly API (V2, Bearer) ────────────────────────────────────────────────
BASE = "https://api.instantly.ai/api/v2"
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
        headers={"Authorization": f"Bearer {ikey()}", "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.loads(r.read() or "{}")
    except urllib.error.HTTPError as e:
        sys.exit(f"Instantly API {method} {path} -> {e.code}: {e.read().decode()[:300]}")

def create_campaign():
    payload = {
        "name": WAVE["name"],
        "campaign_schedule": {"schedules": [{
            "name": "Business hours (Central)",
            "timing": {"from": WAVE["send_from"], "to": WAVE["send_to"]},
            "days": {"1": True, "2": True, "3": True, "4": True, "5": True},
            "timezone": WAVE["timezone"]}]},
        "sequences": [{"steps": [
            {"type": "email", "delay": s["delay"], "variants": s["variants"]} for s in WAVE["sequence"]]}],
        "email_list": WAVE["inboxes"],
        "daily_limit": WAVE["daily_limit"],
        "stop_on_reply": True, "open_tracking": False, "link_tracking": False,
    }
    r = api("POST", "/campaigns", payload)
    cid = r.get("id") or r.get("campaign", {}).get("id")
    print(f"  created campaign id={cid} (PAUSED — review in Instantly before launch)")
    return cid

def add_lead(cid, row):
    body = {"campaign": cid, "email": get(row, "email", "work email"),
            "first_name": get(row, "first name", "first"), "last_name": get(row, "last name", "last"),
            "company_name": get(row, "company", "company name", "organization", "company name for emails")}
    api("POST", "/leads", body)

# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("csv", help="Apollo CSV export")
    ap.add_argument("--top", type=int, default=200, help="how many top-ranked leads to push")
    ap.add_argument("--push", action="store_true", help="create campaign + add leads (else dry-run)")
    ap.add_argument("--campaign-id", help="add to an existing campaign instead of creating one")
    a = ap.parse_args()

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
    print(f"DONE. Added {ok} leads to campaign {cid} (PAUSED). Review + launch in Instantly.")

if __name__ == "__main__":
    main()
