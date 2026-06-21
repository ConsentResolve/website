# Mafia Marketing — Episode 1 · Overnight Build Brief

**How to run:** Upload this file and let it run end-to-end, unattended. The full,
locked script is embedded at the bottom (`SCRIPT.MD`). Do not wait for review —
produce the finished episode and the Shorts cuts, and leave a run log.

---

## Mission

Produce a 2–4 minute animated explainer cartoon, Episode 1 of the **Mafia Marketing**
series, in the style of *Rocky & Bullwinkle* / Jay Ward: flat mid-century UPA limited
animation, bold simple shapes, thick ink outlines, grainy litho-paper texture, a limited
palette, and exaggerated anti-narrative comedy where an over-the-top parody mob narrator
over-explains everything and breaks the fourth wall. The embedded script is locked —
do not rewrite jokes, dialogue, or any Consent Resolve fact.

### Hard locks (never violate)
- The villain is the **fictional "Big Lead Family."** Never name Angi, Thumbtack,
  HomeAdvisor, or any real company. It must read as obvious parody.
- Consent Resolve facts stay exact: **$7 flat per lead**, **yours alone** (never resold),
  **consent-first** (the homeowner opts in on the contractor's *own* site), **warm inbound**
  (the homeowner comes back and calls the contractor — the contractor never cold-calls).
- Never say "free." Never guarantee legality. The contractor's own ads/SEO are never the
  villain — only the shared-lead racket is.
- 16:9, 1920×1080, ~24fps feel.

### Tools (already available)
- **Illustrations: Recraft API.** Generate all art programmatically.
- **Voices: HeyGen (already integrated).** Generate all VO with the Voice IDs below.
- **Assembly: ffmpeg.**

### Voice cast — use these HeyGen Voice IDs exactly
| Character | Voice ID |
|---|---|
| Narrator | `xtULFA9zNGQyyZJJR4mQ` |
| Don Angelo "The Angle" | `11viBWOQ93zp8HPkGTLx` |
| Sal "The Wrench" | `eMMMHWK6kak5GNRXP5CG` |
| Vinnie "Two-Leads" | `Lq4ei6a7XN8bgJ8SO9gY` |
| Mrs. Petunia | `ctDJRMImdx2MyoZCr6qY` |

Keep these in a single voice-map config that every later step reads from. To recast or to
add a character in Episode 2, that one config is the only thing that changes.

---

## Build steps (run all, unattended)

**1 · Plan.** Parse the embedded `SCRIPT.MD`. Derive the scene list, the speaking-character
list, the asset list, and a runtime estimate. Write a short production plan and a run log
you append to at every step (so I can see overnight progress and any retries).

**2 · Art (Recraft API).** First create **one reusable Recraft style** (from a seed or a
small reference set) and reuse its style id on *every* generation so characters and
backgrounds stay visually consistent — this is the #1 thing that breaks in cartoon builds,
so lock it before generating anything else. Then generate, all on transparent backgrounds
where they're overlay elements:
  - A **character turnaround** for each of the four on-screen speakers — Don Angelo, Sal,
    Vinnie, Mrs. Petunia — with a fixed per-character palette. (The Narrator is voice-only;
    no character art.) Make them **larger-than-life mob caricatures**: Don Angelo huge and
    operatic, Sal a round tired everyman, Vinnie small and twitchy, Mrs. Petunia sweet and
    oblivious.
  - A **mouth-shape sheet** per speaker — at minimum neutral / open / wide / "O" — as
    separate transparent PNGs, for flap animation.
  - A **background** per scene: the neon "BIG LEAD FAMILY" alley, the mob back room, Mrs.
    Petunia's porch (set up for the four-vans split-screen gag), the green CONSENT RESOLVE
    door, and the end card.
  - Append a global style string to every prompt: *mid-century UPA cartoon, flat colors,
    limited palette, thick ink outlines, grainy litho paper texture, Jay Ward 1960s TV
    animation, larger-than-life mob caricature.*

**3 · Voice (HeyGen).** For each spoken line in `SCRIPT.MD`, generate audio through HeyGen
using that character's Voice ID. **Feed the phonetic `VO:` text exactly as written** —
the misspellings (poisonal, fawh, t'ree, dat's, yous, excloosive) are intentional and are
what force the accent. Do **not** "correct" them. Generate per character so each voice can
be batched, and keep every clip individually addressable for timing. Keep Sal the least
exaggerated and Mrs. Petunia sweet/clean as the tonal contrast.

**4 · Timing + captions.** Build a timing map: each line → scene → measured audio duration
→ the background and character art it needs. Generate a burned-in caption track from the
**`CC:` lines** (normal spelling, readable) — never from the phonetic VO text. Caption font:
clean mono.

**5 · Animate + assemble (ffmpeg).** Assemble with limited-animation technique:
  - Slow pan/zoom (Ken Burns) on backgrounds; slide-in entrances for characters.
  - **Mouth-flap swaps** synced to each clip's audio amplitude — swap the mouth-shape PNGs
    on voice peaks over a held head.
  - The four-vans footrace gag in Scene 2; the iris-in cold open and iris transitions; a
    brass stab on the title card; a phone ring on Mrs. Petunia's call.
  - Light film-grain overlay across everything.
  - One sparse jazz/upright-bass mob bed, mixed about −22 LUFS under the VO; duck or drop
    it under the punchlines so the deadpan lands.
  - Burn in the captions.

**6 · Output.** Render the full episode, plus three vertical (9:16) Shorts cuts:
  (a) the **"yours-ish"** beat, (b) the **four-vans footrace**, (c) the **green-door reveal**.
  Write a README build checklist so any step can be re-run, and so Episode 2 can be produced
  by swapping only `SCRIPT.MD` (and the voice-map if a new character appears).

If any single asset or clip fails, retry once, then log it and **keep going** — finish the
episode with a placeholder and flag it in the log rather than halting the overnight run.

---

# SCRIPT.MD  *(locked — source of truth)*

**Format:** `VO:` = phonetic text to send to HeyGen (keep the misspellings).
`CC:` = normal-spelled caption text. *(italics)* = action/visual. Runtime target ~2:45.

---

## COLD OPEN
*Black screen. Single spotlight. Newsreel sting. Iris-opens to SAL THE WRENCH, a round
little plumber, outside a flickering neon sign: "BIG LEAD FAMILY — LEADS WHILE THEY LAST."*

**NARRATOR** `xtULFA9zNGQyyZJJR4mQ`
VO: "Eyy. As our story opens in da smoky bawra of Leadville, an honest plumbah is about ta make an offah... he don't entirely unnastand."
CC: "As our story opens in the smoky borough of Leadville, an honest plumber is about to make an offer... he doesn't entirely understand."

**SAL** `eMMMHWK6kak5GNRXP5CG` *(sighing)*
VO: "Fawty bucks fa one lead. Ehh. Business is business."
CC: "Forty bucks for one lead. Eh. Business is business."

**NARRATOR** `xtULFA9zNGQyyZJJR4mQ`
VO: "Business, sweethawt, was about ta get very poisonal. Like everyt'ing else in dis beautiful, rotten neighbahhood."
CC: "Business, dear viewer, was about to get very personal. Like everything else in this beautiful, rotten neighborhood."

*TITLE CARD (zoom + brass stab): **MAFIA MARKETING. Episode One.***

**NARRATOR** `xtULFA9zNGQyyZJJR4mQ`
VO: "Mafia Mahketing. Episode one. Fuhgeddaboudit."
CC: "Mafia Marketing. Episode One."

---

## SCENE 1 — THE BACK ROOM
*A cartoon mob office. DON ANGELO "THE ANGLE" behind a giant desk, petting a drain snake
like a cat. VINNIE "TWO-LEADS" lurks behind him.*

**DON ANGELO** `11viBWOQ93zp8HPkGTLx`
VO: "Salvatore! Come ina, come ina! You want-a leads? Eyy — da Family's gotta leads. Fresha. Hotta. Excloosive."
CC: "Salvatore! Come in, come in! You want leads? The Family has leads. Fresh. Hot. Exclusive."

**SAL** `eMMMHWK6kak5GNRXP5CG`
VO: "Excloosive? So it's just mine?"
CC: "Exclusive? So it's just mine?"

**DON ANGELO** `11viBWOQ93zp8HPkGTLx` *(beat)*
VO: "...It's-a yours-ish."
CC: "...It's yours-ish."

**VINNIE** `Lq4ei6a7XN8bgJ8SO9gY`
VO: "We solda it ta fawh guys, bo—"
CC: "We sold it to four guys, bo—"

**DON ANGELO** `11viBWOQ93zp8HPkGTLx`
VO: "VINNIE."
CC: "VINNIE."

**NARRATOR** `xtULFA9zNGQyyZJJR4mQ`
VO: "An' dere it was. Da woid no contractah survives. Yours-ish."
CC: "And there it was. The word no contractor survives. Yours-ish."

---

## SCENE 2 — THE RACKET, EXPLAINED (BADLY)
*Split-screen gag: the SAME homeowner, MRS. PETUNIA, with a dripping faucet. Four little
plumber vans screech toward her house at once.*

**NARRATOR** `xtULFA9zNGQyyZJJR4mQ`
VO: "Ya see, one leaky faucet became one 'lead'... an' one lead became fawh invoices. Da Family calls dis... efficiency."
CC: "You see, one leaky faucet became one 'lead'... and one lead became four invoices. The Family calls this... efficiency."

**MRS. PETUNIA** `ctDJRMImdx2MyoZCr6qY` *(opening door to four sweating plumbers)*
VO: "Oh my — is this a plumbah convention, deah? There's so many of yous."
CC: "Oh my — is this a plumber convention, dear? There's so many of you."

**SAL** `eMMMHWK6kak5GNRXP5CG` *(out of breath)*
VO: "I paid fawty bucks ta lose a footrace!"
CC: "I paid forty bucks to lose a footrace!"

**VINNIE** `Lq4ei6a7XN8bgJ8SO9gY` *(helpfully)*
VO: "Technic'ly ya paid ta entah da footrace, boss."
CC: "Technically you paid to enter the footrace, boss."

**NARRATOR** `xtULFA9zNGQyyZJJR4mQ`
VO: "Vinnie, it should be noted, was da only honest man in da buildin'. Da Family considahed dis a flaw."
CC: "Vinnie, it should be noted, was the only honest man in the building. The Family considered this a flaw."

---

## SCENE 3 — THE SQUEEZE
*Don Angelo throws an arm around Sal. Dollar signs float ominously.*

**DON ANGELO** `11viBWOQ93zp8HPkGTLx`
VO: "Sal. Sal. You lose da job, you buy more leads. You win da job... you buy more leads. Eidah way... capisce?"
CC: "Sal. Sal. You lose the job, you buy more leads. You win the job... you buy more leads. Either way... capisce?"

**SAL** `eMMMHWK6kak5GNRXP5CG`
VO: "Dat's not a business. Dat's a treadmill wit' a fedora."
CC: "That's not a business. That's a treadmill with a fedora."

**NARRATOR** `xtULFA9zNGQyyZJJR4mQ`
VO: "Our hero had found da catch. Now he needed... a way out. Cue da dramatic lightin' we couldn't afford."
CC: "Our hero had found the catch. Now he needed... a way out. Cue the dramatic lighting we couldn't afford."

*A plain green door appears in the back-alley wall. A calm hand-lettered sign: "CONSENT RESOLVE."*

---

## SCENE 4 — THE WAY OUT
*Sal pushes the green door. Sunlight. Birds. Suspiciously pleasant.*

**NARRATOR** `xtULFA9zNGQyyZJJR4mQ`
VO: "Behind da green door — no Family. No footrace. Just da homeownahs who came ta Sal's own website... an' decided ta say hello."
CC: "Behind the green door — no Family. No footrace. Just the homeowners who came to Sal's own website... and decided to say hello."

**SAL** `eMMMHWK6kak5GNRXP5CG` *(reading a card)*
VO: "'When a homeownah says yes on ya site, you get dere email. A real name. What dey need. Yours alone — fa seven bucks.'"
CC: "'When a homeowner says yes on your site, you get their email. A real name. What they need. Yours alone — for seven bucks.'"

**VINNIE** `Lq4ei6a7XN8bgJ8SO9gY` *(poking head through door)*
VO: "No fawh guys?"
CC: "No four guys?"

**SAL** `eMMMHWK6kak5GNRXP5CG`
VO: "No fawh guys, Vinnie. Dey come back an' call me."
CC: "No four guys, Vinnie. They come back and call me."

**NARRATOR** `xtULFA9zNGQyyZJJR4mQ`
VO: "It was consent-foist. It was excloosive. An' it cost less den da Don's footrace fee. Mrs. Petunia, fa one, was thrilled ta call a single plumbah."
CC: "It was consent-first. It was exclusive. And it cost less than the Don's footrace fee. Mrs. Petunia, for one, was thrilled to call a single plumber."

**MRS. PETUNIA** `ctDJRMImdx2MyoZCr6qY` *(on phone)*
VO: "Sal? It's about the faucet, deah. You're the only one I called."
CC: "Sal? It's about the faucet, dear. You're the only one I called."

**SAL** `eMMMHWK6kak5GNRXP5CG` *(tearing up)*
VO: "Da only one..."
CC: "The only one..."

---

## TAG / MOCK CLIFFHANGER
*Don Angelo shakes a fist at the green door.*

**DON ANGELO** `11viBWOQ93zp8HPkGTLx`
VO: "Dis isn't ovah, Wrench! Nobody leaves da Family!"
CC: "This isn't over, Wrench! Nobody leaves the Family!"

**NARRATOR** `xtULFA9zNGQyyZJJR4mQ`
VO: "But somebody just did. Will da Don adapt? Will Vinnie evah stop tellin' da troot? Will Mrs. Petunia's faucet evah get fixed? Eyy — tune in next time."
CC: "But somebody just did. Will the Don adapt? Will Vinnie ever stop telling the truth? Will Mrs. Petunia's faucet ever get fixed? Tune in next time."

**NARRATOR** `xtULFA9zNGQyyZJJR4mQ`
VO: "Next time: 'A Fistful a' Invoices'... or — 'Da Don Who Knew Too Little.' Fuhgeddaboudit!"
CC: "Next time: 'A Fistful of Invoices'... or — 'The Don Who Knew Too Little.'"

*END CARD (text, normal spelling):*
**"MAFIA MARKETING — brought to you by people who think your leads should be yours.
ConsentResolve.com · $7 a lead · yours alone."**

**END.**
