// Consent Resolve — Instantly "Website Visitors" -> CRM ingest.
//
// Instantly's Website Visitors product has NO public API endpoint
// (/api/v2/website-visitors is app-internal, 401s every API key). The working
// path: in the Website Visitors screen, "Add to list" pushes the identified
// visitors into a normal Instantly LEAD LIST, which IS readable via the
// documented Lead API. We read that list and upsert the visitors as CRM leads
// (source "instantly", identified) so they land in Site Spy with the others.
//
// Config: INSTANTLY_VISITORS_LIST_ID (the list id) — if unset, we auto-discover
// a lead list named "Website Visitors".
//
//   GET /api/crm/instantly/visitors?test=1  -> resolve the list + report count
//   GET /api/crm/instantly/visitors?raw=1   -> dump a couple mapped records
//   GET /api/crm/instantly/visitors?run=1   -> import new identified visitors
//
// Also runs on the */5 cron via runScheduledSync(). No-op without the key/list.
import { json, corsHeaders } from "../_lib/http.js";
import { crmAuthed, upsertLead, addActivity, ensureCrmSchema } from "../_lib/crm.js";

const BASE = "https://api.instantly.ai/api/v2";
// Instantly sits behind Cloudflare and 403/1010s non-browser UAs.
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const KEY = (env) => String(env.INSTANTLY_API_KEY || "").trim();

async function instGet(env, path) {
  const r = await fetch(BASE + path, { headers: { Authorization: "Bearer " + KEY(env), Accept: "application/json", "User-Agent": UA } });
  let body = null; try { body = await r.json(); } catch (_) {}
  return { status: r.status, ok: r.ok, body };
}
async function instPost(env, path, payload) {
  const r = await fetch(BASE + path, {
    method: "POST",
    headers: { Authorization: "Bearer " + KEY(env), "Content-Type": "application/json", Accept: "application/json", "User-Agent": UA },
    body: JSON.stringify(payload),
  });
  let body = null; try { body = await r.json(); } catch (_) {}
  return { status: r.status, ok: r.ok, body };
}

// The list id — explicit env, else discover a list named "Website Visitors".
async function resolveListId(env) {
  if (env.INSTANTLY_VISITORS_LIST_ID) return String(env.INSTANTLY_VISITORS_LIST_ID).trim();
  const r = await instGet(env, "/lead-lists?limit=100");
  const lists = (r.body && (r.body.items || r.body.data)) || (Array.isArray(r.body) ? r.body : []);
  const match = lists.find((l) => String(l.name || "").trim().toLowerCase() === "website visitors")
    || lists.find((l) => /website\s*visitor/i.test(l.name || ""));
  return match ? match.id : null;
}

function normalize(L) {
  const p = L.payload || {};
  const email = String(L.email || p.email || "").toLowerCase().trim();
  const name = [L.first_name || p.firstName, L.last_name || p.lastName].filter(Boolean).join(" ");
  const company = L.company_name || p.companyName || "";
  const domain = String(L.company_domain || L.website || p.website || "").replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "").toLowerCase();
  const title = p.title || "";
  const loc = [p.city, p.state].filter(Boolean).join(", ");
  return { email, name, company, domain, title, loc };
}

async function fetchVisitors(env, listId, want) {
  const rows = [];
  let cursor = null;
  for (let page = 0; page < 30; page++) {
    const payload = { list_ids: [listId], limit: 100 };
    if (cursor) payload.starting_after = cursor;
    const r = await instPost(env, "/leads/list", payload);
    if (!r.ok) return { error: `API ${r.status}: ${JSON.stringify(r.body).slice(0, 160)}`, status: r.status };
    const batch = (r.body && (r.body.items || r.body.data)) || (Array.isArray(r.body) ? r.body : []);
    rows.push(...batch);
    cursor = r.body && r.body.next_starting_after;
    if (!cursor || !batch.length || rows.length >= want) break;
  }
  return { rows };
}

export async function runScheduledSync(env) {
  if (!env.DB || !KEY(env)) return { skipped: "not_configured" };
  const listId = await resolveListId(env);
  if (!listId) return { skipped: "no_visitors_list" };
  await ensureCrmSchema(env);
  const got = await fetchVisitors(env, listId, 500);
  if (got.error) return { error: got.error };
  let synced = 0, skipped = 0, noEmail = 0;
  for (const L of (got.rows || [])) {
    const c = normalize(L);
    if (!c.email || !c.email.includes("@")) { noEmail++; continue; }
    const existing = await env.DB.prepare("SELECT id FROM crm_leads WHERE email=?").bind(c.email).first();
    if (existing) { skipped++; continue; }
    const id = await upsertLead(env, {
      source: "instantly", email: c.email, name: c.name || null, company: c.company || null,
      domain: c.domain || null, consent_status: "identified",
      notes: [c.title, c.loc, c.domain ? "Visited · " + c.domain : ""].filter(Boolean).join(" · ") || null,
    });
    await addActivity(env, id, "identified", "Identified via Instantly (website visitor) · " + (c.title || "contact") + (c.company ? " @ " + c.company : ""), "instantly");
    synced++;
  }
  return { synced, skipped, noEmail, scanned: (got.rows || []).length, list: listId };
}

export async function onRequestOptions({ request, env }) {
  return new Response(null, { status: 204, headers: corsHeaders(request, env) });
}

export async function onRequestGet({ request, env }) {
  const cors = corsHeaders(request, env);
  if (!(await crmAuthed(request, env))) return json({ error: "unauthorized" }, { status: 401 }, cors);
  const q = new URL(request.url).searchParams;

  // Purge FIRST — it's a pure DB delete and must never depend on the Instantly API
  // or the list resolving (the mistaken import lives in crm_leads regardless).
  if (q.get("purge")) {
    if (!env.DB) return json({ ok: false, error: "no_db" }, { status: 500 }, cors);
    const r = await env.DB.prepare("DELETE FROM crm_leads WHERE source='instantly'").run();
    const purged = (r && r.meta && (r.meta.changes != null ? r.meta.changes : r.meta.rows_written)) || 0;
    return json({ ok: true, purged, message: "Deleted all imported Instantly leads from crm_leads (Site Spy). Reload the CRM to see it." }, {}, cors);
  }

  if (!KEY(env)) return json({ ok: false, error: "no_key", message: "INSTANTLY_API_KEY not set." }, { status: 400 }, cors);
  const listId = await resolveListId(env);
  if (!listId) return json({ ok: false, error: "no_list", message: "No 'Website Visitors' lead list found. Set INSTANTLY_VISITORS_LIST_ID or name the list 'Website Visitors'." }, { status: 400 }, cors);

  if (q.get("test") || q.get("raw")) {
    const got = await fetchVisitors(env, listId, q.get("raw") ? 3 : 1);
    if (got.error) return json({ ok: false, list: listId, error: got.error }, {}, cors);
    const rows = got.rows || [];
    return json({ ok: true, list: listId, count: rows.length, mapped: q.get("raw") ? rows.map(normalize) : undefined }, {}, cors);
  }
  if (q.get("run")) {
    const out = await runScheduledSync(env);
    return json({ ok: !out.error, ...out }, out.error ? { status: 502 } : {}, cors);
  }
  return json({ ok: true, list: listId, usage: "?purge=1 remove imported instantly leads · ?test=1 resolve list · ?raw=1 preview · ?run=1 import (disabled from cron)" }, {}, cors);
}
