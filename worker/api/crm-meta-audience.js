// CRM — Meta Custom Audience upload (list-based retargeting).
//   GET  /api/crm/meta/audience            -> { configured, audiences:[{id,name,count}] }
//   POST /api/crm/meta/audience { name|id, emails:[...] } -> ensure audience + upload hashed emails
// Emails are SHA-256 hashed inside the worker (meta.js) before hitting the Graph API.
// Auth: CRM session OR ?key=<FEEDBACK_KEY> (so the loader can push a list without a browser).
import { json, corsHeaders } from "../_lib/http.js";
import { crmAuthed } from "../_lib/crm.js";
import { metaConfigured, listCustomAudiences, ensureCustomAudience, addEmailsToAudience } from "../_lib/meta.js";

async function readAuthed(request, env) {
  if (await crmAuthed(request, env)) return true;
  const k = new URL(request.url).searchParams.get("key");
  return !!(env.FEEDBACK_KEY && k === env.FEEDBACK_KEY);
}

export async function onRequestOptions({ request, env }) {
  return new Response(null, { status: 204, headers: corsHeaders(request, env) });
}

export async function onRequestGet({ request, env }) {
  const cors = corsHeaders(request, env);
  if (!(await readAuthed(request, env))) return json({ error: "unauthorized" }, { status: 401 }, cors);
  if (!metaConfigured(env)) return json({ configured: false }, {}, cors);
  const a = await listCustomAudiences(env);
  return json(Object.assign({ configured: true }, a), {}, cors);
}

export async function onRequestPost({ request, env }) {
  const cors = corsHeaders(request, env);
  if (!(await readAuthed(request, env))) return json({ error: "unauthorized" }, { status: 401 }, cors);
  if (!metaConfigured(env)) return json({ configured: false, error: "not_configured" }, { status: 400 }, cors);
  let b = {}; try { b = await request.json(); } catch (_) {}
  const emails = Array.isArray(b.emails) ? b.emails : [];
  if (!emails.length) return json({ error: "no_emails" }, { status: 400 }, cors);

  let audienceId = b.audienceId || b.id || null;
  let audienceName = b.name || null, created = false;
  if (!audienceId) {
    const ens = await ensureCustomAudience(env, audienceName || "HVAC US 2026 — Cold Recipients");
    if (!ens.ok) return json({ error: ens.error || "audience_failed" }, { status: 502 }, cors);
    audienceId = ens.id; created = ens.created;
  }
  const up = await addEmailsToAudience(env, audienceId, emails);
  return json({ ok: up.ok, audienceId, audienceName, created, added: up.added, total: up.total, errors: up.errors }, {}, cors);
}
