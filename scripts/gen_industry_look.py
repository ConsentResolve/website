#!/usr/bin/env python3
"""Route #2 pipeline: train the Real Tyler photo-avatar group, generate a
horizontal per-industry LOOK from a prompt, poll it, and print the new look id(s)
so we can render a native-landscape scene. HVAC scene direction baked in here.

  python3 scripts/gen_industry_look.py            # full: wait-train -> gen look -> poll
  python3 scripts/gen_industry_look.py gen         # skip train wait, just gen+poll
"""
import json, time, sys, urllib.request, urllib.error

KEY = open("/tmp/heygen_key.txt").read().strip()
GROUP = "37dd05917aed4e42aa347b4875250793"   # Real Tyler
HVAC_PROMPT = ("HVAC service technician wearing a navy company polo shirt, standing in a "
               "suburban backyard beside a residential air-conditioning condenser unit, "
               "bright natural daylight, friendly confident expression, looking at the camera")

def call(method, url, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, headers={"X-Api-Key": KEY, "Content-Type": "application/json"}, method=method)
    try:
        r = urllib.request.urlopen(req, timeout=90); return r.status, json.load(r)
    except urllib.error.HTTPError as e:
        try: return e.code, json.loads(e.read().decode())
        except Exception: return e.code, {"raw": "non-json"}

def wait_train():
    for _ in range(180):  # up to ~30 min
        st, d = call("GET", f"https://api.heygen.com/v2/photo_avatar/train/status/{GROUP}")
        s = ((d.get("data") or {}).get("status") or "").lower()
        print("train:", s, flush=True)
        if s in ("ready", "completed", "trained", "success", "done"): return True
        if s in ("failed", "error"): print("train FAILED", json.dumps(d)[:300], flush=True); return False
        time.sleep(15)
    return False

def gen_look():
    body = {"group_id": GROUP, "prompt": HVAC_PROMPT, "orientation": "horizontal",
            "pose": "half_body", "style": "Realistic"}
    st, d = call("POST", "https://api.heygen.com/v2/photo_avatar/look/generate", body)
    print("look/generate ->", st, json.dumps(d)[:400], flush=True)
    gid = (d.get("data") or {}).get("generation_id") or (d.get("data") or {}).get("id")
    return gid

def poll_gen(gid):
    for _ in range(80):  # ~13 min
        st, d = call("GET", f"https://api.heygen.com/v2/photo_avatar/generation/{gid}")
        data = d.get("data") or {}
        s = (data.get("status") or "").lower()
        print("gen:", s, flush=True)
        if s in ("success", "completed", "ready", "done"):
            print("GEN_RESULT:", json.dumps(data)[:1200], flush=True); return data
        if s in ("failed", "error"):
            print("gen FAILED", json.dumps(data)[:400], flush=True); return None
        time.sleep(10)
    return None

if __name__ == "__main__":
    if "gen" not in sys.argv:
        if not wait_train():
            sys.exit("training did not complete")
    gid = gen_look()
    if not gid:
        sys.exit("no generation_id")
    print("generation_id:", gid, flush=True)
    poll_gen(gid)
