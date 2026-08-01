// Consent-visitor outreach — Consent Resolve using its own product on its own site.
//
// Visitors who clicked Accept on consentresolve.com's consent banner surface through
// the public API as identified contacts. This emails them, transparently, telling them
// exactly why they're hearing from us: they consented, and this email IS the product
// demonstrating itself.
//
//   POST /api/outreach/run?key=<FEEDBACK_KEY>          -> DRY RUN (default). Lists who WOULD be mailed.
//   POST /api/outreach/run?key=...&send=1&limit=25     -> actually sends
//   POST /api/outreach/webhook                          -> Resend events (click/open/bounce)
//
// Lead gating (decided with Aaron 2026-07-20): a CRM lead is created on a CLICK or a
// REPLY only. Opens are recorded but never create a lead — Apple Mail Privacy Protection
// pre-fetches images and auto-registers opens with no human involved, so an open-based
// threshold mostly surfaces Apple Mail users rather than interested ones.
//
// BCC: the first BCC_LIMIT sends copy the team so they can watch it land live; after that
// BCC stops and the team gets the daily digest instead (100 recipients x 4 BCCs would be
// 400 extra emails and four flooded inboxes, and it hurts domain reputation).
import { ensureCrmV2Schema, findOrCreateContactByEmail, addActivityV2, adminUserId } from "../_lib/crm-v2.js";

const API_BASE = "https://api.consentresolve.com/api/v1/public";
// Sending domain: consentresolve.com (verified in Resend). Reply-to stays on
// hello@consentresolve.com so conversations land in the real inbox.
const FROM = "Tyler at Consent Resolve <hello@consentresolve.com>";
// Reply-to is purpose-specific so replies to this campaign are distinguishable from
// product/demo mail in the shared inbox.
const REPLY_TO = (env) => env.REPLY_TO_OUTREACH || env.REPLY_TO || "hello@consentresolve.com";
const BCC = ["tyler@consentresolve.com", "aaron@consentresolve.com", "jason@consentresolve.com", "andy@consentresolve.com"];
const BCC_LIMIT = 25;
const SITE = "https://consentresolve.com";

const json = (o, init = {}) => new Response(JSON.stringify(o), {
  ...init, headers: { "Content-Type": "application/json", ...(init.headers || {}) },
});

async function ensureSchema(env) {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS outreach_sends (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    name TEXT, company TEXT, domain TEXT, visitor_id TEXT,
    resend_id TEXT, sent_at TEXT, bcc INTEGER DEFAULT 0,
    opens INTEGER DEFAULT 0, clicks INTEGER DEFAULT 0, replied INTEGER DEFAULT 0,
    lead_created INTEGER DEFAULT 0, status TEXT DEFAULT 'sent'
  )`).run();
  await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_outreach_resend ON outreach_sends(resend_id)`).run();
}

