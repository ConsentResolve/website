// Reply-screen "🚩 Flag mismatch" action + review queue — /api/crm/prospecting/gojiberry-flag
//
// Gojiberry doesn't accept inbound feedback via its outbound webhook, and this Worker
// has no Gojiberry API key provisioned (only the reverse: Gojiberry -> us). So flagging
// a lead here does NOT call Gojiberry live — it records the flag durably
// (gojiberry_mismatches table + a note on the conversation), and someone reviews the
// queue (GET, or the Prospecting tab's "Gojiberry mismatches" panel) and pushes each
// one to Gojiberry by hand via `update_contact` (fit: "out-of-scope", state:
// "excluded"), then marks it resolved so the queue shows what's actually been done.
import { json, corsHeaders } from "../_lib/http.js";
import { crmAuthed } from "../_lib/crm.js";
import { currentUser } from "../_lib/crm-v2.js";

function rid(p) { return p + Math.random().toString(36).slice(2, 10) + Date.now().toString(36); }

async function ensureTable(env) {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS gojiberry_mismatches (
       id TEXT PRIMARY KEY, prospect_id TEXT, contact_id TEXT, gojiberry_email TEXT,
       reason TEXT, flagged_by TEXT, status TEXT DEFAULT 'pending',
       flagged_at TEXT DEFAULT (datetime('now')), resolved_at TEXT, resolved_by TEXT)`
  ).run();
  // Older rows predate flagged_by/resolved_by — add if missing (idempotent).
  await env.DB.prepare("ALTER TABLE gojiberry_mismatches ADD COLUMN flagged_by TEXT").run().catch(() => {});
  await env.DB.prepare("ALTER TABLE gojiberry_mismatches ADD COLUMN resolved_by TEXT").run().catch(() => {});
}

export async function onRequestOptions({ request, env }) {
  return new Response(null, { status: 204, headers: { ...corsHeaders(request, env), "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" } });
}

// List the queue for review — every flag, newest first, joined to the contact's name/company
// so the panel is readable without a second lookup. ?status=pending|pushed|dismissed filters.
export async function onRequestGet({ request, env }) {
  const cors = corsHeaders(request, env);
  if (!(await crmAuthed(request, env))) return json({ error: "unauthorized" }, { status: 401 }, cors);
  await ensureTable(env);
  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const rows = (await env.DB.prepare(
    `SELECT m.*, c.full_name, c.primary_email, co.name AS company_name
       FROM gojiberry_mismatches m
       LEFT JOIN contacts c ON c.id = m.contact_id
       LEFT JOIN companies co ON co.id = c.company_id
      ${status ? "WHERE m.status=?" : ""}
      ORDER BY m.flagged_at DESC LIMIT 200`
  ).bind(...(status ? [status] : [])).all()).results || [];
  const counts = (await env.DB.prepare("SELECT status, COUNT(*) n FROM gojiberry_mismatches GROUP BY status").all()).results || [];
  return json({ ok: true, flags: rows, counts: Object.fromEntries(counts.map((c) => [c.status, c.n])) }, {}, cors);
}

export async function onRequestPost({ request, env }) {
  const cors = corsHeaders(request, env);
  if (!(await crmAuthed(request, env))) return json({ error: "unauthorized" }, { status: 401 }, cors);
  await ensureTable(env);
  const me = await currentUser(request, env).catch(() => null);

  let b; try { b = await request.json(); } catch { return json({ ok: false, error: "bad_json" }, { status: 400 }, cors); }

  // Reviewing an existing flag: mark it 'pushed' (someone sent the out-of-scope update to
  // Gojiberry by hand) or 'dismissed' (reviewed, kept as a live lead after all).
  if (b && b.action === "resolve") {
    const { id, resolution } = b;
    if (!id || !["pushed", "dismissed"].includes(resolution)) return json({ ok: false, error: "bad_resolution" }, { status: 400 }, cors);
    await env.DB.prepare("UPDATE gojiberry_mismatches SET status=?, resolved_at=datetime('now'), resolved_by=? WHERE id=?")
      .bind(resolution, me ? me.name : null, id).run();
    return json({ ok: true, resolved: id, resolution }, {}, cors);
  }

  // Default: create a new flag from the Reply-screen button.
  const { contact_id, conversation_id, reason } = b || {};
  if (!contact_id) return json({ ok: false, error: "missing_contact_id" }, { status: 400 }, cors);

  const prospect = await env.DB.prepare("SELECT id, domain, signals FROM prospects WHERE promoted_contact_id=?").bind(contact_id).first().catch(() => null);
  if (!prospect) return json({ ok: false, error: "no_prospect_for_contact" }, { status: 404 }, cors);

  let sig = {}; try { sig = JSON.parse(prospect.signals || "{}"); } catch (_) {}
  const gojiEmail = (sig.gojiberry && sig.gojiberry.contact_email) || null;

  await env.DB.prepare(
    "INSERT INTO gojiberry_mismatches (id, prospect_id, contact_id, gojiberry_email, reason, flagged_by) VALUES (?,?,?,?,?,?)"
  ).bind(rid("gjm_"), prospect.id, contact_id, gojiEmail, reason || null, me ? me.name : null).run();

  if (conversation_id) {
    await env.DB.prepare("INSERT INTO notes (id, author_id, conversation_id, contact_id, body) VALUES (?,?,?,?,?)")
      .bind(rid("nt_"), null, conversation_id, contact_id, `🚩 Flagged as ICP mismatch for Gojiberry — ${reason || "no reason given"}`).run().catch(() => {});
  }

  return json({ ok: true, queued: true, message: "Recorded. Review it in Prospecting → Gojiberry mismatches — not yet auto-pushed to Gojiberry (no API key wired)." }, {}, cors);
}
