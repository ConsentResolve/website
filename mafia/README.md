# Mafia Marketing — build pipeline

Animated parody cartoon series for Consent Resolve. Episode 1 produced unattended
overnight. Every step is idempotent and re-runnable; **Episode 2 = drop a new
`BRIEF.md` (new `SCRIPT.MD`) and re-run** (add a voice to `voicemap.json` only if a new
character appears).

## Pipeline (run in order)
```
python3 scripts/mafia_parse.py        # BRIEF.md -> script.json + voicemap.json
python3 scripts/mafia_voice.py        # HeyGen TTS for every line -> vo/*.wav + timing.json
python3 scripts/mafia_art.py          # Recraft: characters (+bg removed)            [needs Recraft credits]
python3 scripts/mafia_bg.py           # OpenAI gpt-image-1: backgrounds + van; PIL petunia cut
python3 scripts/mafia_audio.py        # synth music bed + SFX -> sfx/*.wav
python3 scripts/mafia_assemble.py     # per-line clips + cards + concat + mix -> out/episode.mp4
python3 scripts/mafia_shorts.py       # 3 vertical Shorts -> shorts/*.mp4
# compress: ffmpeg -i out/episode.mp4 -crf 24 -preset medium ... out/episode_yt.mp4
python3 scripts/mafia_upload.py unlisted   # YouTube upload (episode + shorts) + playlist
```

## Decisions made on the overnight run (see RUNLOG.md)
- **Voices:** the brief's Voice IDs are ElevenLabs-format but HeyGen accepts + renders them — used as written, exact phonetic VO text (misspellings kept).
- **Art:** characters via Recraft (locked style-suffix + per-character palette descriptors). **Recraft ran out of credits** mid-run → backgrounds + van generated via OpenAI `gpt-image-1` in the same flat-cartoon style; Petunia's cutout fixed with a PIL flood-fill. Sign text ("BIG LEAD FAMILY", "CONSENT RESOLVE") baked on with PIL (AI text is unreliable).
- **Mouth-flap:** registered AI mouth-PNGs won't align frame-to-frame, so "talking" is an amplitude-style vertical bob (limited-animation). Flagged.
- **Captions/titles:** this ffmpeg has no `drawtext` (no libfreetype) → rendered as PIL PNG overlays (clean mono captions, mint title banners).
- **Music/SFX:** synthesized with ffmpeg (no licensed mob-jazz track) — sparse walking-bass bed (ducked) + brass stab / phone ring / screech / newsreel / chime at cue points. This is the roughest layer; swap for licensed audio when available.
- **Hard locks honored:** villain is the fictional "Big Lead Family" only; CR facts exact ($7 flat, yours alone/never resold, consent-first, warm inbound); never "free"; no legality guarantees; 16:9 1920×1080 @24fps.

## Outputs
- `out/episode.mp4` (master, grain) · `out/episode_yt.mp4` (compressed upload)
- `shorts/short_{a,b,c}_*.mp4` (9:16)
- Uploaded UNLISTED → playlist "Mafia Marketing". Links in RUNLOG.md.

## Known rough edges / next-pass ideas
- Music bed + SFX are synthesized placeholders — biggest quality lift is real audio.
- Animation is limited (bob + Ken Burns + slide-in vans); could add true lip-sync / more in-betweens.
- Re-run `mafia_art.py` once Recraft credits are topped up to get fully style-matched backgrounds (currently OpenAI).
