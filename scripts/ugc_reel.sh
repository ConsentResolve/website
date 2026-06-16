#!/usr/bin/env bash
# ============================================================================
# LOCKED UGC reel pipeline (Consent Resolve). One render -> finished captioned reel.
#   - Avatar IV (talking_photo) for tight lip sync  [CHAR_TYPE=avatar for Avatar V]
#   - Expressiveness High + custom motion cues
#   - caption:true render: clean video_url + real SRT (caption_url) in ONE shot
#   - handheld camera float (dual-frequency, 10/8 budget)
#   - -14 LUFS loudness (two-pass loudnorm)
#   - TikTok karaoke captions from the real SRT (black box, white text, mint word)
# Usage: HEYGEN_API_KEY=.. AVATAR_ID=.. VOICE_ID=.. SCRIPT_TEXT=".." OUT=x.mp4 ./ugc_reel.sh
# ============================================================================
set -euo pipefail
: "${HEYGEN_API_KEY:?}"; : "${AVATAR_ID:?}"; : "${VOICE_ID:?}"; : "${SCRIPT_TEXT:?}"
CHAR_TYPE="${CHAR_TYPE:-talking_photo}"
EXPRESSIVENESS="${EXPRESSIVENESS:-high}"
MOTION_PROMPT="${MOTION_PROMPT:-Small nods, eyebrow lifts on points of emphasis, and a light natural smile that comes and goes. Relaxed and conversational, like talking to a peer.}"
TITLE="${TITLE:-Consent Resolve UGC}"; OUT="${OUT:-ugc_final.mp4}"
PY=/usr/bin/python3; API="https://api.heygen.com"
WIDTH=1080; HEIGHT=1920; FPS=30
LUFS_I=-14; LUFS_TP=-1; LUFS_LRA=7
AMP_X=10; AMP_Y=8; ZOOM_BASE=1.03; ZOOM_RANGE=0.03
POLL_EVERY=5; POLL_MAX=180
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORKDIR="$(mktemp -d)"; RAW="$WORKDIR/raw.mp4"; SRT="$WORKDIR/cap.srt"; MASTER="$WORKDIR/master.mp4"
trap 'rm -rf "$WORKDIR"' EXIT
key(){ echo "$1" | "$PY" -c "import sys,json;d=(json.load(sys.stdin).get('data') or {});print(d.get('$2') or '')"; }

# 1. SUBMIT (caption:true -> clean video + SRT)
payload=$(AVATAR_ID="$AVATAR_ID" VOICE_ID="$VOICE_ID" SCRIPT_TEXT="$SCRIPT_TEXT" TITLE="$TITLE" WIDTH="$WIDTH" HEIGHT="$HEIGHT" CHAR_TYPE="$CHAR_TYPE" EXPRESSIVENESS="$EXPRESSIVENESS" MOTION_PROMPT="$MOTION_PROMPT" "$PY" -c '
import os, json
ct=os.environ["CHAR_TYPE"]
if ct=="talking_photo":
    char={"type":"talking_photo","talking_photo_id":os.environ["AVATAR_ID"],"use_avatar_iv_model":True,"talking_style":"expressive","super_resolution":True}
    if os.environ.get("EXPRESSIVENESS"): char["expressiveness"]=os.environ["EXPRESSIVENESS"]
    if os.environ.get("MOTION_PROMPT"): char["custom_motion_prompt"]=os.environ["MOTION_PROMPT"]
else:
    char={"type":"avatar","avatar_id":os.environ["AVATAR_ID"],"avatar_style":"normal"}
print(json.dumps({"caption":True,"video_inputs":[{"character":char,"voice":{"type":"text","voice_id":os.environ["VOICE_ID"],"input_text":os.environ["SCRIPT_TEXT"]}}],"dimension":{"width":int(os.environ["WIDTH"]),"height":int(os.environ["HEIGHT"])},"title":os.environ["TITLE"]}))')
resp=$(curl -sS -X POST "$API/v2/video/generate" -H "X-Api-Key: $HEYGEN_API_KEY" -H "Content-Type: application/json" -d "$payload")
video_id=$(key "$resp" video_id); [ -n "$video_id" ] || { echo "submit failed: $resp" >&2; exit 1; }
echo "video_id=$video_id"

# 2. POLL (then wait briefly for caption_url to populate)
status=""; video_url=""; caption_url=""
for _ in $(seq 1 "$POLL_MAX"); do
  s=$(curl -sS "$API/v1/video_status.get?video_id=$video_id" -H "X-Api-Key: $HEYGEN_API_KEY")
  status=$(key "$s" status)
  case "$status" in
    completed) video_url=$(key "$s" video_url)
      for _ in $(seq 1 12); do caption_url=$(key "$s" caption_url); [ -n "$caption_url" ] && break; sleep 3; s=$(curl -sS "$API/v1/video_status.get?video_id=$video_id" -H "X-Api-Key: $HEYGEN_API_KEY"); done
      echo " done."; break ;;
    failed) echo "render failed: $s" >&2; exit 1 ;;
    *) printf '.'; sleep "$POLL_EVERY" ;;
  esac
