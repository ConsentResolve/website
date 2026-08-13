// Clean up "phantom" companies — records that were auto-created for contacts that only ever had
// a personal email or a bare phone (no real business domain). Post-rule, these shouldn't exist at
// all; this removes the ones already in the table.
//
//   GET  /api/crm/cleanup-companies                 -> DRY RUN: list the junk candidates + count
//   GET  /api/crm/cleanup-companies?execute=1        -> detach contacts/conversations, delete them
//   GET  /api/crm/cleanup-companies?id=<companyId>            -> dry-run a single company
//   GET  /api/crm/cleanup-companies?id=<companyId>&execute=1  -> remove that ONE company (trusted)
//
// A company is a "junk candidate" when it has NO real business domain AND:
//   - it has no deals (nothing in the pipeline references it),
//   - none of its contacts came from prospecting/import (those are legitimately name-keyed), and
//   - no contact has a business-domain email (i.e. everyone attached is personal-email / phone-only).
// The single-id form skips the heuristic — it removes exactly the company you point at.
// Admin-only. Detach is non-destructive to the contacts/conversations (company_id -> NULL); only
// the empty company row is deleted.
import { json, corsHeaders } from "../_lib/http.js";
import { crmAuthed } from "../_lib/crm.js";
import { ensureCrmV2Schema, isAdmin, FREE_EMAIL_DOMAINS, addActivityV2, currentUser } from "../_lib/crm-v2.js";

const FREE_LIST = [...FREE_EMAIL_DOMAINS].map((d) => `'${d}'`).join(",");

function candidateSql(single) {
  return `
    SELECT co.id, co.name, co.domain,
           (SELECT COUNT(*) FROM contacts c WHERE c.company_id=co.id) AS contacts,
           (SELECT COUNT(*) FROM conversations cv WHERE cv.company_id=co.id) AS convs
      FROM companies co
     WHERE ${single ? "co.id = ?1" : `
           (co.domain IS NULL OR co.domain='' OR lower(co.domain) IN (${FREE_LIST}))
       AND NOT EXISTS (SELECT 1 FROM deals d WHERE d.company_id=co.id)
       AND NOT EXISTS (SELECT 1 FROM contacts c WHERE c.company_id=co.id AND c.source IN ('prospecting','import','import_legacy'))
       AND NOT EXISTS (
             SELECT 1 FROM contacts c
              WHERE c.company_id=co.id AND c.primary_email LIKE '%@%'
                AND lower(substr(c.primary_email, instr(c.primary_email,'@')+1)) NOT IN (${FREE_LIST}))`}
     ORDER BY contacts DESC, co.updated_at DESC
     ${single ? "" : "LIMIT 1000"}`;
}

export async function onRequestOptions({ request, env }) {
  return new Response(null, { status: 204, headers: corsHeaders(request, env) });
}

export async function onRequestGet({ request, env }) {
  const cors = corsHeaders(request, env);
  if (!(await crmAuthed(request, env))) return json({ error: "unauthorized" }, { status: 401 }, cors);
  if (!(await isAdmin(request, env))) return json({ error: "forbidden" }, { status: 403 }, cors);
  await ensureCrmV2Schema(env);
  const url = new URL(request.url);
  const one = url.searchParams.get("id");
  const execute = url.searchParams.get("execute") === "1";
  return json(await run(env, request, { one, execute }), {}, cors);
}

export async function onRequestPost({ request, env }) {
  const cors = corsHeaders(request, env);
  if (!(await crmAuthed(request, env))) return json({ error: "unauthorized" }, { status: 401 }, cors);
  if (!(await isAdmin(request, env))) return json({ error: "forbidden" }, { status: 403 }, cors);
  await ensureCrmV2Schema(env);
  let b = {}; try { b = await request.json(); } catch (_) {}
  return json(await run(env, request, { one: b.id || b.company_id || null, execute: !!b.execute }), {}, cors);
}

async function run(env, request, { one, execute }) {
  const all = async (sql, ...p) => { try { return (await env.DB.prepare(sql).bind(...p).all()).results || []; } catch (e) { return []; } };
  const rows = one ? await all(candidateSql(true), one) : await all(candidateSql(false));
  const summary = { count: rows.length, companies: rows.map((r) => ({ id: r.id, name: r.name, domain: r.domain, contacts: r.contacts, conversations: r.convs })) };

  if (!execute) {
    return { dry: true, ...summary, note: rows.length ? "Add ?execute=1 to detach these contacts/conversations and delete these companies." : "Nothing to clean up." };
  }

  let detachedContacts = 0, detachedConvs = 0, deleted = 0;
  for (const r of rows) {
    const c1 = await env.DB.prepare("UPDATE contacts SET company_id=NULL, updated_at=datetime('now') WHERE company_id=?").bind(r.id).run().catch(() => ({}));
    const c2 = await env.DB.prepare("UPDATE conversations SET company_id=NULL, updated_at=datetime('now') WHERE company_id=?").bind(r.id).run().catch(() => ({}));
    const c3 = await env.DB.prepare("DELETE FROM companies WHERE id=?").bind(r.id).run().catch(() => ({}));
    detachedContacts += (c1.meta && c1.meta.changes) || 0;
    detachedConvs += (c2.meta && c2.meta.changes) || 0;
    deleted += (c3.meta && c3.meta.changes) || 0;
  }
  const me = await currentUser(request, env).catch(() => null);
  await addActivityV2(env, { actorId: me ? me.id : null, entityType: "company", entityId: one || "bulk", action: "phantom_companies_removed", meta: { deleted, detachedContacts, by: me ? me.name : "CRM" } }).catch(() => {});
  return { dry: false, deleted, detached_contacts: detachedContacts, detached_conversations: detachedConvs };
}
