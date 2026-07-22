# Consent Resolve CRM — Current State (rebuild reference)

> As-built inventory of the CRM as it exists today, for a ground-up rebuild. Supersedes the
> Jul-6 `SPEC.md`/`BUILD-SPEC.md`, which predate most of what's now shipped (Gmail two-way,
> Meta lead webhook, Instantly, GBP, Google Ads, social autopost, the SEO stack).
> Generated 2026-07-22 from a full read of `worker/`.

---

## 0. Platform & infrastructure

- **Runtime:** one Cloudflare Worker, `worker/index.js`. Routes under `/api/*`; everything else
  falls through to the static Astro build via the **`ASSETS`** binding (`./dist`).
- **Data:** Cloudflare **D1** (binding `DB`, database `consentresolve-demo`, id `4693a387-…`).
- **Media:** Cloudflare **R2** (binding `MEDIA`, bucket `cr-social`), served same-origin at `/cdn/*`.
- **Routing:** `ROUTES` is a **flat exact-pathname map** — no path params; every id travels as
  `?id=` or a JSON body field. The dispatcher only calls `onRequestOptions` / `onRequestGet` /
  `onRequestPost`; other methods → `405`. Missing `env.DB` → `503 demo_unconfigured`. Uncaught
  errors → `500 {error:"server"}`. **No central auth middleware** — every handler self-gates.
- **Schema is self-creating:** most tables are `CREATE TABLE IF NOT EXISTS` at runtime
  (`ensureCrmSchema` / `ensureCrmV2Schema`, plus several handlers create side tables inline).
  Only 3 `.sql` files exist (`schema.sql`, `social-queue.sql`, `social-tokens.sql`).
- **Cron triggers** (`wrangler.jsonc` → `triggers.crons`, branched in `scheduled()`):

  | Cron (UTC) | Runs |
  |---|---|
  | `*/5 * * * *` | Ingest/sync loop: Apollo visitor sync, Gmail inbox poll, Crisp backfill, Instantly reply poll (100), snooze resurfacing, deferred demo-notify (~12 min), Apollo auto-enrich (8). Time-gated inside: Meta spend sync @ 3/9/15/21h; Instantly lead-status sync (HVAC `db0041db…`) @ 6/18h. |
  | `0 15 * * *` (~10am ET) | SEO IndexNow submit; **Mondays** also GSC weekly email digest; then the social drip. |
  | `0 23 * * *` (~6pm ET) | Social drip (2nd run). |

  **Social drip** iterates `LAUNCH_PLATFORMS = ["x","google_business_profile","linkedin_company"]`,
  no-op unless `SOCIAL_AUTOPOST_ENABLED === "true"`. Cadence: X daily; GBP ≤ `GBP_POSTS_PER_DAY`
  (default 2)/day; `linkedin_company` Mon & Thu, every 2 days. `facebook` is deliberately excluded
  (owned by `scripts/run_cards.py` to avoid double-posting).

---

## 1. Auth model

**Two separate credential systems** (HMAC-signed cookies + shared keys) plus a webhook token.
All cookie logic in `worker/_lib/auth.js`; HMAC uses `ADMIN_SESSION_SECRET`. **No CSRF token**
(relies on `SameSite=Lax` + JSON `Content-Type`; frontend sends `credentials:"same-origin"`).

**Path 1 — Interactive CRM session (Google OAuth → `cr_crm` cookie)** — `worker/api/crm-auth.js`,
routes `/api/crm/auth/{login,callback,logout,me}`:
1. `login` → Google consent (`openid email profile`), reuses the Gmail OAuth client
   (`GMAIL_CLIENT_ID`/`GOOGLE_CLIENT_ID` + secret); `hd=` scoping if `CRM_ALLOWED_DOMAIN` set.
