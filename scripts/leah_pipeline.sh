#!/usr/bin/env bash
# Leah Digital Twin -> HeyGen (Avatar V) -> handheld zoompan + -14 LUFS.
# Faithful port of the provided pipeline, with python3 in place of jq (jq absent).
set -euo pipefail

: "${HEYGEN_API_KEY:?set HEYGEN_API_KEY}"
AVATAR_ID="${AVATAR_ID:?set AVATAR_ID}"
VOICE_ID="${VOICE_ID:?set VOICE_ID}"
TITLE="${TITLE:-Leah - Front Desk - 98pct}"
OUT="${OUT:-leah_final.mp4}"
PY=/usr/bin/python3

WIDTH=1080; HEIGHT=1920; FPS=30
LUFS_I=-14; LUFS_TP=-1; LUFS_LRA=7
AMP_X=10; AMP_Y=8
ZOOM_BASE=1.03; ZOOM_RANGE=0.03
POLL_EVERY=5; POLL_MAX=180
API="https://api.heygen.com"

SCRIPT_TEXT="So I run the front desk at a roofing company, and here is what used to drive me crazy. We would spend real money getting people to our website, and then most of them would just leave. No call, no form, nothing. Turns out about 98 out of every 100 visitors never reach out. We were paying for all of them, and only ever hearing from a handful. Now when someone who has opted in lands on our site, we actually get them as a lead. A name, an email, the details we need to follow up. Same traffic. We just stopped letting most of it disappear. Honestly? It made my whole job easier."

WORKDIR="$(mktemp -d)"; RAW="$WORKDIR/raw.mp4"
trap 'rm -rf "$WORKDIR"' EXIT

# ----- 1. SUBMIT -----
# CHAR_TYPE=avatar (Avatar V, real footage) | talking_photo (Avatar IV, photo look,
# tighter generated-to-audio lip sync). AVATAR_ID is the avatar_id or look id.
payload=$(AVATAR_ID="$AVATAR_ID" VOICE_ID="$VOICE_ID" SCRIPT_TEXT="$SCRIPT_TEXT" TITLE="$TITLE" WIDTH="$WIDTH" HEIGHT="$HEIGHT" CHAR_TYPE="${CHAR_TYPE:-avatar}" "$PY" -c '
import os, json
ct = os.environ.get("CHAR_TYPE","avatar")
if ct == "talking_photo":
    char = {"type":"talking_photo","talking_photo_id":os.environ["AVATAR_ID"],
            "use_avatar_iv_model":True,"talking_style":"expressive","super_resolution":True}
    exp = os.environ.get("EXPRESSIVENESS")          # e.g. "high"
    if exp: char["expressiveness"] = exp
    mp = os.environ.get("MOTION_PROMPT")            # custom motion cues
    if mp: char["custom_motion_prompt"] = mp
else:
    char = {"type":"avatar","avatar_id":os.environ["AVATAR_ID"],"avatar_style":"normal"}
print(json.dumps({
  "video_inputs":[{"character":char,
                   "voice":{"type":"text","voice_id":os.environ["VOICE_ID"],"input_text":os.environ["SCRIPT_TEXT"]}}],
  "dimension":{"width":int(os.environ["WIDTH"]),"height":int(os.environ["HEIGHT"])},
  "title":os.environ["TITLE"]}))')

resp=$(curl -sS -X POST "$API/v2/video/generate" -H "X-Api-Key: $HEYGEN_API_KEY" -H "Content-Type: application/json" -d "$payload")
video_id=$(echo "$resp" | "$PY" -c 'import sys,json;d=json.load(sys.stdin);print((d.get("data") or {}).get("video_id") or "")')
[ -n "$video_id" ] || { echo "Submit failed: $resp" >&2; exit 1; }
echo "Submitted. video_id=$video_id"

# ----- 2. POLL -----
status=""; video_url=""
for _ in $(seq 1 "$POLL_MAX"); do
  s=$(curl -sS "$API/v1/video_status.get?video_id=$video_id" -H "X-Api-Key: $HEYGEN_API_KEY")
  status=$(echo "$s" | "$PY" -c 'import sys,json;d=json.load(sys.stdin);print((d.get("data") or {}).get("status") or "")')
  case "$status" in
    completed) video_url=$(echo "$s" | "$PY" -c 'import sys,json;d=json.load(sys.stdin);print((d.get("data") or {}).get("video_url") or "")'); echo " done."; break ;;
    failed)    echo "Render failed: $s" >&2; exit 1 ;;
    *)         printf '.'; sleep "$POLL_EVERY" ;;
  esac