done
[ "$status" = completed ] || { echo "timeout" >&2; exit 1; }

# 3. DOWNLOAD clean video + SRT
curl -sS -L "$video_url" -o "$RAW"
[ -n "$caption_url" ] && curl -sS -L "$caption_url" -o "$SRT" || echo "WARN: no caption_url"

# 4. MEASURE
measure=$(ffmpeg -hide_banner -i "$RAW" -af "loudnorm=I=$LUFS_I:TP=$LUFS_TP:LRA=$LUFS_LRA:print_format=json" -f null - 2>&1)
read MI MTP MLRA MTH < <(echo "$measure" | "$PY" -c 'import sys,re,json;t=sys.stdin.read();d=json.loads(re.search(r"\{[\s\S]*\}",t).group(0));print(d["input_i"],d["input_tp"],d["input_lra"],d["input_thresh"])')
DUR=$(ffprobe -v error -select_streams v:0 -show_entries stream=duration -of csv=p=0 "$RAW")
{ [ -z "$DUR" ] || [ "$DUR" = "N/A" ]; } && DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$RAW")
TF=$("$PY" -c "print(round($DUR*$FPS))")
echo "dur=${DUR}s TF=$TF | loud I=$MI TP=$MTP"

# 5. FLOAT + LOUDNORM -> MASTER (CFR-safe: fps prefix + zoompan fps; dual-sine handheld)
AF="loudnorm=I=$LUFS_I:TP=$LUFS_TP:LRA=$LUFS_LRA:measured_I=$MI:measured_TP=$MTP:measured_LRA=$MLRA:measured_thresh=$MTH:linear=true"
ffmpeg -y -hide_banner -loglevel error -i "$RAW" \
  -vf "fps=${FPS},zoompan=z='${ZOOM_BASE}+${ZOOM_RANGE}*on/${TF}':d=1:x='iw/2-(iw/zoom/2)+(${AMP_X}*0.6)*sin(on/${FPS}*0.9)+(${AMP_X}*0.4)*sin(on/${FPS}*2.3+1.1)':y='ih/2-(ih/zoom/2)+(${AMP_Y}*0.6)*sin(on/${FPS}*1.2+0.5)+(${AMP_Y}*0.4)*sin(on/${FPS}*2.9+2.0)':s=${WIDTH}x${HEIGHT}:fps=${FPS}" \
  -af "$AF" -r ${FPS} -vsync cfr -c:v libx264 -crf 18 -preset slow -pix_fmt yuv420p -c:a aac -b:a 192k "$MASTER"

# 6. KARAOKE CAPTIONS from real SRT -> OUT (keep a -nocap master)
cp "$MASTER" "${OUT%.mp4}-nocap.mp4"
if [ -s "$SRT" ]; then
  "$PY" "$ROOT/scripts/add_captions_srt.py" "$MASTER" "$SRT" "$OUT"
else
  echo "no SRT -> shipping master without captions"; cp "$MASTER" "$OUT"
fi
echo "Final -> $OUT"
ffmpeg -hide_banner -i "$OUT" -af loudnorm=print_format=summary -f null - 2>&1 | grep "Input Integrated" || true