2. `callback` → exchange code, decode `id_token` (trusted TLS, no local sig check).
3. **Allowlist gate** — email must be present + `email_verified`; at least one gate must be
   configured or all sign-in is denied. Gates: `CRM_ALLOWED_DOMAIN` (Workspace `hd`) and/or
   `CRM_ALLOWED_EMAILS`. Denied → 403 page.
4. Success → HMAC token in cookie **`cr_crm`** (`HttpOnly; Secure; SameSite=Lax; Path=/;
   Max-Age=30d`). Path `/` reaches both `/crm` and `/api/crm/*`.
5. `logout` clears it; `me` returns `{email, apolloUsed}` (apolloUsed = `activities.action='enriched'`
   this month). Signed-in email → a `users` row (`currentUser`); admin role (`isAdmin`) gates
   destructive ops.

**Older cookie — `cr_admin`** (the `/admin` password login, `ADMIN_PASSWORD`, `Path=/admin`, 12h).
`crmAuthed()` accepts **either** an admin session **or** a valid `cr_crm` email.

**Path 2 — Ops / actuator keys (`?key=` shared secrets):**
- `crmKey(env)` = `CRM_KEY || DASHBOARD_KEY || "cr-dash-2026"` — OAuth `state` in connect flows;
  legacy `?key=` the SPA appends to nav (mostly vestigial — see below).
- `crmWebhookToken(env)` = `CRM_WEBHOOK_TOKEN || crmKey(env)` — inbound webhook gate.
- `FEEDBACK_KEY` — separate ops/maintenance key.

| Auth | Endpoints |
|---|---|
| `crmAuthed` (cookie only) | leads, analytics, analytics2, spend, social, social/scores, contact, deals, enrich, merge, presence, status, meta/spend |
| `crmAuthed` + `isAdmin` | migrate (incl. destructive wipe), parts of inbox (`?debug`) |
| `?key=CRM_WEBHOOK_TOKEN` (no cookie; also `Bearer`) | crisp, apollo, demo-notify, instantly (webhook/campaign/leadtokens) |
| `crmAuthed` OR `?key=FEEDBACK_KEY` | gmail (maint), social/promote, meta/audience, meta/launch |
| `crmKey` as OAuth `state` | gmail/auth, gbp/auth, gads/auth |

> **Gotcha for the rebuild:** `crmAuthed()` does **not** honor `?key=` — cookie only. The `?key=`
> the SPA appends to cookie-gated data calls is vestigial; it only matters for the webhook/connect/
> maintenance routes above.

**Presence** (`crm-presence.js`): D1 heartbeat table (not a Durable Object), 35s freshness, GC >600s.
Frontend beats every 20s; shows "👁 X is also viewing." Sized for ~6 users.

---

## 2. Data model

**Two lead models coexist** — a rebuild should decide whether to unify:
- **v1 (legacy, `_lib/crm.js`):** flat `crm_leads` + `crm_activity` + `crm_spend`. Still system of
  record for **Leads**, **Analytics v1**, **Spend/ROAS**, **Social calendar**.
- **v2 (normalized, `_lib/crm-v2.js`):** `companies / contacts / contact_identifiers / conversations /
  messages / deals / users / activities / notes / channel_accounts`. Powers **Inbox**, **Pipeline**,
  **Analytics2**, **Contact 360**, presence, enrichment. IDs are app-generated **ULIDs**.
- `api/crm-migrate.js` = idempotent v1→v2 backfill, or `?wipe=1&confirm=ERASE` clean-slate
  (clears transactional rows, preserves `users` + `channel_accounts`).

### Demo tables (`worker/schema.sql`)
- **`participants`** (PK `id`=demo_token uuid): `name`, `email`(idx), `business_name`, `phone`,
  `trade`, `consent_contact`(int), `status` (registered|visited|consented|emailed|enrolled),
  `sample_page`, `consent_text_version`, `ip`, `user_agent`, `created_at`, `visited_at`,
  `consented_at`, `emailed_at`, `enrolled_at`; idx `(ip,created_at)` for rate-limiting.
