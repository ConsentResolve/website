// Reveal email via Resend. Branded to the locked Consent Resolve voice:
// flat $7 a lead (no $10 starter), contractor-only, email-first lead card
// (we deliver a consented email — never a phone number to cold-call).

import { tradeProfile } from "./trades.js";
import { sendEmail as gmailSend } from "./gmail.js";
import { trackedUrl } from "./click-track.js";

const NAVY = "#0a1628";
const MINT = "#00e5a0";

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

// First name, title-cased, with a graceful fallback (avoids "Hi HELP").
function firstName(p) {
  const n = String(p.name || "").trim().split(/\s+/)[0];
  return n ? n.charAt(0).toUpperCase() + n.slice(1).toLowerCase() : "there";
}

function row(label, value) {
  return `<tr>
    <td style="padding:9px 0;color:#64748b;font-size:13px;width:140px;vertical-align:top">${esc(label)}</td>
    <td style="padding:9px 0;font-size:14px;color:${NAVY};font-weight:600">${value}</td>
  </tr>`;
}

// CAN-SPAM footer: physical mailing address + one-click-aligned unsubscribe link.
function unsubUrl(p, env, baseUrl) {
  const base = (baseUrl || env.BASE_URL || "https://consentresolve.com").replace(/\/$/, "");
  return `${base}/api/unsubscribe?dt=${encodeURIComponent(p.id || "")}`;
}
function unsubFooter(p, env, baseUrl) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto"><tr><td style="padding:16px 28px 4px;text-align:center;font-size:11px;color:#94a3b8;line-height:1.6">Consent Resolve · 1907 Gulf Way #1, St Pete Beach, FL 33706<br/><a href="${unsubUrl(p, env, baseUrl)}" style="color:#94a3b8;text-decoration:underline">Unsubscribe</a></td></tr></table>`;
}

function ownerHtml(p, env, baseUrl) {
  const t = tradeProfile(p.trade);
  return `<!doctype html><html><body style="margin:0;padding:24px;background:#f1f5f9;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:${NAVY}">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto">
    <tr><td style="padding:22px 28px;background:${NAVY};border-radius:14px 14px 0 0">
      <div style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:${MINT};font-weight:700">Consent Resolve</div>
      <div style="font-size:21px;font-weight:700;color:#fff;margin-top:6px">🎯 New identified lead</div>
    </td></tr>
    <tr><td style="padding:26px 28px;background:#fff;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 14px 14px">
      <p style="margin:0 0 18px;font-size:15px;line-height:1.5">A visitor just consented on your website. Here's who they are.</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
        ${row("Name", esc(p.name))}
        ${row("Email", `<a href="mailto:${esc(p.email)}" style="color:#0369a1;font-weight:600">${esc(p.email)}</a>`)}
        ${row("Business", esc(p.business_name || "—"))}
        ${row("Shopping for", esc(t.label))}
        ${row("Page viewed", esc(p.sample_page || env.SAMPLE_PATH || "/demo/sample/"))}
        ${row("Consent captured", esc(p.consented_at))}
      </table>
      <div style="margin-top:22px;padding:16px 18px;border-left:4px solid ${MINT};background:#f0fdf9;border-radius:8px;font-size:14px;line-height:1.55">
        <strong>Notice anything?</strong> This lead is <em>you</em>. You just did exactly what your customers do — and this is what hits your inbox every time someone consents on YOUR ${esc(t.label)} site. It's a real name and a consented email, yours alone, never resold.
      </div>
      <div style="margin-top:26px;text-align:center">
        <a href="${trackedUrl(env, { dest: "/pricing/", email: p.email, campaign: "demo", label: "pricing" })}" style="display:inline-block;background:${MINT};color:${NAVY};padding:14px 26px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px">Get Started</a>
      </div>
      <p style="margin:22px 0 0;font-size:12px;color:#94a3b8;line-height:1.5">Consent captured ${esc(p.consented_at)} · consent text version ${esc(env.CONSENT_TEXT_VERSION || "v1")}. This is a demo: the only "lead" here is you.</p>
    </td></tr>
  </table>${unsubFooter(p, env, baseUrl)}</body></html>`;
}

