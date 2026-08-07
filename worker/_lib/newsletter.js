// worker/_lib/newsletter.js
// The Cold Lead Reactivation newsletter stack — a DEDICATED sending path via Resend on
// tryconsentresolve.com, deliberately isolated from the Gmail transactional/1:1 mail and the
// Instantly cold stack (playbook rule #2). Covers Phase 2 (the 3-email re-permission
// sequence) and the shared sender used by Phase 3.
//
// SAFETY: nothing sends for real until NEWSLETTER_ENABLED === "true". Before that (and for
// anyone not on the NEWSLETTER_TEST_EMAILS allowlist while it's set) the send is SIMULATED —
// logged, never dispatched — so the sequence can be exercised safely (go-live-to-ourselves).
import { logEvent, addSuppression, recordConsent, ensureRebuildSchema } from "./crm-rebuild.js";
import { sendEmail as gmailSend } from "./gmail.js";

// ---- schema ---------------------------------------------------------------
let _nlReady = false;
export async function ensureNewsletterSchema(env) {
  if (_nlReady) return;
  const cols = [
    "ALTER TABLE contacts ADD COLUMN repermission_step INTEGER DEFAULT 0",
    "ALTER TABLE contacts ADD COLUMN repermission_next_at TEXT",
    "ALTER TABLE contacts ADD COLUMN repermission_started_at TEXT",
    "ALTER TABLE contacts ADD COLUMN reengaged_at TEXT",     // last Interested-tier personal re-engagement
  ];
  for (const sql of cols) { try { await env.DB.prepare(sql).run(); } catch (_) {} }
  // Per-(contact,issue) send log so an issue is never sent twice to the same reader.
  try { await env.DB.prepare("CREATE TABLE IF NOT EXISTS newsletter_issue_log (contact_id TEXT, issue_id TEXT, sent_at TEXT, PRIMARY KEY (contact_id, issue_id))").run(); } catch (_) {}
  // D1-backed live/test toggle so it survives CI deploys (dashboard plain vars get wiped).
  try { await env.DB.prepare("CREATE TABLE IF NOT EXISTS newsletter_settings (k TEXT PRIMARY KEY, v TEXT)").run(); } catch (_) {}
  _nlReady = true;
}

// Resolved config: env vars OR the D1 settings row (either can turn it live).
async function getNlSettings(env) {
  try { const rows = (await env.DB.prepare("SELECT k,v FROM newsletter_settings").all()).results || []; const o = {}; for (const r of rows) o[r.k] = r.v; return o; } catch (_) { return {}; }
}
export async function setNlSettings(env, obj) {
  await ensureNewsletterSchema(env);
  for (const [k, v] of Object.entries(obj)) {
    await env.DB.prepare("INSERT INTO newsletter_settings (k,v) VALUES (?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v").bind(k, String(v)).run().catch(() => {});
  }
}
export async function nlConfig(env) {
  const s = await getNlSettings(env);
  const enabled = env.NEWSLETTER_ENABLED === "true" || s.enabled === "1";
  const allow = [...new Set([...csv(env.NEWSLETTER_TEST_EMAILS), ...csv(s.test_emails)])];
  return { enabled, allow };
}

// ---- sending identity + gate ---------------------------------------------
const FROM = (env) => env.NEWSLETTER_FROM || "Aaron Phillips <aaron@tryconsentresolve.com>";
const REPLY_TO = (env) => env.NEWSLETTER_REPLY_TO || "hello@consentresolve.com";
const csv = (s) => String(s || "").split(/[,\s]+/).map((x) => x.trim().toLowerCase()).filter(Boolean);

// live | simulate — a real send only when enabled AND (no allowlist, or recipient on it).
// Takes the RESOLVED config (env + D1) from nlConfig(env).
export function decideSend(cfg, to) {
  if (!cfg || !cfg.enabled) return "simulate";
  if (cfg.allow.length && !cfg.allow.includes(String(to || "").trim().toLowerCase())) return "simulate";
  return "live";
}

// Send one email through Resend. Returns { ok, id, act }. Never throws.
export async function resendSend(env, { to, subject, html, text, headers }) {
  const act = decideSend(await nlConfig(env), to);
  if (act === "simulate") return { ok: true, act, id: "sim-" + Date.now() };
  const key = env.NEWSLETTER_RESEND_KEY;
  if (!key) return { ok: false, act, error: "no_resend_key" };
  const body = { from: FROM(env), to: [to], reply_to: REPLY_TO(env), subject };
  if (html) body.html = html;
  if (text) body.text = text;
  if (headers) body.headers = headers;
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const j = await r.json().catch(() => ({}));
    return r.ok ? { ok: true, act, id: j.id } : { ok: false, act, error: `resend_${r.status}: ${String(j.message || "").slice(0, 160)}` };
  } catch (e) { return { ok: false, act, error: String(e).slice(0, 160) }; }
}