- **`events`** (PK `id` AUTOINCREMENT): `participant_id`→participants(idx), `event_type`
  (registered|visited|consented|emailed|enrolled|error), `metadata`(JSON), `created_at`.

### Social tables
- **`social_queue`** (`social-queue.sql`) — PK `id` AUTOINCREMENT, **UNIQUE(resource_slug, platform)**:
  `resource_slug`, `resource_type`, `platform`, `status` (ready_to_publish|scheduled|published),
  `scheduled_at`, `published_at`, `post_url`, `post_id`, `payload`(JSON), `created_at`, `updated_at`;
  idx on `status`, `resource_slug`. **Drained strictly `ORDER BY id ASC`** (FIFO).
- **`social_tokens`** (`social-tokens.sql`) — **PK `provider`**: `access_token`, `refresh_token`,
  `expires_at`, `updated_at`. Providers: `x`, `google` (GBP), `google_ads`, and Gmail as
  `gmail:<email>`. **The single OAuth store for every integration.**
- **`social_promote_queue`** (created in `crm-social-promote.js`): `id`, `name`, `platform`,
  `mode` (paid|organic), `status` (default queued), `created_at`.

### v1 CRM tables (`_lib/crm.js`)
- **`crm_leads`** — PK `id`, **UNIQUE(email)**: `source` (instantly|demo|crisp|rb2b|manual|apollo),
  `industry`, `name`, `email`, `phone`, `company`, `domain`, `owner`, `stage`
  (new|contacted|qualified|demo|proposal), `status` (open|won|lost|closed, soft-delete `deleted`),
  `value_usd`, `consent_status` (consented|identified|unknown — **`identified` = intel/retargeting
  only, blocked from outreach**), `utm_source`, `utm_campaign`, `notes`, `created_at`, `last_activity`.
  Synced from `participants` by email.
- **`crm_activity`** — PK `id`; `lead_id`, `type`, `body`, `actor`, `at`.
- **`crm_spend`** — PK `id`; `industry`, `channel`, `amount_usd`, `period`, `note`, `created_at`
  (Meta rows tagged `note` starting `meta:`).

### v2 CRM tables (`_lib/crm-v2.js`) — ULID PKs; company grouping skips `FREE_EMAIL_DOMAINS`
- **`companies`**: `id`, `name`, `domain`(idx), `apollo_org_id`, `enrichment`(JSON), timestamps.
- **`contacts`**: `id`, `company_id`→companies(idx), `full_name`, `primary_email`(idx), `phone`,
  `title`, `apollo_person_id`, `enrichment`(JSON), `source`, `is_provisional`(int; 1=anon chat/social
  w/o email), timestamps.
- **`contact_identifiers`** — cross-channel identity map: `id`, `contact_id`→contacts, `type`
  (email|phone|crisp_session|meta_psid|…), `value`, `verified`, **UNIQUE(type,value)** (dedup guard).
- **`channel_accounts`**: `id`, `channel`, `label`, `external_account_id`, `credentials_ref`,
  `is_active`.
- **`conversations`** — one per (channel, external_thread_id): `id`, `contact_id`, `company_id`,
  `channel` (email|instantly|crisp|meta_lead|demo_form), `source_detail`, `channel_account_id`,
  `external_thread_id`, `subject`, `status` (open|snoozed|archived|converted), `snooze_until`,
  `assignee_id`→users, `unread`, `last_message_at`, `last_message_preview`, timestamps.
- **`messages`**: `id`, `conversation_id`→conversations(idx w/ sent_at), `direction` (in|out),
  `channel`, `author_id`, `external_message_id` (dedup), `in_reply_to_external`, `body_text`,
  `body_html`, `attachments`(JSON), `sent_at`, `created_at`.