function firstName(n) {
  const s = String(n || "").trim().split(/\s+/)[0];
  return s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : "there";
}
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// Transparent by design: lead with HOW we got their address. That honesty is the entire
// demo — if we obscured it we'd be doing the thing we sell against.
function buildEmail(p) {
  const u = (path, c) => `${SITE}${path}?utm_source=consent_outreach&utm_medium=email&utm_campaign=identified_visitors&utm_content=${c}`;
  const unsub = `${SITE}/api/unsubscribe?e=${encodeURIComponent(p.email)}`;
  const text = `Hi ${firstName(p.name)},

You visited consentresolve.com and clicked Accept on our consent banner. That's what surfaced your email to us — no form, no guessing. This email is the product demonstrating itself.

That's what Consent Resolve does: about 98% of the people who land on a site leave without filling anything in, and stay anonymous — unless they consent. When they do, you get a real name and email, exclusive to you, $7 a lead, never resold.

Three ways to see it on your own traffic:
- 50 lookups at no charge: ${u("/get-started/", "lookups")}
- A 2-minute live demo: ${u("/demo/", "demo")}
- 15 minutes with our team: ${u("/contact/", "call")}

Not for you? Unsubscribe here and we won't email again: ${unsub}

— Tyler
Consent Resolve · 1907 Gulf Way #1, St Pete Beach, FL 33706`;

  // Email HTML rules that actually matter here: tables for layout (Outlook ignores
  // flex/grid), inline styles only, <=600px, explicit width/height on images, no CSS
  // background-image. The 98/2 visual is built from table cells rather than an image so
  // it still renders when a client blocks images by default — which most do.
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta name="color-scheme" content="light"/><meta name="supported-color-schemes" content="light"/>
</head><body style="margin:0;padding:0;background:#f1f5f9">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">You clicked Accept on our banner &mdash; that's how we got here. Here's what it means for your site.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 12px">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;background:#ffffff;border-radius:14px;overflow:hidden;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">

  <tr><td style="background:#081019;padding:20px 28px" align="left">
    <span style="color:#ffffff;font-size:17px;font-weight:800;letter-spacing:-.01em">
      <span style="color:#2ee6a6">&#10003;</span> Consent Resolve</span>
  </td></tr>

  <tr><td style="padding:30px 28px 6px">
    <table role="presentation" cellpadding="0" cellspacing="0"><tr>
      <td width="72" valign="top">
        <img src="${SITE}/team/tyler-spurlock.jpg" width="64" height="64" alt="Tyler Spurlock"
             style="display:block;width:64px;height:64px;border-radius:32px;border:2px solid #2ee6a6"/>
      </td>
      <td valign="middle" style="padding-left:6px">
        <div style="font-size:16px;font-weight:800;color:#0a1628;line-height:1.2">Tyler Spurlock</div>
        <div style="font-size:13px;color:#64748b">Consent Resolve</div>
      </td>
    </tr></table>
  </td></tr>

  <tr><td style="padding:18px 28px 0">
    <div style="font-size:23px;line-height:1.25;font-weight:800;color:#0a1628">
      You clicked <span style="color:#0a9d72">Accept</span> on our banner.<br/>That's how you got this email.</div>
    <p style="font-size:15px;line-height:1.6;color:#334155;margin:14px 0 0">
      No form. No guessing. You consented on consentresolve.com, and your address surfaced to us
      &mdash; <strong>this email is the product demonstrating itself.</strong></p>
  </td></tr>

  <tr><td style="padding:22px 28px 0">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
           style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px">
      <tr><td style="padding:18px 20px 12px">
        <div style="font-size:13px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#64748b">Every 100 visitors to your site</div>
      </td></tr>
      <tr><td style="padding:0 20px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-radius:6px;overflow:hidden">
          <tr>
            <td width="98%" height="30" style="background:#cbd5e1"></td>
            <td width="2%"  height="30" style="background:#2ee6a6"></td>
          </tr>
        </table>
      </td></tr>
      <tr><td style="padding:10px 20px 18px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="font-size:13px;color:#64748b"><strong style="color:#0a1628">98</strong> leave anonymous</td>
          <td align="right" style="font-size:13px;color:#0a9d72"><strong>2</strong> fill in a form</td>
        </tr></table>
      </td></tr>
    </table>
  </td></tr>

  <tr><td style="padding:20px 28px 0">
    <p style="font-size:15px;line-height:1.6;color:#334155;margin:0">
      Consent Resolve hands the consenting ones back to you as real leads &mdash; a name and an email,
      <strong>exclusive to you, $7 a lead, never resold</strong>. Applied to your own traffic, that's
      more booked jobs from visitors you already paid for.</p>
  </td></tr>

  <tr><td style="padding:22px 28px 4px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr><td style="border-radius:10px;background:#2ee6a6" align="center">
        <a href="${u("/get-started/", "lookups")}" style="display:block;padding:15px 20px;font-size:16px;font-weight:800;color:#08131f;text-decoration:none">50 lookups on your site &mdash; no charge</a>
      </td></tr>
      <tr><td height="10"></td></tr>
      <tr><td style="border-radius:10px;border:1px solid #cbd5e1" align="center">
        <a href="${u("/demo/", "demo")}" style="display:block;padding:13px 20px;font-size:15px;font-weight:700;color:#0a1628;text-decoration:none">Watch the 2-minute demo</a>
      </td></tr>
      <tr><td height="10"></td></tr>
      <tr><td style="border-radius:10px;border:1px solid #cbd5e1" align="center">
        <a href="${u("/contact/", "call")}" style="display:block;padding:13px 20px;font-size:15px;font-weight:700;color:#0a1628;text-decoration:none">Book 15 minutes with our team</a>
      </td></tr>
    </table>
  </td></tr>

  <tr><td style="padding:22px 28px 4px">
    <p style="font-size:15px;line-height:1.6;color:#334155;margin:0">Reply to this email and it comes straight to me.</p>
    <p style="font-size:15px;color:#0a1628;margin:12px 0 0"><strong>&mdash; Tyler</strong></p>
  </td></tr>

  <tr><td style="padding:22px 28px 28px">
    <div style="border-top:1px solid #e2e8f0;padding-top:14px;font-size:12px;line-height:1.6;color:#94a3b8">
      Consent Resolve &middot; 1907 Gulf Way #1, St Pete Beach, FL 33706<br/>
      You're receiving this because you consented to identification on consentresolve.com.
      <a href="${unsub}" style="color:#94a3b8;text-decoration:underline">Unsubscribe</a>
    </div>
  </td></tr>

</table>
</td></tr></table></body></html>`;

  return { subject: "You clicked Accept on our site — here's exactly what that did", text, html, unsub };
}

// Public API: X-API-Key header, per-site contacts, opaque cursor pagination,
// limit max 200, 60 req/min.
//
// NOTE the two UUIDs in the dashboard — they are NOT interchangeable:
//   9a7ac777-… = Tracking UUID, used by the banner script in ConsentResolve.init().
//                The public API 404s on it ("Site not found").
//   d037027c-… = site id the public API expects. Verified 200 with live contacts.
const SITE_ID_DEFAULT = "d037027c-3647-43ed-b069-5126df08faec";

async function fetchIdentified(env, want) {
  // Trim: a trailing newline from a copy/paste into the dashboard is the most common
  // cause of a key that is present but rejected.
  const key = String(env.CR_API_KEY || "").trim();
  if (!key) return { error: "CR_API_KEY not set on the worker" };
  const siteId = env.CR_SITE_ID || SITE_ID_DEFAULT;
  const rows = [];
  let cursor = null;
  // Page until we have enough candidates (dedupe/suppression happens after), capped so
  // we stay well inside the 60 req/min limit.
  for (let page = 0; page < 5; page++) {
    const qs = new URLSearchParams({ limit: String(Math.min(200, Math.max(want * 2, 50))) });
    if (cursor) qs.set("cursor", cursor);
    const r = await fetch(`${API_BASE}/sites/${siteId}/contacts?${qs}`, {
      headers: { "X-API-Key": key, Accept: "application/json" },
    });
    const body = await r.text();
    if (!r.ok) return { error: `API ${r.status}: ${body.slice(0, 240)}`, key_len: key.length, key_tail: key.slice(-4) };
    let d; try { d = JSON.parse(body); } catch { return { error: "non-JSON from API" }; }
    const batch = d.contacts || d.data || d.results || (Array.isArray(d) ? d : []);
    rows.push(...batch);
    cursor = d.cursor || d.next_cursor || (d.meta && d.meta.cursor) || null;
    if (!cursor || !batch.length || rows.length >= want * 2) break;
  }
  return { rows, shape: rows[0] ? Object.keys(rows[0]) : [] };
}

function normalize(v) {
  const email = String(v.email || v.contact_email || v.primary_email || "").toLowerCase().trim();
  return {
    email,
    name: v.name || v.full_name || [v.first_name, v.last_name].filter(Boolean).join(" ") || "",
    company: v.company || v.company_name || (v.company && v.company.name) || "",
    domain: v.domain || v.website || v.company_domain || "",
    visitor_id: v.id || v.contact_id || v.visitor_id || "",
  };
}

export async function onRequestPost({ request, env }) {
  const u = new URL(request.url);
  if (u.pathname.endsWith("/webhook")) return handleWebhook(request, env);

  if (!env.FEEDBACK_KEY || u.searchParams.get("key") !== env.FEEDBACK_KEY) {
    return json({ error: "unauthorized" }, { status: 401 });
  }
  await ensureCrmV2Schema(env); await ensureSchema(env);

  // ?probe=1 — discover what this key can actually see. The CMP siteId used in
  // ConsentResolve.init() is not necessarily the same identifier the public API
  // expects in /sites/{siteId}, so list what the key is scoped to.
  // ?probe=resend — which sending domains are verified? A 403 "domain is not verified"
  // on send is a DNS/Resend-account issue, not a code issue.
  if (u.searchParams.get("probe") === "resend") {
    const r = await fetch("https://api.resend.com/domains", {
      headers: { Authorization: `Bearer ${String(env.RESEND_API_KEY || "").trim()}` },
    });
    const b = await r.text();
    return json({ resend_domains_status: r.status, body: b.slice(0, 900) });
  }

  if (u.searchParams.get("probe") === "1") {
    const key = String(env.CR_API_KEY || "").trim();
    // The dashboard shows two IDs: a Tracking UUID (used by the banner script) and a
    // separate site UUID. Test both against the documented contacts endpoint.
    const cand = [env.CR_SITE_ID || SITE_ID_DEFAULT];
    const tries = cand.map((id) => `/sites/${id}/contacts?limit=1`);
    const out = [];
    for (const t of tries) {
      try {
        const r = await fetch(API_BASE + t, { headers: { "X-API-Key": key, Accept: "application/json" } });
        const b = await r.text();
        out.push({ path: t, status: r.status, body: b.slice(0, 400) });
      } catch (e) { out.push({ path: t, error: String(e).slice(0, 120) }); }
    }
    return json({ probe: true, key_len: key.length, tried: out });
  }

  const send = u.searchParams.get("send") === "1";
  const testTo = (u.searchParams.get("test") || "").trim();
  const limit = Math.min(parseInt(u.searchParams.get("limit") || "25", 10), 200);

  const { rows, error, shape } = await fetchIdentified(env, limit);
  if (error) return json({ error }, { status: 502 });

  // Preview send: renders the REAL template with a REAL contact's details so the
  // personalisation is visible, but delivers to one internal address only. No BCC,
  // no outreach_sends row, no CRM lead, nothing marked as contacted — so the real
  // recipient still gets their first-touch email later.
  if (testTo) {
    if (!env.RESEND_API_KEY) return json({ error: "RESEND_API_KEY not set" }, { status: 500 });
    const src = rows.length ? normalize(rows[0]) : { email: "sample@example.com", name: "Sam", company: "", domain: "" };
    const mail = buildEmail(src);
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM, to: [testTo], reply_to: REPLY_TO(env),
        subject: mail.subject, html: mail.html, text: mail.text,
      }),
    });
    const out = await res.json().catch(() => ({}));
    return json({
      preview_send: true, to: testTo, ok: res.ok && !!out.id, resend_id: out.id || null,
      rendered_for: { name: src.name, company: src.company, domain: src.domain },
      api_contacts_available: rows.length, api_field_shape: shape,
      note: "Nothing recorded. This recipient has NOT been marked as contacted.",
      error: res.ok ? null : JSON.stringify(out).slice(0, 240),
    });
  }

  // Skip anyone already mailed or unsubscribed.
  const sentSet = new Set(((await env.DB.prepare("SELECT email FROM outreach_sends").all()).results || []).map((r) => r.email.toLowerCase()));
  let unsubSet = new Set();
  try {
    unsubSet = new Set(((await env.DB.prepare("SELECT email FROM unsubscribes").all()).results || []).map((r) => String(r.email).toLowerCase()));
  } catch (_) { /* table may not exist yet */ }

  const queue = [];
  for (const v of rows) {
    const c = normalize(v);
    if (!c.email || !c.email.includes("@")) continue;
    if (sentSet.has(c.email) || unsubSet.has(c.email)) continue;
    if (queue.some((q) => q.email === c.email)) continue;
    queue.push(c);
    if (queue.length >= limit) break;
  }

  const alreadySent = sentSet.size;
  if (!send) {
    return json({
      dry_run: true, api_returned: rows.length, already_mailed: alreadySent,
      api_field_shape: shape,
      would_send: queue.length, bcc_on_first: Math.max(0, BCC_LIMIT - alreadySent),
      sample: queue.slice(0, 10), preview: buildEmail(queue[0] || { email: "sample@example.com", name: "Sam" }),
    });
  }
  if (!env.RESEND_API_KEY) return json({ error: "RESEND_API_KEY not set" }, { status: 500 });

  const results = [];
  let n = alreadySent;
  for (const p of queue) {
    const mail = buildEmail(p);
    const withBcc = n < BCC_LIMIT;
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM, to: [p.email], ...(withBcc ? { bcc: BCC } : {}),
        reply_to: REPLY_TO(env),
        subject: mail.subject, html: mail.html, text: mail.text,
        headers: { "List-Unsubscribe": `<${mail.unsub}>, <mailto:hello@consentresolve.com?subject=unsubscribe>`,
                   "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
        tags: [{ name: "campaign", value: "identified_visitors" }],
      }),
    });
    const out = await res.json().catch(() => ({}));
    const ok = res.ok && out.id;
    if (ok) {
      await env.DB.prepare(`INSERT OR IGNORE INTO outreach_sends (email,name,company,domain,visitor_id,resend_id,sent_at,bcc)
        VALUES (?,?,?,?,?,?,datetime('now'),?)`)
        .bind(p.email, p.name, p.company, p.domain, p.visitor_id, out.id, withBcc ? 1 : 0).run();
      n++;
    }
    results.push({ email: p.email, ok, id: out.id || null, bcc: withBcc, error: ok ? null : JSON.stringify(out).slice(0, 160) });
  }
  return json({ sent: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length, bcc_remaining: Math.max(0, BCC_LIMIT - n), results });
}

// Resend event webhook. Click => lead. Open => counted only, never a lead.
async function handleWebhook(request, env) {
  await ensureSchema(env);
  const ev = await request.json().catch(() => ({}));
  const type = ev.type || "";
  const id = ev?.data?.email_id || ev?.data?.id;
  if (!id) return json({ ok: true, ignored: "no email_id" });
  const row = (await env.DB.prepare("SELECT * FROM outreach_sends WHERE resend_id=?").bind(id).first()) || null;
  if (!row) return json({ ok: true, ignored: "unknown email_id" });

  if (type === "email.opened") {
    await env.DB.prepare("UPDATE outreach_sends SET opens=opens+1 WHERE id=?").bind(row.id).run();
    return json({ ok: true, counted: "open" }); // deliberately NOT a lead
  }
  if (type === "email.bounced" || type === "email.complained") {
    await env.DB.prepare("UPDATE outreach_sends SET status=? WHERE id=?").bind(type.split(".")[1], row.id).run();
    return json({ ok: true, status: type });
  }
  if (type === "email.clicked") {
    await env.DB.prepare("UPDATE outreach_sends SET clicks=clicks+1 WHERE id=?").bind(row.id).run();
    if (!row.lead_created) await createLead(env, row, "clicked a link in the consent-outreach email");
    return json({ ok: true, lead: "created_or_existing" });
  }
  return json({ ok: true, ignored: type });
}

export async function createLead(env, row, why) {
  await ensureCrmV2Schema(env);
  const contactId = await findOrCreateContactByEmail(env, row.email, {
    name: row.name || "", source: "consent_outreach", company: row.company || "",
  });
  await env.DB.prepare("UPDATE outreach_sends SET lead_created=1 WHERE id=?").bind(row.id).run();
  try {
    await addActivityV2(env, {
      actorId: await adminUserId(env), entityType: "contact", entityId: contactId,
      action: "outreach_engaged", meta: JSON.stringify({ why, email: row.email, domain: row.domain }),
    });
  } catch (_) {}
  return contactId;
}

export async function onRequestGet({ request, env }) {
  const u = new URL(request.url);
  if (!env.FEEDBACK_KEY || u.searchParams.get("key") !== env.FEEDBACK_KEY) {
    return json({ error: "unauthorized" }, { status: 401 });
  }
  await ensureSchema(env);
  const rows = ((await env.DB.prepare(
    "SELECT email,name,company,sent_at,bcc,opens,clicks,replied,lead_created,status FROM outreach_sends ORDER BY sent_at DESC LIMIT 200"
  ).all()).results) || [];
  const leads = rows.filter((r) => r.lead_created).length;
  return json({ total: rows.length, leads, clicked: rows.filter((r) => r.clicks > 0).length, opened: rows.filter((r) => r.opens > 0).length, rows });
}
