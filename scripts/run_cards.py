#!/usr/bin/env python3
"""Daily runner for the native Facebook card schedule (social/cards.json).
Posts today's photo card / carousel / story via post_fb_card.py.

Safe by default: posts live ONLY when CARDS_AUTOPOST=="true" in the env;
otherwise it dry-runs (prints the plan, posts nothing). Pairs with the video
run_scheduler.py on the same cron.

Usage:
  python3 scripts/run_cards.py                 # today
  python3 scripts/run_cards.py --date 2026-06-16
  python3 scripts/run_cards.py --dry-run       # force dry-run regardless of env
"""
import sys, os, json, subprocess, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
def _load(name):
    p = ROOT / "social" / name
    return json.loads(p.read_text()) if p.exists() else {}
# Resource-center FB drip fills the open card days; brand cards win on any shared date.
SCHED = {**_load("resource-cards.json"), **_load("cards.json")}
PY = "/usr/bin/python3" if Path("/usr/bin/python3").exists() else "python3"

def main():
    date = datetime.date.today().isoformat()
    if "--date" in sys.argv:
        date = sys.argv[sys.argv.index("--date") + 1]
    dry = ("--dry-run" in sys.argv) or os.environ.get("CARDS_AUTOPOST") != "true"
    slot = sys.argv[sys.argv.index("--slot") + 1] if "--slot" in sys.argv else "all"
    day = SCHED.get(date)
    if not day:
        print(f"[cards] {date}: nothing scheduled."); return
    items = day if isinstance(day, list) else [day]   # a day may hold one card or several
    if slot != "all":  # staggered cron: only this time-of-day's cards
        items = [it for it in items if it.get("slot", "mid") == slot]
    if not items:
        print(f"[cards] {date}: nothing for slot '{slot}'."); return
    base = [PY, str(ROOT / "scripts/post_fb_card.py")]
    import post_log
    NOW = datetime.datetime.utcnow().isoformat(timespec="seconds") + "Z"
    results = []
    for it in items:
        fmt = it["format"]; imgs = it["images"]; cap = it.get("caption", ""); link = it.get("link", "")
        print(f"[cards] {date}: {fmt} ({len(imgs)} img){' DRY' if dry else ' LIVE'}")
        if fmt == "photo":
            cmd = base + ["photo", imgs[0], cap]
        elif fmt == "carousel":
            cmd = base + ["carousel", cap] + imgs
        elif fmt == "story":
            cmd = base + ["story", imgs[0]]
        else:
            print(f"  unknown format {fmt}"); continue
        if link and fmt != "story":
            cmd += ["--link", link]
        if dry:
            cmd += ["--dry-run"]
        p = subprocess.run(cmd, check=False, capture_output=True, text=True)
        out = (p.stdout or "")
        if out: print(out[-400:])
        if not dry:
            import re
            ok = p.returncode == 0 and not re.search(r'(upload err|"_err")', out)
            pid, purl = post_log.parse("card", out)
            name = (it.get("images") or [""])[0].split("/")[-1].replace(".png", "")
            results.append({"ts": NOW, "date": date, "slot": it.get("slot", slot), "name": name,
                            "platform": "fb", "ptype": fmt, "status": "ok" if ok else "fail", "pid": pid, "url": purl})
    if not dry:
        post_log.append(results)
    print(f"[cards] done. ({len(results)} result(s) logged)")

if __name__ == "__main__":
    main()
