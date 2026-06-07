# Consent Resolve — Live Demo (in-repo)

A ~60-second self-demo that lives **inside the main site** (no separate project):
register → browse a sample trades site as a visitor → accept the consent banner →
get emailed the exact "new lead" notification a business owner receives — except
the lead is *you* — then auto-enroll in a sales follow-up.

## How it's wired

The marketing site is a static Astro build served by Cloudflare's **Worker static
assets**. We added a Worker entry (`worker/index.js`) to the same project:

- `/api/*` → handled by the Worker (the demo backend).
- everything else → falls through to the `ASSETS` binding (the static Astro site,
  served exactly as before — asset-first by default, so existing pages are
  untouched).

Because the form and API are now **same-origin** (`consentresolve.com`), there's
no CORS or cross-domain cookie hop — a simplification over the original spec,
which assumed a separate `demo.consentresolve.com` project.

```
worker/
  index.js            Worker entry: routes /api/* , else ASSETS
  api/{register,visit,consent,status}.js
  _lib/{db,email,sales,trades,turnstile,http}.js
  schema.sql          D1 schema
src/pages/demo/
  index.astro         demo landing + registration (?trade= pre-fill) [noindex]
  sample.astro        fictional trades site + consent banner          [noindex]
  done.astro          confirmation + live status polling              [noindex]
  error.astro         no-JS fallback error page                       [noindex]
src/components/DemoForm.astro   reusable <DemoForm trade="hvac" /> (same-origin)
```

State machine (a row in `events` on every transition):
`registered → visited → consented → emailed → enrolled`.

## Locked positioning applied

This demo follows the locked voice (see `.docs/voice.md`):

- **Flat $7 a lead** — no "$10 starter / 10 leads for $10" anywhere.
- **Contractor-only**, consent-first framing.
- **Email-first lead card** — the reveal email shows name + consented email +
  business + what they shopped for. It does **not** deliver a phone number,
  because the real product never hands you a number to cold-call.

## Enable the backend (one-time)

The D1 binding ships **commented out** in `wrangler.jsonc` so a placeholder id
can't fail the whole site's deploy. Until you enable it, `/api/*` returns a clean
`503` and the static site is unaffected.

```bash
# 1. Create D1 and apply the schema
wrangler d1 create consentresolve-demo
wrangler d1 execute consentresolve-demo --remote --file=./worker/schema.sql

# 2. In wrangler.jsonc: paste the database_id and UNCOMMENT the d1_databases block.

# 3. Set secrets (Worker secrets)
wrangler secret put RESEND_API_KEY
wrangler secret put TURNSTILE_SECRET     # optional; if unset, Turnstile is skipped
wrangler secret put SALES_WEBHOOK_URL    # Make.com webhook
wrangler secret put TEAM_NOTIFY_URL      # optional Slack/email ping

# 4. Turnstile site key for the form (build-time, public):
#    set PUBLIC_TURNSTILE_SITE_KEY in the Cloudflare build env vars.
#    (If unset, the form renders without the widget and still works.)

# 5. Push to main — Cloudflare builds (astro build) and deploys the Worker.
```

Non-secret vars already in `wrangler.jsonc`: `FROM_EMAIL`, `REPLY_TO`,
`EMAIL_MODE` (owner|customer), `SAMPLE_PATH`, `CONSENT_TEXT_VERSION`,
`ALLOWED_ORIGINS`.

### Resend
Verify the `consentresolve.com` sending domain (SPF + DKIM). Sender defaults to
`demo@consentresolve.com`, reply-to `sales@consentresolve.com`.

### Make.com
Webhook trigger → CRM upsert → drip sequence. Set the URL as `SALES_WEBHOOK_URL`.
Payload: `{ source:"live_demo", demo_token, name, email, business_name, phone,
trade, consent_contact, consented_at, sample_page, status:"enrolled" }`.

## Embedding the form elsewhere

Drop the component on any page (homepage, pricing, a trade vertical):

```astro
---
import DemoForm from "~/components/DemoForm.astro";
---
<DemoForm trade="hvac" />
```

It posts to `/api/register`, works with zero JS (native POST → 302), and upgrades
to a JSON fetch + redirect when JS is on. The `trade` pre-fills the sample site
and reveal email ("Summit Plumbing Co." → "Summit Roofing Co.", etc.).

## Funnel query

```sql
SELECT status, COUNT(*) AS n FROM participants GROUP BY status;

-- recent runs
SELECT name, email, business_name, trade, status, created_at, consented_at, enrolled_at
FROM participants WHERE created_at >= datetime('now','-1 day') ORDER BY created_at DESC;

-- errors by stage
SELECT json_extract(metadata,'$.stage') AS stage, COUNT(*) n
FROM events WHERE event_type='error' GROUP BY stage;
```

## PII / retention
Demo data only. Purge periodically:
```sql
DELETE FROM participants WHERE created_at < datetime('now','-90 days');
DELETE FROM events WHERE participant_id NOT IN (SELECT id FROM participants);
```

## Acceptance checklist
- [ ] D1 created, schema applied, binding uncommented with real id
- [ ] Secrets set (Resend, Turnstile, Sales webhook)
- [ ] `PUBLIC_TURNSTILE_SITE_KEY` set in build env; apex + www added to the widget
- [ ] Resend sending domain verified (SPF/DKIM)
- [ ] Register → redirect to `/demo/sample/?dt=` works (JS on AND off)
- [ ] Sample site themes to the trade; consent banner is not pre-checked
- [ ] Accept → reveal email arrives within seconds showing your own details
- [ ] Make.com scenario fires with the full payload
- [ ] Funnel query shows all five states with timestamps
- [ ] `/demo/*` is noindex (meta + `X-Robots-Tag`) and excluded from sitemap + robots
```
