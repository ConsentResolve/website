// Consent Resolve CRM — visitor 360 detail for Site Spy.
//   GET /api/crm/visitor?vid=<cr_vid>     → a live/anonymous visitor's trail + consent
//   GET /api/crm/visitor?lead=<crm_leads.id> → an identified person: what we know + did they visit
// Returns a unified shape both Site Spy click surfaces render.
import { json, corsHeaders } from "../_lib/http.js";
import { crmAuthed } from "../_lib/crm.js";

const all = async (env, sql, ...b) => { try { return (await env.DB.prepare(sql).bind(...b).all()).results || []; } catch (_) { return []; } };
const one = async (env, sql, ...b) => { try { return (await env.DB.prepare(sql).bind(...b).first()) || null; } catch (_) { return null; } };
const isVideo = (p) => typeof p === "string" && p.startsWith("video:");

// Turn a vid's traffic rows into a page trail + video list.
async function trailForVid(env, vid) {
  const rows = await all(env, "SELECT path, utm_source, ref, created_at FROM traffic WHERE vid=? ORDER BY created_at DESC LIMIT 200", vid);
  const pages = [], videos = [];
  for (const r of rows) {
    if (isVideo(r.path)) videos.push({ name: r.path.slice(6), at: r.created_at, on: r.ref || "" });
    else pages.push({ path: r.path, at: r.created_at, source: r.utm_source || "" });
  }
  const sessions = new Set(rows.map((r) => String(r.created_at).slice(0, 13))).size; // rough: distinct hours
  return { pages, videos, visits: rows.length, sessions, first: rows.length ? rows[rows.length - 1].created_at : null, last: rows.length ? rows[0].created_at : null };
}

export async function onRequestOptions({ request, env }) {
  return new Response(null, { status: 204, headers: corsHeaders(request, env) });
}

export async function onRequestGet({ request, env }) {
  const cors = corsHeaders(request, env);
  if (!(await crmAuthed(request, env))) return json({ error: "unauthorized" }, { status: 401 }, cors);
  const u = new URL(request.url);
  const vid = u.searchParams.get("vid");
  const leadId = u.searchParams.get("lead");

  try {
    if (vid) {
      const pres = await one(env, "SELECT * FROM presence WHERE vid=?", vid);
      const link = await one(env, "SELECT vl.contact_id, c.full_name, c.primary_email, c.source, co.name company FROM visitor_links vl JOIN contacts c ON c.id=vl.contact_id LEFT JOIN companies co ON co.id=c.company_id WHERE vl.vid=? LIMIT 1", vid);
      const trail = await trailForVid(env, vid);
      return json({
        ok: true, kind: "visitor", vid,
        identity: link ? { name: link.full_name, email: link.primary_email, company: link.company, source: link.source } : null,
        consent: pres ? (pres.consent || "unknown") : "unknown",
        location: pres ? [pres.city, pres.region, pres.country].filter(Boolean).join(", ") : null,
        ip: pres ? pres.ip : null,
        visited: trail.visits > 0,
        trail,
      }, {}, cors);
    }

    if (leadId) {
      const lead = await one(env, "SELECT * FROM crm_leads WHERE id=?", leadId);
      if (!lead) return json({ ok: false, error: "not_found" }, { status: 404 }, cors);
      // Did this identified person visit our site? Resolve email -> contact -> vid -> traffic.
      let trail = { pages: [], videos: [], visits: 0, sessions: 0, first: null, last: null };
      let matchedVid = null, consent = lead.consent_status === "consented" ? "granted" : (lead.consent_status || "unknown");
      if (lead.email) {
        const c = await one(env, "SELECT id FROM contacts WHERE lower(primary_email)=lower(?) LIMIT 1", lead.email);
        if (c) {
          const vl = await one(env, "SELECT vid FROM visitor_links WHERE contact_id=? LIMIT 1", c.id);
          if (vl && vl.vid) { matchedVid = vl.vid; trail = await trailForVid(env, vl.vid); const pr = await one(env, "SELECT consent FROM presence WHERE vid=?", vl.vid); if (pr && pr.consent && pr.consent !== "unknown") consent = pr.consent; }
        }
      }
      let enrichment = null;
      try { enrichment = lead.enrichment ? JSON.parse(lead.enrichment) : null; } catch (_) {}
      return json({
        ok: true, kind: "lead", lead_id: leadId,
        identity: { name: lead.name, email: lead.email, company: lead.company, domain: lead.domain, title: lead.title || (enrichment && enrichment.title) || "", source: lead.source },
        consent, notes: lead.notes || "", enrichment,
        visited: trail.visits > 0, matchedVid, trail,
      }, {}, cors);
    }

    return json({ ok: false, error: "need vid or lead" }, { status: 400 }, cors);
  } catch (e) {
    return json({ ok: false, error: String(e).slice(0, 160) }, { status: 500 }, cors);
  }
}