- **`deals`**: `id`, `company_id`→companies, `primary_contact_id`→contacts,
  `origin_conversation_id`→conversations, `owner_id`→users, `title`, `value_cents`,
  `close_probability` (0–100), `expected_close_date`, `lead_status` (active|won|lost), `won_lost_at`,
  timestamps. Pipeline bands 0–25/26–50/51–75/76–99/Won ↔ stored probs 13/38/63/88/won.
- **`users`**: `id`, `name`, `email` UNIQUE, `role` (admin|sales), `active`, `created_at`.
  Seeded: Aaron (admin), Andy/Tyler/Jason (sales), all @consentresolve.com.
- **`activities`** — v2 audit: `id`, `actor_id`→users, `entity_type`, `entity_id`, `action`,
  `meta`(JSON), `created_at`. (`crm-auth /me` counts `action='enriched'` as the Apollo-credit proxy.)
- **`notes`**: `id`, `author_id`, `conversation_id`, `contact_id`, `body`, `created_at`.

### Handler-created side tables
- **`presence`** (`crm-presence.js`): PK `email`; `name`, `viewing`, `updated_at`.
- **`visitor_links`** (`crm-inbox.js`): `vid`, `contact_id`, `email`, `created_at`, UNIQUE(vid,contact_id).
- **`crm_suppressions`** (`_lib/instantly.js`): PK `email`; `reason`, `source`, `created_at` (do-not-contact).
- **`instantly_leads`**, **`indexnow_log`**, and first-party **`traffic`** (attribution) — touched by integrations.

### Relationships
```
participants ─(email)→ crm_leads ─(migrate)→ companies ─< contacts ─< contact_identifiers
users ─< deals >── companies                              │
users ─< conversations(assignee) ─< messages              │
conversations ── contact_id/company_id ───────────────────┘
conversations ─< notes ;  deals ── origin_conversation_id
activities → any (entity_type,entity_id) ;  presence/visitor_links/crm_suppressions keyed by email
```

---

## 3. API endpoint catalog (30 routes)

Exact-path router; ids as `?id=`/body. Every session handler calls `ensureCrmV2Schema` on entry.

### Leads & Contacts
- **`GET /api/crm/leads`** (session) — list v1 leads (`?industry=`,`?source=`) or one (`?id=` →
  `{lead,activity,events}`). Reads `crm_leads`.
- **`POST /api/crm/leads`** (session) — `{create:true,email,…}` upsert+note / `{action:"delete",id}` /
  `{id,stage?,status?,value?,owner?,note?}` update. **Guardrail:** `consent_status="identified"` +
  outreach stage → `403 consent_blocked`. Writes `crm_leads`,`crm_activity`.
- **`GET /api/crm/contact?id=`** (session) — Contact 360: `{contact,company,conversations,deals,
  timeline,stats}` (stats incl. `speed_to_lead_hours`). Reads v2 + `visitor_links`,`traffic`.
- **`POST /api/crm/contact`** (session) — edit `{id,company_name?,full_name?,title?,phone?}`;
  company_name → findOrCreateCompany + syncs `conversations.company_id`; logs `edited`.
- **`GET /api/crm/merge`** (session) — dupe-merge suggestions (shared name or normalized phone).
- **`POST /api/crm/merge`** (session) — `{from_id, into_id|into_email}` → repoint identifiers/
  conversations/deals, delete source, log `merged`.

### Inbox & Conversations
- **`GET /api/crm/inbox`** (session; `?debug` admin) — `?poll=1` Gmail ingest; `?debug=1` recent mail;
  `?id=` single conv (`{conversation,messages,contact,company,users,notes,demo,intel,webIntel,paid,
  coldEmail,suppressed}`, live-pulls Crisp, parses web-intel note, marks read); default = open list (200).
- **`POST /api/crm/inbox`** (session; body `id`) — `{reply}` (routes by channel: email→Gmail;
  meta_lead/demo_form→new Gmail w/ CAN-SPAM + List-Unsubscribe; instantly→sendInstantlyReply;
  crisp→sendCrispMessage) / `{assignee_id}` / `{note}` / `{convert:true}` (creates deal, sets
  conv `converted`) / `{status,snooze_days?}`. Cron helper `sweepSnoozed`.