// ---- tracked opt-in links (HMAC-signed so they can't be forged) -----------
export async function optinToken(env, contactId) {
  const secret = env.NEWSLETTER_TOKEN_SECRET || env.ADMIN_SESSION_SECRET || "cr-newsletter";
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", k, new TextEncoder().encode("optin:" + contactId));
  return btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "").slice(0, 20);
}
async function optinUrl(env, contactId, answer) {
  const origin = env.STL_PUBLIC_ORIGIN || "https://consentresolve.com";
  const t = await optinToken(env, contactId);
  return `${origin}/api/newsletter/optin?c=${encodeURIComponent(contactId)}&a=${answer}&t=${t}`;
}
function unsubUrl(env, contactId) {
  const origin = env.STL_PUBLIC_ORIGIN || "https://consentresolve.com";
  return `${origin}/api/unsubscribe?c=${encodeURIComponent(contactId)}`;
}

// ---- email furniture ------------------------------------------------------
const ADDR = "1907 Gulf Way #1, St Pete Beach, FL 33706";
function shell(bodyHtml, { contactId, env }) {
  return `<div style="font-family:-apple-system,system-ui,Segoe UI,Arial,sans-serif;font-size:16px;line-height:1.6;color:#111;max-width:560px">
${bodyHtml}
<hr style="border:none;border-top:1px solid #e5e9f0;margin:22px 0 12px">
<div style="font-size:12px;color:#8a97a6">Consent Resolve · ${ADDR}<br>
<a href="${unsubUrl(env, contactId)}" style="color:#8a97a6">Unsubscribe</a></div></div>`;
}
function btn(href, label, color = "#00a37a") {
  return `<a href="${href}" style="display:inline-block;background:${color};color:#fff;text-decoration:none;font-weight:700;padding:11px 20px;border-radius:9px;margin:6px 8px 6px 0">${label}</a>`;
}

// ---- Part 5: the 3 re-permission emails -----------------------------------
async function repermissionEmail(env, c, step) {
  const first = (c.full_name || "there").split(" ")[0];
  const yes = await optinUrl(env, c.id, "yes");
  const no = await optinUrl(env, c.id, "no");
  if (step === 1) {
    const html = shell(
      `<p>Hey ${first},</p>
       <p>You raised your hand with us a while back — looking for more booked jobs without the shared-lead games.</p>
       <p>We built the thing. Now there's a short monthly email: one idea, one number you can actually use. No pitch-fest.</p>
       <p><b>Want it?</b></p>
       <p>${btn(yes, "Yes, send it")}${btn(no, "No thanks", "#8a97a6")}</p>`, { contactId: c.id, env });
    const text = `Hey ${first},\n\nYou raised your hand with us a while back. We built the thing — a short monthly email, one idea and one number you can use.\n\nWant it?\nYes: ${yes}\nNo thanks: ${no}`;
    return { subject: "Still chasing more booked jobs?", html, text };
  }
  if (step === 2) {
    const html = shell(
      `<p>Hey ${first},</p>
       <p>Here's exactly what you'd be getting — this is the first issue, in full:</p>
       <p style="background:#f5f7f9;border-radius:10px;padding:14px 16px"><b>Where did August go?</b><br>
       About 98 of every 100 people who land on a contractor's site leave without giving a name. You paid for those clicks. Pull two numbers off your site — sessions, and form-fills + tracked calls — subtract, multiply by your close rate and ticket. That's what walked out the door. One issue a month, that useful.</p>
       <p>Want these?</p>
       <p>${btn(yes, "Send me these")}</p>`, { contactId: c.id, env });
    const text = `Hey ${first},\n\nHere's the first issue in full: "Where did August go?" — 98 of 100 site visitors leave without a name. Pull sessions minus (form-fills + tracked calls), multiply by close rate and ticket = what walked out the door. One useful issue a month.\n\nSend me these: ${yes}`;
    return { subject: "Here's what you'd be getting", html, text };
  }
  // step 3
  const html = shell(
    `<p>Hey ${first},</p>
     <p>Last one from me — I'm not going to keep bothering you.</p>
     <p>If a short, useful monthly note on getting more out of the traffic you already pay for sounds worth it, the door's open.</p>
     <p>${btn(yes, "Actually, keep me on the list")}</p>`, { contactId: c.id, env });
  const text = `Hey ${first},\n\nLast one from me — not going to keep bothering you. If a short, useful monthly note sounds worth it, the door's open.\n\nKeep me on the list: ${yes}`;
  return { subject: "Last one from me", html, text };
}

