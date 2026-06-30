#!/usr/bin/env python3
"""Systematic Meta (Facebook) ad management via the Marketing API (Graph v21.0).

Pairs with meta_campaign.py (which CREATES campaigns, paused) + meta_audience.py.
This is the run-it-day-to-day controller: see what's live, what it's spending, and
what each lead costs — then pause losers / scale winners.

READS are free. WRITES spend money and are no-ops unless you pass --confirm:
  • activate  -> turns an ad/ad set/campaign ON (starts spending)
  • budget    -> changes daily spend
  • pause     -> turns OFF (saves money; still a write, still needs --confirm)

Auth/config (env or /tmp files; NEVER paste a token in chat):
  META_ACCESS_TOKEN     System User token w/ ads_management
  META_AD_ACCOUNT_ID    act_...

Usage:
  python3 scripts/meta_ads.py status                      # overview table (default)
  python3 scripts/meta_ads.py list --level adset
  python3 scripts/meta_ads.py pause    --id <ID>          # dry-run; add --confirm to apply
  python3 scripts/meta_ads.py activate --id <ID> --confirm
  python3 scripts/meta_ads.py budget   --adset <ID> --daily 25 --confirm
"""
import argparse, json, os, sys, urllib.request, urllib.parse, urllib.error
from pathlib import Path

GRAPH = "https://graph.facebook.com/v21.0"
LEAD_ACTIONS = ("lead", "onsite_conversion.lead_grouped", "offsite_conversion.fb_pixel_lead")


def _env(n, f):
    v = os.environ.get(n, "").strip()
    if not v and Path(f).exists():
        v = Path(f).read_text().strip()
    return v


def tok():
    t = _env("META_ACCESS_TOKEN", "/tmp/meta_token.txt")
    if not t:
        sys.exit("set META_ACCESS_TOKEN or /tmp/meta_token.txt")
    return t


def acct():
    a = _env("META_AD_ACCOUNT_ID", "/tmp/meta_ad_account.txt")
    if not a:
        sys.exit("set META_AD_ACCOUNT_ID or /tmp/meta_ad_account.txt")
    return a if a.startswith("act_") else f"act_{a}"


def get(path, params=None):
    p = dict(params or {})
    p["access_token"] = tok()
    url = f"{GRAPH}/{path}?{urllib.parse.urlencode(p)}"
    try:
        return json.load(urllib.request.urlopen(url, timeout=60))
    except urllib.error.HTTPError as e:
        sys.exit(f"Meta GET {path} -> {e.code}: {e.read().decode()[:400]}")


def post(path, params):
    params = dict(params)
    params["access_token"] = tok()
    req = urllib.request.Request(f"{GRAPH}/{path}", data=urllib.parse.urlencode(params).encode(), method="POST")
    try:
        return json.loads(urllib.request.urlopen(req, timeout=90).read())
    except urllib.error.HTTPError as e:
        sys.exit(f"Meta POST {path} -> {e.code}: {e.read().decode()[:400]}")


def _leads(row):
    n = 0
    for a in row.get("actions", []) or []:
        if a.get("action_type") in LEAD_ACTIONS:
            n += int(float(a.get("value", 0)))
    return n


