# Consent Resolve CRM — Phased Ticket Plan

**Derives from:** [BUILD-SPEC.md](BUILD-SPEC.md) (v1)
**Target:** March 1
**Convention:** `LL-*` long-lead (start now, run in parallel) · `P0–P4` phases · each ticket lists **Scope / Reuse / Depends / Done-when / Size** (S≈≤1d, M≈2–3d, L≈1wk+).

> **Build philosophy (from spec §1):** orchestration, not re-implementation. Mirror inbound into D1; send back through the origin tool. We already own Google Workspace, Instantly, Apollo, Crisp — the CRM is connective tissue + pipeline + analytics + profile.

---

## 0. What already exists (reuse map — do NOT rebuild)

| Spec need | Already in the repo | Ticket that consumes it |
|---|---|---|
| Phase 0 "simple auth (6 users)" | Google login → `cr_crm` session (`worker/api/crm-auth.js`, `_lib/auth.js`), allowlist `CRM_ALLOWED_EMAILS` | P0-2 |
| Email adapter (`hello@`) | Gmail OAuth + token store `social_tokens` `gmail:<email>`, send + thread read (`_lib/gmail.js`, `api/crm-gmail.js`) | LL-3, P1-2, P1-3 |
| Apollo enrichment | `APOLLO_API_KEY` + visitor sync (`api/crm-apollo-sync.js`) | P2-5 |
| Crisp inbound | Crisp webhook receiver (`api/crm-crisp.js`) | P2-1 |
| Deals/leads + activity + spend | `crm_leads`, `crm_activity`, `crm_spend` (flat) | P0-4 migration → `deals`/`contacts`/`companies` |
| Cron host | `scheduled()` in `worker/index.js` (Apollo `*/5`, social drip `0 15`) | P1-10 snooze sweep |

---

## LL — Long-lead (kick off TODAY, in parallel with P0)

### LL-1 · Meta App + Lead-Access review  — **Size L (external, weeks–months)**
- **Scope:** Create/verify the Meta app, request `leads_retrieval` + page perms, submit App Review with screencast + use-case. This is the #1 schedule risk (spec §12) and blocks P2-2.
- **Done-when:** App approved for leadgen webhook + Graph lead fetch on the CR page.

### LL-2 · Gmail `watch` + Pub/Sub topic (real-time push)  — **Size M**
- **Scope:** GCP Pub/Sub topic + subscription; `users.watch` on `hello@`; push endpoint. **Deferrable** — MVP uses cron polling (P1-2); this upgrades to push later.
- **Depends:** LL-3.

### LL-3 · Connect `hello@consentresolve.com` to CRM Gmail OAuth  — **Size S**  ⚠️ *prereq for P1-2*
- **Scope:** Mailbox exists (Aaron provisioned it) but is **not yet connected**. Run the existing Settings → "Connect Gmail account" flow for `hello@`; confirm a `social_tokens` row `gmail:hello@consentresolve.com` with a refresh token. Keep `hello@` permanently off the cold-sending domain (spec §12).
- **Done-when:** `/api/crm/gmail/status` lists `hello@` connected; a test send + thread read succeed.

---

## P0 — Foundation

### P0-1 · Normalized D1 schema  — **Size M**
- **Scope:** Create `companies, contacts, contact_identifiers, conversations, messages, deals, users, activities, notes` (spec §3 DDL) **additively**, alongside existing `crm_*` tables (no destructive change). ULID TEXT ids, ISO timestamps, INTEGER cents.
- **Done-when:** Tables + indexes live in `consentresolve-demo`; `ensureCrmSchema` extended.

### P0-2 · Users + roles, bound to Google login  — **Size S**
- **Scope:** Seed ≤6 `users` (Aaron=admin, Tyler=sales, +others); on login, resolve `cr_crm` email → `users.id`; gate by `role`.
- **Reuse:** `crm-auth.js` / `crmSessionEmail`. **Depends:** P0-1.

### P0-3 · Worker plumbing: Queues + KV + ULID + config  — **Size M**
- **Scope:** Bind a normalize **Queue** + a send **Queue** (with retry/DLQ), a KV namespace (enrichment cache, `credentials_ref`), ULID helper, and `FREE_EMAIL_DOMAINS` config list (spec §4).
- **Done-when:** Queues round-trip a test message; KV read/write works.

