// POST /api/register — dual-mode entry point.
//   JSON            -> 200 { demo_token, redirect_url }
//   form-urlencoded -> 302 Location: /demo/sample/?dt=TOKEN  (no-JS fallback)
// Turnstile + honeypot + per-IP rate limit. Same-origin in this build; CORS
// allowlist honored for possible future cross-origin embedding.

import { corsHeaders, json, clientIp, baseOrigin } from "../_lib/http.js";
import { verifyTurnstile } from "../_lib/turnstile.js";
import { uuid, nowIso, insertParticipant, getByEmail, updateParticipant, logEvent, recentRegistrations } from "../_lib/db.js";

const SAMPLE_PATH = "/demo/sample/";
const RATE_LIMIT = 8; // registrations per IP per minute

export async function onRequestOptions({ request, env }) {
  return new Response(null, { status: 204, headers: corsHeaders(request, env) });
}

export async function onRequestPost({ request, env }) {
  const cors = corsHeaders(request, env);
  const ct = (request.headers.get("Content-Type") || "").toLowerCase();
  const isForm = ct.includes("application/x-www-form-urlencoded") || ct.includes("multipart/form-data");
  const origin = baseOrigin(request, env);

  // Parse body for either mode.
  let fields = {};
  try {
    if (isForm) {
      const fd = await request.formData();
      for (const [k, v] of fd.entries()) fields[k] = typeof v === "string" ? v : "";
    } else {
      fields = await request.json();
    }
  } catch {
    return fail(isForm, origin, cors, "validation", "Could not read the form.");
  }

  const name = (fields.name || "").toString().trim();
  const email = (fields.email || "").toString().trim().toLowerCase();
  const business_name = (fields.business_name || "").toString().trim();
  const trade = (fields.trade || "").toString().trim();
  const phone = (fields.phone || "").toString().trim();
  const consent_contact = fields.consent_contact === "1" || fields.consent_contact === 1 || fields.consent_contact === true;
  const hp = (fields.hp || "").toString();
  const turnstileToken = (fields.turnstileToken || fields["cf-turnstile-response"] || "").toString();

  // Honeypot: a filled "hp" means a bot. Pretend success, store nothing.
  if (hp) {
    if (isForm) return redirect(`${origin}${SAMPLE_PATH}?dt=bot`, cors);
    return json({ demo_token: "bot", redirect_url: `${origin}${SAMPLE_PATH}?dt=bot` }, {}, cors);
  }

  // Validation.
  if (!name || !email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return fail(isForm, origin, cors, "validation", "Please enter your name and a valid email.");
  }
  if (!consent_contact) {
    return fail(isForm, origin, cors, "validation", "Please check the consent box to continue.");
  }

  const ip = clientIp(request);

  // Rate limit per IP.
  if ((await recentRegistrations(env, ip, 60)) >= RATE_LIMIT) {
    return fail(isForm, origin, cors, "rate_limited", "Too many tries. Please wait a minute.", 429);
  }

  // Turnstile (skipped if no secret configured).
  const ts = await verifyTurnstile(env, turnstileToken, ip);
  if (!ts.ok) {
    // TEMP DIAGNOSTIC — surfaces the exact siteverify reason, then revert.
    const codes = (ts.data && ts.data["error-codes"]) || [];
    const dbg = `codes=${JSON.stringify(codes)} token=${turnstileToken ? "present(" + turnstileToken.length + ")" : "MISSING"} err=${ts.error || "-"} secret=${env.TURNSTILE_SECRET ? "set" : "MISSING"}`;
    return fail(isForm, origin, cors, "turnstile", "Bot check failed. [" + dbg + "]");
  }

  // Duplicate email -> reuse the existing token (idempotent re-entry).
  let token;
  try {
    const existing = await getByEmail(env, email);
    if (existing) {
      token = existing.id;
      await updateParticipant(env, token, {
        name,
        business_name: business_name || existing.business_name,
        trade: trade || existing.trade,
        phone: phone || existing.phone,
        consent_contact: consent_contact ? 1 : 0,
      });
      await logEvent(env, token, "registered", { repeat: true });
    } else {
      token = uuid();
      await insertParticipant(env, {
        id: token,
        name,
        email,
        business_name,
        phone,
        trade,
        consent_contact,
        ip,
        user_agent: request.headers.get("User-Agent") || null,
        created_at: nowIso(),
      });
      await logEvent(env, token, "registered", { trade: trade || null });
    }
  } catch (err) {
    return fail(isForm, origin, cors, "server", "Something went wrong. Please try again.", 500);
  }

  const redirectUrl = `${origin}${SAMPLE_PATH}?dt=${encodeURIComponent(token)}`;
  const cookie = `dt=${token}; Domain=.consentresolve.com; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=3600`;

  if (isForm) {
    return redirect(redirectUrl, cors, cookie);
  }
  return json({ demo_token: token, redirect_url: redirectUrl }, {}, { ...cors, "Set-Cookie": cookie });
}

function redirect(location, cors, cookie) {
  const headers = { Location: location, ...cors };
  if (cookie) headers["Set-Cookie"] = cookie;
  return new Response(null, { status: 302, headers });
}

function fail(isForm, origin, cors, reason, message, status = 400) {
  if (isForm) {
    return new Response(null, {
      status: 302,
      headers: { Location: `${origin}/demo/error/?reason=${encodeURIComponent(reason)}`, ...cors },
    });
  }
  return json({ error: reason, message }, { status }, cors);
}
