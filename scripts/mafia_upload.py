#!/usr/bin/env python3
"""Upload Episode 1 + the 3 Shorts to YouTube as UNLISTED, into a 'Mafia Marketing'
playlist. Needs the force-ssl yt token. Prints watch URLs (the episode link is what
to open in the morning).
  python3 scripts/mafia_upload.py [public|unlisted]   (default unlisted)
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pathlib import Path
from yt_api import token, api, upload_media
from mafia_lib import OUT, SHORTS, log

PRIVACY = sys.argv[1] if len(sys.argv) > 1 else "unlisted"
DESC = ("Episode 1 of Mafia Marketing — a parody cartoon. An honest plumber learns the "
        "fictional \"Big Lead Family\" has been selling his \"exclusive\" lead to four guys at "
        "once... then he finds the green door.\n\n"
        "Consent Resolve gives home-service contractors exclusive, consent-first leads — "
        "$7 a lead, yours alone, never resold. The homeowner opts in on your OWN site and "
        "comes back to call you. No footrace.\n\n"
        "👉 See it on your own site: https://consentresolve.com/demo\n\n"
        "(The \"Big Lead Family\" is fictional parody — any resemblance to real lead-sellers is the joke.)")
TAGS = ["contractor leads", "exclusive leads", "home services marketing", "lead generation",
        "small business", "plumber", "consent first", "animated", "cartoon", "parody"]

def upload(path, title, desc, tags):
    r = upload_media(str(path), "video/mp4",
        {"_endpoint": "/videos", "part": "snippet,status", "uploadType": "multipart"}, token(),
        extra_meta={"snippet": {"title": title[:100], "description": desc, "tags": tags[:15], "categoryId": "23"},
                    "status": {"privacyStatus": PRIVACY, "selfDeclaredMadeForKids": False}})
    vid = r["id"]; log(f"uploaded {Path(path).name} -> https://www.youtube.com/watch?v={vid} ({PRIVACY})")
    return vid

def main():
    tok = token()
    ep = OUT / "episode_yt.mp4"
    if not ep.exists(): ep = OUT / "episode.mp4"
    if not ep.exists(): sys.exit("no episode — run assemble first")
    ep_id = upload(ep, "Mafia Marketing — Ep. 1: Yours-ish", DESC, TAGS)

    # playlist
    pid = api("POST", "/playlists", tok, {"part": "snippet,status"},
              {"snippet": {"title": "Mafia Marketing", "description": "An animated parody series from Consent Resolve. $7 a lead, yours alone."},
               "status": {"privacyStatus": PRIVACY}})["id"]
    api("POST", "/playlistItems", tok, {"part": "snippet"},
        {"snippet": {"playlistId": pid, "resourceId": {"kind": "youtube#video", "videoId": ep_id}}})
    log(f"playlist Mafia Marketing -> {pid} (+episode)")

    shorts = [("short_a_yours_ish.mp4", "Yours-ish. 😬 #Shorts"),
              ("short_b_four_vans.mp4", "One lead, four vans #Shorts"),
              ("short_c_green_door.mp4", "Behind the green door #Shorts")]
    for fn, title in shorts:
        p = SHORTS / fn
        if not p.exists(): log(f"short missing {fn} — skipped"); continue
        vid = upload(p, title, DESC, TAGS + ["shorts"])
        api("POST", "/playlistItems", tok, {"part": "snippet"},
            {"snippet": {"playlistId": pid, "resourceId": {"kind": "youtube#video", "videoId": vid}}})

    print(f"\n=== WATCH (unlisted) ===\nEpisode: https://www.youtube.com/watch?v={ep_id}")
    log(f"DONE — episode https://www.youtube.com/watch?v={ep_id}")

if __name__ == "__main__":
    main()
