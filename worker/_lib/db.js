// D1 helpers for the live demo. Binding name: DB (see wrangler.jsonc).

export function uuid() {
  return crypto.randomUUID();
}

export function nowIso() {
  return new Date().toISOString();
}

export async function getParticipant(env, dt) {
  if (!dt) return null;
  return env.DB.prepare("SELECT * FROM participants WHERE id = ?").bind(dt).first();
}

export async function getByEmail(env, email) {
  if (!email) return null;
  return env.DB
    .prepare("SELECT * FROM participants WHERE email = ? ORDER BY created_at DESC LIMIT 1")
    .bind(email)
    .first();
}

export async function insertParticipant(env, p) {
  await env.DB
    .prepare(
      `INSERT INTO participants
        (id, name, email, business_name, phone, trade, consent_contact, status, ip, user_agent, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'registered', ?, ?, ?)`
    )
    .bind(
      p.id,
      p.name,
      p.email,
      p.business_name || null,
      p.phone || null,
      p.trade || null,
      p.consent_contact ? 1 : 0,
      p.ip || null,
      p.user_agent || null,
      p.created_at
    )
    .run();
}

// Generic column updater. `fields` is a plain object of column -> value.
export async function updateParticipant(env, id, fields) {
  const keys = Object.keys(fields);
  if (!keys.length) return;
  const set = keys.map((k) => `${k} = ?`).join(", ");
  const values = keys.map((k) => fields[k]);
  await env.DB
    .prepare(`UPDATE participants SET ${set} WHERE id = ?`)
    .bind(...values, id)
    .run();
}

export async function logEvent(env, participantId, eventType, metadata) {
  await env.DB
    .prepare(
      "INSERT INTO events (participant_id, event_type, metadata, created_at) VALUES (?, ?, ?, ?)"
    )
    .bind(participantId, eventType, metadata ? JSON.stringify(metadata) : null, nowIso())
    .run();
}

// Lightweight per-IP rate limit: count registrations from this IP in the window.
export async function recentRegistrations(env, ip, windowSeconds = 60) {
  if (!ip) return 0;
  const since = new Date(Date.now() - windowSeconds * 1000).toISOString();
  const row = await env.DB
    .prepare("SELECT COUNT(*) AS n FROM participants WHERE ip = ? AND created_at >= ?")
    .bind(ip, since)
    .first();
  return row ? Number(row.n) : 0;
}
