// Speed-to-Lead — consent classifier + lead creation (spec §1, §4, build step 2).
//
// The central rule: cookie-banner acceptance grants identification rights only.
// It writes 0 to ALL four channel columns, ALWAYS. A form submit with regulated
// channel checkboxes (SMS / AI-voice / human-phone) is what unlocks Population B.
import { ensureStlSchema } from "./schema.js";

const CONSENT_VERSION = "v1-2026-07";
const COOKIE_BANNER_TEXT =
  "By continuing you agree we may identify your business visit. This does NOT authorize calls or texts.";

const b = (x) => (x ? 1 : 0);

// Decide A vs B from the submitted consent. B requires a form_submit that grants
// at least one TCPA-regulated channel (SMS, AI voice, or phone-human).
export function classifyPopulation(payload) {
  const k = payload.kind || "cookie_banner";
  const c = payload.consent || {};
  const regulated = !!(c.sms || c.phone_ai || c.phone_human);
  if (k === "form_submit" && regulated) return "B";
  return "A";
}

// Insert a lead + its first consent event; returns { leadId, population, revokeToken }.
export async function createLead(env, payload) {
  await ensureStlSchema(env);
  const now = Date.now();
  const leadId = crypto.randomUUID();
  const population = classifyPopulation(payload);
  const isTest = b(payload.is_test);

  await env.DB.prepare(
    `INSERT INTO stl_leads
       (id, created_at, population, status, first_name, last_name, company, trade,
        email, phone, phone_type, timezone, state, ad_source, campaign_id,
        landing_page, session_id, is_test, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(
    leadId, now, population, "active",
    payload.first_name || null, payload.last_name || null, payload.company || null,
    (payload.trade || "other"), payload.email || null, payload.phone || null,
    payload.phone_type || null, payload.timezone || "America/Chicago", payload.state || null,
    payload.ad_source || null, payload.campaign_id || null, payload.landing_page || null,
    payload.session_id || null, isTest, now
  ).run();

  const revokeToken = await addConsentEvent(env, leadId, payload, now);
  await logEvent(env, leadId, "lead_created", { population, trade: payload.trade, is_test: isTest });
  return { leadId, population, revokeToken };
}

// Write a consent event. Cookie-banner => all channel flags 0, grade 'none'.
export async function addConsentEvent(env, leadId, payload, at) {
  const now = at || Date.now();
  const kind = payload.kind || "cookie_banner";
  const isCookie = kind === "cookie_banner";
  const c = payload.consent || {};
  const id = crypto.randomUUID();
  const revokeToken = crypto.randomUUID().replace(/-/g, "");

  const flags = isCookie
    ? { email: 0, sms: 0, hum: 0, ai: 0 }
    : { email: b(c.email), sms: b(c.sms), hum: b(c.phone_human), ai: b(c.phone_ai) };

  const grade = isCookie ? "none" : (c.grade === "oral" ? "oral" : "written");
  const exact = payload.exact_language || c.exact_language ||
    (isCookie ? COOKIE_BANNER_TEXT : `[${CONSENT_VERSION}] Email/SMS/Phone/AI-voice consent checkboxes.`);

  await env.DB.prepare(
    `INSERT INTO stl_consent_events
       (id, lead_id, created_at, kind, channel_email, channel_sms, channel_phone_hum,
        channel_phone_ai, consent_grade, exact_language, state, ip, user_agent,
        page_url, revoke_token)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(
    id, leadId, now, kind, flags.email, flags.sms, flags.hum, flags.ai,
    grade, exact, payload.state || null, payload.ip || null,
    payload.user_agent || null, payload.page_url || null, revokeToken
  ).run();

  return revokeToken;
}

export async function logEvent(env, leadId, kind, detail) {
  try {
    await env.DB.prepare(
      `INSERT INTO stl_events (id, lead_id, at, kind, detail) VALUES (?,?,?,?,?)`
    ).bind(crypto.randomUUID(), leadId || null, Date.now(), kind, detail ? JSON.stringify(detail) : null).run();
  } catch (_) {}
}

export { COOKIE_BANNER_TEXT, CONSENT_VERSION };
