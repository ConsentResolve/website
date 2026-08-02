// worker/api/crm-import-legacy.js
// Bring the OLD CRM's leads into the NEW CRM's INBOX so every lead is visible as an
// (Open) conversation, with its notes + replies attached — and pull anything that was
// archived back into Open. Complements /api/crm/migrate (which only creates the
// contact/company/deal pipeline rows, never conversations or messages).
//
//   GET /api/crm/import-legacy               -> dry-run preview (counts + samples), NO writes
//   GET /api/crm/import-legacy?run=1          -> execute (idempotent, re-runnable)
//        &unarchive=0                          -> skip flipping existing archived convos to open
//
// Admin-gated (cr_crm session + users.role='admin'). Idempotent: every created row uses a
// deterministic id (mig-*) + INSERT OR IGNORE, so re-runs never duplicate.
import { json, corsHeaders } from "../_lib/http.js";
import { crmAuthed } from "../_lib/crm.js";
import { ensureCrmV2Schema, ulid, emailDomain, findOrCreateCompany, adminUserId, isAdmin } from "../_lib/crm-v2.js";

export async function onRequestOptions({ request, env }) {
  return new Response(null, { status: 204, headers: corsHeaders(request, env) });
}
export async function onRequestGet(ctx) { return run(ctx); }
export async function onRequestPost(ctx) { return run(ctx); }

// crm_leads.status (open|won|lost|closed) -> deals.lead_status (active|won|lost).
const mapStatus = (s) => (s === "won" ? "won" : s === "lost" ? "lost" : "active");
// Old lead source -> a conversation channel the inbox understands.
function srcChannel(source) {
  const s = (source || "").toLowerCase();
  if (s.includes("crisp") || s.includes("chat")) return "chat";
  return "email"; // instantly / demo / apollo / manual all reply-by-email
}
// A logged activity is a NOTE (internal) vs a MESSAGE (a real reply/touch with a body).
function isNoteType(t) { const s = (t || "").toLowerCase(); return !s || /note|comment|log|internal|stage|status/.test(s); }
// Direction of a message-type activity: a "reply/received/inbound" is FROM the lead; the
// rest (email/sms/call we logged) are outbound. Best-effort — original type is preserved.
function msgDir(t) { const s = (t || "").toLowerCase(); return /repl|inbound|received|incoming|from.?lead|customer/.test(s) ? "in" : "out"; }
function msgChannel(t) { const s = (t || "").toLowerCase(); if (/sms|text/.test(s)) return "sms"; if (/call|voice|phone/.test(s)) return "phone"; if (/chat|crisp/.test(s)) return "chat"; return "email"; }