// Visitor-facing nurture email — this is the message the HOMEOWNER receives, so
// it's branded as the contractor (the sample business), not Consent Resolve. It
// drives them back to the contractor: call, or finish the quote. Warm inbound
// (homeowner -> contractor), never an outbound cold-call. This is the email the
// demo sends after consent (EMAIL_MODE=promo).
function promoHtml(p, env, baseUrl) {
  const t = tradeProfile(p.trade);
  const BLUE = "#1d4ed8";
  const tel = "tel:" + String(t.phone || "").replace(/[^0-9+]/g, "");
  const base = (baseUrl || env.BASE_URL || "https://consentresolve.com").replace(/\/$/, "");
  const quoteUrl = trackedUrl(env, { dest: `/demo/sample/get-quote/?dt=${encodeURIComponent(p.id || "")}`, email: p.email, campaign: "demo", label: "quote" });
  const first = firstName(p);
  return `<!doctype html><html><body style="margin:0;padding:24px;background:#f1f5f9;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#0f172a">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto">
    <tr><td style="background:#0a1628;color:#cbd5e1;text-align:center;padding:9px 16px;font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;border-radius:14px 14px 0 0">📩 Sample Customer Email</td></tr>
    <tr><td style="padding:22px 28px;background:${BLUE}">
      <div style="font-size:19px;font-weight:800;color:#fff">${esc(t.biz)}</div>
      <div style="font-size:13px;color:#dbeafe;margin-top:2px">Licensed · Insured · Locally owned</div>
    </td></tr>
    <tr><td style="padding:26px 28px;background:#fff;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 14px 14px">
      <p style="margin:0 0 14px;font-size:16px;line-height:1.5">Hi ${esc(first)}, thanks for stopping by ${esc(t.biz)}.</p>
      <p style="margin:0 0 18px;font-size:15px;line-height:1.55">Looks like you were checking out ${esc(t.label)}. Want us to take care of it? Two easy ways to get started — whatever's quicker for you:</p>
      <div style="text-align:center;margin:22px 0 8px">
        <a href="${quoteUrl}" style="display:inline-block;background:${BLUE};color:#fff;padding:14px 26px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;margin:4px">Finish your free quote →</a>
      </div>
      <div style="text-align:center;margin:0 0 8px">
        <a href="${tel}" style="display:inline-block;background:#fff;color:${BLUE};border:1px solid ${BLUE};padding:13px 26px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;margin:4px">Or call us: ${esc(t.phone)}</a>
      </div>
      <p style="margin:20px 0 0;font-size:13px;color:#64748b;line-height:1.5">No pressure, and no spam — you'll only hear from us because you asked. Reply anytime and a real person answers.</p>
      <p style="margin:18px 0 0;padding:12px 14px;background:#eef4ff;border-radius:8px;font-size:13px;color:#0f172a;line-height:1.55"><strong>Imagine if 30–40% of your anonymous website traffic got this email</strong> — optimized specifically to generate warm inbound calls or an online quote.</p>
      <p style="margin:14px 0 0;font-size:11px;color:#94a3b8;line-height:1.5">This is a Consent Resolve demo — ${esc(t.biz)} is fictional and the only person we emailed is you. It shows the consented follow-up that pulls a visitor back to call you or finish their quote.</p>
    </td></tr>
  </table>${unsubFooter(p, env, baseUrl)}</body></html>`;
}

function customerHtml(p, env, baseUrl) {
  const t = tradeProfile(p.trade);
  return `<!doctype html><html><body style="margin:0;padding:24px;background:#f1f5f9;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:${NAVY}">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto">
    <tr><td style="padding:28px;background:#fff;border:1px solid #e2e8f0;border-radius:14px">
      <div style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#00a86e;font-weight:700">Consent Resolve</div>
      <h2 style="margin:8px 0 12px;font-size:20px">Thanks for visiting ${esc(t.biz)}, ${esc(p.name)}.</h2>
      <p style="font-size:15px;line-height:1.55">Here's the privacy-respecting experience your customers see: a clear ask, no surprise tracking, and a timestamped record of exactly what they agreed to.</p>
      <p style="font-size:13px;color:#94a3b8">Consent captured ${esc(p.consented_at)} · version ${esc(env.CONSENT_TEXT_VERSION || "v1")}</p>
      <div style="margin-top:24px;text-align:center">
        <a href="${trackedUrl(env, { dest: "/how-it-works/", email: p.email, campaign: "demo", label: "how-it-works" })}" style="display:inline-block;background:${MINT};color:${NAVY};padding:14px 26px;border-radius:8px;text-decoration:none;font-weight:700">See how it works →</a>
      </div>
    </td></tr>
  </table>${unsubFooter(p, env, baseUrl)}</body></html>`;
}

// Build the email (subject + html) for a given mode. Shared by the live send
// and the /api/preview route so what you preview is exactly what sends.
//   promo    (default) — visitor nurture: call us / finish your quote
//   owner               — the "new identified lead" reveal
//   customer            — privacy-experience confirmation
export function renderEmail(env, p, baseUrl, modeOverride) {
  const mode = (modeOverride || env.EMAIL_MODE || "promo").toLowerCase();
  const t = tradeProfile(p.trade);
  if (mode === "owner") {
    return { subject: `New identified lead: ${p.name} from ${p.business_name || "your demo"}`, html: ownerHtml(p, env, baseUrl) };
  }
  if (mode === "customer") {
    return { subject: "Thanks for visiting — your consent is on file", html: customerHtml(p, env, baseUrl) };
  }
  return { subject: `Your free ${t.label} quote from ${t.biz} — let's get you booked`, html: promoHtml(p, env, baseUrl) };
}

