// One-click + link unsubscribe for the demo emails.
//   POST (RFC 8058 one-click, from the mailbox provider) -> 200
//   GET  (footer link click) -> friendly confirmation page
// Best-effort: clears consent_contact on the participant; never errors the user.

import { json } from "../_lib/http.js";
import { getParticipant, updateParticipant, logEvent } from "../_lib/db.js";

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

export async function onRequestPost({ request, env }) {
  const dt = new URL(request.url).searchParams.get("dt") || "";
  await unsubscribe(env, dt);
  return json({ ok: true });
}

export async function onRequestGet({ request, env }) {
  const dt = new URL(request.url).searchParams.get("dt") || "";
  await unsubscribe(env, dt);
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
