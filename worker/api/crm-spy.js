// Consent Resolve — Site Spy "identified people" table + row actions.
//
// Lists identity-resolved leads (Apollo / RB2B / Consent Resolve-own / Instantly …)
// that haven't been actioned yet, and handles the three row actions:
//   - disqualify : not our ICP -> hidden from Spy (spy_state='disqualified')
//   - open       : bridge into the v2 CRM as a contact + OPEN conversation -> Inbox
//   - enroll     : add to an outreach automation (respects the consent guardrail)
//
// State lives on a new crm_leads.spy_state column (identified default -> actioned).
import { json, corsHeaders } from "../_lib/http.js";
import { crmAuthed, addActivity } from "../_lib/crm.js";
import { findOrCreateContactByEmail, upsertConversationByThread, ensureCrmV2Schema } from "../_lib/crm-v2.js";
import { enrollContact } from "../_lib/workflow-engine.js";

async function ensureSpyColumn(env) {
  try { await env.DB.prepare("ALTER TABLE crm_leads ADD COLUMN spy_state TEXT").run(); } catch (_) {}
}

function mapRow(r) {
  return {
    id: r.id,
    name: r.name || (r.email ? r.email.split("@")[0] : "Unknown visitor"),
    email: r.email || null,
    company: r.company || null,
    domain: r.domain || null,
    source: r.source || "other",
    title: (r.notes || "").split(" · ")[0] || null,
    created_at: r.created_at || null,
  };
}

// Identified leads still sitting in Site Spy (not yet opened/enrolled/disqualified).
export async function listSpyLeads(env) {
  if (!env.DB) return [];
  await ensureSpyColumn(env);
  const rows = (await env.DB.prepare(
    `SELECT id, name, email, company, domain, source, notes, created_at
       FROM crm_leads
      WHERE consent_status='identified' AND (spy_state IS NULL OR spy_state='identified')
      ORDER BY datetime(created_at) DESC LIMIT 500`
  ).all()).results || [];
  // Which of these identified people have actually browsed our site? (email ->
  // contact -> visitor_links -> traffic). One set query, then flag each row.
  const visited = new Set();
  try {
    const vr = (await env.DB.prepare(
      `SELECT DISTINCT lower(c.primary_email) em
         FROM contacts c JOIN visitor_links vl ON vl.contact_id=c.id
        WHERE c.primary_email IS NOT NULL`
    ).all()).results || [];
    for (const r of vr) if (r.em) visited.add(r.em);
  } catch (_) {}
  return rows.map((r) => { const m = mapRow(r); m.visited = !!(r.email && visited.has(r.email.toLowerCase())); return m; });
}

export async function onRequestOptions({ request, env }) {
  return new Response(null, { status: 204, headers: corsHeaders(request, env) });
}

export async function onRequestGet({ request, env }) {
  const cors = corsHeaders(request, env);
  if (!(await crmAuthed(request, env))) return json({ error: "unauthorized" }, { status: 401 }, cors);
  return json({ ok: true, leads: await listSpyLeads(env) }, {}, cors);
}

export async function onRequestPost({ request, env }) {
  const cors = corsHeaders(request, env);
  if (!(await crmAuthed(request, env))) return json({ error: "unauthorized" }, { status: 401 }, cors);
  let b = {}; try { b = await request.json(); } catch { return json({ error: "bad_json" }, { status: 400 }, cors); }
  const { id, action } = b;
  if (!id || !action) return json({ error: "id_and_action_required" }, { status: 400 }, cors);
  await ensureSpyColumn(env);
  const lead = await env.DB.prepare("SELECT * FROM crm_leads WHERE id=?").bind(id).first();
  if (!lead) return json({ error: "not_found" }, { status: 404 }, cors);
  const now = new Date().toISOString();

  if (action === "disqualify") {
    await env.DB.prepare("UPDATE crm_leads SET spy_state='disqualified', status='disqualified', last_activity=? WHERE id=?").bind(now, id).run();
    await addActivity(env, id, "note", "Disqualified from Site Spy — not ICP" + (b.reason ? ": " + b.reason : ""), "crm");
    return json({ ok: true, action, id }, {}, cors);
  }

  if (action === "open" || action === "enroll") {
    if (!lead.email) return json({ ok: false, error: "no_email", message: "This visitor has no email — can't open or enroll." }, { status: 400 }, cors);
    await ensureCrmV2Schema(env);
    const contactId = await findOrCreateContactByEmail(env, lead.email, {
      name: lead.name || "", source: lead.source || "apollo", company: lead.company || "",
    });

    if (action === "open") {
      const convId = await upsertConversationByThread(env, {
        channel: "identified", externalThreadId: "spy_" + id, contactId,
        subject: "Identified visitor — " + (lead.company || lead.domain || lead.name || lead.email),
        incoming: true, lastAt: now,
        preview: (lead.notes || ("Identified via " + (lead.source || "site"))).slice(0, 160),
      });
      await env.DB.prepare("UPDATE crm_leads SET spy_state='opened', last_activity=? WHERE id=?").bind(now, id).run();
      await addActivity(env, id, "note", "Opened from Site Spy → Inbox", "crm");
      return json({ ok: true, action, id, contactId, conversationId: convId }, {}, cors);
    }

    // enroll — enrollContact enforces the consent guardrail (identified/no-consent
    // sources like Apollo are refused for outreach). Surface that, don't override it.
    const res = await enrollContact(env, { contactId, source: "site_spy" });
    if (res && res.runId) {
      await env.DB.prepare("UPDATE crm_leads SET spy_state='enrolled', last_activity=? WHERE id=?").bind(now, id).run();
      await addActivity(env, id, "note", "Added to automation (" + (res.workflow || "sequence") + ") from Site Spy", "crm");
      return json({ ok: true, action, id, workflow: res.workflow }, {}, cors);
    }
    const skipped = (res && res.skipped) || "not_enrolled";
    const message = skipped === "identified_no_outreach"
      ? "Consent-first guardrail: this visitor was identified without consent, so they can't be auto-messaged. Use Open to work them by hand, or retarget via ads."
      : skipped === "already_enrolled" ? "Already in an automation."
      : skipped === "suppressed" ? "This contact opted out — suppressed from all messaging."
      : "Could not enroll (" + skipped + ").";
    return json({ ok: false, action, id, skipped, message }, {}, cors);
  }

  return json({ error: "unknown_action" }, { status: 400 }, cors);
}