// Delays between re-permission steps (playbook: Day 1 / Day 4 / Day 10, then suppress).
const STEP_DELAY_DAYS = { 1: 3, 2: 6, 3: 3 }; // step1→2: 3d, step2→3: 6d (=day10), step3→suppress: 3d

// ---- enrollment -----------------------------------------------------------
// Enroll a set of contacts (default: everyone in the Nurture bucket with an email who isn't
// already opted-in/suppressed) into the re-permission sequence. Idempotent.
export async function enrollRepermission(env, { contactIds } = {}) {
  await ensureRebuildSchema(env); await ensureNewsletterSchema(env);
  let ids = contactIds;
  if (!ids) {
    const rows = (await env.DB.prepare(
      `SELECT DISTINCT ct.id FROM contacts ct
         JOIN conversations cv ON cv.contact_id = ct.id AND cv.status='nurture'
        WHERE ct.primary_email IS NOT NULL
          AND COALESCE(ct.newsletter_status,'pending')='pending'
          AND ct.id NOT IN (SELECT contact_id FROM suppressions WHERE channel IN ('all','email') AND contact_id IS NOT NULL)`
    ).all()).results || [];
    ids = rows.map((r) => r.id);
  }
  let enrolled = 0;
  for (const id of ids) {
    await env.DB.prepare(
      "UPDATE contacts SET newsletter_status='pending', repermission_step=1, repermission_started_at=datetime('now'), repermission_next_at=datetime('now') WHERE id=? AND COALESCE(newsletter_status,'pending')='pending'"
    ).bind(id).run().catch(() => {});
    enrolled++;
  }
  return { enrolled, count: ids.length };
}

// ---- Pre-consented opt-in (account policy: contacts are treated as consented) --------------
// Has this contact EXPLICITLY opted out of email? (declined the newsletter, unsubscribed, filed a
// complaint, or revoked email consent.) We NEVER re-subscribe these — re-mailing a known opt-out is
// the one genuinely-illegal move. A plain non-response ('no_repermission') is NOT an opt-out.
async function isExplicitOptOut(env, id) {
  if (!id) return false;
  const s = await env.DB.prepare(
    "SELECT 1 FROM suppressions WHERE contact_id=? AND channel IN ('all','email') AND (" +
    "lower(COALESCE(reason,'')) LIKE '%declin%' OR lower(COALESCE(reason,'')) LIKE '%unsub%' OR " +
    "lower(COALESCE(reason,'')) LIKE '%optout%' OR lower(COALESCE(reason,'')) LIKE '%opt-out%' OR " +
    "lower(COALESCE(reason,'')) LIKE '%complain%' OR lower(COALESCE(reason,'')) LIKE '%spam%') LIMIT 1"
  ).bind(id).first().catch(() => null);
  if (s) return true;
  const r = await env.DB.prepare("SELECT 1 FROM consent_records WHERE contact_id=? AND channel='email' AND action='revoked' LIMIT 1").bind(id).first().catch(() => null);
  return !!r;
}
// Opt a set of contacts into the newsletter DIRECTLY (no re-permission ask). Records an HONEST
// consent record (admin / legitimate-interest attestation — never a fabricated click), skips
// explicit opt-outs, and clears only a prior non-response suppression so lapsed contacts can send.
export async function optInContacts(env, { contactIds = [], basis = "existing relationship / legitimate interest", captureMethod = "admin_attested", source = "crm", actorEmail = null } = {}) {
  await ensureRebuildSchema(env); await ensureNewsletterSchema(env);
  let opted = 0, skipped = 0;
  for (const id of contactIds) {
    if (!id) continue;
    if (await isExplicitOptOut(env, id)) { skipped++; continue; }
    const c = await env.DB.prepare("SELECT id, primary_email FROM contacts WHERE id=?").bind(id).first().catch(() => null);
    if (!c) { skipped++; continue; }
    await env.DB.prepare("UPDATE contacts SET newsletter_status='opted_in', repermission_step=0, repermission_next_at=NULL, updated_at=datetime('now') WHERE id=?").bind(id).run().catch(() => {});
    await env.DB.prepare("DELETE FROM suppressions WHERE contact_id=? AND channel IN ('all','email') AND lower(COALESCE(reason,''))='no_repermission'").bind(id).run().catch(() => {});
    if (c.primary_email) await recordConsent(env, { contactId: id, email: c.primary_email, channel: "email", action: "granted", basis, captureMethod, source, proofRef: actorEmail ? ("attested_by:" + actorEmail) : null }).catch(() => {});
    opted++;
  }
  return { opted_in: opted, skipped_optout: skipped, count: contactIds.length };
}
// Retroactive bulk: opt in EVERY contact with an email who isn't already opted-in and hasn't
// explicitly opted out. (The pre-consented policy applied to the existing base — admin action.)
export async function optInAll(env, { limit = 5000, actorEmail = null } = {}) {
  await ensureRebuildSchema(env); await ensureNewsletterSchema(env);
  const rows = (await env.DB.prepare(
    "SELECT id FROM contacts WHERE primary_email IS NOT NULL AND primary_email!='' AND COALESCE(newsletter_status,'pending')<>'opted_in' LIMIT ?"
  ).bind(limit).all()).results || [];
  const ids = rows.map((r) => r.id);
  const res = await optInContacts(env, { contactIds: ids, basis: "existing relationship / legitimate interest", captureMethod: "admin_bulk_attestation", source: "admin", actorEmail });
  return { ...res, scanned: ids.length, capped: ids.length >= limit };
}

