"""Single source of truth for the 'originals' review set — the Jun 11–13 era
reels (UGC first-person + persona/look tests + non-UGC music reels + early
music experiments). Imported by gen_sprint_gallery.py (to render + catalog) and
deploy_originals.py (to upload). Each item is (basename_without_ext, label).
Local source: public/reels/<basename>.mp4 · R2 key: social/sprint/orig/<basename>.mp4
"""

ORIG_GROUPS = [
    ("Original UGC — first-person angle reels",
     "Avatar acting as a contractor (pre-reframe)", [
        ("test-leak-tiktok", "leak"), ("test-ftc-tiktok", "ftc"), ("test-math-tiktok", "math"),
        ("test-invoice-tiktok", "invoice"), ("test-ghost-tiktok", "ghost"), ("test-policy-tiktok", "policy"),
        ("test-twice-tiktok", "twice"), ("test-contrarian-tiktok", "contrarian"), ("test-ownership-tiktok", "ownership"),
        ("test-robot-tiktok", "robot"), ("test-race-tiktok", "race"), ("test-credit-tiktok", "credit"),
        ("test-creepy-tiktok", "creepy"), ("test-aaron-tiktok", "aaron · persona"),
        ("test-tyler-tiktok", "tyler · persona"), ("test-jason-tiktok", "jason · persona"),
     ]),
    ("Persona & look tests",
     "Early casting / style trials (Jun 11)", [
        ("reel-named-aaron-v1", "aaron v1"), ("reel-named-aaron-v2", "aaron v2"), ("reel-named-aaron-v3", "aaron v3"),
        ("reel-named-jason-v1", "jason v1"), ("reel-named-jason-v2", "jason v2"), ("reel-named-jason-v3", "jason v3"),
        ("reel-named-jason-pointer", "jason pointer"), ("reel-named-tyler-v1", "tyler v1"),
        ("reel-named-tyler-v2", "tyler v2"), ("reel-named-tyler-v3", "tyler v3"),
        ("reel-final-aaron", "aaron final"), ("reel-final-jason", "jason final"), ("reel-final-tyler", "tyler final"),
        ("reel-jason-final", "jason final (alt)"), ("reel-style-aaron", "aaron styled"),
        ("reel-style-tyler", "tyler styled"), ("reel-style-pickup", "pickup styled"),
        ("reel-test-aaron", "aaron test"), ("reel-test-jason", "jason test"), ("reel-test-tyler", "tyler test"),
        ("reel-test-pickup", "pickup test"), ("reel-test-curly", "curly test"), ("reel-test-curly-iv", "curly IV"),
        ("reel-test-curly-masked", "curly masked"), ("reel-tyler-cinematic", "tyler cinematic"),
        ("reel-tyler-clean", "tyler clean"), ("reel-tyler-sticker", "tyler sticker"), ("reel-tyler-rec", "tyler rec"),
        ("reel-D-avatar", "D · avatar"), ("reel-E-avatar-pip", "E · avatar PiP"),
     ]),
    ("Original non-UGC — music reels (locked)",
     "Brand-animated, per-angle music bed", [
        ("reel-leak-locked", "leak · VO"), ("reel-ftc-locked", "ftc · VO"), ("reel-ownership-locked", "ownership · VO"),
        ("reel-invoice-locked", "invoice · instrumental"), ("reel-math-locked", "math · instrumental"),
        ("reel-robot-locked", "robot · instrumental"), ("reel-twice-locked", "twice · with-lyrics"),
        ("reel-ghost-locked", "ghost · with-lyrics"), ("reel-dashboard-locked", "dashboard · product beat"),
     ]),
    ("Music experiments",
     "First Suno / instrumental trials (Jun 11)", [
        ("reel-A-vo", "A · VO"), ("reel-B-song", "B · song"), ("reel-C-jingle-vo", "C · jingle+VO"),
        ("reel-01-lead-leak", "leak v1"), ("reel-01-lead-leak-v2", "leak v2"),
        ("reel-01-lead-leak-voiced", "leak voiced"), ("reel-01-lead-leak-vo", "leak VO"),
        ("reel-01-lead-leak-suno", "leak suno"), ("reel-01-lead-leak-suno-v2", "leak suno v2"),
        ("reel-01-lead-leak-sage", "leak sage"),
     ]),
]

# Flat list of (basename, label, group_title) for uploaders / lookups.
def flat():
    out = []
    for title, _sub, items in ORIG_GROUPS:
        for base, label in items:
            out.append((base, label, title))
    return out