### Deals & Pipeline
- **`GET /api/crm/deals`** (session; `?include=all`) — `{deals,users}` (joined names); bands computed
  client-side from `close_probability`.
- **`POST /api/crm/deals`** (session) — `{create:true,company_id,…}` / update `{id,close_probability,
  expected_close_date,value_cents,lead_status,title,owner_id}`; won/lost stamps `won_lost_at`; logs.

### Analytics & Reporting
- **`GET /api/crm/analytics`** (session) — v1 per-industry funnel visits→leads→demos→won + CPL/CAC/
  win-rate/ROAS (`computeAnalytics`).
- **`GET /api/crm/analytics2`** (session) — v2 `{forecast,attribution,byOwner,funnel,speedToLead,totals}`
  from deals/conversations/messages/users.

### Spend / ROAS
- **`GET /api/crm/spend`** (session) — `{spend}` from `crm_spend`.
- **`POST /api/crm/spend`** (session) — add `{amount_usd,…}` / delete `{delete:true,id}`.

### Social
- **`GET /api/crm/social`** (session) — calendar `{posts}` from `social_queue`.
- **`GET /api/crm/social/scores`** (session) — creative scoring from R2 `social/metrics.json` +
  `channel-stats.json` (no D1); warm-up grades + leaderboard.
- **`GET/POST /api/crm/social/promote`** (session OR `?key=FEEDBACK_KEY`) — read/flag/mark/unflag
  the winner-amplification queue (`social_promote_queue`).

### Apollo / Enrichment
- **`POST /api/crm/enrich`** (session; needs `APOLLO_API_KEY`) — on-demand Apollo people/org match →
  caches on `contacts.enrichment`/`companies.enrichment`; logs `enriched`.
- **`POST /api/crm/apollo`** (`?key=CRM_WEBHOOK_TOKEN`) — identified-visitor webhook → `upsertLead`
  (`source=apollo`, `consent_status=identified`). Always 200.
- **`GET /api/crm/apollo/sync`** (session; needs key) — `?test=1` verify / `?run=1` pull an Apollo
  Contacts list into `crm_leads` (dedup). Cron `runScheduledSync`.

### Misc / Ops
- **`GET /api/crm/status`** (session) — integration health + pipeline freshness (reads `social_tokens`,
  `social_queue`, R2 metrics).
- **`GET/POST /api/crm/presence`** (session) — who's viewing what (35s window).
- **`POST /api/crm/demo-notify`** (`?key=CRM_WEBHOOK_TOKEN`) — manual demo-signup notification sweep.
- **`POST /api/crm/instantly/leadtokens`** (`?key=CRM_WEBHOOK_TOKEN`; needs `INSTANTLY_API_KEY`) —
  mint `?ld=` prefill tokens, write to each lead's `custom_variables.crid` (`?run=1` to PATCH).
- **`/api/crm/migrate`** (session+admin) — v1→v2 backfill / destructive wipe.
- **`/api/crm/auth/{login,callback,logout,me}`** — Google CRM sign-in (issues `cr_crm`).
- Integration routes (see §5): `/api/crm/gmail/*`, `/crisp`, `/instantly*`, `/meta*`, `/gbp/*`, `/gads/*`.

---

## 4. Frontend feature map

**Architecture:** `worker/crm.js` renders ONE Worker page — all CSS + JS inlined, **vanilla JS, no
framework, no build step.** Dark theme (navy `#0a1628`/mint `#00e5a0`). Injects the rep's name via
`__CR_ME__`. Unauth → `LOGIN_HTML` (401) with a "Sign in with Google" button.

