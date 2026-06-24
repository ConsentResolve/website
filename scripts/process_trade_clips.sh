#!/bin/bash
# Download a trade's intro+resume HeyGen clips, crop HeyGen's 34px white pillarbox
# bars (keep true 16:9, no stretch), and regenerate a poster from the cleaned
# intro frame. Usage: process_trade_clips.sh <slug> <intro_url> <resume_url>
set -e
ROOT="/Users/aaronphillips/GIT/consentresolve2"
FF="/opt/homebrew/bin/ffmpeg"
slug="$1"; intro_url="$2"; resume_url="$3"
cd "$ROOT"
[ -z "$slug" ] || [ -z "$intro_url" ] || [ -z "$resume_url" ] && { echo "usage: $0 <slug> <intro_url> <resume_url>"; exit 1; }

crop() { # <src_url> <out>
  /usr/bin/curl -sL "$1" -o /tmp/_raw.mp4
  "$FF" -y -i /tmp/_raw.mp4 -vf "crop=1212:682:34:19,scale=1280:720:flags=lanczos" \
    -c:v libx264 -preset medium -crf 19 -pix_fmt yuv420p -c:a copy -movflags +faststart "$2" 2>/dev/null
  echo "  wrote $2 ($(ls -la "$2" | awk '{print $5}') bytes, dims $($FF -hide_banner 2>/dev/null; /opt/homebrew/bin/ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 "$2"))"
}

echo "[$slug] intro…"; crop "$intro_url" "public/video/${slug}-intro.mp4"
echo "[$slug] resume…"; crop "$resume_url" "public/video/${slug}-resume.mp4"
echo "[$slug] poster…"
"$FF" -y -ss 2.5 -i "public/video/${slug}-intro.mp4" -frames:v 1 /tmp/_pframe.png 2>/dev/null
/usr/bin/python3 scripts/gen_video_poster.py /tmp/_pframe.png "public/video/${slug}-poster.jpg" "Where do the other 98 go?" "98" noplay
echo "[$slug] done."
