// worker/_lib/workflow-engine.js
// The follow-up automation engine (CRM-REBUILD-MASTER Part 3.2/3.4, Part 7.2).
// v0 is Cloudflare-Workflows-free: it runs on the existing */5 cron. Every step
// emits a crm_event, so step-level conversion reporting is a query, not a project.
//
// SAFETY: the entire engine is DORMANT until env.WORKFLOW_ENGINE_ENABLED === "true"
// (same pattern as SOCIAL_AUTOPOST_ENABLED). Shipping it does not send anything.
// SMS (Telnyx) and AI voice (Retell) actions are coded but HOLD until 10DLC approval
// + creds; email (Resend, already live) is the launch channel.
//
// The consent gate (canSend) is checked before EVERY message action — load-bearing.

import {
  ulid, nowIso, ensureRebuildSchema, logEvent, canSend, isSuppressed, consentState,
} from "./crm-rebuild.js";
import { sendEmail as gmailSend } from "./gmail.js";
import { trackedUrl } from "./click-track.js";
import { ensureCrmV2Schema, createTask } from "./crm-v2.js";
import { IV_WORKFLOW, renderIvTemplate, buildVars } from "./iv-sequence.js";

const enabled = (env) => env.WORKFLOW_ENGINE_ENABLED === "true";
// Per-sequence live switch for the Identified Visitor Outreach — lets that one sequence go
// live WITHOUT flipping the global engine on (which would wake speed-to-lead / earn-consent).
// IV_TEST_EMAILS (csv) restricts real sends to just those addresses; blank = all enrolled.
const ivLive = (env) => env.IV_LIVE === "true";
const ivAllow = (env) => String(env.IV_TEST_EMAILS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
const isIvStep = (run, step) => run.workflow_id === "identified-visitor" || String(step && step.template || "").startsWith("iv_");

// Conservative quiet-hours window that satisfies every jurisdiction we operate in
// at once (TX 9am–9pm lower bound; FL/OK/WA 8am–8pm upper bound → intersect 9–20).
// Per-recipient state refinement is a documented follow-up.
const QUIET = { open: 9, close: 20 };
const TZ = (env) => env.WORKFLOW_TZ || "America/Chicago";

function tzParts(ms, tz) {
  const p = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "numeric", hour12: false }).formatToParts(new Date(ms));
  let hh = Number(p.find((x) => x.type === "hour").value) % 24;
  const mm = Number(p.find((x) => x.type === "minute").value);
  return { hh, mm, minsOfDay: hh * 60 + mm };
}
// Returns the soonest sendable epoch-ms for a channel (email: anytime; sms/voice: inside window).
function sendableAt(ms, channel, env) {
  if (channel !== "sms" && channel !== "voice") return ms;
  const { hh, minsOfDay } = tzParts(ms, TZ(env));
  if (hh >= QUIET.open && hh < QUIET.close) return ms;
  const addMins = hh < QUIET.open ? (QUIET.open * 60 - minsOfDay) : (24 * 60 - minsOfDay) + QUIET.open * 60;
  return ms + addMins * 60000;
}

// ── Phase 2: cold-to-demo local-time windows + frequency cap ─────────────────
// Prospect timezone approximated from US state (default Central). Not exact for the
// rare multi-TZ state, and DST is handled by Intl.
const STATE_TZ = {
  CT: "America/New_York", DE: "America/New_York", FL: "America/New_York", GA: "America/New_York", IN: "America/New_York", ME: "America/New_York", MD: "America/New_York", MA: "America/New_York", MI: "America/New_York", NH: "America/New_York", NJ: "America/New_York", NY: "America/New_York", NC: "America/New_York", OH: "America/New_York", PA: "America/New_York", RI: "America/New_York", SC: "America/New_York", VT: "America/New_York", VA: "America/New_York", WV: "America/New_York", DC: "America/New_York",
  AL: "America/Chicago", AR: "America/Chicago", IL: "America/Chicago", IA: "America/Chicago", KS: "America/Chicago", KY: "America/Chicago", LA: "America/Chicago", MN: "America/Chicago", MS: "America/Chicago", MO: "America/Chicago", NE: "America/Chicago", ND: "America/Chicago", OK: "America/Chicago", SD: "America/Chicago", TN: "America/Chicago", TX: "America/Chicago", WI: "America/Chicago",
  AZ: "America/Phoenix", CO: "America/Denver", MT: "America/Denver", NM: "America/Denver", UT: "America/Denver", WY: "America/Denver", ID: "America/Denver",
  CA: "America/Los_Angeles", NV: "America/Los_Angeles", OR: "America/Los_Angeles", WA: "America/Los_Angeles",
  AK: "America/Anchorage", HI: "Pacific/Honolulu",
};
function contactTz(c) {
  const en = (c && c._enrich) || {}; const sig = en._signals || {};
  let st = String(sig.region || sig.state || en.region || en.state || (c && c.region) || "").trim().toUpperCase();
  if (st.length !== 2) { const m = st.match(/\b([A-Z]{2})\b/); st = m ? m[1] : ""; }
  return STATE_TZ[st] || "America/Chicago";
}
function localParts(ms, tz) {
  const p = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", hour: "numeric", minute: "numeric", hour12: false }).formatToParts(new Date(ms));
  const wd = p.find((x) => x.type === "weekday").value, hh = Number(p.find((x) => x.type === "hour").value) % 24, mm = Number(p.find((x) => x.type === "minute").value);
  const map = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { dow: map[wd] != null ? map[wd] : 1, mins: hh * 60 + mm };
}
function nextSlot(ms, tz, ok) { let t = ms; for (let i = 0; i < 48 * 15; i++) { if (ok(localParts(t, tz))) return t; t += 30 * 60000; } return t; }
const coldOk = (p) => p.dow >= 2 && p.dow <= 4 && p.mins >= 480 && p.mins < 660;                                  // Tue–Thu 8:00–10:59
const callOk = (p) => p.dow >= 1 && p.dow <= 5 && ((p.mins >= 480 && p.mins < 600) || (p.mins >= 960 && p.mins < 1050)); // Mon–Fri 8–10 / 4:00–5:30

// Frequency cap: ≤4 automated emails / 30d across ALL sequences (workflow + newsletter,
// NOT human 1:1 replies). Returns 0 if a slot is free now, else the epoch-ms a slot opens.
async function freqCapFreeAt(env, contactId) {
  const CAP = 4, WINDOW = 30 * 86400000;
  const since = new Date(Date.now() - WINDOW).toISOString();
  const rows = (await env.DB.prepare(
    "SELECT occurred_at FROM crm_events WHERE contact_id=? AND type IN ('email_sent','newsletter_sent','repermission_sent','reengagement_sent','nurture_sent') AND occurred_at>=? ORDER BY occurred_at DESC LIMIT ?"
  ).bind(contactId, since, CAP).all().catch(() => ({ results: [] }))).results || [];
  if (rows.length < CAP) return 0;
  return new Date(rows[rows.length - 1].occurred_at).getTime() + WINDOW; // oldest of the last 4 frees a slot 30d later
}

