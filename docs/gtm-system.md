# Consent Resolve — Integrated GTM system

One ICP (Apollo) → cold email (Instantly) + social + retargeting → /demo → dashboard → loop.
Same message, multi-touch, one attribution loop, consent-first throughout.

## UTM convention (use everywhere so the dashboard attributes cleanly)
Always: `?utm_source=<source>&utm_medium=<medium>&utm_campaign=<campaign>` on every link to consentresolve.com.
The first-touch `cr_src` cookie (set by `/api/hit`) captures `utm_source`; the dashboard groups sources into macro-channels.

| Channel | utm_source | utm_medium | Macro-group |
|---|---|---|---|
| Cold email (Instantly) | `instantly` | `email` | **Outreach** |
| LinkedIn (Buffer/native) | `linkedin` | `social` | **Social** |
| X / Twitter | `x` | `social` | Social |
| Facebook | `facebook` | `social` | Social |
| Instagram | `instagram` | `social` | Social |
| YouTube | `youtube` | `video` | Social |
| TikTok | `tiktok` | `social` | Social |
| Google Business Profile | `gbp` | `social` | Social |
| Meta retargeting | `retarget_meta` | `paid_social` | **Retargeting** |
| Google retargeting | `retarget_google` | `display` | Retargeting |
| LinkedIn retargeting | `retarget_linkedin` | `paid_social` | Retargeting |
| (none / typed) | — | — | **Direct** |

Dashboard macro-grouping lives in `scripts/gen_dashboard.py` (`CHGROUP`); update both if you add sources.

## Instantly cold-email sequence (on-brand, soft, CAN-SPAM)
Link target: `https://consentresolve.com/demo?utm_source=instantly&utm_medium=email&utm_campaign=contractors_2026`
Tokens: `{{firstName}} {{companyName}} {{senderName}} {{physicalAddress}} {{unsubscribeLink}}`

**Email 1 — value-first intro.** Subjects: `{{firstName}}, the 98% who leave your site` / `quick one about {{companyName}}'s website leads`
> Hi {{firstName}}, Quick one. Most home-service sites lose ~98% of visitors — they look, they leave, you never know. Consent Resolve hands those visitors back as exclusive, consent-first leads: the homeowner opts in on your own site and comes back to you — real name, email, what they need. $7 a lead, yours alone, never resold. No shared-lead treadmill. 2-minute demo on a site like yours: [link]. If not relevant, reply "no thanks" and I won't follow up. — {{senderName}}, Consent Resolve · {{physicalAddress}} · Unsubscribe: {{unsubscribeLink}}

**Email 2 — the math (3–4 days, no-reply only).** Subject: `re: the 98%`
> {{firstName}} — following up once. A shared lead from the big platforms runs $35–90 and gets sold to 4–5 contractors. A consent-first lead is $7 and only yours. 2-min demo: [link]. Not for you? Reply and I'll stop. — {{senderName}} · {{physicalAddress}} · Unsubscribe: {{unsubscribeLink}}

**Email 3 — respectful break-up.** Subject: `last one, {{firstName}}`
> I'll leave it here so I'm not cluttering your inbox, {{firstName}}. If recovering the visitors who leave {{companyName}}'s site without calling is ever worth 2 minutes: [link]. Good luck this season. — {{senderName}} · {{physicalAddress}} · Unsubscribe: {{unsubscribeLink}}

Send settings: 20–40/inbox/day, business hours Mon–Fri, open-tracking OFF, stop-on-reply ON, unsubscribe ON.

## Apollo
ICP: title owner/GM/marketing-lead · industry home services (HVAC, roofing, plumbing, electrical, remodeling) · size + geo. Export once → push to: Instantly (email), Meta/LinkedIn custom audiences (ads), LinkedIn (manual engage). Verify emails (<3% bounce). Suppress: customers + unsubscribes everywhere.

## Retargeting (three layers, creative = our explainer videos/reels)
1. Pixel: Meta Pixel + Google tag + LinkedIn Insight Tag on the site → retarget visitors.
2. List: Apollo ICP uploaded as custom audiences → ads to the same people we email.
3. reb2b: identified visitors → retargeting audience + warm follow-up (NOT cold-call — consent-first + TCPA/CIPA).

## Consent-first guardrail
Soft opt-out email · cookie/consent-based retargeting · no cold-calling reb2b-identified people. Practicing it IS the differentiator.
