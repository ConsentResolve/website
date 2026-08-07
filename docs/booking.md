# Native demo booking (Cal.com v2 + widget)

Replaces the Cal.com iframe on `/demo` with a fully on-brand booking flow. The Cal.com API key
never reaches the browser — every Cal call goes through the Worker.

**Flow (conversion-tuned).** The commitment funnel is 4 steps: 1 Trade → 2 Lead source (single
tap) → 3 Time (first open day preselected; times capped at 6 with a "show all") → 4 Email
(required) + mobile (optional). The slot is **held at step 4** — that's the only place email +
time are required. Once booked, a **skippable** step 5 asks for name / company / website (it sells
why giving them early makes the demo better) and PATCHes the record via `/api/booking/update`;
skipping never costs the booking. Step 6 is the final confirmation + calendar file.

```
Browser widget  →  Worker (/api/booking/*)  →  Cal.com v2 API
                        └→ D1 (booking_events + bookings)
```

## Files
- `worker/api/booking.js` — the four endpoints + Cal.com v2 client + D1 schema + ICS builder.
  Registered in `worker/index.js` at `/api/booking/{slots,create,event,ics}`.
- `public/booking-widget.js` — the self-contained widget (scoped `crbw-`, no framework). Served at
  `https://consentresolve.com/booking-widget.js`.
- `src/components/BookingWidget.astro` — drops the mount div + loader (used on `/demo`).
- `worker/api/__tests__/booking.test.js` — phone/website normalization tests (`node …`).

## Go live — set these (booking is inert-graceful until both exist)
1. **Cal.com API key** (secret — never in the repo):
   ```bash
   npx wrangler secret put CALCOM_API_KEY
   ```
   (or set it in the Cloudflare dashboard → Worker → Settings → Variables → *Encrypt*.)
2. **Event type ID** (numeric id of the single demo event type) — set in `wrangler.jsonc` vars
   (`"CALCOM_EVENT_TYPE_ID": "123456"`) so it survives CI deploys, then deploy.

Get both from cal.com: **Settings → Developer → API keys**, and the event type ID from the event
type's URL / API. Until they're set, the widget’s time step shows a graceful "call/text us"
fallback (never a dead end) — steps 1, 2, 4 still work.

CORS: same-origin needs nothing. To embed on another origin, add it to `ALLOWED_ORIGINS`.

## Embed on any landing page (one component or two lines)
Astro: `import BookingWidget from "~/components/BookingWidget.astro"` then `<BookingWidget />`.

Anywhere else:
```html
<div data-cr-booking data-api="https://consentresolve.com"></div>
<script src="https://consentresolve.com/booking-widget.js" defer></script>
```
The script auto-mounts every `[data-cr-booking]` on the page. UTM params on the page URL are
captured on mount and flow through to the booking metadata.

## Endpoints
- `GET  /api/booking/slots?start=YYYY-MM-DD&end=YYYY-MM-DD` → `{ days:[{date,label,slotCount,slots:[{time,iso}]}] }` (America/Chicago, 60s edge cache, zero-slot days dropped).
- `POST /api/booking/create` `{ startIso,email, [phone,trade,leadSources[],utm,name,company,website] }` → `{ ok, booking:{uid,startIso} }` or `{ ok:false, reason:"slot_taken"|"api_error"|"missing_fields"|... }`. Only `email` + `startIso` are required; a missing name falls back to the email local-part for the Cal attendee.
- `POST /api/booking/update` `{ uid, [name,company,website,phone] }` → `{ ok:true }`. Post-booking enrichment; only overwrites columns the user actually filled in.
- `POST /api/booking/event` `{ event, step, sessionId, meta }` → per-step funnel logging.
- `GET  /api/booking/ics?uid=…` → `.ics` for "Add to my calendar".

## Query the drop-off funnel (D1)
Per-step reach + conversion, last 30 days:
```sql
SELECT step,
       COUNT(DISTINCT session_id) AS sessions_reached
FROM booking_events
WHERE event = 'step_view'
  AND created_at >= datetime('now','-30 days')
GROUP BY step
ORDER BY step;
```

Funnel from start → confirmed booking:
```sql
SELECT
  COUNT(DISTINCT CASE WHEN event='flow_start'        THEN session_id END) AS started,
  COUNT(DISTINCT CASE WHEN event='step_complete' AND step='step1' THEN session_id END) AS picked_trade,
  COUNT(DISTINCT CASE WHEN event='step_complete' AND step='step2' THEN session_id END) AS did_marketing,
  COUNT(DISTINCT CASE WHEN event='slot_selected'     THEN session_id END) AS picked_time,
  COUNT(DISTINCT CASE WHEN event='booking_submitted' THEN session_id END) AS submitted,
  COUNT(DISTINCT CASE WHEN event='booking_confirmed' THEN session_id END) AS booked
FROM booking_events
WHERE created_at >= datetime('now','-30 days');
```

Abandon points (where people leave):
```sql
SELECT step, COUNT(*) AS abandons
FROM booking_events
WHERE event='abandoned' AND created_at >= datetime('now','-30 days')
GROUP BY step ORDER BY abandons DESC;
```

Run any of these with:
```bash
npx wrangler d1 execute consentresolve-demo --remote --command "<SQL>"
```