### P0-4 · ~~Migrate `crm_leads`~~ → **CLEAN SLATE (skipped 2026-06-26)**  — **Size S**
- **Decision:** existing leads are throwaway → **don't migrate; wipe and start fresh.** `/api/crm/migrate?wipe=1` clears legacy `crm_leads`/`crm_activity` + all v2 transactional tables, preserving `users` + `channel_accounts`. v2 model starts empty for P1 ingest.

<details><summary>(original migration ticket, retained for reference)</summary>

### P0-4 · Migrate `crm_leads` → companies/contacts/deals  — **Size M**
- **Scope:** One-time backfill: each `crm_leads` row → contact (+ company by email domain) → deal (`value_cents`, `owner_id`, `lead_status`). Log provenance to `activities`. Idempotent, re-runnable. **No hard-delete** of `crm_leads` (keep as fallback).
- **Depends:** P0-1.

---

## P1 — MVP unified inbox (Gmail `hello@` + Instantly) — *ROI core*

### P1-1 · Channel adapter contract + registry  — **Size S**
- **Scope:** `ChannelAdapter` interface (spec §5): `parseInbound`, `sendReply`, `capabilities`. Registry keyed by `ChannelType`.

### P1-2 · Email adapter — inbound (cron poll)  — **Size M**
- **Scope:** Cron poll `history.list` for `hello@` (reuse Gmail OAuth); parse → `NormalizedInbound[]` → enqueue normalize. (Upgrade to Pub/Sub push = LL-2.)
- **Depends:** LL-3, P1-1, P0-3.

### P1-3 · Email adapter — outbound  — **Size S**
- **Scope:** `messages.send` preserving `threadId` + `References`/`In-Reply-To`; write outbound `messages` row.
- **Reuse:** existing Gmail send. **Depends:** P1-1.

### P1-4 · Instantly adapter — inbound  — **Size M**
- **Scope:** Reply webhook receiver (or poll `GET /api/v2/emails`) → normalize, capturing `eaccount` + `source_detail` (vertical/domain) + `reply_to_uuid`.
- **Depends:** P1-1, P0-3.

### P1-5 · Instantly adapter — outbound  — **Size M**
- **Scope:** `POST /api/v2/emails/reply` with `eaccount` + `reply_to_uuid`. **Critical:** reply out the *same* warmed mailbox/domain the thread arrived on — never `hello@` (deliverability + threading). **Depends:** P1-4.

### P1-6 · Normalize queue consumer + identity write  — **Size M**
- **Scope:** Consume `NormalizedInbound` → identity resolution (P2-3 v0: email/thread match only for MVP) → upsert conversation + message → ping fan-out (stub until P4). **Depends:** P0-3, P1-2/P1-4.