done
[ "$status" = "completed" ] || { echo "Timed out" >&2; exit 1; }

# ----- 3. DOWNLOAD -----
curl -sS -L "$video_url" -o "$RAW"; echo "Downloaded raw -> $RAW"

# ----- 4. MEASURE (loudnorm pass 1 + frame count) -----
measure=$(ffmpeg -hide_banner -i "$RAW" -af "loudnorm=I=$LUFS_I:TP=$LUFS_TP:LRA=$LUFS_LRA:print_format=json" -f null - 2>&1)
read MI MTP MLRA MTH < <(echo "$measure" | "$PY" -c '
import sys,re,json
t=sys.stdin.read(); m=re.search(r"\{[\s\S]*\}",t); d=json.loads(m.group(0))
print(d["input_i"],d["input_tp"],d["input_lra"],d["input_thresh"])')
echo "measured I=$MI TP=$MTP LRA=$MLRA TH=$MTH"

# Source can be 25fps; we CFR-normalize to $FPS below, so base the zoom ramp on
# duration*FPS (post-normalization frame count), NOT the raw nb_frames — else the
# video gets relabeled to a shorter duration than the audio and lip-sync drifts.
DUR=$(ffprobe -v error -select_streams v:0 -show_entries stream=duration -of csv=p=0 "$RAW")
{ [ -z "$DUR" ] || [ "$DUR" = "N/A" ]; } && DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$RAW")
TF=$("$PY" -c "print(round($DUR*$FPS))")
echo "source dur=${DUR}s -> CFR ${FPS}fps, TF=$TF frames"

# ----- 5. MOTION + NORMALIZED AUDIO (loudnorm pass 2, single encode) -----
AF="loudnorm=I=$LUFS_I:TP=$LUFS_TP:LRA=$LUFS_LRA:measured_I=$MI:measured_TP=$MTP:measured_LRA=$MLRA:measured_thresh=$MTH:linear=true"
# fps=$FPS FIRST (CFR-normalizes, preserves duration); zoompan WITHOUT its own
# fps= (keeps the normalized rate); -r/-vsync lock CFR so A/V stay aligned.
ffmpeg -y -hide_banner -loglevel error -i "$RAW" \
  -vf "fps=${FPS},zoompan=z='${ZOOM_BASE}+${ZOOM_RANGE}*on/${TF}':d=1:x='iw/2-(iw/zoom/2)+(${AMP_X}*0.6)*sin(on/${FPS}*0.9)+(${AMP_X}*0.4)*sin(on/${FPS}*2.3+1.1)':y='ih/2-(ih/zoom/2)+(${AMP_Y}*0.6)*sin(on/${FPS}*1.2+0.5)+(${AMP_Y}*0.4)*sin(on/${FPS}*2.9+2.0)':s=${WIDTH}x${HEIGHT}:fps=${FPS}" \
  -af "$AF" \
  -r ${FPS} -vsync cfr \
  -c:v libx264 -crf 18 -preset slow -pix_fmt yuv420p -c:a aac -b:a 192k "$OUT"
echo "Final -> $OUT"
echo -n "Verify loudness: "
ffmpeg -hide_banner -i "$OUT" -af loudnorm=print_format=summary -f null - 2>&1 | grep "Input Integrated" || true
