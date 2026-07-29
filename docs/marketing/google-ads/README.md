# Google Ads Editor — import guide

Files (import in this order into **Google Ads Editor** → *Account → Import → From file* → map columns → **review, then Post**):
1. `google-ads-keywords.csv` — 24 keywords across 3 ad groups (Phrase + Exact)
2. `google-ads-ads.csv` — 3 responsive search ads (one per ad group, message-matched)
3. `google-ads-negatives.csv` — 26 campaign negative keywords

All ads' Final URLs carry `?utm_source=google_search&utm_medium=cpc&utm_campaign=…` and point at the **`/demo/`** book-a-meeting funnel (repointed from `/google/` 2026-07-28 to match the "first 50 leads on us" offer), so channel + ad-group attribution flows into the CRM automatically. The ad copy is message-matched to that offer.

## Campaign-level settings (set these first — CSVs don't carry them)
Create the campaign shell **`CR Search - Lead Gen (US)`** (exact name — the CSVs join on it), then import.

| Setting | Value |
|---|---|
| Campaign type | **Search** only |
| Networks | **Uncheck** "Search Partners" AND "Display Network" (money pits at start) |
| Locations | US — or start with your 2–3 target metros |
| Budget | **$30–50/day** |
| Bidding | **Manual CPC** (~$2–4 max) until ~15–20 conversions, then switch to **Maximize Conversions** |
| Conversion action | **Already done — nothing to paste.** Account conversions are live: **`book_meeting`** (Primary, fires on a real Cal booking) + **`generate_lead`** (Secondary, fires on the `/demo/` step-1 capture). For a NEW campaign with no history, set the campaign to optimize toward **`generate_lead`** first (enough volume for bidding), with `book_meeting` as the north-star; revisit once you have ~15–20 conversions. |
| Ad rotation | Optimize (default) |

## Ad groups
- **Lead Generation** — "contractor lead generation", "more leads for my business", etc.
- **Angi-Thumbtack Alternative** — "angi alternative", "stop buying shared leads", etc. (highest-intent)
- **Website Visitor ID** — "identify website visitors", "turn website visitors into leads", etc.

## Before you post
- Confirm the **conversion action is tracking** — it already is (`book_meeting` + `generate_lead` under `AW-18263188422`, verified live 2026-07-28). Verify in Tag Assistant on `/demo/` after accepting cookies.
- Add any brand terms you want to exclude, and watch the search-terms report weekly to add negatives.
- Start Manual CPC so a broad keyword can't run away before you have data.