**Routing:** each tab is a **real URL** `/crm/<section>` (not hash). JS reads `pathname.split("/")[2]`,
toggles `[data-pane]`, lazy-loads that section's data. Global `api(path)` appends `?key=` and sends
`credentials:"same-origin"`. `presenceBeat()` every 20s. Tabs: **Inbox · Pipeline · Analytics · Spend ·
Social · Status · Settings · What's Live** (+ hidden legacy `leads`, `industry`).

- **Inbox** (`/crm/inbox`, default) — 3-column Gmail-style: list (filter, search, sync button,
  channel badges, unread dot, 🔥 HOT when `fit:hot`) | thread (bubbles; Convert-to-Lead, Snooze,
  Archive, Reopen, Assign, note; reply composer with 4 templates + CAN-SPAM sig for meta_lead/demo_form)
  | intel panel (Apollo photo, suppression banner, web-intel HOT/WARM/VERIFY card, paid-lead cost badge,
  cold-email badge, tiles, demo progress, pages-viewed, Enrich + Set-company). Co-viewer presence line.
- **Contact 360** (in-Inbox drill) — `/api/crm/contact`: cross-channel history, stat tiles, deals,
  unified timeline; **merge into…** another contact.
- **Pipeline** (`/crm/pipeline`) — `/api/crm/deals`; kanban, **drag-drop** between probability bands
  (or close-month view); click → edit status/prob/value/date. Header = count + weighted total.
- **Analytics** (`/crm/analytics`) — `/api/crm/analytics2`: tiles, weighted forecast-by-month bars,
  source/vertical attribution table, by-owner table.
- **Spend/ROAS** (`/crm/roas`) — `/api/crm/analytics` + Meta live (`/meta/spend`, sync button) +
  Cold-email funnel + sending-inbox health (`/instantly?funnel=1&health=1`); spend list add/delete.
- **Social** (`/crm/social`) — `/api/crm/social/scores`: warm-up grade cards, creative leaderboard,
  promotion queue (`/social/promote`), GBP block.
- **Status** (`/crm/status`) — `/api/crm/status`: integration dots, GBP connect (`/gbp/*`), Google Ads
  connect (`/gads/*`), last/next post, schedule grid.
- **Settings** (`/crm/settings`) — `/api/crm/gmail/status`: connected Gmail accounts, + Connect Gmail,
  redirect URI; merge-suggestions helper.
- **What's Live** (`/crm/live`) — Instantly campaign + Meta campaigns roll-up (LIVE/paused badges, MTD).
- **Legacy (DOM, not nav):** flat **Leads** list (v1 CRUD + inline Gmail thread) and **Industry** funnel.

---

## 5. Integrations catalog

Every provider is **inert/no-op until its secret(s) are set**, and all OAuth providers share the
**`social_tokens`** store with the same in-CRM browser re-auth pattern (`state` = CRM key). Preserve
this shape in the rebuild.

1. **Gmail — two-way email (unified inbox).** OAuth2 (`gmail.readonly`, `gmail.send`, `openid`,`email`),
   `GMAIL_CLIENT_ID/SECRET` (or `GOOGLE_*`), token as `gmail:<email>`; `CRM_INBOX_EMAILS`
   (default hello@consentresolve.com). Inbound poll (`in:inbox newer_than:14d`, `*/5` cron) →
   contacts/conversations/messages; outbound `sendMessage`. Files `_lib/gmail.js`, `api/crm-gmail.js`,
   `api/crm-inbox.js`. CRLF-guarded, RFC-2047 headers.
2. **Meta Lead Ads webhook → CRM.** Webhook (`leadgen`), GET verify `META_VERIFY_TOKEN`
   (default `cr-leadgen-verify-2026`), POST HMAC `META_APP_SECRET`. Lead fetch via
   `FB_PAGE_TOKEN|META_PAGE_TOKEN|META_ACCESS_TOKEN`. `leadgen_id` → field_data → SSRF-guarded fetch
   of the lead's website → `scanWebsite`+`checkTrade` intel note → contacts/conversations(channel
   `meta_lead`, `source_detail` `form:…|trade:…|site:…|fit:…`)/message/note. `api/crm-meta.js`.
   **Gap: creates contact+conversation+note only — NO auto-reply, NO deal, NO owner.** Replies go by
   email (never Messenger).
