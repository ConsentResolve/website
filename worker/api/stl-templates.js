// worker/api/stl-templates.js
// Read + edit the Speed-to-Lead message copy (emails + SMS) from the CRM.
//   GET  /api/crm/stl-templates                 -> { templates:[...], tokens:[...] }
//   POST /api/crm/stl-templates {save:{id,subject,body}}  -> upsert an override
//   POST /api/crm/stl-templates {reset:{id}}              -> delete the override (back to default)
// Auth: any signed-in CRM user (same gate as the sequences editor). Overrides live in D1
// (stl_template_overrides) and are picked up by the STL runner on its next tick.
import { json, corsHeaders } from "../_lib/http.js";
import { crmAuthed } from "../_lib/crm.js";
import { crmSessionEmail } from "../_lib/auth.js";
import { STL_EDITABLE, ensureStlTemplateSchema } from "../_lib/stl/templates.js";

// Merge-field palette shown in the editor. Keep in sync with stlTokens() in templates.js.
const TOKENS = [
  { k: "first", d: "Lead's first name (falls back to \"there\")" },
  { k: "Trade", d: "Trade, capitalized (e.g. Roofing; falls back to \"Trades\")" },
  { k: "trade", d: "Trade, lowercase (e.g. roofing)" },
  { k: "company", d: "Company name (falls back to \"your shop\")" },
  { k: "companyOrShop", d: "Company name, or \"your shop\"" },
  { k: "companyOrTrade", d: "Company name, or the Trade label" },
  { k: "when", d: "Booked meeting time (e.g. Thursday at 2:30 PM)" },
  { k: "link", d: "Booking link" },
  { k: "rep", d: "Assigned rep's name" },
  { k: "repPhone", d: "Rep's phone number" },
  { k: "fromName", d: "Sender name (blank if unset)" },
  { k: "fromNameOrWe", d: "Sender name, or \"we\"" },
  { k: "revokeUrl", d: "One-click consent-revoke link (B3 only)" },
  { k: "season", d: "Current season phrase (e.g. the summer rush)" },
  { k: "timestamp", d: "When the lead consented (B3 receipt)" },
  { k: "consentChecks", d: "The ✅ channel-consent line (B3 receipt)" },
  { k: "page", d: "Landing page path the lead consented on" },
  { k: "adSource", d: "Ad source (e.g. google; falls back to \"direct\")" },
];

export async function onRequestOptions({ request, env }) {
  return new Response(null, { status: 204, headers: corsHeaders(request, env) });
}

export async function onRequestGet({ request, env }) {
  const cors = corsHeaders(request, env);
  if (!(await crmAuthed(request, env))) return json({ error: "unauthorized" }, { status: 401 }, cors);
  await ensureStlTemplateSchema(env);
  const ov = {};
  try {
    const rows = (await env.DB.prepare("SELECT template_id, subject, body, updated_at, updated_by FROM stl_template_overrides").all()).results || [];
    for (const r of rows) ov[r.template_id] = r;
  } catch (_) {}
  const templates = Object.entries(STL_EDITABLE)
    .sort((a, b) => (a[1].seq === b[1].seq ? a[1].order - b[1].order : a[1].seq.localeCompare(b[1].seq)))
    .map(([id, m]) => {
      const o = ov[id];
      return {
        id, seq: m.seq, order: m.order, channel: m.channel, label: m.label, sensitive: !!m.sensitive,
        defaultSubject: m.subject || "", defaultBody: m.body || "",
        subject: o && o.subject != null ? o.subject : (m.subject || ""),
        body: o && o.body != null ? o.body : (m.body || ""),
        isDefault: !o, updatedAt: o ? o.updated_at : null, updatedBy: o ? o.updated_by : null,
      };
    });
  return json({ templates, tokens: TOKENS }, {}, cors);
}

export async function onRequestPost({ request, env }) {
  const cors = corsHeaders(request, env);
  if (!(await crmAuthed(request, env))) return json({ error: "unauthorized" }, { status: 401 }, cors);
  await ensureStlTemplateSchema(env);
  const body = await request.json().catch(() => ({}));
  const who = (await crmSessionEmail(request, env)) || "crm";

  if (body.save && body.save.id) {
    const id = String(body.save.id);
    const m = STL_EDITABLE[id];
    if (!m) return json({ error: "unknown_template" }, { status: 400 }, cors);
    const bodyv = String(body.save.body || "");
    if (!bodyv.trim()) return json({ error: "empty_body" }, { status: 400 }, cors);
    const subject = m.channel === "email" ? String(body.save.subject || "") : null;
    await env.DB.prepare(
      `INSERT INTO stl_template_overrides (template_id, subject, body, updated_at, updated_by)
       VALUES (?,?,?,strftime('%Y-%m-%dT%H:%M:%fZ','now'),?)
       ON CONFLICT(template_id) DO UPDATE SET subject=excluded.subject, body=excluded.body,
         updated_at=excluded.updated_at, updated_by=excluded.updated_by`
    ).bind(id, subject, bodyv, who).run();
    return json({ ok: true, id, isDefault: false, updatedBy: who }, {}, cors);
  }

  if (body.reset && body.reset.id) {
    const id = String(body.reset.id);
    await env.DB.prepare("DELETE FROM stl_template_overrides WHERE template_id=?").bind(id).run();
    return json({ ok: true, id, isDefault: true }, {}, cors);
  }

  return json({ error: "noop" }, { status: 400 }, cors);
}