// ---- Default workflow definitions ----------------------------------------
const SPEED_TO_LEAD = {
  id: "speed-to-lead",
  name: "Speed-to-lead",
  trigger: "lead_created",
  goal: JSON.stringify(["replied", "booked", "opted_out"]),
  requires_consent: JSON.stringify(["sms", "voice"]),
  definition: JSON.stringify([
    { channel: "sms",   action: "send_sms",       delay_minutes: 0,    template: "stl_sms1" },
    { channel: "voice", action: "place_ai_call",  delay_minutes: 5,    template: "stl_call" },
    { channel: "email", action: "send_email",     delay_minutes: 0,    template: "stl_email" },
    { channel: null,    action: "wait",           delay_minutes: 1440 },
    { channel: "sms",   action: "send_sms",       delay_minutes: 0,    template: "stl_sms2" },
  ]),
};
const EARN_CONSENT = {
  id: "earn-consent",
  name: "Earn consent (email-only)",
  trigger: "lead_created",
  goal: JSON.stringify(["replied", "booked", "consent_granted", "opted_out"]),
  requires_consent: JSON.stringify([]),
  definition: JSON.stringify([
    { channel: "email", action: "send_email", delay_minutes: 0,    template: "earn_1" },
    { channel: "email", action: "send_email", delay_minutes: 2880, template: "earn_2" },
    { channel: "email", action: "send_email", delay_minutes: 7200, template: "earn_3" },
  ]),
};

// Cold-to-Demo — the multichannel outbound sequence (spec: consent-resolve-sequence-prompt).
// 5 emails + 3 manual task steps (LinkedIn Day 3, calls Day 8/14) over 21 days. Editable in
// #sequences (email copy + delays); task steps are code-owned. Merge fields resolved by coldVars.
const COLD_TO_DEMO = {
  id: "cold-to-demo",
  name: "Cold-to-Demo (multichannel)",
  trigger: "manual_enroll",
  goal: JSON.stringify(["replied", "booked", "opted_out"]),
  requires_consent: JSON.stringify([]),
  definition: JSON.stringify([
    { channel: "email",    action: "send_email",  delay_minutes: 0,     template: "c2d_1" },                                   // Day 1
    { channel: "linkedin", action: "create_task", delay_minutes: 2880,  task_type: "linkedin", title: "LinkedIn: connect with {{first_name}} at {{company}}", task_body: "Send a connection request — no note, or a one-liner referencing their {{trade}} work in {{city}}. No pitch." }, // Day 3
    { channel: "email",    action: "send_email",  delay_minutes: 2880,  template: "c2d_2" },                                   // Day 5
    { channel: "phone",    action: "create_task", delay_minutes: 4320,  task_type: "call", title: "Call {{first_name}} — {{company}}", task_body: "Reference the emails: \"I sent you a couple notes about the anonymous traffic on your site.\" One sentence of value, ask for 15 minutes. No answer → sub-20-sec voicemail (name, company, one reason to call back). Log: connected / voicemail / bad number." }, // Day 8
    { channel: "email",    action: "send_email",  delay_minutes: 2880,  template: "c2d_3" },                                   // Day 10
    { channel: "phone",    action: "create_task", delay_minutes: 5760,  task_type: "call", title: "Call {{first_name}} (attempt 2) — {{company}}", task_body: "Second attempt. If voicemail again, DO NOT leave a second voicemail — hang up. Email 4 (the calendar ask) fires the same day automatically." }, // Day 14
    { channel: "email",    action: "send_email",  delay_minutes: 0,     template: "c2d_4" },                                   // Day 14 (same day as call 2)
    { channel: "email",    action: "send_email",  delay_minutes: 10080, template: "c2d_5" },                                   // Day 21
  ]),
};

// Re-engagement sprint (Phase 3) — fired when a nurture trigger hits (seasonal, manual tag,
// or a reply). 3 touches over 2 weeks: email → call task → email. Then back to quarterly nurture.
const REENGAGE = {
  id: "reengage",
  name: "Re-engagement sprint",
  trigger: "manual_enroll",
  goal: JSON.stringify(["replied", "booked", "opted_out"]),
  requires_consent: JSON.stringify([]),
  definition: JSON.stringify([
    { channel: "email", action: "send_email", delay_minutes: 0, template: "re_1" },
    { channel: "phone", action: "create_task", delay_minutes: 4320, task_type: "call", title: "Call {{first_name}} — re-engagement", task_body: "A trigger fired (seasonal / manual / reply). Quick call to reconnect on turning their site visitors into $7 leads." },
    { channel: "email", action: "send_email", delay_minutes: 5760, template: "re_2" },
  ]),
};

async function seedWorkflows(env) {
  await ensureRebuildSchema(env);
  // Code-owned workflows: keep the definition in sync from code on every seed.
  for (const w of [SPEED_TO_LEAD, EARN_CONSENT]) {
    await env.DB.prepare(
      `INSERT INTO workflows (id,name,trigger,goal,definition,requires_consent,enabled)
       VALUES (?,?,?,?,?,?,1)
       ON CONFLICT(id) DO UPDATE SET definition=excluded.definition, goal=excluded.goal,
         requires_consent=excluded.requires_consent, updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')`
    ).bind(w.id, w.name, w.trigger, w.goal, w.definition, w.requires_consent).run();
  }
  // Editable workflows (IV): seed ONCE, then the DB definition is the source of truth so
  // cadence edits from /crm/app#sequences aren't clobbered on the next cron.
  for (const w of [IV_WORKFLOW, COLD_TO_DEMO, REENGAGE]) {
    await env.DB.prepare(
      `INSERT INTO workflows (id,name,trigger,goal,definition,requires_consent,enabled)
       VALUES (?,?,?,?,?,?,1) ON CONFLICT(id) DO NOTHING`
    ).bind(w.id, w.name, w.trigger, w.goal, w.definition, w.requires_consent).run();
  }
}

