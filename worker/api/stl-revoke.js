// Speed-to-Lead — one-click consent revoke (spec §6 B3, §8.5). build step 3.
//   GET /consent/revoke?t=<token>   → executes immediately, shows confirmation.
// One click from the receipt email = a GET = done, sub-second, idempotent. It
// cancels every pending touchpoint for the lead and flips status to revoked.
import { revoke } from "../_lib/stl/runner.js";

const page = (title, msg, ok) => `<!doctype html><meta charset=utf-8>
<meta name=viewport content="width=device-width,initial-scale=1"><title>${title}</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0e1c2e;color:#eaf2f8;font-family:system-ui,-apple-system,sans-serif}
.c{max-width:420px;text-align:center;padding:40px 28px;background:#14263c;border:1px solid rgba(255,255,255,.08);border-radius:16px}
.m{width:52px;height:52px;border-radius:50%;display:grid;place-items:center;margin:0 auto 16px;font-size:26px;background:${ok ? "#0c8f5f" : "#8a2b2b"}}
h1{font-size:20px;margin:0 0 8px}p{color:#a9bccb;font-size:14.5px;line-height:1.55;margin:0}</style>
<div class=c><div class=m>${ok ? "✓" : "!"}</div><h1>${title}</h1><p>${msg}</p></div>`;

export async function onRequestGet({ request, env }) {
  const token = new URL(request.url).searchParams.get("t");
  const headers = { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" };
  if (!token) return new Response(page("Invalid link", "This revoke link is missing its token.", false), { status: 400, headers });
  try {
    const r = await revoke(env, { token, via: "link" });
    if (!r.ok) return new Response(page("Already handled", "This request was already processed, or the link has expired. You will not be contacted.", true), { headers });
    return new Response(page("Consent revoked", "Done — instantly. All email, SMS, and calls for you are stopped and logged. No account, no support ticket, no retention specialist.", true), { headers });
  } catch (e) {
    return new Response(page("Something went wrong", "We could not process that just now. Reply STOP to any message and you will be removed.", false), { status: 500, headers });
  }
}