### P1-7 · Inbox UI (list + thread)  — **Size L**
- **Scope:** New `/crm/inbox` page: conversation list (unread, channel chip, assignee, last-msg preview), thread view, assign control. Follows the standalone-page pattern in `crm.js` (path-routed panes; **no `${`/backticks**, **no single-`\` regex** in the client template — see [BUILD-SPEC notes] and the template-literal gotcha).
- **Depends:** P1-6.

### P1-8 · Reply UI + send-to-origin  — **Size M**
- **Scope:** Composer → route through adapter by `conversations.channel` (email→email, instantly→instantly). **Depends:** P1-3, P1-5, P1-7.

### P1-9 · Status machine A/B/C/D  — **Size S**
- **Scope:** Open / Snooze(+`snooze_until`) / Archive(soft) / Convert(→ P3-4). UI actions + `activities` log. **Depends:** P1-7.

### P1-10 · Cron snooze sweep (every 1 min)  — **Size S**
- **Scope:** Add `* * * * *` trigger; `UPDATE conversations SET status='open',unread=1 WHERE status='snoozed' AND snooze_until<=now`; notify assignee.
- **Reuse:** `scheduled()` in `index.js`. **Depends:** P1-9.

### P1-11 · Send queue + retry  — **Size S**
- **Scope:** Route outbound through the send Queue (retry/backoff, DLQ) so a slow origin API doesn't block the UI. **Depends:** P0-3, P1-8.

---

## P2 — Crisp + Meta, identity, profile/enrichment

### P2-1 · Crisp adapter (in/out)  — **Size M** · reuse `crm-crisp.js` webhook. Outbound = REST send-message.
### P2-2 · Meta Lead adapter (inbound only)  — **Size M** · `leadgen` webhook → Graph fetch; `canSend:false`; **reply routed via email** (or "call only" if phone-only). **Depends:** LL-1.
### P2-3 · Identity resolution engine  — **Size L** · `contact_identifiers` match; provisional contacts (anon chat/social); **suggest-merge, never fuzzy-auto-merge** (spec §4).
### P2-4 · Company grouping + manual-assign UI  — **Size M** · domain → `FREE_EMAIL_DOMAINS` skip → Apollo-org fallback → manual. *Free-email is the common path for this ICP — build manual assign early.*
### P2-5 · Profile panel + on-demand Apollo enrich  — **Size M** · reuse Apollo; **button, never auto-on-arrival**; KV cache + TTL; log to `activities`.
### P2-6 · Merge-suggestion UI  — **Size S** · surface P2-3 suggestions; one-click confirm.

---

## P3 — Leads pipeline & board — *ROI core*

### P3-1 · Deals API  — **Size M** · CRUD + `PATCH /deals/:id { close_probability | expected_close_date | lead_status }`; `activities` on change.
### P3-2 · Probability-band board UI  — **Size L** · bands 0–25 / 26–50 / 51–75 / 76–99 / **Won** (client-computed); drag → PATCH prob; cards show company, contact, size, weighted value, close date, owner.
### P3-3 · Close-month forecast toggle  — **Size S** · same board grouped by `strftime('%Y-%m', expected_close_date)`.
### P3-4 · Convert-to-Lead flow  — **Size S** · conversation → `deals` row (company+contact+origin_conversation); `status='converted'`; stays replyable. (Wires into P1-9 action D.)
### P3-5 · Card → linked conversation reply  — **Size S** · open thread from a deal card.

---

## P4 — Presence & analytics (trail launch)

### P4-1 · Presence Durable Object  — **Size M** · one workspace-wide DO; WS heartbeat `{userId,viewing,composing}`; 30s TTL; **soft-lock warn**, don't block.
### P4-2 · New-message fan-out via DO  — **Size S** · after D1 write, ping DO → live inbox update (replaces P1-6 stub).
### P4-3 · Analytics dashboard  — **Size L** · weighted forecast by month; source/vertical attribution; funnel (conv→lead→won); per-owner (active, weighted, win-rate); per-rep activity; **speed-to-lead** (inbound→first outbound) per rep & source — the key operational metric.

---

## Critical path & sequencing

```
TODAY (parallel):  LL-1 Meta review ───────────────────────────────► (gates P2-2)
                   LL-3 connect hello@ ──► P1-2
                   P0-1 schema ──► P0-2, P0-4, (all of P1)

Then:  P0 ─► P1 (MVP inbox: hello@ + Instantly)  ─► P3 (pipeline)  ─► P2 (Crisp/Meta/identity)  ─► P4 (presence/analytics)
```

- **P1 + P3 are the ROI core** (spec §11); P2 identity depth and P4 presence/analytics can trail the first usable release.
- **MVP cut line:** P0 + P1 (Gmail `hello@` + Instantly inbound→inbox→reply→status/snooze) is the first thing the team can use daily.
- **Defer for MVP:** Gmail Pub/Sub push (LL-2 → poll first), full identity resolution (P1-6 uses email/thread match v0; P2-3 adds the engine), presence (P1-6 fan-out stubbed).

## Decisions — RESOLVED (2026-06-26)
1. **`users` roster** — **Andy, Aaron, Tyler, Jason** (already CRM-allowlisted). Seed `users` from these. Assumed: emails `<first>@consentresolve.com`, roles `aaron=admin`, others `sales` — *Aaron to correct any exec role* (P0-2).
2. **Instantly inbound** — **nothing is set up yet.** So P1 Instantly inbound is itself a setup ticket: either (a) configure a reply **webhook** in Instantly → our receiver, or (b) **poll `GET /api/v2/emails`** with an `INSTANTLY_API_KEY` secret (recommended — no Instantly-side config). Until then, **MVP launches on `hello@` Gmail alone** (P1-2/P1-3); Instantly (P1-4/P1-5) folds in once the key/webhook exists.
3. **Meta — IN SCOPE.** ⇒ **LL-1 (Meta App + Lead-Access review) is active and starts today** (long-lead, gates P2-2).
