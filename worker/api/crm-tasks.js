// worker/api/crm-tasks.js
//   POST /api/crm/tasks { id, contact_id?, found:{}, done:[] } -> persist a lead's Task-tab state
// The Task tab (found fields + done checkboxes) was in-memory only, so a refresh wiped it.
// This saves it per conversation. If a website is entered, it's also synced to the company's
// domain so the Intel lookup has somewhere to look.
import { json, corsHeaders } from "../_lib/http.js";
import { crmAuthed } from "../_lib/crm.js";

async function ensure(env) {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS crm_task_state (
    id TEXT PRIMARY KEY, contact_id TEXT, found TEXT, done TEXT, updated_at TEXT)`).run().catch(() => {});
}
function normDomain(s) {
  let d = String(s || "").trim().toLowerCase();
  d = d.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/[/?#].*$/, "").trim();
  return /^[a-z0-9.-]+\.[a-z]{2,}$/.test(d) ? d : "";
}

export async function onRequestOptions({ request, env }) {
  return new Response(null, { status: 204, headers: corsHeaders(request, env) });
}

export async function onRequestPost({ request, env }) {
  const cors = corsHeaders(request, env);
  if (!(await crmAuthed(request, env))) return json({ ok: false, error: "unauthorized" }, { status: 403 }, cors);
  await ensure(env);
  const b = await request.json().catch(() => ({}));
  if (!b.id) return json({ ok: false, error: "id_required" }, { status: 400 }, cors);
  const found = b.found && typeof b.found === "object" ? b.found : {};
  const done = Array.isArray(b.done) ? b.done : [];
  await env.DB.prepare(
    `INSERT OR REPLACE INTO crm_task_state (id, contact_id, found, done, updated_at) VALUES (?,?,?,?,datetime('now'))`
  ).bind(b.id, b.contact_id || null, JSON.stringify(found), JSON.stringify(done)).run();

  // Sync an entered website to the company's domain (so the lookup can find it).
  const site = normDomain(found.website);
  if (site && b.contact_id) {
    try {
      const ct = await env.DB.prepare("SELECT company_id FROM contacts WHERE id=?").bind(b.contact_id).first();
      if (ct && ct.company_id) {
        await env.DB.prepare("UPDATE companies SET domain=?, updated_at=datetime('now') WHERE id=? AND (domain IS NULL OR domain='')")
          .bind(site, ct.company_id).run().catch(() => {});
      }
    } catch (_) {}
  }
  return json({ ok: true }, {}, cors);
}