// ---- the runner (cron) ----------------------------------------------------
// Advance every contact whose re-permission step is due. Inert (advances nothing) while the
// contact is in simulate mode — so the sequence isn't consumed before you go live.
export async function runRepermission(env, { limit = 100 } = {}) {
  await ensureNewsletterSchema(env);
  const due = (await env.DB.prepare(
    `SELECT id, full_name, primary_email, repermission_step FROM contacts
      WHERE COALESCE(newsletter_status,'pending')='pending' AND repermission_step BETWEEN 1 AND 3
        AND repermission_next_at IS NOT NULL AND repermission_next_at <= datetime('now')
        AND primary_email IS NOT NULL LIMIT ?`
  ).bind(limit).all()).results || [];
  const cfg = await nlConfig(env);
  let sent = 0, suppressed = 0, simulated = 0;
  for (const c of due) {
    const to = c.primary_email;
    if (decideSend(cfg, to) === "simulate") { simulated++; continue; } // leave it pending; nothing consumed
    const step = c.repermission_step;
    const mail = await repermissionEmail(env, c, step);
    const res = await resendSend(env, { to, subject: mail.subject, html: mail.html, text: mail.text,
      headers: { "List-Unsubscribe": `<${unsubUrl(env, c.id)}>, <mailto:hello@consentresolve.com?subject=unsubscribe>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } });
    if (!res.ok) continue; // retry next tick
    await logEvent(env, { type: "repermission_sent", contactId: c.id, channel: "email", meta: { step, id: res.id } }).catch(() => {});
    sent++;
    if (step >= 3) {
      // After the final email, wait the grace window, then suppression happens on a later tick
      // (handled below by the "past step 3 + grace elapsed" pass).
      await env.DB.prepare("UPDATE contacts SET repermission_step=4, repermission_next_at=datetime('now', ?) WHERE id=?")
        .bind(`+${STEP_DELAY_DAYS[3]} day`, c.id).run().catch(() => {});
    } else {
      await env.DB.prepare("UPDATE contacts SET repermission_step=?, repermission_next_at=datetime('now', ?) WHERE id=?")
        .bind(step + 1, `+${STEP_DELAY_DAYS[step]} day`, c.id).run().catch(() => {});
    }
  }
  // Final pass: contacts who reached step 4 (all 3 sent) and never acted → suppress email, keep in CRM.
  const expired = (await env.DB.prepare(
    "SELECT id, primary_email FROM contacts WHERE COALESCE(newsletter_status,'pending')='pending' AND repermission_step=4 AND repermission_next_at <= datetime('now') LIMIT ?"
  ).bind(limit).all()).results || [];
  for (const c of expired) {
    await env.DB.prepare("UPDATE contacts SET newsletter_status='suppressed', repermission_step=0, repermission_next_at=NULL WHERE id=?").bind(c.id).run().catch(() => {});
    await addSuppression(env, { contactId: c.id, email: c.primary_email, channel: "email", reason: "no_repermission", source: "newsletter" }).catch(() => {});
    suppressed++;
  }
  return { sent, suppressed, simulated, due: due.length };
}

// ---- opt-in / opt-out handler (called by the public /api/newsletter/optin) --
export async function handleOptin(env, contactId, answer, token) {
  await ensureRebuildSchema(env); await ensureNewsletterSchema(env);
  const expect = await optinToken(env, contactId);
  if (!token || token !== expect) return { ok: false, error: "bad_token" };
  const c = await env.DB.prepare("SELECT id, primary_email FROM contacts WHERE id=?").bind(contactId).first();
  if (!c) return { ok: false, error: "not_found" };
  if (answer === "yes") {
    await env.DB.prepare("UPDATE contacts SET newsletter_status='opted_in', repermission_step=0, repermission_next_at=NULL WHERE id=?").bind(contactId).run().catch(() => {});
    // A deliberate opt-in click is real intent — record consent + score it.
    await recordConsent(env, { contactId, email: c.primary_email, channel: "email", action: "granted", basis: "newsletter opt-in", captureMethod: "repermission_link", source: "newsletter" }).catch(() => {});
    await logEvent(env, { type: "poll_response", contactId, channel: "email", meta: { kind: "newsletter_optin", answer: "yes" } }).catch(() => {});
    return { ok: true, status: "opted_in" };
  }
  // "No thanks" → suppress email, keep in CRM (mail/social/retargeting still allowed offline).
  await env.DB.prepare("UPDATE contacts SET newsletter_status='suppressed', repermission_step=0, repermission_next_at=NULL WHERE id=?").bind(contactId).run().catch(() => {});
  await addSuppression(env, { contactId, email: c.primary_email, channel: "email", reason: "declined_newsletter", source: "newsletter" }).catch(() => {});
  return { ok: true, status: "declined" };
}

// ---- Poll tap: capture the segmentation field + score it -------------------
const SEG_FIELDS = new Set(["seg_ticket", "seg_channel", "seg_trucks", "seg_crm"]);
export async function handlePoll(env, { contactId, field, value, issue, token }) {
  await ensureNewsletterSchema(env);
  if (!SEG_FIELDS.has(field)) return { ok: false, error: "bad_field" };
  if (!token || token !== await optinToken(env, contactId)) return { ok: false, error: "bad_token" };
  await env.DB.prepare(`UPDATE contacts SET ${field}=? WHERE id=?`).bind(String(value).slice(0, 40), contactId).run().catch(() => {});
  await logEvent(env, { type: "poll_response", contactId, channel: "email", meta: { field, value, issue } }).catch(() => {});
  return { ok: true };
}

// ---- Monthly issue send (HOLD-FOR-APPROVAL) --------------------------------
// Without confirm:true this is a DRY RUN — returns the recipient count + a rendered preview so
// the issue can be reviewed. With confirm:true it sends to every opted-in reader (deduped per
// issue, gated by nlConfig, throttled), and scores nothing until they click/reply.
export async function sendIssue(env, { issueId, confirm = false, limit = 2000 }) {
  await ensureNewsletterSchema(env);
  const { loadIssue, renderIssue } = await import("./newsletter-issues.js");
  const issue = await loadIssue(env, issueId); // D1 copy (edited in the CRM) wins
  if (!issue) return { ok: false, error: "unknown_issue" };
  const origin = env.STL_PUBLIC_ORIGIN || "https://consentresolve.com";
  const cfg = await nlConfig(env);

  // Opted-in, not suppressed, has an email, not already sent this issue.
  const recips = (await env.DB.prepare(
    `SELECT ct.id, ct.full_name, ct.primary_email FROM contacts ct
      WHERE ct.newsletter_status='opted_in' AND ct.primary_email IS NOT NULL
        AND ct.id NOT IN (SELECT contact_id FROM suppressions WHERE channel IN ('all','email') AND contact_id IS NOT NULL)
        AND ct.id NOT IN (SELECT contact_id FROM newsletter_issue_log WHERE issue_id=?)
      LIMIT ?`
  ).bind(issue.id, limit).all()).results || [];

  if (!confirm) {
    const sample = recips[0] || { id: "sample", full_name: "Sam", primary_email: "sample@example.com" };
    const preview = await renderIssue(env, sample, issue, { unsubUrl: `${origin}/api/unsubscribe?c=${sample.id}` });
    return { ok: true, dry: true, issue: issue.id, cep: issue.cep, subject: preview.subject, recipients: recips.length, sending: cfg.enabled ? "LIVE" : "simulate", preview_html: preview.html };
  }

  let sent = 0, simulated = 0, failed = 0;
  const throttleMs = Math.max(0, parseInt(env.NEWSLETTER_THROTTLE_MS || "250", 10) || 250);
  for (let i = 0; i < recips.length; i++) {
    const c = recips[i];
    const mail = await renderIssue(env, c, issue, { unsubUrl: `${origin}/api/unsubscribe?c=${encodeURIComponent(c.id)}` });
    const res = await resendSend(env, { to: c.primary_email, subject: mail.subject, html: mail.html, text: mail.text,
      headers: { "List-Unsubscribe": `<${origin}/api/unsubscribe?c=${encodeURIComponent(c.id)}>, <mailto:hello@consentresolve.com?subject=unsubscribe>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } });
    if (res.act === "simulate") { simulated++; continue; }   // don't log a send that didn't happen
    if (!res.ok) { failed++; continue; }
    await env.DB.prepare("INSERT OR IGNORE INTO newsletter_issue_log (contact_id, issue_id, sent_at) VALUES (?,?,datetime('now'))").bind(c.id, issue.id).run().catch(() => {});
    await logEvent(env, { type: "newsletter_sent", contactId: c.id, channel: "email", meta: { issue: issue.id, id: res.id } }).catch(() => {});
    sent++;
    if (throttleMs && i < recips.length - 1) await new Promise((r) => setTimeout(r, throttleMs));
  }
  return { ok: true, issue: issue.id, sent, simulated, failed, eligible: recips.length };
}

