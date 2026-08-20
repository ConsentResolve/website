// Reply-screen "🚩 Flag mismatch" action — /api/crm/prospecting/gojiberry-flag
//
// Gojiberry doesn't accept inbound feedback via its outbound webhook, and this Worker
// has no Gojiberry API key provisioned (only the reverse: Gojiberry -> us). So this
// endpoint records the flag durably (gojiberry_mismatches table + a note on the
// conversation) rather than pretending to call Gojiberry live. A human (or a future
// scheduled job, once a Gojiberry API key is wired in) drains this table via
// Gojiberry's `update_contact` (fit: "out-of-scope").
import { json, corsHeaders } from "../_lib/http.js";
import { crmAuthed } from "../_lib/crm.js";

function rid(p) { return p + Math.random().toString(36).slice(2, 10) + Date.now().toString(36); }

export async function onRequestOptions({ request, env }) {
  return new Response(null, { status: 204, headers: { ...corsHeaders(request, env), "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" } });
}

export async function onRequestPost({ request, env }) {
  const cors = corsHeaders(request, env);
  if (!(await crmAuthed(request, env))) return json({ error: "unauthorized" }, { status: 401 }, cors);

  let b; try { b = await request.json(); } catch { return json({ ok: false, error: "bad_json" }, { status: 400 }, cors); }
  const { contact_id, conversation_id, reason } = b || {};
  if (!contact_id) return json({ ok: false, error: "missing_contact_id" }, { status: 400 }, cors);

  const prospect = await env.DB.prepare("SELECT id, domain, signals FROM prospects WHERE promoted_contact_id=?").bind(contact_id).first().catch(() => null);
  if (!prospect) return json({ ok: false, error: "no_prospect_for_contact" }, { status: 404 }, cors);

  let sig = {}; try { sig = JSON.parse(prospect.signals || "{}"); } catch (_) {}
  const gojiEmail = (sig.gojiberry && sig.gojiberry.contact_email) || null;

  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS gojiberry_mismatches (
       id TEXT PRIMARY KEY, prospect_id TEXT, contact_id TEXT, gojiberry_email TEXT,
       reason TEXT, status TEXT DEFAULT 'pending', flagged_at TEXT DEFAULT (datetime('now')), resolved_at TEXT)`
  ).run();
  await env.DB.prepare(
    "INSERT INTO gojiberry_mismatches (id, prospect_id, contact_id, gojiberry_email, reason) VALUES (?,?,?,?,?)"
  ).bind(rid("gjm_"), prospect.id, contact_id, gojiEmail, reason || null).run();

  if (conversation_id) {
    await env.DB.prepare("INSERT INTO notes (id, author_id, conversation_id, contact_id, body) VALUES (?,?,?,?,?)")
      .bind(rid("nt_"), null, conversation_id, contact_id, `🚩 Flagged as ICP mismatch for Gojiberry — ${reason || "no reason given"}`).run().catch(() => {});
  }

  return json({ ok: true, queued: true, message: "Recorded. Not yet auto-pushed to Gojiberry (no API key wired) — export gojiberry_mismatches to update_contact(fit: 'out-of-scope') until then." }, {}, cors);
}
