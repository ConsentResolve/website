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
import sys, json, subprocess, datetime, urllib.request, os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCHED = json.loads((ROOT / "social/schedule.json").read_text())
R2 = json.loads(Path("/tmp/r2.json").read_text()) if Path("/tmp/r2.json").exists() else {}
R2_PUBLIC = "https://pub-27fc71b9070247178d8756a59bef0b33.r2.dev"
PUB = R2.get("public_base", "") or R2_PUBLIC

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

def run(cmd, dry):
    log("RUN" if not dry else "DRY", " ".join(str(c)[:80] for c in cmd[:4]), "...")
    if dry:
        return
    subprocess.run(cmd, check=False)

def main():
    dry = "--dry-run" in sys.argv
    date = datetime.date.today().isoformat()
    if "--date" in sys.argv:
        date = sys.argv[sys.argv.index("--date") + 1]
    slot = sys.argv[sys.argv.index("--slot") + 1] if "--slot" in sys.argv else "all"
    items = SCHED.get(date, [])
    if slot != "all":  # staggered cron: only this time-of-day's items (am/mid/pm)
        items = [it for it in items if it.get("slot", "mid") == slot]
    if not items:
        log(f"{date}: nothing scheduled" + (f" for slot '{slot}'." if slot != "all" else ".")); return
    PY = "/usr/bin/python3" if Path("/usr/bin/python3").exists() else "python3"
    for it in items:
        angle = it.get("angle", it.get("name", "?")); kind = it.get("kind", "ugc"); plats = it["platforms"]
        log(f"{date}: {angle} [{kind}] -> {plats} story={it.get('story')}")
        need_bytes = any(p in ("fb", "yt", "li") for p in plats)
        if it.get("url"):                                    # explicit R2 url (any bucket: shoptalk/, exp/, sprint/)
            url = it["url"]; lb_path = None
            if need_bytes:
                lb_path = f"/tmp/sched-{it.get('name','item')}.mp4"
                if not dry:
                    urllib.request.urlretrieve(url, lb_path)
        elif it.get("name"):                                 # locked sprint reel (legacy name→path)
            url, lb_path = media_by_name(it["name"], dry) if need_bytes else (f"{PUB}/social/sprint/{it['name']}.mp4", None)
        else:                                                # legacy angle/kind reel
            if not video_for(angle, kind).exists() and not PUB:
                log(f"  SKIP {angle}: no local video and no R2 base"); continue
            url, _ = ensure_r2(angle, kind, dry)
            lb_path = local_bytes(angle, kind, url, dry) if need_bytes else None
        for p in plats:
            if p == "ig":
                run([PY, str(ROOT/"scripts/post_instagram.py"), url, it["caption"], "REELS"], dry)
            elif p == "fb":
                run([PY, str(ROOT/"scripts/post_video.py"), lb_path, it["caption"]], dry)
            elif p == "yt":
                run([PY, str(ROOT/"scripts/post_youtube.py"), lb_path, it["yt_title"], it["caption"], "public"], dry)
            elif p == "li":  # LinkedIn personal native video
                run([PY, str(ROOT/"scripts/post_linkedin.py"), lb_path, it["caption"], "personal"], dry)
            elif p == "tk":  # TikTok via Buffer (media by public R2 URL, no browser)
                ch = os.environ.get("BUFFER_TIKTOK_CHANNEL", "6a2d5c7238b55793458ff01d")
                ai = "ai" if kind == "ugc" else "noai"
                run([PY, str(ROOT/"scripts/post_buffer.py"), ch, url, it["caption"], "shareNow", ai], dry)
        if it.get("story"):
            run([PY, str(ROOT/"scripts/post_instagram.py"), url, "", "STORIES"], dry)
    log("done.")

if __name__ == "__main__":
    main()