// ---- Interested-tier personal re-engagement (playbook Part 3) --------------
// When a lead clicks and crosses into Interested, send ONE genuine 1:1 email from a human
// (via Gmail hello@, so it lands in Primary and replies thread into the CRM), referencing the
// specific thing they clicked. Once per contact. Gated by nlConfig.
export async function runReengagement(env, { limit = 50 } = {}) {
  await ensureNewsletterSchema(env);
  const cfg = await nlConfig(env);
  if (!cfg.enabled) return { sent: 0, skipped: "not_enabled" };
  const rows = (await env.DB.prepare(
    `SELECT id, full_name, primary_email FROM contacts
      WHERE tier='interested' AND reengaged_at IS NULL AND primary_email IS NOT NULL
        AND id NOT IN (SELECT contact_id FROM suppressions WHERE channel IN ('all','email') AND contact_id IS NOT NULL)
        AND id IN (SELECT DISTINCT contact_id FROM crm_events WHERE type='link_clicked' AND occurred_at > datetime('now','-7 day') AND contact_id IS NOT NULL)
      LIMIT ?`
  ).bind(limit).all()).results || [];
  let sent = 0;
  const account = String(env.CRM_INBOX_EMAILS || "hello@consentresolve.com").split(/[,\s]+/)[0].trim().toLowerCase();
  for (const c of rows) {
    if (decideSend(cfg, c.primary_email) === "simulate") continue; // honor the test allowlist
    const first = (c.full_name || "there").split(" ")[0];
    // What did they last click? Personalize off it.
    let clicked = "";
    try { const ev = await env.DB.prepare("SELECT meta FROM crm_events WHERE contact_id=? AND type='link_clicked' ORDER BY occurred_at DESC LIMIT 1").bind(c.id).first(); const m = JSON.parse(ev?.meta || "{}"); clicked = m.label || ""; } catch (_) {}
    const ref = clicked ? ` I saw you took a look at “${clicked}” —` : "";
    const text = `Hi ${first},\n\nAaron here from Consent Resolve.${ref} figured I'd reach out personally rather than let the newsletter do all the talking.\n\nIf it'd help, I'm happy to pull the actual numbers for your site and show you what recovered visitors would look like — no pitch, just the math. Want me to?\n\n— Aaron`;
    const res = await gmailSend(env, { account, to: c.primary_email, subject: `${first}, quick one from Aaron at Consent Resolve`, text, from: env.FROM_EMAIL || "Aaron Phillips <hello@consentresolve.com>", replyTo: "hello@consentresolve.com" }).catch(() => ({ ok: false }));
    if (res && res.ok) {
      await env.DB.prepare("UPDATE contacts SET reengaged_at=datetime('now') WHERE id=?").bind(c.id).run().catch(() => {});
      await logEvent(env, { type: "reengagement_sent", contactId: c.id, channel: "email", meta: { clicked } }).catch(() => {});
      sent++;
    }
  }
  return { sent, eligible: rows.length };
}
