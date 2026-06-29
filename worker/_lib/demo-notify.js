// Deferred demo-signup notifications. Instead of emailing hello@ the instant the form
// is submitted, we wait ~10-15 min so the email can report how far the prospect got in
// the demo (submitted only / browsed the sample / completed it). Driven by the */5 cron.
import { sendLeadNotification } from "./email.js";
import { getByEmail } from "./db.js";
import { addActivityV2, findOrCreateContactByEmail } from "./crm-v2.js";

// Demo progress, keyed by participant.status. The full ladder is:
//   registered -> visited -> consented -> emailed -> enrolled
// (consent.js advances consented->emailed->enrolled as the reveal email + nurture fire),
// so "completed the demo" = any of consented/emailed/enrolled.
const PROGRESS = {
  registered: { short: "form only",        detail: "Submitted the form but did not start the sample demo." },
  visited:    { short: "browsed sample",   detail: "Browsed the sample site, but did not accept the consent banner." },
  consented:  { short: "accepted consent", detail: "Accepted the consent banner — completed the core demo." },
  emailed:    { short: "completed demo",   detail: "Completed the demo — accepted consent and saw the reveal (the demo lead was them)." },
  enrolled:   { short: "completed demo",   detail: "Completed the demo — accepted consent, saw the reveal, and entered the nurture sequence." },
};
const progressFor = (status) =>
  PROGRESS[status] || { short: status || "unknown", detail: "Reached demo stage: " + (status || "unknown") + "." };

export async function sweepDemoNotifications(env, { minMinutes = 12, email = null } = {}) {
  if (!env.DB) return { sent: 0, scanned: 0 };
  // One-time column add (idempotent: D1 throws if it already exists -> ignore). On the
  // FIRST run (column just created) backfill existing rows as already-notified — they
  // were emailed by the old immediate path, so the sweep must not re-notify them.
  try {
    await env.DB.prepare("ALTER TABLE participants ADD COLUMN notified_at TEXT").run();
    await env.DB.prepare("UPDATE participants SET notified_at = created_at WHERE notified_at IS NULL").run();
  } catch (_) {}

  // Testing/re-test: target a specific signup by email, ignoring notified_at + age.
  let rows;
  if (email) {
    const p = await getByEmail(env, String(email).trim().toLowerCase());
    rows = p ? [p] : [];
  } else {
    const now = Date.now();
    const cutoff = new Date(now - minMinutes * 60000).toISOString();   // old enough to settle
    const floor  = new Date(now - 24 * 3600000).toISOString();          // don't reach back > 24h
    rows = (await env.DB.prepare(
      "SELECT * FROM participants WHERE notified_at IS NULL AND created_at <= ? AND created_at >= ? ORDER BY created_at ASC LIMIT 25"
    ).bind(cutoff, floor).all()).results || [];
  }

  let sent = 0;
  for (const p of rows) {
    const prog = progressFor(p.status);
    const meta = {
      progress: { short: prog.short, detail: prog.detail, status: p.status },
      registeredAt: p.created_at, visitedAt: p.visited_at || null, consentedAt: p.consented_at || null,
      time: p.created_at, repeat: false,
    };
    const r = await sendLeadNotification(env, p, meta).catch(() => ({ ok: false }));
    // Mark notified only on a real send; otherwise leave it for the next sweep (until it
    // ages out of the 24h floor) so a missing RESEND key doesn't silently drop signups.
    if (r && r.ok) {
      await env.DB.prepare("UPDATE participants SET notified_at = ? WHERE id = ?").bind(new Date().toISOString(), p.id).run();
      sent++;
    }
    // Mirror the progress into the CRM so each signup's demo depth is visible per-contact.
    try {
      const contactId = await findOrCreateContactByEmail(env, p.email, { name: p.name, phone: p.phone, company: p.business_name, source: "demo_form" });
      if (contactId) await addActivityV2(env, { actorId: null, entityType: "contact", entityId: contactId, action: "demo_progress", meta: { status: p.status, detail: prog.detail } });
    } catch (_) {}
  }
  return { sent, scanned: rows.length };
}
