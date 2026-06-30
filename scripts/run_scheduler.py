#!/usr/bin/env python3
"""Daily social scheduler — posts the day's videos + Story to the connected
platforms (IG Reels, FB Reels, YouTube Shorts) per social/schedule.json.

Designed to run from GitHub Actions cron (always-on, no Mac needed) but also
runs locally. Reuses the existing posters (which read creds from /tmp). The
video files live on R2; this resolves a public URL (uploading from local if
present) and downloads bytes for the byte-upload platforms (FB/YT).

Usage:
  python3 scripts/run_scheduler.py                 # post today's items
  python3 scripts/run_scheduler.py --date 2026-06-15
  python3 scripts/run_scheduler.py --dry-run       # show plan, post nothing
"""
import sys, json, subprocess, datetime, urllib.request, urllib.parse, os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCHED = json.loads((ROOT / "social/schedule.json").read_text())
R2 = json.loads(Path("/tmp/r2.json").read_text()) if Path("/tmp/r2.json").exists() else {}
R2_PUBLIC = "https://pub-27fc71b9070247178d8756a59bef0b33.r2.dev"
PUB = R2.get("public_base", "") or R2_PUBLIC

# R2 sits behind Cloudflare, which 403s the default python-urllib user-agent. Install a
# browser UA on the global opener so urlretrieve (FB/YT byte downloads) isn't blocked.
_op = urllib.request.build_opener()
_op.addheaders = [("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36")]
urllib.request.install_opener(_op)
import post_log
NOW = datetime.datetime.utcnow().isoformat(timespec="seconds") + "Z"

def log(*a): print("[scheduler]", *a, flush=True)

def video_for(angle, kind):
    """Local vertical cut: non-UGC locked reel, or UGC avatar reels-safe cut."""
    name = f"reel-{angle}-locked" if kind == "nonugc" else f"test-{angle}-tiktok"
    return ROOT / f"public/reels/{name}.mp4"

def ensure_r2(angle, kind, dry):
    key = (f"social/nonugc/{angle}.mp4" if kind == "nonugc" else f"social/{angle}.mp4"); url = f"{PUB}/{key}"
    local = video_for(angle, kind)
    if local.exists() and not dry:
        subprocess.run(["/usr/bin/python3", str(ROOT/"scripts/r2_upload.py"), str(local), key, "video/mp4"], check=False)
    return url, key

def local_bytes(angle, kind, url, dry):
    """FB/YT need a local file. Use local if present, else download from R2."""
    local = video_for(angle, kind)
    if local.exists():
        return str(local)
    tmp = f"/tmp/sched-{kind}-{angle}.mp4"
    if not dry:
        urllib.request.urlretrieve(url, tmp)
    return tmp

def media_by_name(name, dry):
    """Sprint reels (locked style) live at social/sprint/<name>.mp4 on R2. Return
    (public_url, local_file_for_byte_upload). Tries known local stems, else downloads."""
    url = f"{PUB}/social/sprint/{name}.mp4"
    for stem in (f"test-sprint-{name}-tiktok", f"test-{name}-tiktok", f"reel-{name}"):
        p = ROOT / f"public/reels/{stem}.mp4"
        if p.exists():
            return url, str(p)
    tmp = f"/tmp/sched-{name}.mp4"
    if not dry:
        urllib.request.urlretrieve(url, tmp)
    return url, tmp

def run(cmd, dry, attempts=2):
    """Run a poster; return (ok, stdout). Retries once on failure (the posting APIs
    occasionally hiccup transiently — e.g. today's TK/YT fails) with a short backoff,
    so momentary errors self-heal instead of needing a manual rescue."""
    log("RUN" if not dry else "DRY", " ".join(str(c)[:80] for c in cmd[:4]), "...")
    if dry:
        return None, ""
    import re as _re, time as _t
    out = ""
    for i in range(attempts):
        p = subprocess.run(cmd, check=False, capture_output=True, text=True)
        out = (p.stdout or "")
        ok = p.returncode == 0 and not _re.search(r'(PUBLISH|UPLOAD|upload|buffer HTTP) err|"_err"', out)
        if not ok and p.stderr: out = (out + "\n" + p.stderr).strip()  # fold stderr in so the real error is captured
        if ok:
            if p.stdout: print(p.stdout[-500:], flush=True)
            return True, out
        log(f"  attempt {i + 1}/{attempts} failed" + (" — retrying in 8s" if i + 1 < attempts else ""))
        if p.stderr: print(p.stderr[-300:], flush=True)
        if i + 1 < attempts: _t.sleep(8)
    return False, out

CR_BASE = "https://consentresolve.com"
def _reel_url(name):
    """Resolve a winning reel name to its public R2 video URL across known buckets (HEAD)."""
    for sub in ("social/sprint", "social/shoptalk", "social/exp", "social"):
        u = f"{PUB}/{sub}/{name}.mp4"
        try:
            if urllib.request.urlopen(urllib.request.Request(u, method="HEAD"), timeout=12).status == 200:
                return u
        except Exception:
            continue
    return None

