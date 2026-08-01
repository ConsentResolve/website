// Email click tracking — provider-agnostic (replaces Resend's click webhook).
//
// Every CTA in an outgoing email is wrapped as ${BASE}/r?u=<dest>&e=<email>&c=<campaign>&l=<label>.
// The /r endpoint (api/click.js) records the click, then 302s to <dest>. Only SAME-ORIGIN
// destinations are followed — no open redirect. Attribution params are plain (the value of a
// forged click is nil; worst case is a click event on an address we already mailed).
//
// A click writes THREE things so it shows up everywhere:
//   1. crm_events  type 'link_clicked'  → Site Spy "Email link clicks" + the intent buckets
//   2. activities  action 'link_clicked' → contact timeline + the CRM Activity tab
//   3. outreach_sends.clicks++ (+ lead_created on first click) → restores click→lead

import { findOrCreateContactByEmail, addActivityV2, adminUserId } from "./crm-v2.js";
import { logEvent } from "./crm-rebuild.js";

function baseUrl(env) {
  return String(env.BASE_URL || "https://consentresolve.com").replace(/\/$/, "");
}

// Wrap a destination in a tracked redirect. `dest` may be a path ("/demo/?utm=…") or a
// full same-origin URL. External URLs are returned untouched (nothing to attribute, and
// we won't proxy them). Synchronous so it drops straight into email templates.
export function trackedUrl(env, { dest, email, campaign, label }) {
  const base = baseUrl(env);
  if (!dest) return base + "/";
  // Leave non-http schemes (mailto:, tel:) and cross-origin links alone.
  if (/^(mailto:|tel:|sms:)/i.test(dest)) return dest;
  try {
    const abs = new URL(dest, base + "/");
    if (abs.origin !== new URL(base).origin) return dest; // external → don't wrap
  } catch (_) { return dest; }
  const q = new URLSearchParams({ u: dest });
  if (email) q.set("e", email);
  if (campaign) q.set("c", campaign);
  if (label) q.set("l", label);
  return `${base}/r?${q.toString()}`;
}

// Resolve the safe same-origin destination for a raw ?u= value. Returns the home page
// for anything cross-origin or unparseable — this is the open-redirect guard.
export function safeDest(env, u) {
  const base = baseUrl(env);
  try {
    const abs = new URL(u || "/", base + "/");
    if (abs.origin === new URL(base).origin) return abs.toString();
  } catch (_) {}
  return base + "/";
}

// Record a click. Resilient: every write is independent so one failure can't block the
// redirect or the others. `email` attributes the click to a contact; without it we still
// log an anonymous link_clicked event for the Site Spy counter.
export async function recordClick(env, { dest, email, campaign, label }) {
  const src = campaign || "email";
  const em = String(email || "").toLowerCase().trim();
  if (!em || !em.includes("@")) {
    try { await logEvent(env, { type: "link_clicked", channel: "email", source: src, meta: { url: dest, label, campaign, anonymous: true } }); } catch (_) {}
    return { contactId: null };
  }
  let contactId = null;
  try { contactId = await findOrCreateContactByEmail(env, em, { source: src }); } catch (_) {}
  try { await logEvent(env, { type: "link_clicked", contactId, channel: "email", source: src, meta: { url: dest, label, campaign } }); } catch (_) {}
  try {
    await addActivityV2(env, {
      actorId: await adminUserId(env).catch(() => null),
      entityType: "contact", entityId: contactId, action: "link_clicked",
      meta: { label: label || "a link", url: dest, campaign: campaign || null },
    });
  } catch (_) {}
  // Outreach attribution + restore click→lead (the behavior Resend's webhook used to give us).
  try {
    const row = await env.DB.prepare("SELECT id, lead_created FROM outreach_sends WHERE lower(email)=?").bind(em).first();
    if (row) {
      await env.DB.prepare("UPDATE outreach_sends SET clicks=clicks+1" + (row.lead_created ? "" : ", lead_created=1") + " WHERE id=?").bind(row.id).run();
    }
  } catch (_) {}
  return { contactId };
}
