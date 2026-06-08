// Reveal email via Resend. Branded to the locked Consent Resolve voice:
// flat $7 a lead (no $10 starter), contractor-only, email-first lead card
// (we deliver a consented email — never a phone number to cold-call).

import { tradeProfile } from "./trades.js";

const NAVY = "#0a1628";
const MINT = "#00e5a0";

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function row(label, value) {
  return `<tr>
    <td style="padding:9px 0;color:#64748b;font-size:13px;width:140px;vertical-align:top">${esc(label)}</td>
    <td style="padding:9px 0;font-size:14px;color:${NAVY};font-weight:600">${value}</td>
  </tr>`;
}

function ownerHtml(p, env) {
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
        <a href="https://consentresolve.com/pricing/" style="display:inline-block;background:${MINT};color:${NAVY};padding:14px 26px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px">Get Started</a>
      </div>
      <p style="margin:22px 0 0;font-size:12px;color:#94a3b8;line-height:1.5">Consent captured ${esc(p.consented_at)} · consent text version ${esc(env.CONSENT_TEXT_VERSION || "v1")}. This is a demo: the only "lead" here is you.</p>
    </td></tr>
  </table></body></html>`;
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
  const quoteUrl = `${base}/demo/sample/get-quote/?dt=${encodeURIComponent(p.id || "")}`;
  const first = String(p.name || "there").split(/\s+/)[0];
  return `<!doctype html><html><body style="margin:0;padding:24px;background:#f1f5f9;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#0f172a">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto">
    <tr><td style="padding:22px 28px;background:${BLUE};border-radius:14px 14px 0 0">
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
      <p style="margin:14px 0 0;font-size:11px;color:#94a3b8;line-height:1.5">This is a Consent Resolve demo — ${esc(t.biz)} is fictional and the only person we emailed is you. It shows the consented follow-up that pulls a visitor back to call you or finish their quote.</p>
    </td></tr>
  </table></body></html>`;
}

function customerHtml(p, env) {
  const t = tradeProfile(p.trade);
  return `<!doctype html><html><body style="margin:0;padding:24px;background:#f1f5f9;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:${NAVY}">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto">
    <tr><td style="padding:28px;background:#fff;border:1px solid #e2e8f0;border-radius:14px">
      <div style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#00a86e;font-weight:700">Consent Resolve</div>
      <h2 style="margin:8px 0 12px;font-size:20px">Thanks for visiting ${esc(t.biz)}, ${esc(p.name)}.</h2>
      <p style="font-size:15px;line-height:1.55">Here's the privacy-respecting experience your customers see: a clear ask, no surprise tracking, and a timestamped record of exactly what they agreed to.</p>
      <p style="font-size:13px;color:#94a3b8">Consent captured ${esc(p.consented_at)} · version ${esc(env.CONSENT_TEXT_VERSION || "v1")}</p>
      <div style="margin-top:24px;text-align:center">
        <a href="https://consentresolve.com/how-it-works/" style="display:inline-block;background:${MINT};color:${NAVY};padding:14px 26px;border-radius:8px;text-decoration:none;font-weight:700">See how it works →</a>
      </div>
    </td></tr>
  </table></body></html>`;
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
    return { subject: `🎯 New identified lead: ${p.name} from ${p.business_name || "your demo"}`, html: ownerHtml(p, env) };
  }
  if (mode === "customer") {
    return { subject: "Thanks for visiting — your consent is on file", html: customerHtml(p, env) };
  }
  return { subject: `Your free ${t.label} quote from ${t.biz} — let's get you booked`, html: promoHtml(p, env, baseUrl) };
}

export async function sendRevealEmail(env, p, baseUrl) {
  if (!env.RESEND_API_KEY) return { ok: false, error: "missing_resend_key" };

  const { subject, html } = renderEmail(env, p, baseUrl);

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.FROM_EMAIL || "demo@consentresolve.com",
      to: [p.email],
      reply_to: env.REPLY_TO || undefined,
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { ok: false, error: `resend_${res.status}`, detail: text.slice(0, 400) };
  }
  return { ok: true, data: await res.json().catch(() => ({})) };
}
