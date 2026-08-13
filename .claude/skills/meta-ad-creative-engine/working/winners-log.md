# Winners log — Meta ad creatives

Running record of what won, why we think it won, and what we tested next.
Newest entries on top. (Format defined in SKILL.md, Mode 3.)

<!-- entries go here -->

## 2026-08-12 — cross-vertical (Hype Video / Traffic / Lead Ads)
- Tested: format — video ("98% who leave" script, Aug-3 edit, video_id 1718872239260838) vs the same script's static image execution (lead-cr_electrician.png) vs an older video edit of the identical script (July-3, video_id 1286784243263979, running in the Traffic campaign).
- Held constant: the wasted-spend / "98% who leave" angle and full copy (title, body) — identical across all three.
- Winner: **video, Aug-3 edit** — 11.1% CTR, $22.15 CPL, 99% of its ad set's spend on ~373 clicks (Hype Video campaign, LEAD_GENERATION). The July-3 edit of the same script also outperformed static in its own campaign (7.0% CTR) but that ad ran under a Traffic/LANDING_PAGE_VIEWS objective, so its CPL isn't directly comparable. The static execution of the identical script (Lead Ads campaign) converted at 4.1% CTR / $30.61 CPL.
- Sample: Aug-3 video comfortably past the 100-click floor. Static also past floor (real spend, real leads) — this is a trustworthy format comparison, not noise.
- Hypothesis: angle is already proven (matches the 2026-07-02 roofing finding — wasted-spend wins on messaging). This round the delta is production format: video's motion/pacing earns the thumb-stop that a static 4:5 image with the same words doesn't. The Aug-3 vs July-3 gap suggests the *specific edit* (pacing, opening frame, captions) also matters, not just "video exists" — unresolved which part of the edit is doing the work.
- Next: refresh batch holding the wasted-spend angle AND video format constant, varying ONE execution dimension — see the 5-variant plan below (thumb-stop opener / production style test). Do not edit the live Aug-3 winner; scale by duplication into the currently-paused retarget ad set once reactivated.

## 2026-07-02 — roofing
- Tested: angle — wasted-spend (A, 4:5) vs competitor-envy (B, 4:5) vs ROI-math (C, square). Target CPL $30.
- Held constant: roofing vertical, Leads objective, same offer/destination.
- Winner: **A (wasted-spend, 4:5)** on reliability — $31 CPL (on target) over 210 clicks / 9 leads, CVR 4.29%. C had a lower CPL ($27) but only 95 clicks / 5 leads (below the 100-click floor) and its CI [0.77%, 9.75%] overlaps A's [1.55%, 7.03%], so C is NOT a distinguishable winner. B killed: $58 CPL (~2x target), worst CVR (2.22%) on a real 180-click sample.
- Sample: A trustworthy (210 clicks). C under-sampled AND fatigued (freq 3.4 > 3, CTR 1.00% = half of A/B). CIs A vs C overlap → not significant.
- Hypothesis: wasted-spend is the reliable roofing argument at equal spend; competitor-envy underperforms here despite decent CTR (thumb-stop, doesn't convert). ROI-math's low CPL is unresolved — likely real but masked by fatigue + tiny sample.
- Next: refresh batch varying ONE dimension — 4 wasted-spend executions (visual treatment line-art vs photoreal + headline, all 4:5) + 1 clean non-fatigued ROI-math control to resolve C. Scale A by duplication; do not edit live A.