// ---- Message templates (compliant copy) ----------------------------------
const BRAND = "Consent Resolve";
function tpl(env, id, c) {
  // Identified Visitor Outreach templates are full personalized emails built from the
  // contact + cached _visitor (CR site data) + _person (Apollo) enrichment.
  if (String(id).startsWith("iv_")) {
    const en = c._enrich || {};
    const r = renderIvTemplate(id, buildVars(env, { contact: c, visitor: en._visitor, person: en._person }));
    if (r) return r;
  }
  const first = (c.full_name || "there").split(" ")[0];
  // Pref-center CTA routed through the tracked redirect so nurture clicks land in the CRM.
  const PREF_CENTER = trackedUrl(env, { dest: "/get-started/", email: c.email, campaign: "nurture", label: id });
  // Cold-to-Demo merge vars + the ONE booking link (email 4 only, per spec).
  const cv = coldVars(env, c);
  const demoLink = trackedUrl(env, { dest: "/demo/", email: c.email, campaign: "cold_to_demo", label: id });
  const t = {
    // Day 1 — pain + relevance. Signal-personalized opener. No link. Interest CTA.
    c2d_1: () => ({
      subject: "your website traffic",
      html: c2dShell(cv.first_name, `<p>${fill("{{signal_line}}", cv)}Most ${cv.trade} shops pay $80 to $150 for a shared lead from the aggregators, and that same lead gets sold to four other contractors. Meanwhile about 95% of the people who land on ${cv.company}'s own site leave without a name. You already paid to get them there.</p><p>Worth a look?</p>`, c),
    }),
    // Day 5 — proof / price. New angle. No link.
    c2d_2: () => ({
      subject: "$7 flat",
      html: c2dShell(cv.first_name, `<p>Quick follow-up. The aggregators charge $80 to $150 a lead and share it around. We charge $7 a lead, flat, and it is yours alone. No contract.</p><p>Same homeowner, a fraction of the cost, and nobody else is calling them.</p><p>Want the math for ${cv.company}?</p>`, c),
    }),
    // Day 10 — objection preempt (legal/creepy). No link.
    c2d_3: () => ({
      subject: "is this legal",
      html: c2dShell(cv.first_name, `<p>The question I get most: is this even legal? Fair one.</p><p>Nobody gets identified unless they give consent on your site first. That is the whole point, and it keeps you on the right side of the state privacy laws that are starting to bite contractors who buy shared lists. You are not renting someone else's data. You own a lead that opted in with you.</p><p>Happy to walk through it if it helps.</p>`, c),
    }),
    // Day 14 — direct ask. The ONE and only calendar link.
    c2d_4: () => ({
      subject: "15 minutes",
      html: c2dShell(cv.first_name, `<p>Want to see it live on ${cv.company}'s own website traffic? Fifteen minutes.</p><p>I have Tuesday morning and Thursday afternoon open this week. Grab whatever works: <a href="${demoLink}">my calendar</a>.</p><p>Or reply with a time and I will send an invite.</p>`, c),
    }),
    // Day 21 — breakup + newsletter opt-in (reply-based; never auto-subscribe).
    c2d_5: () => ({
      subject: "should I stop",
      html: c2dShell(cv.first_name, `<p>Should I stop reaching out? No hard feelings if the timing is off.</p><p>If it is useful, I send a short monthly note on what is working in ${cv.trade} marketing. No pitch. Reply "monthly" and I will add you, and only you.</p>`, c),
    }),
    // Long-Term Nurture — quarterly, value-led, no pitch. Rotates nt_1..nt_4.
    nt_1: () => ({ subject: "worth knowing", html: c2dShell(cv.first_name, `<p>Quick one, no ask. For most ${cv.trade} shops, about 98% of the people who hit the website leave without ever calling. The fix isn't more traffic, it's catching the ones you already have. Just worth keeping on your radar.</p>`, c) }),
    nt_2: () => ({ subject: "what the busy ones do", html: c2dShell(cv.first_name, `<p>Something the busier ${cv.trade} shops around ${cv.city} have figured out: a lead that already visited your site closes far more often than a cold shared lead, because they picked you first. Most shops just never capture them.</p>`, c) }),
    nt_3: () => ({ subject: "one number to watch", html: c2dShell(cv.first_name, `<p>If you track one marketing number this quarter, make it cost per booked job, not cost per lead. A cheap lead that never books is the most expensive thing you buy. Happy to run yours sometime.</p>`, c) }),
    nt_4: () => ({ subject: "slow-season tip", html: c2dShell(cv.first_name, `<p>Slower stretch? Good time to fix the leaky bucket. The homeowners already visiting your site are the cheapest work you'll ever get, and most leave unseen. When you want to plug that, I'm here.</p>`, c) }),
    // Re-engagement sprint (a trigger fired) — 3 touches, warmer.
    re_1: () => ({ subject: "circling back", html: c2dShell(cv.first_name, `<p>You mentioned the timing wasn't right a while back, so I left you alone. Figured now might be better. Still happy to show you how to turn the folks already on ${cv.company}'s site into $7 exclusive leads. Worth 15 minutes?</p>`, c) }),
    re_2: () => ({ subject: "last try for now", html: c2dShell(cv.first_name, `<p>No worries if it's still not the moment. If turning your own website visitors into exclusive leads ever moves up the list, just reply and we'll pick it back up.</p>`, c) }),
    stl_sms1: () => ({ text: `Hi ${first}, ${c.owner || "Andy"} at ${BRAND} — we turn your website visitors into exclusive $7 leads. Want the 2-min version? Reply STOP to opt out.` }),
    stl_sms2: () => ({ text: `${first}, still happy to show you how ${BRAND} recovers the 98% of site visitors who leave without filling a form. Reply YES for a quick look. STOP to opt out.` }),
    stl_call: () => ({ script: `Hi${first !== "there" ? " " + first : ""}, this is an AI assistant calling on behalf of ${BRAND}. I'll be quick — we help home-service businesses turn the website visitors who leave without filling out a form into exclusive leads. Is now an OK time for about sixty seconds?` }),
    stl_email: () => ({
      subject: `${first}, the 98% of your site visitors who leave without a trace`,
      html: emailShell(`Hi ${first},`, `Most contractors capture only the ~2% of website visitors who fill out a form. ${BRAND} identifies the rest — with consent — and delivers them as <b>exclusive</b> leads at a flat $7. No shared leads, no long contracts.<br><br>Worth a 10-minute look?`, c),
    }),
    earn_1: () => ({
      subject: `${first}, a consent-first way to get more leads from your site`,
      html: emailShell(`Hi ${first},`, `You're getting website traffic — but ~98% leave without ever filling out a form. ${BRAND} recovers those visitors, with their consent, and turns them into exclusive leads.<br><br>If you'd like calls and texts too, you can opt in here: <a href="${PREF_CENTER}">set your contact preferences</a>.`, c),
    }),
    earn_2: () => ({
      subject: `${first}, quick follow-up from ${BRAND}`,
      html: emailShell(`Hi ${first},`, `Just circling back — contractors using ${BRAND} recover leads they were otherwise losing entirely. Reply and I'll send a 60-second sample, or <a href="${PREF_CENTER}">opt in for a call</a>.`, c),
    }),
    earn_3: () => ({
      subject: `${first}, last note (for now)`,
      html: emailShell(`Hi ${first},`, `I'll stop here so I'm not a pest. If recovering the visitors your forms miss sounds useful, just reply — or <a href="${PREF_CENTER}">book a quick call</a>.`, c),
    }),
  }[id];
  return t ? t() : { subject: `${BRAND}`, html: emailShell(`Hi ${first},`, `Reaching out from ${BRAND}.`, c) };
}
function emailShell(greeting, body, c) {
  const addr = "1907 Gulf Way #1, St Pete Beach, FL 33706";
  return `<div style="font-family:system-ui,Arial,sans-serif;font-size:15px;line-height:1.6;color:#0e1c2e">
    <p>${greeting}</p><p>${body}</p>
    <p>— ${c.owner || "Andy"}, ${BRAND}</p>
    <hr style="border:none;border-top:1px solid #e5e9f0;margin:18px 0">
    <p style="font-size:12px;color:#8496a6">${BRAND} · ${addr}<br>
    You received this because you expressed interest in lead generation. <a href="https://consentresolve.com/api/unsubscribe?c=${encodeURIComponent(c.id || "")}">Unsubscribe</a>.</p></div>`;
}

// ---- Cold-to-Demo merge vars + copy --------------------------------------
// Resolve {{first_name}} {{company}} {{city}} {{trade}} {{signal}} from the contact +
// its company enrichment, with graceful fallbacks so a missing signal still reads clean.
function coldVars(env, c) {
  const en = c._enrich || {};
  const sig = en._signals || {};
  const first = String(c.full_name || "").trim().split(/\s+/)[0] || "there";
  const company = c.company || "your company";
  const city = sig.city || en.city || c.city || "your area";
  const trade = (en._intel && en._intel.trade) || sig.trade || sig.trade_guess || "home-service";
  let signal = en._signal || c.signal || "";
  if (!signal) {
    if (Array.isArray(sig.marketplaces) && sig.marketplaces.length) signal = "you're buying leads through " + sig.marketplaces[0];
    else if (sig.running_ads || (sig.ad_spend > 0)) signal = "you're running ads to your site";
    else if (c.domain) signal = "your site, " + c.domain;
  }
  const signal_line = signal ? ("Noticed " + signal + ". ") : "";
  return { first_name: first, company, city, trade, signal, signal_line, domain: c.domain || "" };
}
function fill(str, v) { return String(str == null ? "" : str).replace(/\{\{(\w+)\}\}/g, (_, k) => (v[k] != null ? v[k] : "")); }
function c2dShell(first, bodyHtml, c) {
  const addr = "1907 Gulf Way #1, St Pete Beach, FL 33706";
  return `<div style="font-family:system-ui,Arial,sans-serif;font-size:15px;line-height:1.6;color:#0e1c2e;max-width:520px">
    <p>${first},</p>${bodyHtml}
    <p>— Tyler, ${BRAND}</p>
    <hr style="border:none;border-top:1px solid #e5e9f0;margin:16px 0">
    <p style="font-size:12px;color:#8496a6">${BRAND} · ${addr}<br>
    Not a fit? <a href="https://consentresolve.com/api/unsubscribe?c=${encodeURIComponent(c.id || "")}">Unsubscribe</a>.</p></div>`;
}

