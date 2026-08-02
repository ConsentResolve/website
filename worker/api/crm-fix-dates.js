// worker/api/crm-fix-dates.js
// Correct conversation "arrived" dates. Every ingest path created conversations with the
// schema default created_at = datetime('now') (the INGEST moment), so the inbox showed
// "when we imported/polled it", not when the lead actually came in. This backfills each
// conversation's created_at to the EARLIEST real signal we have for it:
//     1. the first message's sent_at       (email/chat/sms threads — the true arrival)
//     2. the earliest crm_event for the contact (lead_created, etc.)
//     3. the contact's created_at
// It only ever moves a date EARLIER (a real earlier signal can only mean the lead came in
// sooner), never later, so it can't invent a wrong-newer date.
//
//   GET  /api/crm/fix-dates            -> dry-run: distribution + before/after sample, NO writes
//   GET  /api/crm/fix-dates?run=1      -> apply (idempotent, re-runnable)
//
// Admin-gated (cr_crm session + users.role='admin').
import { json, corsHeaders } from "../_lib/http.js";
import { crmAuthed } from "../_lib/crm.js";
import { ensureCrmV2Schema, isAdmin } from "../_lib/crm-v2.js";

export async function onRequestOptions({ request, env }) {
  return new Response(null, { status: 204, headers: corsHeaders(request, env) });
}
export async function onRequestGet(ctx) { return run(ctx); }
export async function onRequestPost(ctx) { return run(ctx); }

const ms = (s) => { const t = Date.parse(s); return isNaN(t) ? null : t; };
const earliest = (...vals) => {
  const ts = vals.map(ms).filter((t) => t != null);
  return ts.length ? new Date(Math.min(...ts)).toISOString() : null;
};

async function run({ request, env }) {
  const cors = corsHeaders(request, env);
  if (!(await crmAuthed(request, env))) return json({ error: "unauthorized" }, { status: 401 }, cors);
  if (!(await isAdmin(request, env))) return json({ error: "forbidden", message: "Admin role required." }, { status: 403 }, cors);
  await ensureCrmV2Schema(env);
  const dry = new URL(request.url).searchParams.get("run") !== "1";

  const convs = (await env.DB.prepare(
    "SELECT cv.id, cv.contact_id, cv.created_at, cv.last_message_at, ct.full_name, ct.primary_email FROM conversations cv LEFT JOIN contacts ct ON ct.id=cv.contact_id"
  ).all()).results || [];

  // Earliest + latest message per conversation (the strongest arrival signal).
  const msgMin = new Map(), msgMax = new Map();
  for (const m of ((await env.DB.prepare("SELECT conversation_id, MIN(sent_at) mn, MAX(sent_at) mx FROM messages WHERE sent_at IS NOT NULL GROUP BY conversation_id").all()).results || [])) {
    msgMin.set(m.conversation_id, m.mn); msgMax.set(m.conversation_id, m.mx);
  }
  // Earliest event per contact (lead_created / first touch), as a fallback when a
  // conversation has no messages (e.g. a form lead).
  const evtMin = new Map();
  try {
    for (const e of ((await env.DB.prepare("SELECT contact_id, MIN(occurred_at) mn FROM crm_events WHERE contact_id IS NOT NULL AND occurred_at IS NOT NULL GROUP BY contact_id").all()).results || [])) {
      evtMin.set(e.contact_id, e.mn);
    }
  } catch (_) {}
  // Contact created_at, as a last-resort fallback.
  const ctMin = new Map();
  for (const c of ((await env.DB.prepare("SELECT id, created_at FROM contacts WHERE created_at IS NOT NULL").all()).results || [])) {
    ctMin.set(c.id, c.created_at);
  }

  let changed = 0, unchanged = 0, noSignal = 0;
  const updates = [];
  const sample = [];
  for (const cv of convs) {
    // The true arrival = earliest of every signal we have (including the current created_at,
    // so the result is never LATER than what's already stored).
    const arrival = earliest(
      msgMin.get(cv.id),
      evtMin.get(cv.contact_id),
      ctMin.get(cv.contact_id),
      cv.created_at
    );
    // Also make last_message_at reflect the newest message so sort order is right.
    const lastAt = msgMax.get(cv.id) || cv.last_message_at || arrival;

    if (!arrival) { noSignal++; continue; }
    const moves = ms(arrival) != null && ms(cv.created_at) != null && ms(arrival) < ms(cv.created_at) - 1000; // >1s earlier
    const lastMoves = lastAt && lastAt !== cv.last_message_at;
    if (!moves && !lastMoves) { unchanged++; continue; }
    if (moves) changed++;
    if (sample.length < 20) sample.push({ who: cv.full_name || cv.primary_email || cv.id, was: cv.created_at, now: arrival, from: msgMin.get(cv.id) ? "first message" : evtMin.get(cv.contact_id) ? "first event" : "contact created" });
    updates.push({ id: cv.id, created_at: arrival, last_message_at: lastAt });
  }

  if (dry) {
    return json({ ok: true, dry: true, conversations: convs.length,
      would_fix_arrival: changed, already_correct: unchanged, no_signal: noSignal,
      sample, note: "preview only — append ?run=1 to apply. Dates only ever move EARLIER, to the first real message/event we have." }, {}, cors);
  }

  // Apply in chunks.
  let applied = 0;
  for (let i = 0; i < updates.length; i += 40) {
    await env.DB.batch(updates.slice(i, i + 40).map((u) =>
      env.DB.prepare("UPDATE conversations SET created_at=?, last_message_at=COALESCE(?, last_message_at) WHERE id=?").bind(u.created_at, u.last_message_at || null, u.id)
    ));
    applied += Math.min(40, updates.length - i);
  }
  return json({ ok: true, dry: false, conversations: convs.length, updated: applied, no_signal: noSignal, sample }, {}, cors);
}