3. **Meta Marketing API — ads/audiences/launch.** Bearer `META_ACCESS_TOKEN` + `META_AD_ACCOUNT_ID`
   (v21.0), `FACEBOOK_PAGE_ID`. Spend `/insights` → `crm_spend` (`meta:<id>:<name>`); status; SHA-256
   emails → Custom Audiences; launch lead-form / conversion campaigns **PAUSED**, activate, delete.
   `_lib/meta.js`, `api/crm-meta-ads.js`,`-audience.js`,`-launch.js`.
4. **Meta Conversions API (CAPI) + Pixel.** Outbound server `Lead` events, `META_CAPI_TOKEN`
   (or `META_ACCESS_TOKEN`), `META_PIXEL_ID` (default `1611275646787663`). Fires only after the
   consent-gated browser Pixel (same `event_id` dedup). `api/meta-capi.js`. Consent-critical.
5. **Instantly — cold email (reply ingest + ops).** Bearer `INSTANTLY_API_KEY` (v2, **needs browser
   UA**), webhook `?key=CRM_WEBHOOK_TOKEN`. Replies → conversations(channel `instantly`); lead sync →
   `instantly_leads` + `crm_suppressions`; wave-funnel ROAS; campaign copy PATCH; lead prefill tokens.
   `_lib/instantly.js`, `api/crm-instantly.js`,`-campaign.js`,`-lead-tokens.js`. HVAC campaign id
   hardcoded `db0041db-…`.
6. **Crisp — live chat.** Webhook `?key=CRM_WEBHOOK_TOKEN` + REST plugin Basic auth
   (`CRISP_IDENTIFIER:CRISP_KEY`, `X-Crisp-Tier: plugin`, `CRISP_WEBSITE_ID`). Chats → contacts/
   conversations(channel `crisp`)/messages (+ legacy `crm_leads`). `*/5` REST backfill for missed
   webhooks. `api/crm-crisp.js`.
7. **Apollo — lead sourcing + enrichment.** `APOLLO_API_KEY` (`X-Api-Key`). Webhook → identified
   `crm_leads` (`consent_status=identified`, blocked from outreach); list-sync (`APOLLO_CONTACTS_LABEL`);
   people/org enrich (credit-gated, button + capped sweep, requires paid plan). Leadsy.ai vtag feeds
   Apollo's "Visited people" (RB2B was the predecessor, removed). `api/crm-apollo.js`,`-apollo-sync.js`,
   `crm-enrich.js`.
8. **Google Business Profile — posting + connect.** OAuth2 (`business.manage`), token as `google`;
   `GBP_ACCOUNT_ID`/`GBP_LOCATION_ID`/`GBP_POSTS_PER_DAY`. Drains `social_queue` → `postGBP` (localPosts,
   text-only retry). `api/crm-gbp-auth.js`, `api/gbp-status.js`, `postGBP` in `_lib/publish.js`.
   Historically blocked on GBP API approval (quota=0).
9. **Google Ads — conversions/read.** OAuth2 (`adwords`), token as `google_ads`;
   `GOOGLE_ADS_DEVELOPER_TOKEN`/`LOGIN_CUSTOMER_ID`/`CUSTOMER_ID`, version auto-probed. Reads
   `conversion_action` + access status. `api/crm-gads-auth.js`, `_lib/google-ads.js`.
   **Dev token Test-access until Google grants Basic; offline-conversion upload not yet implemented.**
10. **Google Search Console + GA4 — SEO dashboard.** **Service-account** RS256 JWT (WebCrypto),
    `webmasters.readonly` + `analytics.readonly`; `GSC_CLIENT_EMAIL`/`GSC_PRIVATE_KEY`/`GSC_SITE_URL`/
    `GA4_PROPERTY_ID`. `/api/seo/{overview,queries,pages,digest,aeo}`, `_lib/google-sa.js`, `api/seo.js`.
    Pending SA secrets per project state.
