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
  if (env.STL_PUBLIC_ORIGIN) form.set("StatusCallback", `${env.STL_PUBLIC_ORIGIN}/api/stl/twilio/status`);
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`, {
    method: "POST", headers: { Authorization: basic(env), "Content-Type": "application/x-www-form-urlencoded" }, body: form.toString(),
  });
  const j = await res.json().catch(() => ({}));
  return res.ok ? { ok: true, sid: j.sid, status: j.status } : { ok: false, status: res.status, error: j.message || `twilio_${res.status}` };
}

// Find which account (this one or any of its subaccounts) owns a given number.
// Twilio has no global reverse-owner lookup, but the parent creds can list all
// subaccounts and search each. Answers "which Account SID owns +17272025996?".
export async function findNumberOwner(env, number) {
  if (!hasCreds(env)) return { ok: false, error: "missing_twilio_creds" };
  const num = (number || env.TWILIO_FROM_NUMBER || "").trim();
  if (!num) return { ok: false, error: "no number given" };
  // List the main account + all its subaccounts.
  const ar = await fetch("https://api.twilio.com/2010-04-01/Accounts.json?PageSize=200", { headers: { Authorization: basic(env) } });
  if (!ar.ok) return { ok: false, status: ar.status, error: `cannot_list_accounts_${ar.status}` };
  const aj = await ar.json().catch(() => ({}));
  const accounts = aj.accounts || [];
  const owners = [];
  for (const a of accounts) {
    const auth = "Basic " + btoa(`${a.sid}:${a.auth_token}`);
    const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${a.sid}/IncomingPhoneNumbers.json?PhoneNumber=${encodeURIComponent(num)}`, { headers: { Authorization: auth } });
    if (!r.ok) continue;
    const j = await r.json().catch(() => ({}));
    if ((j.incoming_phone_numbers || []).length) {
      owners.push({ account_sid: a.sid, friendly_name: a.friendly_name, status: a.status, type: a.type, is_subaccount: a.sid !== env.TWILIO_ACCOUNT_SID });
    }
  }
  return { ok: true, number: num, found: owners.length > 0, owners, accounts_scanned: accounts.length, configured_account: env.TWILIO_ACCOUNT_SID };
}

// Look up a sent message's delivery status + carrier error by SID.
// Reveals whether "queued" became delivered / undelivered / failed and the code
// (e.g. 30034 = A2P 10DLC not registered).
export async function messageStatus(env, sid) {
  if (!hasCreds(env)) return { ok: false, error: "missing_twilio_creds" };
  if (!sid) return { ok: false, error: "need a message SID (SM…)" };
  const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages/${encodeURIComponent(sid)}.json`, { headers: { Authorization: basic(env) } });
  if (!r.ok) return { ok: false, status: r.status, error: `twilio_${r.status}` };
  const j = await r.json().catch(() => ({}));
  return { ok: true, sid: j.sid, status: j.status, error_code: j.error_code, error_message: j.error_message, to: j.to, from: j.from, date_sent: j.date_sent, date_updated: j.date_updated };
}

// List Messaging Services + the numbers attached to each. A2P 10DLC campaigns are
// linked to a Messaging Service, so this reveals which MG SID is approved and which
// numbers send under it — set TWILIO_MESSAGING_SERVICE_SID to that MG… value.
export async function listMessagingServices(env) {
  if (!hasCreds(env)) return { ok: false, error: "missing_twilio_creds" };
  const r = await fetch("https://messaging.twilio.com/v1/Services?PageSize=50", { headers: { Authorization: basic(env) } });
  if (!r.ok) return { ok: false, status: r.status, error: `twilio_${r.status}` };
  const j = await r.json().catch(() => ({}));
  const services = [];
  for (const s of (j.services || [])) {
    let numbers = [];
    try {
      const nr = await fetch(`https://messaging.twilio.com/v1/Services/${s.sid}/PhoneNumbers?PageSize=50`, { headers: { Authorization: basic(env) } });
      if (nr.ok) { const nj = await nr.json().catch(() => ({})); numbers = (nj.phone_numbers || []).map((p) => p.phone_number); }
    } catch (_) {}
    services.push({ sid: s.sid, name: s.friendly_name, numbers, use_case: s.usecase || null });
  }
  return { ok: true, count: services.length, services };
}

// Attach an owned number to a Messaging Service (completes A2P: campaign → service →
// number). Resolves the E.164 to its PN SID, then adds it to the service's sender pool.
export async function attachNumberToService(env, serviceSid, number) {
  if (!hasCreds(env)) return { ok: false, error: "missing_twilio_creds" };
  serviceSid = (serviceSid || env.TWILIO_MESSAGING_SERVICE_SID || "").trim();
  number = (number || env.TWILIO_FROM_NUMBER || "").trim();
  if (!serviceSid) return { ok: false, error: "no messaging service SID" };
  if (!number) return { ok: false, error: "no number" };
  // Resolve E.164 → PhoneNumber SID (PN…).
  const nr = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/IncomingPhoneNumbers.json?PhoneNumber=${encodeURIComponent(number)}`, { headers: { Authorization: basic(env) } });
  if (!nr.ok) return { ok: false, status: nr.status, error: `lookup_${nr.status}` };
  const nj = await nr.json().catch(() => ({}));
  const pn = (nj.incoming_phone_numbers || [])[0];
  if (!pn) return { ok: false, error: `number ${number} not found in this account` };
  const form = new URLSearchParams(); form.set("PhoneNumberSid", pn.sid);
  const ar = await fetch(`https://messaging.twilio.com/v1/Services/${serviceSid}/PhoneNumbers`, {
    method: "POST", headers: { Authorization: basic(env), "Content-Type": "application/x-www-form-urlencoded" }, body: form.toString(),
  });
  const aj = await ar.json().catch(() => ({}));
  if (!ar.ok) return { ok: false, status: ar.status, error: aj.message || `attach_${ar.status}` };
  return { ok: true, attached: number, phone_sid: pn.sid, service: serviceSid };
}

export async function listTwilioNumbers(env) {
  if (!hasCreds(env)) return { ok: false, error: "missing_twilio_creds" };
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/IncomingPhoneNumbers.json?PageSize=50`, { headers: { Authorization: basic(env) } });
  if (!res.ok) return { ok: false, status: res.status };
  const j = await res.json().catch(() => ({}));
  return { ok: true, numbers: (j.incoming_phone_numbers || []).map((n) => ({ number: n.phone_number, sms: !!(n.capabilities && n.capabilities.sms), voice: !!(n.capabilities && n.capabilities.voice) })) };
}
