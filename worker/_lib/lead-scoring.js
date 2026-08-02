// worker/_lib/lead-scoring.js
// Behavior-based warm-lead scoring — Part 3 of the Cold Lead Reactivation playbook.
// Opens score ZERO (Apple MPP + image proxying make them noise). We score real intent:
// clicks, poll taps, calculator completions, replies, and money-page visits — with a
// 60-day half-life decay because in-market windows close.
//
//   tiers:  Cold 0-4 · Interested 5-11 · Warm 12-19 · Hot 20+
//
// The score + tier are written onto contacts (lead_score, tier, scored_at) so the CRM can
// bucket, badge, and SLA them. Recomputed by the cron (rescoreDueContacts) and on demand.
import { ulid } from "./crm-v2.js";

// ---- schema (idempotent) --------------------------------------------------
let _scoringReady = false;
export async function ensureScoringSchema(env) {
  if (_scoringReady) return;
  const cols = [
    "ALTER TABLE contacts ADD COLUMN lead_score INTEGER DEFAULT 0",
    "ALTER TABLE contacts ADD COLUMN tier TEXT DEFAULT 'cold'",
    "ALTER TABLE contacts ADD COLUMN scored_at TEXT",
    // Newsletter re-permission state: pending | opted_in | suppressed (Part 5).
    "ALTER TABLE contacts ADD COLUMN newsletter_status TEXT DEFAULT 'pending'",
    // Segmentation captured from poll taps (Part 2): avg-ticket band, main channel, trucks, CRM.
    "ALTER TABLE contacts ADD COLUMN seg_ticket TEXT",
    "ALTER TABLE contacts ADD COLUMN seg_channel TEXT",
    "ALTER TABLE contacts ADD COLUMN seg_trucks TEXT",
    "ALTER TABLE contacts ADD COLUMN seg_crm TEXT",
  ];
  for (const sql of cols) { try { await env.DB.prepare(sql).run(); } catch (_) { /* exists */ } }
  try { await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_contacts_tier ON contacts(tier, lead_score)").run(); } catch (_) {}
  _scoringReady = true;
}

// ---- the model ------------------------------------------------------------
export const TIERS = { cold: [0, 4], interested: [5, 11], warm: [12, 19], hot: [20, Infinity] };
export function tierFor(score) {
  const s = Number(score) || 0;
  if (s >= 20) return "hot";
  if (s >= 12) return "warm";
  if (s >= 5) return "interested";
  return "cold";
}
// Response SLA per tier (minutes) — the money is in speed (Part 3).
export const TIER_SLA_MIN = { hot: 15, warm: 24 * 60, interested: 48 * 60, cold: null };

const MONEY_RE = /(compare|pricing|calculator|calc|lead-math|resources\/compare|roas|worksheet)/i;
const isMoney = (meta) => MONEY_RE.test([meta.label, meta.path, meta.dest, meta.campaign].filter(Boolean).join(" "));

// Points for a single event, given its type + parsed meta. Unknown/quiet events = 0.
export function pointsFor(type, meta = {}) {
  switch (type) {
    case "link_clicked":       return isMoney(meta) ? 4 : 1;
    case "poll_response":      return 3;
    case "calc_completed":     return 6;
    case "worksheet_completed":return 6;
    case "replied":            return 8;
    case "sms_received":       return 8;   // a text reply is a reply
    case "email_forwarded":    return 5;
    case "registration_started": return 15;
    case "booked":             return 20;
    case "inbound_call":       return 20;  // they called us — hot
    case "call_answered":      return 20;
    case "site_visit": {
      const p = String(meta.path || "");
      if (/\/pricing/i.test(p)) return 8;
      if (/\/(demo|how-it-works)/i.test(p)) return 6;
      return 2;                            // any tracked page view = awake
    }
    default: return 0;                     // opens, system events, etc.
  }
}

const HALF_LIFE_MS = 60 * 24 * 60 * 60 * 1000; // 60-day half-life
function decayWeight(occurredAt, now) {
  const t = Date.parse(occurredAt);
  if (isNaN(t)) return 1;
  const age = Math.max(0, now - t);
  return Math.pow(0.5, age / HALF_LIFE_MS);
}

// Compute a contact's decayed score from its scored events. `events` = rows of
// { type, meta (json string|obj), occurred_at }. Adds the "2+ sessions in 7 days = 6" bonus.
export function computeScore(events, now = Date.now()) {
  let score = 0;
  const visitDays = new Set();
  for (const e of events) {
    let meta = e.meta; if (typeof meta === "string") { try { meta = JSON.parse(meta || "{}"); } catch (_) { meta = {}; } }
    const pts = pointsFor(e.type, meta || {});
    if (pts) score += pts * decayWeight(e.occurred_at, now);
    if (e.type === "site_visit") { const t = Date.parse(e.occurred_at); if (!isNaN(t) && now - t < 7 * 864e5) visitDays.add(new Date(t).toISOString().slice(0, 10)); }
  }
  if (visitDays.size >= 2) score += 6; // came back within a week — "came back is the whole game"
  return Math.round(score);
}

// Recompute + persist scores for a set of contacts (or all with recent events).
// Returns { rescored, promoted:[{contactId, from, to, score}] } so callers can react to
// tier crossings (e.g. surface a new Warm/Hot in Open).
export async function rescoreContacts(env, contactIds) {
  await ensureScoringSchema(env);
  const ids = contactIds && contactIds.length ? contactIds : null;
  // Pull the current tier so we can detect crossings.
  const cur = new Map();
  if (ids) {
    for (let i = 0; i < ids.length; i += 90) {
      const chunk = ids.slice(i, i + 90);
      for (const r of ((await env.DB.prepare(`SELECT id, tier, lead_score FROM contacts WHERE id IN (${chunk.map(() => "?").join(",")})`).bind(...chunk).all()).results || [])) cur.set(r.id, r);
    }
  }
  // Gather scored events per contact.
  const byContact = new Map();
  const gather = async (sql, binds) => {
    for (const e of ((await env.DB.prepare(sql).bind(...binds).all()).results || [])) {
      const a = byContact.get(e.contact_id) || []; a.push(e); byContact.set(e.contact_id, a);
    }
  };
  if (ids) {
    for (let i = 0; i < ids.length; i += 90) {
      const chunk = ids.slice(i, i + 90);
      await gather(`SELECT contact_id, type, meta, occurred_at FROM crm_events WHERE contact_id IN (${chunk.map(() => "?").join(",")})`, chunk);
    }
  } else {
    await gather("SELECT contact_id, type, meta, occurred_at FROM crm_events WHERE contact_id IS NOT NULL", []);
  }
  const now = Date.now();
  const promoted = [];
  let rescored = 0;
  const targets = ids || [...byContact.keys()];
  for (const cid of targets) {
    const score = computeScore(byContact.get(cid) || [], now);
    const tier = tierFor(score);
    await env.DB.prepare("UPDATE contacts SET lead_score=?, tier=?, scored_at=? WHERE id=?")
      .bind(score, tier, new Date(now).toISOString(), cid).run().catch(() => {});
    rescored++;
    const prev = cur.get(cid);
    if (prev && prev.tier && prev.tier !== tier) promoted.push({ contactId: cid, from: prev.tier, to: tier, score });
  }
  return { rescored, promoted };
}

// Contacts whose score may be stale — have crm_events newer than their last scoring.
// Cheap incremental sweep for the cron.
export async function rescoreDueContacts(env, { limit = 200 } = {}) {
  await ensureScoringSchema(env);
  const rows = (await env.DB.prepare(
    `SELECT DISTINCT e.contact_id FROM crm_events e
       JOIN contacts c ON c.id = e.contact_id
      WHERE e.contact_id IS NOT NULL
        AND (c.scored_at IS NULL OR e.occurred_at > c.scored_at)
      LIMIT ?`
  ).bind(limit).all()).results || [];
  const ids = rows.map((r) => r.contact_id);
  if (!ids.length) return { rescored: 0, promoted: [] };
  return rescoreContacts(env, ids);
}