def inject_organic_boosts(items, slot):
    """Score->promote loop (organic). Append CRM-flagged winners to this run. Gated on
    FEEDBACK_KEY (a GH secret) — a pure no-op until that's set, so the daily flow is unchanged.
    Returns the list of queue ids boosted (to mark after posting). 1 per slotted run."""
    fk = os.environ.get("FEEDBACK_KEY", "").strip()
    if not fk or slot == "all":
        return []
    boosted = []
    try:
        u = f"{CR_BASE}/api/crm/social/promote?mode=organic&status=queued&key=" + urllib.parse.quote(fk)
        q = json.loads(urllib.request.urlopen(u, timeout=20).read()).get("queue", [])
        for it in q[:1]:
            vu = _reel_url(it["name"])
            if not vu:
                log(f"  boost {it['name']}: no R2 video — leaving queued"); continue
            items.append({"name": it["name"], "url": vu, "platforms": ["ig", "fb", "yt", "tk"],
                          "kind": "nonugc", "slot": slot,
                          "caption": "Worth a fresh look \U0001F447 turn your own site traffic into consent-first leads. https://consentresolve.com/demo?utm_source=organic&utm_medium=social&utm_campaign=reboost",
                          "yt_title": it["name"].replace("-", " ").title()})
            boosted.append(it["id"]); log(f"  organic re-boost: {it['name']}")
    except Exception as e:
        log(f"  organic boost fetch failed: {e}")
    return boosted

def mark_boosts(ids):
    fk = os.environ.get("FEEDBACK_KEY", "").strip()
    for bid in ids:
        try:
            u = f"{CR_BASE}/api/crm/social/promote?key=" + urllib.parse.quote(fk)
            r = urllib.request.Request(u, data=json.dumps({"mark": True, "id": bid, "status": "boosted"}).encode(),
                                       method="POST", headers={"Content-Type": "application/json"})
            urllib.request.urlopen(r, timeout=20)
        except Exception:
            pass