// Internal "new demo signup" alert -> the team inbox (hello@consentresolve.com,
// aliased into Instantly's Unibox), so every website/demo-form lead lands in the
// same place as cold-email replies. reply_to is the lead's email, so a reply in
// Unibox goes straight to the prospect. No unsubscribe footer (internal mail).
function notifyLeadHtml(p, t, meta) {
  return `<!doctype html><html><body style="margin:0;padding:24px;background:#f1f5f9;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:${NAVY}">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto">
    <tr><td style="padding:20px 28px;background:${NAVY};border-radius:14px 14px 0 0">
      <div style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:${MINT};font-weight:700">Consent Resolve · Lead</div>
      <div style="font-size:20px;font-weight:700;color:#fff;margin-top:6px">New demo signup${meta.repeat ? " (returning)" : ""}</div>
    </td></tr>
    <tr><td style="padding:24px 28px;background:#fff;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 14px 14px">
      <p style="margin:0 0 14px;font-size:14px;line-height:1.5;color:#475569">Registered on the website demo ~10–15 minutes ago. Reply to this email to reach them directly.</p>
      ${meta.progress ? `<div style="margin:0 0 16px;padding:12px 14px;background:#ecfdf5;border:1px solid ${MINT};border-radius:8px">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.12em;color:#0f766e">How far they got</div>
        <div style="font-size:14px;color:${NAVY};margin-top:4px;font-weight:600">${esc(meta.progress.detail)}</div>
      </div>` : ""}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
        ${row("Name", esc(p.name || "—"))}
        ${row("Email", `<a href="mailto:${esc(p.email)}" style="color:#0369a1;font-weight:600">${esc(p.email)}</a>`)}
        ${row("Business", esc(p.business_name || "—"))}
        ${row("Trade", esc(t.label || p.trade || "—"))}
        ${row("Phone", esc(p.phone || "—"))}
        ${row("Consent to contact", p.consent_contact ? "Yes" : "No")}
        ${row("Submitted", esc(meta.registeredAt || meta.time || ""))}
        ${meta.visitedAt ? row("Started sample demo", esc(meta.visitedAt)) : ""}
        ${meta.consentedAt ? row("Accepted consent", esc(meta.consentedAt)) : ""}
      </table>
    </td></tr>
  </table></body></html>`;
}

export async function sendLeadNotification(env, p, meta = {}) {
  const to = env.LEADS_NOTIFY_EMAIL || "hello@consentresolve.com";
  const t = tradeProfile(p.trade);
  const prog = meta.progress ? ` · ${meta.progress.short}` : "";
  const subject = `New demo signup${meta.repeat ? " (returning)" : ""}: ${p.name || "Unknown"}${p.trade ? " — " + (t.label || p.trade) : ""}${prog}`;
  // Reads as "from the prospect" in the inbox: display NAME is who submitted, the send
  // address is our own mailbox, and Reply-To is their email so a reply goes to them.
  const fromAddr = env.FROM_EMAIL || "hello@consentresolve.com";
  const fromName = String(p.name || "Demo signup").replace(/["<>\r\n,]/g, " ").trim().slice(0, 60) || "Demo signup";
  const g = await gmailSend(env, {
    to, subject, html: notifyLeadHtml(p, t, meta),
    from: `${fromName} <${fromAddr.replace(/^.*<|>.*$/g, "")}>`,
    replyTo: p.email || undefined,
  });
  if (!g.ok) return { ok: false, error: `gmail_${g.error || "failed"}` };
  return { ok: true, data: { id: g.id } };
}

export async function sendRevealEmail(env, p, baseUrl) {
  const { subject, html } = renderEmail(env, p, baseUrl);
  const base = (baseUrl || env.BASE_URL || "https://consentresolve.com").replace(/\/$/, "");
  const unsub = `${base}/api/unsubscribe?dt=${encodeURIComponent(p.id || "")}`;
  const g = await gmailSend(env, {
    to: p.email, subject, html,
    from: env.FROM_EMAIL || "Consent Resolve <hello@consentresolve.com>",
    // demo@ does not exist, so this resolves to hello@ and replies land.
    replyTo: env.REPLY_TO_DEMO || env.REPLY_TO || "hello@consentresolve.com",
    headers: {
      "List-Unsubscribe": `<${unsub}>, <mailto:unsubscribe@consentresolve.com?subject=unsubscribe>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  });
  if (!g.ok) return { ok: false, error: `gmail_${g.error || "failed"}` };
  return { ok: true, data: { id: g.id } };
}