11. **IndexNow.** `INDEXNOW_KEY` var (`0452ce…`, key file at `/{key}.txt`). Reads sitemap via ASSETS
    binding, dedupes vs `indexnow_log`, submits to Bing/Yandex. Daily cron + `POST /api/seo/indexnow`.
    **Live.**
12. **Buffer — LinkedIn (interim)/TikTok.** Bearer `BUFFER_TOKEN` + `BUFFER_LINKEDIN_CHANNEL`, GraphQL
    `shareNow`. `ADAPTERS.linkedin_company` → `postLinkedInBuffer`. Native `ugcPosts` coded but **not
    approved** — repoint when approved. `_lib/publish.js`.
13. **X / Twitter.** OAuth2 `tweet.write`, `X_CLIENT_ID/SECRET/X_REFRESH_TOKEN`, token as `x`.
    **Refresh token rotates every use — must be persisted** (cron + `x-status?refresh=1` do this).
    `postX`; metrics `/api/x-metrics`, `/api/x-status`, one-shot `/api/x-trigger`. **Live.**
14. **Social autopost queue + cron.** `/api/social-queue` gated by `X-CR-Automation-Key`=
    `CR_AUTOMATION_KEY` (fails closed 503). `publishNextLive` drips 1 row/platform/run (FIFO), VoC ads
    ~1-in-4, liveness-checks URLs, parks dead links, dispatches via `ADAPTERS`. `_lib/publish.js`,
    `_lib/queue.js`, `api/social-queue.js`.

**Supporting:** **Resend** (`RESEND_API_KEY`) — demo-signup notifications + SEO digest; `FROM_EMAIL`
currently `hello@tryconsentresolve.com` (consentresolve.com DNS verification failed), `REPLY_TO`
hello@consentresolve.com. **Turnstile** (`TURNSTILE_SECRET`) — bot check. **Front-end tags** (consent-
gated via Usercentrics/Termageddon): Meta Pixel, GA4/GTM, Clarity, Leadsy.ai — all in
`src/layouts/BaseLayout.astro`.

---

## 6. Known gaps & rebuild considerations

1. **No follow-up engine (highest priority).** Meta lead / demo / most inbound ingests create a
   contact + conversation only — **no auto-reply, no deal, no owner, no SLA timer.** This is the #1
   reason paid leads don't convert. A rebuild should make "on new lead → acknowledge + assign + create
   deal + start a timer" a first-class, channel-agnostic pipeline.
2. **Unify the two lead models.** v1 `crm_leads` and v2 `contacts/conversations/deals` overlap and
   drift. Pick one (v2 is the richer target); migrate v1 consumers (Analytics v1, Spend, Social
   calendar, legacy Leads UI).
3. **Preserve the consent guardrail.** `consent_status="identified"` (Apollo/Leadsy visitors) must stay
   blocked from outreach stages — this is load-bearing for the consent-first positioning.
4. **OAuth token store is a good pattern** — one `social_tokens` table + in-CRM browser re-auth
   (`state`=key). Keep it; add rotation-persistence for single-use refresh tokens (X).
5. **Auth: drop the vestigial `?key=` on cookie routes;** keep the webhook-token and actuator-key paths
   explicit and consistent. Consider real CSRF if the surface grows.
6. **Self-creating schema** is convenient but undocumented — a rebuild should ship real migrations.
7. **Frontend is one inlined vanilla-JS file** — fine for a solo tool, but a framework + component
   split would help as features grow. All data flows through the ~20 `/api/crm/*` endpoints listed above.
8. **Integrations pending activation:** GBP API approval (quota), Google Ads Basic access, GSC/GA4 SA
   secrets, native LinkedIn approval. The code is ready; they're credential/approval-gated.
