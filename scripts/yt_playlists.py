#!/usr/bin/env python3
"""YouTube playlists = topic clusters for SEO/AEO authority. Needs force-ssl scope.
  python3 scripts/yt_playlists.py list
  python3 scripts/yt_playlists.py create "<title>" "<description>" [public|unlisted]
  python3 scripts/yt_playlists.py add <playlistId> <videoId>
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from yt_api import token, api

def main():
    cmd = sys.argv[1] if len(sys.argv) > 1 else "list"
    tok = token()
    if cmd == "list":
        r = api("GET", "/playlists", tok, {"part": "snippet,contentDetails", "mine": "true", "maxResults": 50})
        for p in r.get("items", []):
            s = p["snippet"]; print(f'{p["id"]}  ({p["contentDetails"]["itemCount"]:>3} vids)  {s["title"]}')
    elif cmd == "create":
        title, desc = sys.argv[2], sys.argv[3]
        privacy = sys.argv[4] if len(sys.argv) > 4 else "public"
        r = api("POST", "/playlists", tok, {"part": "snippet,status"},
                {"snippet": {"title": title, "description": desc},
                 "status": {"privacyStatus": privacy}})
        print("created playlist:", r["id"])
    elif cmd == "add":
        pid, vid = sys.argv[2], sys.argv[3]
        r = api("POST", "/playlistItems", tok, {"part": "snippet"},
                {"snippet": {"playlistId": pid, "resourceId": {"kind": "youtube#video", "videoId": vid}}})
        print("added", vid, "->", pid, "(item", r["id"] + ")")
    else:
        sys.exit("usage: list | create <title> <desc> [privacy] | add <playlistId> <videoId>")

if __name__ == "__main__":
    main()
