// One-click + link unsubscribe for the demo emails.
//   POST (RFC 8058 one-click, from the mailbox provider) -> 200
//   GET  (footer link click) -> friendly confirmation page
// Best-effort: clears consent_contact on the participant; never errors the user.

import { json } from "../_lib/http.js";
import { getParticipant, updateParticipant, logEvent } from "../_lib/db.js";
import { ensureRebuildSchema, addSuppression, recordConsent } from "../_lib/crm-rebuild.js";
import { handleGoalEvent } from "../_lib/workflow-engine.js";

// v1 demo email unsubscribe (participant id in ?dt=).
async function unsubscribe(env, dt) {
  try {
    const p = await getParticipant(env, dt);
    if (p) {
      await updateParticipant(env, p.id, { consent_contact: 0 });
      await logEvent(env, p.id, "unsubscribed", {});
    }
  } catch {
    /* never block the unsubscribe response */
  }
}

// v2 workflow-engine email unsubscribe (contact id in ?c=). Suppresses in the NEW consent
// system the engine actually checks: addSuppression + recordConsent(revoked) + exit sequences.
async function unsubscribeContact(env, contactId) {
  try {
    await ensureRebuildSchema(env);
    const c = await env.DB.prepare("SELECT id, primary_email, phone FROM contacts WHERE id=?").bind(contactId).first();
    const email = c?.primary_email || null;
    await addSuppression(env, { contactId, email, channel: "email", reason: "unsubscribe", source: "email_link" });
    await recordConsent(env, { contactId, email, channel: "email", action: "revoked", basis: "email unsubscribe", captureMethod: "unsub_link", source: "email" });
    await handleGoalEvent(env, { contactId, goal: "opted_out" }); // exits any active sequence
  } catch {
    /* never block the unsubscribe response */
  }
}

async function handleUnsub(env, url) {
  const dt = url.searchParams.get("dt") || "";
  const c = url.searchParams.get("c") || "";
  if (c) await unsubscribeContact(env, c);
  if (dt) await unsubscribe(env, dt);
}

export async function onRequestPost({ request, env }) {
  await handleUnsub(env, new URL(request.url));
  return json({ ok: true });
}

export async function onRequestGet({ request, env }) {
  await handleUnsub(env, new URL(request.url));
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex,nofollow" /><title>Unsubscribed</title></head>
    <body style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;max-width:520px;margin:64px auto;padding:0 20px;text-align:center;color:#0f172a">
      <div style="font-size:42px">✅</div>
      <h1 style="font-size:24px;margin:12px 0 8px">You're unsubscribed.</h1>
      <p style="color:#475569;line-height:1.6">You won't receive any more emails from this Consent Resolve demo.
      <br/><a href="https://consentresolve.com/" style="color:#1d4ed8">Return to consentresolve.com</a></p>
    </body></html>`;
  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8", "X-Robots-Tag": "noindex, nofollow", "Cache-Control": "no-store" },
  });
}
