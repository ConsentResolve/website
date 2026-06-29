// Chat-time session-stitch — POST /api/identify { vid, email, name? }
// Fired client-side when a visitor gives their email in the Crisp pre-chat form: links
// their anonymous cr_vid to the email-keyed contact so prior pageviews stitch into the
// Contact 360. Same-origin only (low-risk write — it associates a vid with an email).
import { json } from "../_lib/http.js";
import { ensureCrmV2Schema, findOrCreateContactByEmail } from "../_lib/crm-v2.js";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ ok: false });
  // Same-origin guard (sendBeacon may omit Origin; allow when absent or matching).
  const origin = request.headers.get("Origin") || "";
  const allowed = (env.ALLOWED_ORIGINS || "https://consentresolve.com").split(",").map((s) => s.trim());
  if (origin && !allowed.includes(origin)) return json({ ok: false, error: "bad_origin" }, { status: 403 });

  let b = {};
  try { b = await request.json(); } catch { return json({ ok: false }); }
  const vid = String(b.vid || "").slice(0, 40);
  const email = String(b.email || "").toLowerCase().trim();
  if (!vid || !EMAIL_RE.test(email)) return json({ ok: true, skipped: true });
  try {
    await ensureCrmV2Schema(env);
    const contactId = await findOrCreateContactByEmail(env, email, { name: String(b.name || "").slice(0, 120), source: "chat" });
    await env.DB.prepare("CREATE TABLE IF NOT EXISTS visitor_links (vid TEXT, contact_id TEXT, email TEXT, created_at TEXT DEFAULT (datetime('now')), UNIQUE(vid, contact_id))").run();
    await env.DB.prepare("INSERT INTO visitor_links (vid, contact_id, email) VALUES (?, ?, ?) ON CONFLICT(vid, contact_id) DO NOTHING").bind(vid, contactId, email).run();
    return json({ ok: true });
  } catch (e) { return json({ ok: true, error: String(e).slice(0, 100) }); }
}