def main():
    dry = "--dry-run" in sys.argv
    date = datetime.date.today().isoformat()
    if "--date" in sys.argv:
        date = sys.argv[sys.argv.index("--date") + 1]
    slot = sys.argv[sys.argv.index("--slot") + 1] if "--slot" in sys.argv else "all"
    items = SCHED.get(date, [])
    if slot != "all":  # staggered cron: only this time-of-day's items (am/mid/pm)
        items = [it for it in items if it.get("slot", "mid") == slot]
    boost_ids = inject_organic_boosts(items, slot)  # no-op unless FEEDBACK_KEY is set
    if not items:
        log(f"{date}: nothing scheduled" + (f" for slot '{slot}'." if slot != "all" else ".")); return
    PY = "/usr/bin/python3" if Path("/usr/bin/python3").exists() else "python3"
    results = []
    li_done = False  # LinkedIn-via-Buffer: cap to one post per run (LinkedIn cadence)
    for it in items:
        angle = it.get("angle", it.get("name", "?")); kind = it.get("kind", "ugc"); plats = it["platforms"]
        log(f"{date}: {angle} [{kind}] -> {plats} story={it.get('story')}")
        need_bytes = any(p in ("fb", "yt", "li") for p in plats)
        if it.get("url"):                                    # explicit R2 url (any bucket: shoptalk/, exp/, sprint/)
            url = it["url"]; lb_path = None
            if need_bytes:
                lb_path = f"/tmp/sched-{it.get('name','item')}.mp4"
                if not dry:
                    try:
                        urllib.request.urlretrieve(url, lb_path)
                    except Exception as e:
                        log(f"  download failed for {it.get('name')}: {e} — skipping byte platforms"); lb_path = None
        elif it.get("name"):                                 # locked sprint reel (legacy name→path)
            url, lb_path = media_by_name(it["name"], dry) if need_bytes else (f"{PUB}/social/sprint/{it['name']}.mp4", None)
        else:                                                # legacy angle/kind reel
            if not video_for(angle, kind).exists() and not PUB:
                log(f"  SKIP {angle}: no local video and no R2 base"); continue
            url, _ = ensure_r2(angle, kind, dry)
            lb_path = local_bytes(angle, kind, url, dry) if need_bytes else None
        for p in plats:
            if p in ("fb", "yt", "li") and not lb_path:
                log(f"  skip {p} for {it.get('name', angle)}: no local bytes"); continue
            ok = out = None
            if p == "ig":
                ok, out = run([PY, str(ROOT/"scripts/post_instagram.py"), url, it["caption"], "REELS"], dry)
            elif p == "fb":
                ok, out = run([PY, str(ROOT/"scripts/post_video.py"), lb_path, it["caption"]], dry)
            elif p == "yt":  # YT description can carry a real link — tag it
                ytdesc = it["caption"] + "\n\n👉 See it on your own site: https://consentresolve.com/demo?utm_source=youtube&utm_medium=social&utm_campaign=launch_2026"
                ok, out = run([PY, str(ROOT/"scripts/post_youtube.py"), lb_path, it["yt_title"], ytdesc, "public"], dry)
            elif p == "li":  # LinkedIn — post to each configured actor (personal + company)
                for actor in ("personal", "company"):
                    cred = Path(f"/tmp/li_{actor}.json")
                    if not dry and (not cred.exists() or cred.stat().st_size < 20):
                        continue  # actor not configured (no token/urn) — skip silently
                    a_ok, a_out = run([PY, str(ROOT/"scripts/post_linkedin.py"), lb_path, it["caption"], actor], dry)
                    if not dry and a_ok is not None:
                        results.append({"ts": NOW, "date": date, "slot": it.get("slot", slot), "name": it.get("name", angle),
                                        "platform": f"li-{actor}", "ptype": "reel", "status": "ok" if a_ok else "fail", "pid": "", "url": ""})
                ok = None  # recorded per-actor above; skip the generic append below
            elif p == "tk":  # TikTok via Buffer (media by public R2 URL, no browser)
                ch = os.environ.get("BUFFER_TIKTOK_CHANNEL", "6a2d5c7238b55793458ff01d")
                ai = "ai" if kind == "ugc" else "noai"
                ok, out = run([PY, str(ROOT/"scripts/post_buffer.py"), ch, url, it["caption"], "shareNow", ai], dry)
            if not dry and ok is not None:
                pid, purl = post_log.parse(p, out or "")
                note = ""
                if out:  # surface the platform's response (esp. Buffer/TikTok __typename + message)
                    try:
                        import json as _j
                        bj = _j.loads([l for l in out.strip().splitlines() if l.strip().startswith("{")][-1])
                        note = (bj.get("__typename", "") + ((": " + bj["message"]) if bj.get("message") else "")).strip(": ")
                    except Exception: pass
                if not ok and not note and out:  # no structured message (e.g. a YT traceback) — capture the raw error tail
                    note = " ".join(out.split())[-200:]
                results.append({"ts": NOW, "date": date, "slot": it.get("slot", slot), "name": it.get("name", angle),
                                "platform": p, "ptype": "reel", "status": "ok" if ok else "fail", "pid": pid, "url": purl, "note": note})
        # LinkedIn via Buffer (interim until native LinkedIn API approval). Once per run
        # to respect LinkedIn cadence; gated by BUFFER_LINKEDIN_CHANNEL.
        li_ch = os.environ.get("BUFFER_LINKEDIN_CHANNEL", "6a38746c5ab6d2f1065994ca")
        li_skip = kind == "shoptalk" or "shoptalk" in ((it.get("name", "") or "") + " " + (it.get("url", "") or "")).lower()
        try: li_wed = __import__("datetime").date.fromisoformat(date).weekday() == 2  # LinkedIn reels: Wed only
        except Exception: li_wed = False
        if li_ch and url and not li_done and not li_skip and li_wed:  # no SHOP TALK; one reel, Wednesdays
            li_ok, li_out = run([PY, str(ROOT/"scripts/post_buffer.py"), li_ch, url, it["caption"],
                                 "shareNow", ("ai" if kind == "ugc" else "noai"), "linkedin"], dry)
            if not dry and li_ok is not None:
                li_pid, li_purl = post_log.parse("li", li_out or "")
                li_note = ""
                if li_out:
                    try:
                        import json as _j
                        bj = _j.loads([l for l in li_out.strip().splitlines() if l.strip().startswith("{")][-1])
                        li_note = (bj.get("__typename", "") + ((": " + bj["message"]) if bj.get("message") else "")).strip(": ")
                    except Exception: pass
                results.append({"ts": NOW, "date": date, "slot": it.get("slot", slot), "name": it.get("name", angle),
                                "platform": "li", "ptype": "reel", "status": "ok" if li_ok else "fail",
                                "pid": li_pid, "url": li_purl, "note": li_note})
                li_done = True
        if it.get("story"):
            ok, out = run([PY, str(ROOT/"scripts/post_instagram.py"), url, "", "STORIES"], dry)
            if not dry and ok is not None:
                results.append({"ts": NOW, "date": date, "slot": it.get("slot", slot), "name": it.get("name", angle),
                                "platform": "ig", "ptype": "story", "status": "ok" if ok else "fail", "pid": "", "url": ""})
    if not dry:
        post_log.append(results)
        if boost_ids:
            mark_boosts(boost_ids)  # flip re-boosted winners to 'boosted' so they don't repeat
    log(f"done. ({len(results)} result(s) logged)")

if __name__ == "__main__":
    main()
