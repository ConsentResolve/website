# Jobber marketplace auto-provisioning — dashboard contract

The worker half is live (`worker/_lib/partners/provision.js`, wired into the
marketplace branch of `worker/api/partners-jobber.js`). This doc is the work
order for the **dashboard** (dashboard.consentresolve.com) half. When both
halves exist and the secrets are set, a contractor who clicks Connect on our
Jobber App Marketplace listing gets a ConsentResolve account created and
linked with zero forms.

## The flow

```
Jobber marketplace "Connect"
  → Jobber OAuth approve (scopes: clients read/write, users read)
  → worker callback: tokens stored, account {id,name} + admin email fetched
  → POST {DASHBOARD_PROVISION_URL}            ← this endpoint is the ask
  → dashboard: create-or-match customer, mint customer_key, magic link
  → worker: claimConnection(jobber account → customer_key)
  → 302 contractor to finish_url (set password → snippet → billing)
```

Every failure at any step degrades to the concierge flow: connection parks
unclaimed, contractor lands on `/jobber-connected/`, onboarding claims it by
hand. The contractor never sees an error from our side.

## Endpoint the dashboard must expose

> **Status (2026-08-20).** The receiving half now exists in crmono as
> `cr-app/packages/api/src/routes/provision.ts` (PR #4, `fix/jobber-provisioning`).
> It returns the user id as `customer_key` and a `/reset-password` magic link
> as `finish_url`. The request shape below has been corrected to match what
> that implementation actually validates.

`POST` at a URL of its choosing (the worker reads it from
`DASHBOARD_PROVISION_URL`). As implemented in crmono this is
`https://api.consentresolve.com/api/v1/provision/partner` — the **API**
worker, mounted outside the JWT chain alongside the other signed webhooks,
not the dashboard origin.

Request body (JSON, exactly what is HMAC-signed):

```json
{
  "source": "partner_marketplace",
  "partner": "jobber",
  "email": "owner@acme-roofing.com",
  "partner_account_id": "Z2lkOi8vSm9iYmVyL0FjY291bnQvMTIzNDU2Nw==",
  "account_name": "Acme Roofing",
  "ts": 1755115200000
}
```

`ts` is a **number** (epoch milliseconds), not an ISO-8601 string — the
receiver validates `z.number()` and answers 400 otherwise. `account_name` is
optional and typed `string | undefined`: when the partner account has no
name, **omit the key** rather than sending `null`, which also fails
validation. Both shapes are pinned by
`worker/_lib/partners/provision.test.js`.

Header: `X-CR-Signature` — lowercase hex `HMAC-SHA256(secret, raw_body)`.
Verify against the raw request body **before** parsing; reject mismatches
with 401 and stale `ts` (>5 min) with 400. The shared secret is
`DASHBOARD_PROVISION_SECRET` — same long random value set as a wrangler
secret on the worker and an env var on the dashboard.

Response `200`:

```json
{
  "customer_key": "cus_9f2ab81c",
  "finish_url": "https://dashboard.consentresolve.com/welcome?token=<one-time signed token>"
}
```

Rules for the dashboard side:

- **Idempotent.** Same `email` OR same (`partner`, `partner_account_id`) →
  same customer, same `customer_key`, fresh `finish_url`. Repeat connects
  must not mint duplicate accounts.
- **`customer_key`** is the tenancy key the worker routes leads by. Stable,
  opaque, never reused across customers.
- **`finish_url`** is a short-lived (≤24h) one-time magic link: the
  contractor sets a password and lands in onboarding. If they never finish,
  the account exists in a pending state and the connection stays claimed —
  onboarding email nudges come from the dashboard.
- Store `partner` + `partner_account_id` on the customer record; the same
  contract will serve Workiz/JobNimbus/JobTread later.

## What onboarding must produce (for leads to actually flow)

1. The customer's **snippet must carry `customer_key`** — the worker routes
   a recovered lead to the connections of the key the lead arrived with
   (`deliverLeadToPartners(env, lead, customerKey)`).
2. Billing on file ($7 per lead) before delivery turns on — the delivery
   gate is a dashboard/product decision; the worker will deliver for any
   claimed connection.

## Worker-side configuration (already implemented)

```
wrangler secret put DASHBOARD_PROVISION_URL      # the endpoint above
wrangler secret put DASHBOARD_PROVISION_SECRET   # openssl rand -hex 32
```

Unset → provisioning is skipped entirely (concierge flow). Also required:
`JOBBER_MARKETPLACE_ENABLED=true` (var) once the listing is approved, and
the **users read** scope added to the Jobber app (the email query shape
needs one GraphiQL verification pass — `pickOwnerEmail` in
`worker/_lib/partners/jobber.js` tolerates schema drift by falling back to
concierge).
