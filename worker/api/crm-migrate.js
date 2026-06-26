// One-time, idempotent backfill: legacy crm_leads -> companies / contacts / deals
// (BUILD-PLAN P0-4). CRM-gated. Re-runnable — contact_identifiers UNIQUE(type,value)
// on the email is the dedup guard, so already-migrated leads are skipped.
//   GET  /api/crm/migrate            -> dry-run preview (counts + sample)
//   GET  /api/crm/migrate?run=1      -> execute
// crm_leads is NEVER deleted (kept as fallback per spec §12: archive, don't hard-delete).
import { json, corsHeaders } from "../_lib/http.js";
import { crmAuthed } from "../_lib/crm.js";
import { ensureCrmV2Schema, ulid, emailDomain, findOrCreateCompany, addActivityV2, adminUserId } from "../_lib/crm-v2.js";

// crm_leads.status (open|won|lost|closed) -> deals.lead_status (active|won|lost).
function mapStatus(s) { return s === "won" ? "won" : s === "lost" ? "lost" : "active"; }

export async function onRequestOptions({ request, env }) {
  return new Response(null, { status: 204, headers: corsHeaders(request, env) });
}
export async function onRequestGet(ctx) { return run(ctx); }
export async function onRequestPost(ctx) { return run(ctx); }

async function run({ request, env }) {
  const cors = corsHeaders(request, env);
  if (!(await crmAuthed(request, env))) return json({ error: "unauthorized" }, { status: 401 }, cors);
  const dry = new URL(request.url).searchParams.get("run") !== "1";
  await ensureCrmV2Schema(env);
  const adminId = await adminUserId(env);

  const leads = (await env.DB.prepare("SELECT * FROM crm_leads").all()).results || [];
  let migrated = 0, skipped = 0, noEmail = 0;
  const samples = [];
  for (const l of leads) {
    const email = (l.email || "").trim().toLowerCase();
    if (!email) { noEmail++; continue; }
    const exists = await env.DB.prepare(
      "SELECT contact_id FROM contact_identifiers WHERE type='email' AND value=?"
    ).bind(email).first();
    if (exists) { skipped++; continue; }
    if (dry) { migrated++; if (samples.length < 8) samples.push(email); continue; }

    const companyId = await findOrCreateCompany(env, { name: l.company, domain: l.domain || emailDomain(email) });
    const contactId = ulid();
    await env.DB.prepare(
      `INSERT INTO contacts (id, company_id, full_name, primary_email, phone, source, is_provisional)
       VALUES (?, ?, ?, ?, ?, ?, 0)`
    ).bind(contactId, companyId, l.name || null, email, l.phone || null, l.source || null).run();
    await env.DB.prepare(
      `INSERT INTO contact_identifiers (id, contact_id, type, value, verified)
       VALUES (?, ?, 'email', ?, ?) ON CONFLICT(type, value) DO NOTHING`
    ).bind(ulid(), contactId, email, l.consent_status === "consented" ? 1 : 0).run();

    // owner: crm_leads.owner is a free-text first name -> match users, else fall back to admin.
    let ownerId = adminId;
    if (l.owner) {
      const u = await env.DB.prepare(
        "SELECT id FROM users WHERE lower(name)=lower(?) OR lower(email) LIKE lower(?)"
      ).bind(l.owner, l.owner + "@%").first();
      if (u) ownerId = u.id;
    }
    const dealId = ulid();
    await env.DB.prepare(
      `INSERT INTO deals (id, company_id, primary_contact_id, owner_id, title, value_cents, lead_status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(dealId, companyId, contactId, ownerId, l.company || l.name || email,
           Math.round((Number(l.value_usd) || 0) * 100), mapStatus(l.status)).run();
    await addActivityV2(env, { actorId: ownerId, entityType: "deal", entityId: dealId, action: "migrated", meta: { from: "crm_leads", lead_id: l.id } });
    migrated++;
  }
  return json({
    ok: true, dry, totals: { leads: leads.length, migrated, skipped, noEmail },
    ...(dry ? { note: "preview only — append ?run=1 to execute", sample_emails: samples } : {}),
  }, {}, cors);
}