async function run({ request, env }) {
  const cors = corsHeaders(request, env);
  if (!(await crmAuthed(request, env))) return json({ error: "unauthorized" }, { status: 401 }, cors);
  if (!(await isAdmin(request, env))) return json({ error: "forbidden", message: "Admin role required." }, { status: 403 }, cors);
  const url = new URL(request.url);
  await ensureCrmV2Schema(env);
  const dry = url.searchParams.get("run") !== "1";
  const unarchive = url.searchParams.get("unarchive") !== "0"; // default ON

  const adminId = await adminUserId(env);
  const leads = (await env.DB.prepare("SELECT * FROM crm_leads").all()).results || [];
  // Group legacy activity by lead.
  let acts = [];
  try { acts = (await env.DB.prepare("SELECT id, lead_id, type, body, actor, at FROM crm_activity ORDER BY at ASC").all()).results || []; } catch (_) {}
  const actsByLead = new Map();
  for (const a of acts) { const arr = actsByLead.get(a.lead_id) || []; arr.push(a); actsByLead.set(a.lead_id, arr); }

  // How many existing convos are archived (would be flipped to Open).
  const archivedCount = (await env.DB.prepare("SELECT COUNT(*) n FROM conversations WHERE status='archived'").first())?.n || 0;

  const counts = { leads: leads.length, no_email: 0, contacts_created: 0, conversations_created: 0,
                   conversations_reused: 0, notes_imported: 0, messages_imported: 0, unarchived: 0 };

  // ---- DRY RUN: count only, no writes ----
  if (dry) {
    const samples = [];
    for (const l of leads) {
      const email = (l.email || "").trim().toLowerCase();
      if (!email) { counts.no_email++; continue; }
      const la = actsByLead.get(l.id) || [];
      for (const a of la) { if (isNoteType(a.type)) counts.notes_imported++; else if ((a.body || "").trim()) counts.messages_imported++; }
      if (samples.length < 8) samples.push({ email, name: l.name || null, status: l.status || null, activities: la.length });
    }
    counts.conversations_created = leads.length - counts.no_email; // upper bound (some may reuse an existing convo)
    counts.unarchived = unarchive ? archivedCount : 0;
    return json({ ok: true, dry: true, would: counts, sample: samples,
      note: "preview only — append ?run=1 to import. Every lead becomes an OPEN conversation; notes+replies attach to it; archived convos flip to Open." }, {}, cors);
  }

  // ---- EXECUTE ----
  for (const l of leads) {
    const email = (l.email || "").trim().toLowerCase();
    if (!email) { counts.no_email++; continue; }

    // 1) Contact (reuse if the v1->v2 migrate already made it; else create, keyed on email).
    let contactId = null, companyId = null;
    const existing = await env.DB.prepare("SELECT contact_id FROM contact_identifiers WHERE type='email' AND value=?").bind(email).first();
    if (existing) {
      contactId = existing.contact_id;
      companyId = (await env.DB.prepare("SELECT company_id FROM contacts WHERE id=?").bind(contactId).first())?.company_id || null;
    } else {
      companyId = await findOrCreateCompany(env, { name: l.company, domain: l.domain || emailDomain(email) });
      contactId = "mig-ct-" + l.id;
      await env.DB.prepare(
        `INSERT OR IGNORE INTO contacts (id, company_id, full_name, primary_email, phone, source, is_provisional) VALUES (?,?,?,?,?,?,0)`
      ).bind(contactId, companyId, l.name || null, email, l.phone || null, l.source || null).run();
      await env.DB.prepare(
        `INSERT INTO contact_identifiers (id, contact_id, type, value, verified) VALUES (?,?,'email',?,?) ON CONFLICT(type,value) DO NOTHING`
      ).bind(ulid(), contactId, email, l.consent_status === "consented" ? 1 : 0).run();
      counts.contacts_created++;
    }

    // 2) Deal (pipeline row) — idempotent, so this endpoint alone is enough to fully import.
    await env.DB.prepare(
      `INSERT OR IGNORE INTO deals (id, company_id, primary_contact_id, owner_id, title, value_cents, lead_status)
       VALUES (?,?,?,?,?,?,?)`
    ).bind("mig-deal-" + l.id, companyId, contactId, adminId, l.company || l.name || email,
           Math.round((Number(l.value_usd) || 0) * 100), mapStatus(l.status)).run().catch(() => {});

    // 3) Conversation — reuse the contact's existing thread if any, else create an OPEN one.
    let convId = (await env.DB.prepare("SELECT id, status FROM conversations WHERE contact_id=? ORDER BY COALESCE(last_message_at, created_at) ASC LIMIT 1").bind(contactId).first())?.id || null;
    if (convId) {
      counts.conversations_reused++;
      await env.DB.prepare("UPDATE conversations SET status='open' WHERE id=? AND status='archived'").bind(convId).run().catch(() => {});
    } else {
      convId = "mig-conv-" + l.id;
      await env.DB.prepare(
        `INSERT OR IGNORE INTO conversations (id, contact_id, company_id, channel, source_detail, status, unread, subject, created_at)
         VALUES (?,?,?,?,?, 'open', 0, ?, ?)`
      ).bind(convId, contactId, companyId, srcChannel(l.source), (l.source ? "imported:" + l.source : "imported"),
             (l.company || l.name || email), l.created_at || new Date().toISOString()).run();
      counts.conversations_created++;
    }

    // 4) Notes + replies for this lead.
    const la = actsByLead.get(l.id) || [];
    let lastAt = l.created_at || null, lastPreview = "";
    for (const a of la) {
      const body = (a.body || "").trim();
      const at = a.at || l.created_at || new Date().toISOString();
      if (isNoteType(a.type)) {
        const noteBody = (a.type ? "[" + a.type + "] " : "") + (body || "(no text)") + (a.actor ? "\n— " + a.actor : "");
        await env.DB.prepare(
          `INSERT OR IGNORE INTO notes (id, author_id, conversation_id, contact_id, body, created_at) VALUES (?,?,?,?,?,?)`
        ).bind("mig-note-" + a.id, adminId, convId, contactId, noteBody, at).run().catch(() => {});
        counts.notes_imported++;
      } else if (body) {
        const dir = msgDir(a.type);
        await env.DB.prepare(
          `INSERT OR IGNORE INTO messages (id, conversation_id, direction, channel, author_id, body_text, sent_at)
           VALUES (?,?,?,?,?,?,?)`
        ).bind("mig-msg-" + a.id, convId, dir, msgChannel(a.type), dir === "out" ? adminId : null, body, at).run().catch(() => {});
        counts.messages_imported++;
      }
      if (body) { lastAt = at; lastPreview = body.slice(0, 160); }
    }

    // If the lead had no activity at all, drop one context note so the conversation isn't blank.
    if (!la.length) {
      const ctx = `Imported from old CRM.` +
        (l.source ? `\nSource: ${l.source}` : "") + (l.industry ? `\nTrade: ${l.industry}` : "") +
        (l.status ? `\nStatus: ${l.status}` : "") + (l.value_usd ? `\nValue: $${l.value_usd}` : "") +
        (l.notes ? `\n\n${l.notes}` : "");
      await env.DB.prepare(
        `INSERT OR IGNORE INTO notes (id, author_id, conversation_id, contact_id, body, created_at) VALUES (?,?,?,?,?,?)`
      ).bind("mig-note-lead-" + l.id, adminId, convId, contactId, ctx, l.created_at || new Date().toISOString()).run().catch(() => {});
      counts.notes_imported++;
      lastPreview = lastPreview || "Imported from old CRM";
    }

    // 5) Keep it in Open + refresh the row's ordering/preview.
    await env.DB.prepare(
      "UPDATE conversations SET status='open', last_message_at=COALESCE(?, last_message_at), last_message_preview=COALESCE(NULLIF(?, ''), last_message_preview, ?) WHERE id=?"
    ).bind(lastAt, lastPreview, "Imported from old CRM", convId).run().catch(() => {});
  }

  // 6) Flip anything else that was archived back into Open (so "see everything in Open").
  if (unarchive) {
    const r = await env.DB.prepare("UPDATE conversations SET status='open', updated_at=datetime('now') WHERE status='archived'").run().catch(() => ({}));
    counts.unarchived = (r && r.meta && r.meta.changes) || 0;
  }

  return json({ ok: true, dry: false, imported: counts }, {}, cors);
}
