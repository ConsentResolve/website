// Speed-to-Lead — Twilio helpers: credential check, phone-type Lookup, one-off
// test send, number list, and X-Twilio-Signature verification (Twilio's own scheme,
// HMAC-SHA1 base64 over URL + sorted POST params — distinct from the SHA-256 used
// for Retell/Cal). All no-op cleanly until the creds are set.
const enc = (s) => new TextEncoder().encode(s);
const basic = (env) => "Basic " + btoa(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`);
const hasCreds = (env) => !!(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN);

// Verify an inbound Twilio webhook. OPT-IN: only enforced when STL_VERIFY_WEBHOOKS=1.
export async function twilioVerify(env, request, params) {
  if (env.STL_VERIFY_WEBHOOKS !== "1") return true;
  const sig = request.headers.get("X-Twilio-Signature");
  if (!sig || !env.TWILIO_AUTH_TOKEN) return false;
  try {
    let data = request.url; // must be the exact URL Twilio was configured to call
    for (const k of Object.keys(params).sort()) data += k + params[k];
    const key = await crypto.subtle.importKey("raw", enc(env.TWILIO_AUTH_TOKEN), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
    const mac = await crypto.subtle.sign("HMAC", key, enc(data));
    const b64 = btoa(String.fromCharCode(...new Uint8Array(mac)));
    return b64 === sig;
  } catch (_) { return false; }
}

// Confirm the creds work (used by the console "Verify Twilio" button).
export async function twilioStatus(env) {
  if (!hasCreds(env)) return { ok: false, error: "missing TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN" };
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}.json`, { headers: { Authorization: basic(env) } });
  if (!res.ok) return { ok: false, status: res.status, error: `twilio_${res.status}` };
  const j = await res.json().catch(() => ({}));
  return { ok: true, account: j.friendly_name || env.TWILIO_ACCOUNT_SID, account_status: j.status,
    from: env.TWILIO_FROM_NUMBER || null, messaging_service: env.TWILIO_MESSAGING_SERVICE_SID || null };
}

// Line-type Lookup (v2) → mobile | landline | voip. Feeds leads.phone_type, which the
// consent gate uses to allow a manual human dial to a published business line.
export async function lookupPhone(env, phone) {
  if (!hasCreds(env) || !phone) return { ok: false, type: null };
  const res = await fetch(`https://lookups.twilio.com/v2/PhoneNumbers/${encodeURIComponent(phone)}?Fields=line_type_intelligence`, { headers: { Authorization: basic(env) } });
  if (!res.ok) return { ok: false, type: null, status: res.status };
  const j = await res.json().catch(() => ({}));
  const t = j.line_type_intelligence && j.line_type_intelligence.type;
  const map = { mobile: "mobile", landline: "landline", fixedVoip: "voip", nonFixedVoip: "voip", voip: "voip" };
  return { ok: true, type: map[t] || (t ? "landline" : null), carrier: (j.line_type_intelligence || {}).carrier_name || null };
}

export async function backfillPhoneType(env, leadId, phone) {
  const r = await lookupPhone(env, phone);
  if (r.ok && r.type) { try { await env.DB.prepare("UPDATE stl_leads SET phone_type=? WHERE id=?").bind(r.type, leadId).run(); } catch (_) {} }
  return r;
}

export async function sendTestSms(env, to, body) {
  if (!hasCreds(env)) return { ok: false, error: "missing_twilio_creds" };
  if (!to) return { ok: false, error: "need a 'to' number" };
  const form = new URLSearchParams();
  form.set("To", to);
  if (env.TWILIO_MESSAGING_SERVICE_SID) form.set("MessagingServiceSid", env.TWILIO_MESSAGING_SERVICE_SID);
  else form.set("From", env.TWILIO_FROM_NUMBER || "");
  form.set("Body", body || "Speed-to-Lead test SMS ✓ — reply STOP to opt out.");
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`, {
    method: "POST", headers: { Authorization: basic(env), "Content-Type": "application/x-www-form-urlencoded" }, body: form.toString(),
  });
  const j = await res.json().catch(() => ({}));
  return res.ok ? { ok: true, sid: j.sid, status: j.status } : { ok: false, status: res.status, error: j.message || `twilio_${res.status}` };
}

export async function listTwilioNumbers(env) {
  if (!hasCreds(env)) return { ok: false, error: "missing_twilio_creds" };
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/IncomingPhoneNumbers.json?PageSize=50`, { headers: { Authorization: basic(env) } });
  if (!res.ok) return { ok: false, status: res.status };
  const j = await res.json().catch(() => ({}));
  return { ok: true, numbers: (j.incoming_phone_numbers || []).map((n) => ({ number: n.phone_number, sms: !!(n.capabilities && n.capabilities.sms), voice: !!(n.capabilities && n.capabilities.voice) })) };
}
