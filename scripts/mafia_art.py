#!/usr/bin/env python3
"""Generate all Mafia Marketing art via Recraft: 4 character figures (bg removed),
a plumber van (bg removed, reused 4x for the footrace), and the scene backgrounds.
Locked global STYLE suffix + per-character palette descriptors = visual consistency.
Idempotent + retry-once-then-continue (placeholder flagged) per the brief.
  python3 scripts/mafia_art.py
"""
from mafia_lib import ART, STYLE, recraft, recraft_remove_bg, log

PLAIN = "full body, centered, facing camera, simple solid flat pastel background, lots of empty margin"

CHARACTERS = {
 "don_angelo": "Don Angelo The Angle, a HUGE operatic cartoon Italian-American mafia boss, towering broad shoulders, enormous square jaw, slicked black hair under a black fedora, deep burgundy pinstripe three-piece suit with a gold tie and pocket square, white spats, smug confident grin, cradling a shiny metal drain-snake plumbing tool like a pet cat, " + PLAIN,
 "sal": "Sal The Wrench, a short round tired kindly everyman plumber, friendly weary face with heavy eyebrows and a bushy grey mustache, navy-blue denim coveralls over a grey henley, small flat cap, big drooping sad eyes, holding a chrome pipe wrench, " + PLAIN,
 "vinnie": "Vinnie Two-Leads, a small twitchy nervous skinny henchman, an oversized mustard-brown pinstripe suit far too big for him, wide darting eyes, sweaty anxious grin, fidgeting hands, hunched posture, " + PLAIN,
 "petunia": "Mrs Petunia, a sweet oblivious cheerful elderly lady, round rosy cheeks, big round eyeglasses, white-grey hair in a neat bun, soft pink floral house-dress with a lavender cardigan, gentle innocent smile, " + PLAIN,
}
VAN = ("a tiny cute boxy cartoon plumber work van seen from the side, bright teal, a round "
       "pipe-and-wrench emblem on the door, comic speed lines behind it, " + PLAIN)
BACKGROUNDS = {
 "bg_alley": "a dark smoky cartoon city back-alley at night under a big glowing neon sign reading 'BIG LEAD FAMILY', wet cobblestone puddles, fire escapes, moody teal and magenta neon glow, no characters, wide establishing shot",
 "bg_backroom": "a dim 1960s cartoon mafia back-room office, a giant ornate wooden desk, venetian blinds casting noir stripes, a green banker's lamp, framed pictures, smoky amber light, no characters, wide shot",
 "bg_porch": "a cozy cartoon suburban house porch with a yellow door and flower boxes, a wide empty street out front with room for several vans, sunny afternoon, no characters, wide shot",
 "bg_greendoor": "a plain humble bright-green wooden door set in an old brick alley wall, a small calm hand-lettered wooden sign above it, soft daylight, hopeful and quiet, no characters, centered",
 "bg_sunlit": "a bright sunny peaceful cartoon backyard meadow with blue sky, fluffy clouds, little birds and flowers, warm and pleasant, suspiciously cheerful, no characters, wide shot",
 "bg_endcard": "a clean flat dark navy cartoon background with subtle halftone texture and a thin mint-green border frame, empty center for text, no characters",
 "bg_title": "a dramatic dark smoky cartoon spotlight stage, deep shadows, a single warm spotlight beam in the center, theatrical, empty center for a title, no characters",
}

def gen_char(key, prompt):
    src = ART / f"{key}.src.png"; final = ART / f"{key}.png"
    if final.exists(): log(f"art skip {key}.png (exists)"); return
    if recraft(f"{prompt}. {STYLE}", str(src), size="1024x1820"):  # tall for full figures
        recraft_remove_bg(str(src), str(final)); log(f"art ok {key} (+bg removed)")
    else:
        log(f"art PLACEHOLDER {key} — flagged")

def gen_bg(key, prompt):
    final = ART / f"{key}.png"
    if final.exists(): log(f"art skip {key}.png (exists)"); return
    ok = recraft(f"{prompt}. {STYLE}", str(final), size="1820x1024")
    log(f"art {'ok' if ok else 'PLACEHOLDER'} {key}")

def main():
    log("ART: characters")
    for k, p in CHARACTERS.items(): gen_char(k, p)
    log("ART: van")
    gen_char("van", VAN)
    log("ART: backgrounds")
    for k, p in BACKGROUNDS.items(): gen_bg(k, p)
    log("ART: done")

if __name__ == "__main__":
    main()