// ---- Providers ------------------------------------------------------------
// Sends through the connected Google Workspace mailbox (hello@consentresolve.com) —
// no sending-domain DNS to verify. Name kept for call-site stability.
async function sendResend(env, { to, subject, html, text, unsubUrl, from }, dry) {
  if (dry) return { ok: true, id: "dry-preview", dry: true, preview: { to, subject } };
  // A per-send `from` override (e.g. the IV sequence sends as "Tyler Spurlock") wins over the
  // global FROM_EMAIL, so we can change one sequence's sender without touching every other email.
  const fromAddr = from || env.FROM_EMAIL || "Consent Resolve <hello@consentresolve.com>";
  // RFC 8058 one-click unsubscribe → required by Gmail/Yahoo for bulk senders + boosts deliverability.
  const headers = unsubUrl ? { "List-Unsubscribe": `<${unsubUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } : undefined;
  const g = await gmailSend(env, { to, subject, html, text, from: fromAddr, replyTo: env.REPLY_TO || "hello@consentresolve.com", headers });
  if (!g.ok) return { ok: false, error: `gmail_${g.error || "failed"}` };
  return { ok: true, id: g.id };
}
// HOLD-FOR-MORNING: Telnyx SMS. Coded; inert until TELNYX_API_KEY + 10DLC approval.
async function sendTelnyxSms(env, { to, text }, dry) {
  if (dry) return { ok: true, id: "dry-preview", dry: true, preview: { to, text } };
  if (!env.TELNYX_API_KEY || !env.TELNYX_FROM_NUMBER) return { ok: false, error: "telnyx_not_configured", hold: true };
  const r = await fetch("https://api.telnyx.com/v2/messages", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.TELNYX_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env.TELNYX_FROM_NUMBER, to, text }),
  });
  const j = await r.json().catch(() => ({}));
  return r.ok ? { ok: true, id: j?.data?.id } : { ok: false, error: `telnyx_${r.status}` };
}
// HOLD-FOR-MORNING: Retell AI voice. Coded; inert until RETELL_API_KEY.
async function placeRetellCall(env, { to, script }, dry) {
  if (dry) return { ok: true, id: "dry-preview", dry: true, preview: { to } };
  if (!env.RETELL_API_KEY || !env.RETELL_AGENT_ID || !env.RETELL_FROM_NUMBER) return { ok: false, error: "retell_not_configured", hold: true };
  const r = await fetch("https://api.retellai.com/v2/create-phone-call", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RETELL_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from_number: env.RETELL_FROM_NUMBER, to_number: to, override_agent_id: env.RETELL_AGENT_ID, retell_llm_dynamic_variables: { opening: script } }),
  });
  const j = await r.json().catch(() => ({}));
  return r.ok ? { ok: true, id: j?.call_id } : { ok: false, error: `retell_${r.status}` };
}

// ---- Enrollment -----------------------------------------------------------
async function loadContact(env, contactId) {
  const r = await env.DB.prepare(
    `SELECT c.id, c.full_name, c.primary_email email, c.phone, c.source, c.company_id, u.name owner,
            co.name company, co.domain, co.enrichment
       FROM contacts c LEFT JOIN deals d ON d.primary_contact_id=c.id
       LEFT JOIN users u ON u.id=d.owner_id
       LEFT JOIN companies co ON co.id=c.company_id WHERE c.id=? LIMIT 1`
  ).bind(contactId).first();
  if (r) { try { r._enrich = r.enrichment ? JSON.parse(r.enrichment) : null; } catch (_) { r._enrich = null; } }
  return r;
}

// Enroll one contact. Routes speed-to-lead (has SMS PEWC) vs earn-consent. Idempotent
// via uq_wfrun_contact_wf. Returns {runId, workflow} or {skipped}.
async function enrollContact(env, { contactId, conversationId, dealId, source, workflowId: forceWorkflow }) {
  await ensureRebuildSchema(env); await ensureCrmV2Schema(env);
  if (forceWorkflow) await seedWorkflows(env);   // ensure the target workflow row exists
  const c = await loadContact(env, contactId);
  if (!c) return { skipped: "no_contact" };
  // Note: the former source==='apollo' outreach block was removed 2026-07-29 at the
  // owner's direction — identified visitors accepted the cookie banner (lawful basis
  // captured), so identified/prospected leads are eligible for automation. The
  // suppression (opted-out) and already-enrolled checks below still apply.
  if (await isSuppressed(env, { contactId, email: c.email, channel: "all" })) return { skipped: "suppressed" };
  const st = await consentState(env, { contactId, email: c.email });
  const workflowId = forceWorkflow || (st.sms === "granted" ? "speed-to-lead" : "earn-consent");
  // already enrolled?
  const existing = await env.DB.prepare("SELECT id FROM workflow_runs WHERE workflow_id=? AND contact_id=?").bind(workflowId, contactId).first();
  if (existing) return { skipped: "already_enrolled", runId: existing.id };
  const runId = ulid();
  const def = JSON.parse((await env.DB.prepare("SELECT definition FROM workflows WHERE id=?").bind(workflowId).first())?.definition || "[]");
  const firstDelay = (def[0]?.delay_minutes || 0);
  let firstMs = sendableAt(Date.now() + firstDelay * 60000, def[0]?.channel, env);
  if (workflowId === "cold-to-demo" && def[0]?.action === "send_email") firstMs = nextSlot(firstMs, contactTz(c), coldOk);
  const nextAt = new Date(firstMs).toISOString();
  await env.DB.prepare(
    `INSERT INTO workflow_runs (id,workflow_id,contact_id,conversation_id,deal_id,status,current_step,next_run_at)
     VALUES (?,?,?,?,?, 'active', 0, ?)`
  ).bind(runId, workflowId, contactId, conversationId || null, dealId || null, nextAt).run();
  await logEvent(env, { type: "sequence_enrolled", contactId, conversationId, dealId, workflowRunId: runId, source, meta: { workflow: workflowId } });
  return { runId, workflow: workflowId };
}

// ---- Goal handling: reply/booked/opt-out exits active runs for a contact ----
async function handleGoalEvent(env, { contactId, goal }) {
  await ensureRebuildSchema(env);
  const runs = (await env.DB.prepare(
    `SELECT r.id, r.workflow_id, w.goal FROM workflow_runs r JOIN workflows w ON w.id=r.workflow_id
      WHERE r.contact_id=? AND r.status='active'`
  ).bind(contactId).all()).results || [];
  let exited = 0;
  for (const r of runs) {
    const goals = JSON.parse(r.goal || "[]");
    if (!goals.includes(goal)) continue;
    await env.DB.prepare("UPDATE workflow_runs SET status='exited', exit_reason=?, next_run_at=NULL, updated_at=? WHERE id=?")
      .bind(goal, nowIso(), r.id).run();
    await logEvent(env, { type: "sequence_exited", contactId, workflowRunId: r.id, meta: { reason: goal } });
    exited++;
  }
  if (goal === "opted_out") {
    const c = await loadContact(env, contactId);
    if (c) { const { addSuppression } = await import("./crm-rebuild.js"); await addSuppression(env, { contactId, email: c.email, phone: c.phone, channel: "all", reason: "opted_out", source: "workflow" }); }
  }
  return exited;
}

// ---- The cron tick --------------------------------------------------------
// Process every run whose next step is due. Returns a summary.
async function processDueRuns(env, { limit = 50, dry = false } = {}) {
  // Run when the global engine is on OR the Identified Visitor sequence is live (its own
  // switch). Per-step gating in executeStep still decides what actually sends.
  if (!dry && !enabled(env) && !ivLive(env)) return { skipped: "disabled" };
  await ensureRebuildSchema(env); await seedWorkflows(env);
  const now = nowIso();
  const due = (await env.DB.prepare(
    "SELECT * FROM workflow_runs WHERE status='active' AND next_run_at IS NOT NULL AND next_run_at<=? ORDER BY next_run_at ASC LIMIT ?"
  ).bind(now, limit).all()).results || [];
  const out = { processed: 0, emailed: 0, skipped: 0, deferred: 0, exited: 0, completed: 0, dry };
  for (const run of due) {
    try { await stepRun(env, run, out, dry); } catch (e) {
      await env.DB.prepare("UPDATE workflow_runs SET last_error=?, updated_at=? WHERE id=?").bind(String(e).slice(0, 200), now, run.id).run();
    }
    out.processed++;
  }
  return out;
}

async function stepRun(env, run, out, dry) {
  const wf = await env.DB.prepare("SELECT * FROM workflows WHERE id=?").bind(run.workflow_id).first();
  const steps = JSON.parse(wf?.definition || "[]");
  let idx = run.current_step;
  const c = await loadContact(env, run.contact_id);
  if (!c) { await completeRun(env, run, "no_contact"); return; }

  // Advance through skip/wait steps until we either send, defer, or finish.
  while (idx < steps.length) {
    const step = steps[idx];
    const ch = step.channel;

    if (step.action === "wait") { idx++; continue; }

    // PARK an IV email step we can't actually send yet (sequence not live, or this
    // recipient isn't on the test allowlist). Do NOT advance — otherwise a dormant run
    // would silently "preview" past the real emails and complete, so flipping live later
    // would send nothing. Reschedule the same step; it fires the moment it can send.
    if (isIvStep(run, step) && step.action === "send_email" && !dry) {
      const allow = ivAllow(env);
      const canSendNow = ivLive(env) && (allow.length === 0 || allow.includes(String(c.email || "").toLowerCase()));
      if (!canSendNow) { await scheduleAt(env, run, idx, new Date(Date.now() + 3600 * 1000).toISOString()); out.deferred = (out.deferred || 0) + 1; return; }
    }

    // PARK non-IV workflows while the engine is off. The */5 cron still ticks (because IV is
    // live), so without this a Cold-to-Demo run would "preview" through every step and complete
    // without sending. Instead we hold the CURRENT step (reschedule +1h, don't advance) so
    // anything enrolled before go-live fires the moment WORKFLOW_ENGINE_ENABLED flips to true.
    if (!dry && !enabled(env) && !isIvStep(run, step) && step.action !== "wait") {
      await scheduleAt(env, run, idx, new Date(Date.now() + 3600 * 1000).toISOString());
      out.deferred = (out.deferred || 0) + 1; return;
    }

    // Consent gate before any message action.
    if (ch === "sms" || ch === "voice" || ch === "email") {
      const gate = await canSend(env, { contactId: run.contact_id, email: c.email, phone: c.phone, channel: ch });
      if (!gate.ok) {
        if (gate.reason === "suppressed") { await exitRun(env, run, "suppressed", out); return; }
        // no PEWC (sms/voice) or email revoked → skip this step, keep the sequence moving (email carries it).
        await logStep(env, run, idx, ch, step.action, "skipped", gate.reason);
        await logEvent(env, { type: "sequence_step_completed", contactId: run.contact_id, workflowRunId: run.id, channel: ch, meta: { step: idx, status: "skipped", reason: gate.reason } });
        out.skipped++; idx++; continue;
      }
    }

    // Quiet hours (sms/voice only): defer the whole run to window-open.
    if (ch === "sms" || ch === "voice") {
      const okAt = sendableAt(Date.now(), ch, env);
      if (okAt > Date.now() + 60000) {
        await scheduleAt(env, run, idx, new Date(okAt).toISOString());
        out.deferred++; return;
      }
    }

    // Frequency cap (Phase 2): ≤4 automated emails / 30d across all sequences. Defer the
    // whole run past the window rather than dropping the touch.
    if (step.action === "send_email" && !dry) {
      const freeAt = await freqCapFreeAt(env, run.contact_id);
      if (freeAt > Date.now() + 60000) {
        await logStep(env, run, idx, ch, step.action, "deferred", "freq_cap");
        await logEvent(env, { type: "freq_capped", contactId: run.contact_id, workflowRunId: run.id, meta: { step: idx, retry_at: new Date(freeAt).toISOString() } });
        await scheduleAt(env, run, idx, new Date(freeAt).toISOString());
        out.deferred++; return;
      }
    }

    // Execute the action.
    const res = await executeStep(env, run, c, step, idx, out, dry);
    if (res === "exit") return;
    if (res === "retry") {
      // A genuine send failure (provider error, not an unconfigured-provider hold and not a
      // skip). DON'T advance the drip — that would silently drop this touch. Reschedule the
      // SAME step with exponential backoff, bounded so a permanently-failing step eventually
      // gives up instead of looping forever.
      const attempts = await failedAttempts(env, run.id, idx);
      if (attempts >= 4) {
        await logStep(env, run, idx, ch, step.action, "skipped", "gave_up_after_retries");
        out.skipped++; idx++; continue; // move on so the run isn't stuck
      }
      const backoffMin = Math.min(240, 15 * Math.pow(2, attempts)); // 15m,30m,60m,120m…
      await scheduleAt(env, run, idx, new Date(sendableAt(Date.now() + backoffMin * 60000, ch, env)).toISOString());
      out.deferred++; return;
    }
    // schedule the NEXT step (if any) after its delay; else complete.
    const next = steps[idx + 1];
    if (!next) {
      await completeRun(env, run, "completed"); out.completed++;
      // Finished Cold-to-Demo with zero engagement → drop into Long-Term Nurture.
      if (run.workflow_id === "cold-to-demo") { try { if (!(await hadEngagement(env, run.contact_id, "1970-01-01T00:00:00Z"))) await enrollNurture(env, run.contact_id, "cold_to_demo_no_engagement"); } catch (_) {} }
      return;
    }
    let atMs = sendableAt(Date.now() + (next.delay_minutes || 0) * 60000, next.channel, env);
    // Phase 2: cold-to-demo emails land only Tue–Thu 8–11am prospect-local.
    if (run.workflow_id === "cold-to-demo" && next.action === "send_email") atMs = nextSlot(atMs, contactTz(c), coldOk);
    await scheduleAt(env, run, idx + 1, new Date(atMs).toISOString());
    return; // one action per tick per run
  }
  await completeRun(env, run, "completed"); out.completed++;
}

async function executeStep(env, run, c, step, idx, out, dry) {
  // Terminal action: drop the lead onto the newsletter track (no send of its own — the
  // re-permission runner handles that separately). Also nudges the thread to Nurture.
  if (step.action === "subscribe_newsletter") {
    try { const { optInContacts } = await import("./newsletter.js"); await optInContacts(env, { contactIds: [run.contact_id], captureMethod: "workflow_newsletter", source: "workflow" }); } catch (_) {}
    if (run.conversation_id) await env.DB.prepare("UPDATE conversations SET status='nurture', updated_at=datetime('now') WHERE id=?").bind(run.conversation_id).run().catch(() => {});
    await logStep(env, run, idx, null, "subscribe_newsletter", "sent", "");
    await logEvent(env, { type: "newsletter_subscribed", contactId: run.contact_id, workflowRunId: run.id, meta: { step: idx } });
    return;
  }
  // Task step: emit an assignable task (LinkedIn / call / manual) for the SDR. No send;
  // the human does the action and logs the outcome. Created live only when the engine is on.
  if (step.action === "create_task") {
    const live = !dry && enabled(env);
    const cv = coldVars(env, c);
    const title = fill(step.title || "Follow-up", cv);
    const body = fill(step.task_body || "", cv);
    if (live) {
      // Call tasks get due-dated into the next call window (Mon–Fri 8–10 / 4–5:30 local).
      const due = step.task_type === "call" ? new Date(nextSlot(Date.now(), contactTz(c), callOk)).toISOString() : new Date().toISOString();
      await createTask(env, { contactId: run.contact_id, conversationId: run.conversation_id, companyId: c.company_id || null,
        type: step.task_type || "manual", title, body, dueAt: due, source: "sequence", workflowRunId: run.id });
    }
    await logStep(env, run, idx, step.channel, "create_task", live ? "created" : "preview", title);
    await logEvent(env, { type: live ? "task_created" : "sequence_step_completed", contactId: run.contact_id, conversationId: run.conversation_id, workflowRunId: run.id, channel: step.channel, meta: { step: idx, type: step.task_type || "manual", title, preview: !live || undefined } });
    out.tasked = (out.tasked || 0) + 1;
    return;
  }
  // Per-sequence live gating: IV emails send for real only when IV_LIVE is on AND (no test
  // allowlist, or this recipient is on it). Every other workflow needs the global engine on.
  // Otherwise we run the step as a preview (records intent, sends nothing).
  let eff = dry;
  if (!dry) {
    if (isIvStep(run, step)) {
      const allow = ivAllow(env);
      eff = !(ivLive(env) && (allow.length === 0 || allow.includes(String(c.email || "").toLowerCase())));
    } else {
      eff = !enabled(env);
    }
  }
  // IV emails render from their (possibly edited-in-CRM) subject/html override; other
  // workflows use the code templates.
  const t = (isIvStep(run, step) && step.action === "send_email")
    ? renderIvTemplate(step.template, buildVars(env, { contact: c, visitor: (c._enrich || {})._visitor, person: (c._enrich || {})._person }), { subject: step.subject, html: step.html })
    : tpl(env, step.template, c);
  let res, type, cost = 0;
  if (step.action === "send_email") {
    if (!c.email) { await logStep(env, run, idx, "email", step.action, "skipped", "no_email"); out.skipped++; return; }
    // IV emails go out as "Tyler Spurlock" (the human they're written from); all other
    // sequences keep the default Consent Resolve sender. Reply-To stays hello@ either way.
    const from = (isIvStep(run, step) && step.action === "send_email") ? "Tyler Spurlock <hello@consentresolve.com>" : undefined;
    res = await sendResend(env, { to: c.email, subject: t.subject, html: t.html, text: t.text, from, unsubUrl: c.id ? "https://consentresolve.com/api/unsubscribe?c=" + encodeURIComponent(c.id) : undefined }, eff);
    type = eff ? "email_preview" : "email_sent";
    if (!eff) await maybeCreateMessage(env, run, c, "email", t.subject, t.html);
  } else if (step.action === "send_sms") {
    if (!c.phone) { await logStep(env, run, idx, "sms", step.action, "skipped", "no_phone"); out.skipped++; return; }
    res = await sendTelnyxSms(env, { to: c.phone, text: t.text }, eff);
    type = eff ? "sms_preview" : "sms_sent"; cost = eff ? 0 : 1; // ~$0.0085/seg → tracked in cents rounded to 1 for now
  } else if (step.action === "place_ai_call") {
    if (!c.phone) { await logStep(env, run, idx, "voice", step.action, "skipped", "no_phone"); out.skipped++; return; }
    res = await placeRetellCall(env, { to: c.phone, script: t.script }, eff);
    type = eff ? "call_preview" : "call_placed"; cost = eff ? 0 : 10;
  } else { await logStep(env, run, idx, step.channel, step.action, "skipped", "unknown_action"); out.skipped++; return; }

  if (res.ok) {
    await logStep(env, run, idx, step.channel, step.action, eff ? "preview" : "sent", res.id || "");
    await logEvent(env, { type, contactId: run.contact_id, conversationId: run.conversation_id, workflowRunId: run.id, channel: step.channel, costCents: cost, meta: { step: idx, provider_id: res.id, template: step.template, dry: eff || undefined, preview: res.preview } });
    if (step.action === "send_email") out.emailed++;
  } else if (res.hold) {
    // Provider not configured yet (Telnyx/Retell) → treat as skipped, keep sequence moving.
    await logStep(env, run, idx, step.channel, step.action, "skipped", res.error);
    await logEvent(env, { type: "sequence_step_completed", contactId: run.contact_id, workflowRunId: run.id, channel: step.channel, meta: { step: idx, status: "hold", reason: res.error } });
    out.skipped++;
  } else {
    // Genuine provider failure (e.g. Gmail 429, network). Log it and signal a retry so the
    // caller reschedules THIS step instead of advancing past a touch that never landed.
    await logStep(env, run, idx, step.channel, step.action, "failed", res.error);
    await logEvent(env, { type: step.channel === "sms" ? "sms_failed" : "sequence_step_completed", contactId: run.contact_id, workflowRunId: run.id, channel: step.channel, meta: { step: idx, status: "failed", error: res.error } });
    out.failed = (out.failed || 0) + 1;
    return eff ? undefined : "retry";
  }
}

// How many times step `idx` of this run has already failed — bounds the retry backoff.
async function failedAttempts(env, runId, idx) {
  try {
    const r = await env.DB.prepare(
      "SELECT COUNT(*) n FROM workflow_steps WHERE run_id=? AND step_index=? AND status='failed'"
    ).bind(runId, idx).first();
    return (r && r.n) || 0;
  } catch (_) { return 0; }
}

// Mirror an outbound automation email into the inbox conversation so the team sees it.
async function maybeCreateMessage(env, run, c, channel, subject, html) {
  if (!run.conversation_id) return;
  try {
    await env.DB.prepare(
      `INSERT INTO messages (id,conversation_id,direction,channel,body_text,body_html,sent_at)
       VALUES (?,?,?,?,?,?,?)`
    ).bind(ulid(), run.conversation_id, "out", channel, subject, html, nowIso()).run();
    await env.DB.prepare("UPDATE conversations SET last_message_at=?, last_message_preview=? WHERE id=?")
      .bind(nowIso(), (subject || "").slice(0, 120), run.conversation_id).run();
  } catch (_) {}
}

async function logStep(env, run, idx, channel, action, status, detail) {
  await env.DB.prepare(
    `INSERT INTO workflow_steps (id,run_id,step_index,channel,action,status,detail,executed_at) VALUES (?,?,?,?,?,?,?,?)`
  ).bind(ulid(), run.id, idx, channel || null, action || null, status, (detail || "").slice(0, 300), nowIso()).run();
}
async function scheduleAt(env, run, stepIdx, iso) {
  await env.DB.prepare("UPDATE workflow_runs SET current_step=?, next_run_at=?, updated_at=? WHERE id=?").bind(stepIdx, iso, nowIso(), run.id).run();
}
async function completeRun(env, run, reason) {
  await env.DB.prepare("UPDATE workflow_runs SET status='completed', exit_reason=?, next_run_at=NULL, updated_at=? WHERE id=?").bind(reason, nowIso(), run.id).run();
  await logEvent(env, { type: "sequence_exited", contactId: run.contact_id, workflowRunId: run.id, meta: { reason } });
}
async function exitRun(env, run, reason, out) {
  await env.DB.prepare("UPDATE workflow_runs SET status='exited', exit_reason=?, next_run_at=NULL, updated_at=? WHERE id=?").bind(reason, nowIso(), run.id).run();
  await logEvent(env, { type: "sequence_exited", contactId: run.contact_id, workflowRunId: run.id, meta: { reason } });
  out.exited++;
}

// Auto-enroll sweep: react to new inbound conversations without touching every ingest
// handler (approximates the "emit lead_created → engine reacts" inversion). Gated by flag.
async function autoEnrollSweep(env, { hours = 24, limit = 30 } = {}) {
  if (!enabled(env)) return { skipped: "disabled" };
  await ensureRebuildSchema(env); await seedWorkflows(env);
  const since = new Date(Date.now() - hours * 3600 * 1000).toISOString();
  const convs = (await env.DB.prepare(
    `SELECT cv.id conv_id, cv.contact_id, cv.channel, ct.source
       FROM conversations cv JOIN contacts ct ON ct.id=cv.contact_id
      WHERE cv.created_at>=? AND cv.contact_id IS NOT NULL AND ct.source IS NOT 'apollo'
        AND NOT EXISTS (SELECT 1 FROM workflow_runs r WHERE r.contact_id=cv.contact_id)
      ORDER BY cv.created_at DESC LIMIT ?`
  ).bind(since, limit).all()).results || [];
  let enrolled = 0;
  for (const cv of convs) {
    const r = await enrollContact(env, { contactId: cv.contact_id, conversationId: cv.conv_id, source: cv.channel });
    if (r.runId && !r.skipped) enrolled++;
  }
  return { enrolled, scanned: convs.length };
}

// Called from the */5 cron.
async function tick(env) {
  if (!enabled(env) && !ivLive(env)) return { skipped: "disabled" };
  // The generic auto-enroll sweep (earn-consent / speed-to-lead) only runs when the GLOBAL
  // engine is on — IV enrollment is handled by the CR visitor sync, so turning IV live
  // doesn't sweep every inbound conversation into a sequence.
  const a = enabled(env) ? await autoEnrollSweep(env, {}) : { skipped: "global_off" };
  const p = await processDueRuns(env, {});
  return { autoEnroll: a, process: p };
}

// ── Phase 2: no-reply / no-booking timer sweeps (run on the */5 cron) ────────
// A cold-to-demo contact who clicked/visited but hasn't replied → a call task next
// business day. Idempotent (skips if a call task was made in the last 3 days).
async function sweepClickNoReply(env) {
  if (!enabled(env)) return { skipped: "disabled" };
  const dayAgo = new Date(Date.now() - 24 * 3600e3).toISOString();
  const rows = (await env.DB.prepare(
    `SELECT DISTINCT r.contact_id, r.conversation_id FROM workflow_runs r
      WHERE r.workflow_id='cold-to-demo' AND r.status='active'
        AND EXISTS (SELECT 1 FROM crm_events e WHERE e.contact_id=r.contact_id AND e.type IN ('link_clicked','site_visit') AND e.occurred_at>=?)`
  ).bind(dayAgo).all().catch(() => ({ results: [] }))).results || [];
  let made = 0;
  for (const row of rows) {
    const cid = row.contact_id; if (!cid) continue;
    const replied = await env.DB.prepare("SELECT 1 FROM messages m JOIN conversations c ON c.id=m.conversation_id WHERE c.contact_id=? AND m.direction='in' AND COALESCE(m.sent_at,m.created_at)>=? LIMIT 1").bind(cid, dayAgo).first().catch(() => null);
    if (replied) continue;
    const recent = await env.DB.prepare("SELECT 1 FROM crm_tasks WHERE contact_id=? AND type='call' AND created_at>=? LIMIT 1").bind(cid, new Date(Date.now() - 3 * 86400e3).toISOString()).first().catch(() => null);
    if (recent) continue;
    const c = await loadContact(env, cid); if (!c) continue;
    const due = new Date(nextSlot(Date.now() + 86400e3, contactTz(c), callOk)).toISOString();
    await createTask(env, { contactId: cid, conversationId: row.conversation_id, type: "call", title: "Call — engaged, no reply", body: "They clicked a link or visited the site but haven't replied. Give them a quick call.", dueAt: due, source: "automation" });
    await logEvent(env, { type: "noreply_calltask", contactId: cid, meta: {} }).catch(() => {});
    made++;
  }
  return { made };
}
// Clicked the Email-4 calendar link ≥24h ago but never booked (and never replied) → one nudge.
async function sweepCalNoBooking(env) {
  const dry = !enabled(env);
  const lo = new Date(Date.now() - 7 * 86400e3).toISOString(), hi = new Date(Date.now() - 24 * 3600e3).toISOString();
  const rows = (await env.DB.prepare(
    `SELECT DISTINCT contact_id FROM crm_events WHERE type='link_clicked' AND occurred_at>=? AND occurred_at<=? AND (meta LIKE '%c2d_4%' OR meta LIKE '%cold_to_demo%')`
  ).bind(lo, hi).all().catch(() => ({ results: [] }))).results || [];
  let sent = 0;
  for (const row of rows) {
    const cid = row.contact_id; if (!cid) continue;
    const ct = await env.DB.prepare("SELECT lifecycle_stage FROM contacts WHERE id=?").bind(cid).first().catch(() => null);
    if (ct && ct.lifecycle_stage === "meeting_booked") continue;
    const replied = await env.DB.prepare("SELECT 1 FROM messages m JOIN conversations c ON c.id=m.conversation_id WHERE c.contact_id=? AND m.direction='in' LIMIT 1").bind(cid).first().catch(() => null);
    if (replied) continue;
    const nudged = await env.DB.prepare("SELECT 1 FROM crm_events WHERE contact_id=? AND type='demo_nudge_sent' LIMIT 1").bind(cid).first().catch(() => null);
    if (nudged) continue;
    const c = await loadContact(env, cid); if (!c || !c.email) continue;
    if (await isSuppressed(env, { contactId: cid, email: c.email, channel: "all" })) continue;
    const cv = coldVars(env, c);
    const html = c2dShell(cv.first_name, `<p>Saw you grabbed a look at some times — anything I can answer before you pick one?</p><p>Happy to keep it to 15 minutes.</p>`, c);
    const res = await sendResend(env, { to: c.email, subject: "anything I can answer?", html, unsubUrl: "https://consentresolve.com/api/unsubscribe?c=" + encodeURIComponent(c.id) }, dry);
    await logEvent(env, { type: "demo_nudge_sent", contactId: cid, meta: { dry: dry || undefined } }).catch(() => {});
    if (res && res.ok && !dry) sent++;
  }
  return { sent, dry };
}
async function runReplyTimers(env) {
  const a = await sweepClickNoReply(env).catch((e) => ({ error: String(e).slice(0, 80) }));
  const b = await sweepCalNoBooking(env).catch((e) => ({ error: String(e).slice(0, 80) }));
  return { clickNoReply: a, calNoBooking: b };
}

// ── Phase 3: Long-Term Nurture engine ────────────────────────────────────────
// Trade → months that trade's "season" is live (jumps a quarterly contact into a
// re-engagement sprint). Editable; sensible defaults you can tune.
const TRADE_SEASON = {
  roofing: [3, 4, 5, 9, 10], hvac: [5, 6, 7, 8, 12, 1], plumbing: [11, 12, 1, 2],
  electrical: [6, 7, 11, 12], landscaping: [3, 4, 5, 9], "lawn care": [3, 4, 5, 6],
  "pest control": [4, 5, 6, 7], "pool service": [4, 5, 6], painting: [4, 5, 6, 9],
  "garage door": [11, 12, 1], "septic": [3, 4, 5], "gutter": [3, 4, 9, 10],
  "pressure washing": [3, 4, 5, 6], "tree service": [3, 4, 9, 10, 11], concrete: [4, 5, 6, 9],
};
let _nurtEnsured = false;
async function ensureNurtureTable(env) {
  if (_nurtEnsured) return;
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS nurture_contacts (
    contact_id TEXT PRIMARY KEY, status TEXT NOT NULL DEFAULT 'active', next_touch_at TEXT,
    last_touch_at TEXT, touches_sent INTEGER NOT NULL DEFAULT 0, no_engage_count INTEGER NOT NULL DEFAULT 0,
    sprinted_season_month INTEGER, entered_reason TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')))`).run().catch(() => {});
  await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_nurture_due ON nurture_contacts(status, next_touch_at)`).run().catch(() => {});
  _nurtEnsured = true;
}
async function hadEngagement(env, contactId, since) {
  const click = await env.DB.prepare("SELECT 1 FROM crm_events WHERE contact_id=? AND type IN ('link_clicked','site_visit') AND occurred_at>? LIMIT 1").bind(contactId, since).first().catch(() => null);
  if (click) return true;
  const reply = await env.DB.prepare("SELECT 1 FROM messages m JOIN conversations c ON c.id=m.conversation_id WHERE c.contact_id=? AND m.direction='in' AND COALESCE(m.sent_at,m.created_at)>? LIMIT 1").bind(contactId, since).first().catch(() => null);
  return !!reply;
}
async function archiveNurture(env, contactId, reason) {
  await env.DB.prepare("UPDATE nurture_contacts SET status='archived', updated_at=datetime('now') WHERE contact_id=?").bind(contactId).run().catch(() => {});
  await logEvent(env, { type: "nurture_archived", contactId, meta: { reason } }).catch(() => {});
}
// Enroll a contact into quarterly nurture (from bad-timing replies or zero-engagement completions).
async function enrollNurture(env, contactId, reason) {
  await ensureNurtureTable(env);
  const next = new Date(Date.now() + 90 * 86400e3).toISOString();
  const ex = await env.DB.prepare("SELECT contact_id, status FROM nurture_contacts WHERE contact_id=?").bind(contactId).first().catch(() => null);
  if (ex) { await env.DB.prepare("UPDATE nurture_contacts SET status='active', next_touch_at=COALESCE(next_touch_at,?), updated_at=datetime('now') WHERE contact_id=?").bind(next, contactId).run().catch(() => {}); return { ok: true, already: true }; }
  await env.DB.prepare("INSERT INTO nurture_contacts (contact_id, status, next_touch_at, entered_reason) VALUES (?, 'active', ?, ?)").bind(contactId, next, reason || "").run().catch(() => {});
  await logEvent(env, { type: "nurture_enrolled", contactId, meta: { reason } }).catch(() => {});
  return { ok: true };
}
// Daily: send the quarterly value touch when due; seasonal in-season → sprint; hygiene archive.
async function runNurture(env) {
  await ensureNurtureTable(env);
  if (!enabled(env)) return { skipped: "disabled" };
  const nowMs = Date.now(), now = new Date(nowMs).toISOString();
  const month = new Date(nowMs).getUTCMonth() + 1;
  const due = (await env.DB.prepare("SELECT * FROM nurture_contacts WHERE status='active' AND next_touch_at IS NOT NULL AND next_touch_at<=? ORDER BY next_touch_at ASC LIMIT 100").bind(now).all().catch(() => ({ results: [] }))).results || [];
  let sent = 0, archived = 0, sprinted = 0;
  for (const row of due) {
    const cid = row.contact_id;
    const c = await loadContact(env, cid); if (!c || !c.email) { await archiveNurture(env, cid, "no_email"); archived++; continue; }
    if (await isSuppressed(env, { contactId: cid, email: c.email, channel: "all" })) { await archiveNurture(env, cid, "suppressed"); archived++; continue; }
    // Hygiene: two consecutive quarterly touches with zero clicks/replies → archive.
    if ((row.no_engage_count || 0) >= 2) { await archiveNurture(env, cid, "cold_2q"); archived++; continue; }
    const cv = coldVars(env, c);
    const seasonMonths = TRADE_SEASON[String(cv.trade || "").toLowerCase()] || [];
    // Seasonal trigger → 3-touch re-engagement sprint instead of a quarterly touch (once per season).
    if (seasonMonths.includes(month) && row.sprinted_season_month !== month) {
      await enrollContact(env, { contactId: cid, source: "nurture_seasonal", workflowId: "reengage" }).catch(() => {});
      await env.DB.prepare("UPDATE nurture_contacts SET last_touch_at=?, next_touch_at=?, sprinted_season_month=?, updated_at=datetime('now') WHERE contact_id=?")
        .bind(now, new Date(nowMs + 90 * 86400e3).toISOString(), month, cid).run().catch(() => {});
      await logEvent(env, { type: "nurture_seasonal_sprint", contactId: cid, meta: { month, trade: cv.trade } }).catch(() => {});
      sprinted++; continue;
    }
    // Quarterly value touch — rotate nt_1..nt_4. Was the prior touch engaged with?
    const engaged = row.last_touch_at ? await hadEngagement(env, cid, row.last_touch_at) : true;
    const tid = "nt_" + (((row.touches_sent || 0) % 4) + 1);
    const t = tpl(env, tid, c);
    const res = await sendResend(env, { to: c.email, subject: t.subject, html: t.html, unsubUrl: "https://consentresolve.com/api/unsubscribe?c=" + encodeURIComponent(c.id) }, !enabled(env));
    await logEvent(env, { type: "nurture_sent", contactId: cid, channel: "email", meta: { template: tid } }).catch(() => {});
    const newNoEngage = engaged ? 0 : ((row.no_engage_count || 0) + (row.last_touch_at ? 1 : 0));
    await env.DB.prepare("UPDATE nurture_contacts SET last_touch_at=?, next_touch_at=?, touches_sent=touches_sent+1, no_engage_count=?, updated_at=datetime('now') WHERE contact_id=?")
      .bind(now, new Date(nowMs + 90 * 86400e3).toISOString(), newNoEngage, cid).run().catch(() => {});
    if (res && res.ok) sent++;
  }
  return { sent, archived, sprinted };
}

export {
  enabled, seedWorkflows, enrollContact, handleGoalEvent, processDueRuns,
  autoEnrollSweep, tick, sendableAt, tpl, sendTelnyxSms, sendResend, placeRetellCall,
  runReplyTimers, runNurture, enrollNurture,
};
