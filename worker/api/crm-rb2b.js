// RB2B visitor-identification webhook -> CRM lead, flagged consent_status="identified"
// (no consent banner) so the CRM blocks it from outreach stages — retargeting/intel
// only. Register the URL (with ?key=<CRM_WEBHOOK_TOKEN>) in RB2B's webhook settings.
import { json } from "../_lib/http.js";
import { crmWebhookToken, upsertLead, addActivity } from "../_lib/crm.js";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
function deepFind(obj, keys, depth) {
  if (!obj || typeof obj !== "object" || (depth || 0) > 4) return null;
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    if (keys.includes(k.toLowerCase()) && v && typeof v !== "object") return v;
  }
  for (const k of Object.keys(obj)) {
    const v = deepFind(obj[k], keys, (depth || 0) + 1);
    if (v) return v;
  }
  return null;
}

export async function onRequestPost({ request, env }) {
  if ((new URL(request.url).searchParams.get("key") || "") !== crmWebhookToken(env)) return json({ error: "unauthorized" }, { status: 401 });
  let body = {};
  try { body = await request.json(); } catch { return json({ ok: true, skipped: "bad_json" }); }
  try {
    const emailRaw = String(deepFind(body, ["work_email", "email", "business_email"], 0) || "").toLowerCase();
    const email = EMAIL_RE.test(emailRaw) ? emailRaw : null;
    const first = deepFind(body, ["first_name", "firstname"], 0) || "";
    const last = deepFind(body, ["last_name", "lastname"], 0) || "";
    const name = String(deepFind(body, ["name", "full_name"], 0) || (first + " " + last).trim());
    const company = String(deepFind(body, ["company_name", "company", "organization"], 0) || "");
    const city = String(deepFind(body, ["city"], 0) || "");
    const linkedin = String(deepFind(body, ["linkedin_url", "linkedin"], 0) || "");
    if (!email && !name && !company) return json({ ok: true, skipped: "no_identity" });
    const id = await upsertLead(env, {
      source: "rb2b", email, name, company, consent_status: "identified",
      notes: linkedin ? "LinkedIn: " + linkedin : null,
    });
    await addActivity(env, id, "identified", "Identified via RB2B" + (company ? " · " + company : "") + (city ? " · " + city : ""), "rb2b");
    return json({ ok: true, lead: id });
  } catch (e) { return json({ ok: true, error: String(e).slice(0, 120) }); }
}
