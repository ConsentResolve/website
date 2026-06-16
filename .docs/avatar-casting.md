# Avatar Casting & Looks System — Consent Resolve

Standing reference for the three presenter personas (Aaron, Tyler, Jason): which
trades each owns, how to build their looks, and the paste-ready prompts. Goal:
stop accumulating random looks. Each persona = one base identity, a disciplined
handful of looks, plain/logo-free wardrobe, authentic service-pro settings kept
in soft focus (never a cluttered job site).

Target market: **home-service pros**. Across the three characters we cover the
major trades without overlap.

---

## Engine reality (read first)
- Our three personas are **AI virtual characters** built from images → they run on
  **Avatar IV** only (the "Create a virtual character" path).
- **Avatar V** is HeyGen's "**Clone a real person**" path — it requires **real video
  footage of a real human**. Our AI personas have no real footage, so Avatar V is
  not available to them (confirmed in-Studio + via API: "no eligible instant
  avatar look"). To ever use Avatar V, you'd film a real person/presenter.

## LOCKED UGC reel style (Jun 2026) — `scripts/ugc_reel.sh`
Every UGC reel runs through one pipeline (one HeyGen render → finished captioned reel):
- **Avatar IV** (`talking_photo` + `use_avatar_iv_model`) — chosen over Avatar V for
  **tight, generated-to-audio lip sync**. (Avatar V real-footage is more realistic but
  its retargeted lips read looser; reserve for one-setting founder pieces.)
- **Expressiveness = high** + a `custom_motion_prompt` (small nods, brow lifts on
  emphasis, light smile) so delivery isn't flat.
- **Real cloned voices**, no emotion field (the clones are `emotion_support:false`).
- **`caption:true` render** → clean `video_url` + real **SRT** (`caption_url`) in one shot.
- **Handheld camera float** — dual-frequency drift, 10/8 px budget (frame must breathe).
- **−14 LUFS** two-pass loudnorm (CFR-normalize to 30fps FIRST or lip-sync drifts).
- **TikTok karaoke captions** from the real SRT: black box, white text, spoken word in
  mint (`scripts/add_captions_srt.py`).

Voice + anchor look IDs are in `video_scripts.py` (Real Jason/Tyler) and the casting
tables below; Real Aaron group `10c7ced9…`, Real Leah/"L Beyke" group `761a2701…`.

## Industry map (collectively cover the trades)
| Character | Persona | Owns these trades |
|---|---|---|
| **Aaron** | Seasoned indoor / high-ticket owner | HVAC · Electrical · Remodeling/GC · Flooring |
| **Jason** | Rugged heavy-field operator | Plumbing · Roofing · Concrete/Masonry · Garage door · Fencing |
| **Tyler** | Young outdoor / athletic operator | Lawn care/Landscaping · Pest control · Pressure washing/Exterior · Painting · Pool service |

**Voice casting:** Jason → pain/frustration hooks · Tyler → "here's how it works / proof" · Aaron → steady owner-operator trust.

---

## Global rules (apply to every persona)

### Base image(s)
HeyGen Photo Avatars carry identity from the base, so it must be clean.
- **Base 1 (required):** front-facing, looking at lens, **neutral expression**, even
  soft light, plain solid tee, **no logos/text**, uncluttered background, sharp on
  the face. (Neutral-expression bases render best in Avatar IV.)
- **Base 2 (optional):** same person, slight ¾ angle + soft closed-mouth smile for
  expression range.
- Never base off a look with a third-party logo (it propagates into generated looks).

### Look-count discipline
**4 core + 1 optional per persona.** One look per trade/location; more just
recreates the "all over the board" problem and drifts identity.

### Wardrobe & logos
Plain solid garments only — **no logos, brand marks, or printed text, ever.**
Lean navy (on-brand); charcoal/grey/khaki/white as trade-appropriate.

### Settings & variety
- Authentic but **soft-focus** — let environment artifacts live in the bokeh.
- Vary location + time-of-day + wardrobe color **between** looks (variety rules).
- High-artifact scenes (roofs, busy job sites, crews, ladders, exposed wiring):
  keep **ground-level and shallow** — subject in front of an out-of-focus version,
  never inside the busy scene.

### STYLE SUFFIX — append to every look prompt
```
Shot vertically on a smartphone front camera at arm's length, candid selfie framing, slightly tight headroom, marginally crooked horizon, shallow phone-portrait depth of field, natural ambient light, realistic skin texture and pores. No studio lighting, no color grade, no motion graphics, no on-screen text. Clothing is plain with absolutely no logos, brand marks, or printed text.
```

### How to generate the looks
- **Studio:** Avatar → open the persona → **"Design with AI"** → paste prompt (+ suffix).
- **API:** Photo Avatar look-generation from the base image (programmatic batch).

---

## AARON — seasoned indoor / high-ticket owner
Bald, ~50s, clean-shaven. Trades: HVAC · Electrical · Remodeling/GC · Flooring.
**Purge from old set:** the "monarx"-branded tee looks and the spray-bottle outdoor look.

| # | Look name | Trade (role) | Prompt (+ append suffix) |
|---|---|---|---|
| 1 | **Back-office Aaron** *(primary anchor)* | Owner — explainer | `The same bald man seated at a modest residential home-office desk, wearing a plain heather-grey henley. Out-of-focus shelf and a window with soft morning light behind him, warm lived-in small-business back office.` |
| 2 | **HVAC Aaron** | HVAC | `The same bald man standing beside an outdoor residential AC condenser unit, wearing a plain navy work polo. The unit and house siding sit softly out of focus behind him, bright daylight.` |
| 3 | **Electrical Aaron** | Electrical | `The same bald man standing in a garage near an open electrical panel, wearing a plain charcoal t-shirt. The breaker panel is far out of focus behind him; keep it shallow and soft. Mixed indoor daylight.` |
| 4 | **Remodel Aaron** | Remodeling / GC | `The same bald man standing in a home mid-remodel, wearing a plain navy quarter-zip pullover. Blurred wall studs and drywall sit far out of focus behind him, soft window light.` |
| 5 *(opt)* | **Flooring Aaron** | Flooring | `The same bald man standing in a room with newly installed wood flooring, wearing a plain grey t-shirt. Blurred flooring planks and a tool far out of focus behind him, soft daylight.` |

---

## TYLER — young outdoor / athletic operator
Late 20s, curly hair, mustache, fit. Trades: Lawn care · Pest control · Pressure washing · Painting · Pool service.
**Don't** base off the green branded-tee look.

| # | Look name | Trade (role) | Prompt (+ append suffix) |
|---|---|---|---|
| 1 | **Lawn-care Tyler** *(primary)* | Landscaping/lawn | `The same young man standing on a freshly cut residential lawn in a plain moss-green crew t-shirt. Softly blurred green yard and a hint of a mower far out of focus behind him, bright morning daylight.` |
| 2 | **Pest-control Tyler** | Pest control | `The same young man beside a suburban home exterior in a plain khaki polo shirt. A backpack sprayer rests softly out of focus behind him, flat midday daylight.` |
| 3 | **Pressure-wash Tyler** | Exterior cleaning | `The same young man standing on a clean residential driveway in a plain navy t-shirt. Blurred house siding and a wand hose far out of focus behind him, bright overcast light.` |
| 4 | **Painter Tyler** | Painting | `The same young man inside a room being repainted, wearing a plain white t-shirt with faint paint flecks. A drop cloth and ladder sit far out of focus behind him, soft window light.` |
| 5 *(opt)* | **Pool-service Tyler** | Pool service | `The same young man at the edge of a backyard pool in a plain navy polo. Blurred water and screen enclosure behind him, warm midday sun.` |

---

## JASON — rugged heavy-field operator
~50s, bald, grey goatee. Trades: Plumbing · Roofing · Concrete/Masonry · Garage door · Fencing.
Truck cab (#1) is his universal anchor — works for any of his trades.

> **DEFAULT (Jun 2026): "Real Jason" is now the UGC presenter for Jason.**
> Jason runs on the **Real Jason** photo-avatar group (`276733…`) with his **real
> cloned voice `9d5497…`**. The old AI-Jason group (`a24e2bd4…`, voice `0e671a…`)
> is **retired for UGC**. The 5 looks below were regenerated into the Real Jason
> group (truck/utility/driveway/roof/garage-door) and their ids are wired in
> `video_scripts.py` (`jason_truck/plumb/drive/roof/garage`).
> • The real voice has **emotion_support = false** → generators OMIT the emotion
>   field for it (`NO_EMOTION` in `gen_reel_sprint.py` / `gen_avatar_scenes.py`).
> • **Non-UGC VO** uses a *mix*: `vo_reel.py` alternates the male voice between the
>   real voice (`9d5497…`) and the legacy voice (`0e671a…`) via `JASON_MIX`.
> • The real-footage **Avatar V** asset (`ceff9efa…`) also exists but is locked to
>   one filmed setting; we chose Avatar IV looks for UGC to keep trade-scene variety.

| # | Look name | Trade (role) | Prompt (+ append suffix) |
|---|---|---|---|
| 1 | **Truck-cab Jason** *(primary anchor)* | Universal field hook | `The same older man with a grey goatee in the driver's seat of a pickup truck cab, seatbelt on, wearing a plain navy work t-shirt. Dashboard and softly blurred windshield behind him, warm early-morning light through the glass.` |
| 2 | **Plumbing Jason** | Plumbing | `The same older man standing in a residential garage or utility area in a plain charcoal work t-shirt. A water heater and pipes sit far out of focus behind him, mixed indoor daylight.` |
| 3 | **Roofing Jason** | Roofing | `The same older man standing at ground level in front of a single-story home, wearing a plain grey t-shirt and a plain dark ball cap. A residential roofline and a ladder are far out of focus behind him, bright daylight. Do not place him on the roof; keep the background shallow and soft.` |
| 4 | **Concrete Jason** | Concrete/Masonry | `The same older man standing beside a freshly poured residential driveway in a plain navy work t-shirt. Wooden forms and a wheelbarrow sit far out of focus behind him, flat overcast daylight.` |
| 5 *(opt)* | **Garage-door Jason** *(swap: Fencing)* | Garage door / Fencing | `The same older man standing in an open residential garage bay in a plain navy work polo. The blurred garage-door track and panels sit out of focus behind him, soft daytime light.` (Fencing swap: along a new wood fence line, blurred posts behind, late-afternoon light.) |

---

## Quick checklist before generating a look
- [ ] Plain wardrobe, **zero logos/text**
- [ ] Right trade for the persona (per the map)
- [ ] Background soft/shallow; no busy job-site, no roof, no exposed-wiring detail
- [ ] Style suffix appended
- [ ] Wardrobe color / time-of-day differs from the persona's other looks
