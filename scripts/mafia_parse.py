#!/usr/bin/env python3
"""Parse the Mafia Marketing brief's locked SCRIPT.MD -> mafia/script.json + voicemap.
Re-runnable: swap mafia/BRIEF.md (new SCRIPT.MD) to re-derive everything for Ep 2.
  python3 scripts/mafia_parse.py [path/to/brief.md]
"""
import re, json, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
BRIEF = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "mafia/BRIEF.md"

text = BRIEF.read_text()
# isolate the locked script (everything after the SCRIPT.MD header)
script = text.split("# SCRIPT.MD", 1)[1]

def slugify(s):
    return re.sub(r"[^a-z0-9]+", "_", s.lower()).strip("_")

CHAR_RE = re.compile(r"^\*\*([A-Z][A-Z .'\"]+?)\*\*\s*`([A-Za-z0-9]+)`(?:\s*\*\((.*?)\)\*)?\s*$")
SCENE_RE = re.compile(r"^##\s+(.*)$")
ACTION_RE = re.compile(r"^\*\((.*?)\)\*\s*$|^\*(.+?)\*\s*$")

scenes, voicemap = [], {}
cur_scene = None
cur_line = None

def push_line():
    global cur_line
    if cur_line and cur_line.get("vo"):
        cur_scene["lines"].append(cur_line)
    cur_line = None

for raw in script.splitlines():
    ln = raw.strip()
    if not ln or ln == "---":
        continue
    m = SCENE_RE.match(ln)
    if m:
        push_line()
        title = m.group(1).strip()
        cur_scene = {"id": slugify(title), "title": title, "action": "", "lines": []}
        scenes.append(cur_scene)
        continue
    if cur_scene is None:
        continue
    m = CHAR_RE.match(ln)
    if m:
        push_line()
        name, vid, act = m.group(1).strip(), m.group(2), (m.group(3) or "").strip()
        voicemap[name] = vid
        cur_line = {"character": name, "voice_id": vid, "action": act, "vo": "", "cc": ""}
        continue
    if ln.startswith("VO:") and cur_line is not None:
        cur_line["vo"] = ln[3:].strip().strip('"')
        continue
    if ln.startswith("CC:") and cur_line is not None:
        cur_line["cc"] = ln[3:].strip().strip('"')
        continue
    am = ACTION_RE.match(ln)
    if am and cur_line is None:  # scene-level stage direction
        cur_scene["action"] = (cur_scene["action"] + " " + (am.group(1) or am.group(2))).strip()
push_line()

# global numbering for every spoken line (timing/addressing)
idx = 0
for sc in scenes:
    for li in sc["lines"]:
        li["n"] = idx; li["scene"] = sc["id"]; idx += 1

out = {"voicemap": voicemap, "scenes": scenes, "total_lines": idx}
(ROOT / "mafia/script.json").write_text(json.dumps(out, indent=2))
(ROOT / "mafia/voicemap.json").write_text(json.dumps(voicemap, indent=2))
print(f"parsed {len(scenes)} scenes, {idx} spoken lines, {len(voicemap)} voices")
for sc in scenes:
    print(f"  {sc['id']:28} {len(sc['lines'])} lines")
print("voices:", ", ".join(f"{k}={v[:6]}…" for k, v in voicemap.items()))