def cmd_status(_a):
    camps = get(f"{acct()}/campaigns", {"fields": "id,name,effective_status,objective", "limit": 200}).get("data", [])
    asets = get(f"{acct()}/adsets", {"fields": "id,campaign_id,daily_budget", "limit": 500}).get("data", [])
    budget_by_camp = {}
    for s in asets:
        b = s.get("daily_budget")
        if b:
            budget_by_camp[s["campaign_id"]] = budget_by_camp.get(s["campaign_id"], 0) + int(b)
    ins = get(f"{acct()}/insights", {"level": "campaign",
              "fields": "campaign_id,spend,impressions,clicks,actions",
              "date_preset": "this_month", "limit": 200}).get("data", [])
    by = {d.get("campaign_id"): d for d in ins}
    print(f"{'CAMPAIGN':38} {'STATUS':12} {'BUD/d':>7} {'SPEND mo':>9} {'CLICKS':>7} {'LEADS':>6} {'CPL':>8}")
    print("-" * 92)
    tot_spend = tot_leads = 0.0
    for c in camps:
        d = by.get(c["id"], {})
        spend = float(d.get("spend", 0) or 0)
        clicks = int(d.get("clicks", 0) or 0)
        leads = _leads(d)
        tot_spend += spend
        tot_leads += leads
        cpl = (spend / leads) if leads else (spend / clicks if clicks else 0)
        cpl_lbl = (f"${cpl:.2f}" + ("" if leads else "*")) if cpl else "—"
        bud = budget_by_camp.get(c["id"], 0) / 100.0
        print(f"{(c.get('name') or '')[:36]:38} {c.get('effective_status',''):12} "
              f"{('$'+format(bud,'.0f')) if bud else '—':>7} {'$'+format(spend,'.2f'):>9} "
              f"{clicks:>7} {leads:>6} {cpl_lbl:>8}")
    print("-" * 92)
    blended = (tot_spend / tot_leads) if tot_leads else 0
    print(f"{'TOTAL (this month)':38} {'':12} {'':>7} {'$'+format(tot_spend,'.2f'):>9} "
          f"{'':>7} {int(tot_leads):>6} {('$'+format(blended,'.2f')) if blended else '—':>8}")
    print("\n* CPL shown per-click where no lead conversions are tracked yet (add the Meta Pixel lead event for true CPL).")


def cmd_list(a):
    edge = {"campaign": "campaigns", "adset": "adsets", "ad": "ads"}[a.level]
    fields = {"campaign": "id,name,effective_status,objective",
              "adset": "id,name,campaign_id,daily_budget,effective_status,optimization_goal",
              "ad": "id,name,adset_id,effective_status"}[a.level]
    rows = get(f"{acct()}/{edge}", {"fields": fields, "limit": 500}).get("data", [])
    for r in rows:
        bud = r.get("daily_budget")
        extra = f"  ${int(bud)/100:.0f}/day" if bud else ""
        print(f"{r['id']}  [{r.get('effective_status','')}]  {r.get('name','')}{extra}")
    print(f"\n{len(rows)} {a.level}(s).")


def set_status(obj_id, status, confirm):
    if not confirm:
        verb = "ACTIVATE (starts spending)" if status == "ACTIVE" else "pause"
        print(f"DRY RUN — would {verb}: {obj_id} -> {status}. Re-run with --confirm to apply.")
        return
    if status == "ACTIVE":
        print(f"⚠️  Activating {obj_id} — this will begin spending your ad budget.")
    print(post(obj_id, {"status": status}))


def cmd_pause(a):
    set_status(a.id, "PAUSED", a.confirm)


def cmd_activate(a):
    set_status(a.id, "ACTIVE", a.confirm)


def cmd_budget(a):
    cents = int(round(a.daily * 100))
    if not a.confirm:
        print(f"DRY RUN — would set ad set {a.adset} daily budget -> ${a.daily:.2f}. Re-run with --confirm.")
        return
    print(f"⚠️  Changing daily budget on {a.adset} to ${a.daily:.2f} — affects spend.")
    print(post(a.adset, {"daily_budget": cents}))


def main():
    ap = argparse.ArgumentParser(description="Systematic Meta ad management (reads free; writes need --confirm).")
    sub = ap.add_subparsers(dest="cmd")

    sub.add_parser("status").set_defaults(func=cmd_status)

    pl = sub.add_parser("list")
    pl.add_argument("--level", choices=["campaign", "adset", "ad"], default="campaign")
    pl.set_defaults(func=cmd_list)

    pp = sub.add_parser("pause")
    pp.add_argument("--id", required=True)
    pp.add_argument("--confirm", action="store_true")
    pp.set_defaults(func=cmd_pause)

    pa = sub.add_parser("activate")
    pa.add_argument("--id", required=True)
    pa.add_argument("--confirm", action="store_true")
    pa.set_defaults(func=cmd_activate)

    pb = sub.add_parser("budget")
    pb.add_argument("--adset", required=True)
    pb.add_argument("--daily", type=float, required=True, help="daily budget USD")
    pb.add_argument("--confirm", action="store_true")
    pb.set_defaults(func=cmd_budget)

    a = ap.parse_args()
    if not getattr(a, "func", None):
        a.func = cmd_status  # default to the overview
    a.func(a)


if __name__ == "__main__":
    main()
