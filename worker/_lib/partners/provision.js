// Auto-provisioning bridge: marketplace connect → customer account on the
// dashboard (dashboard.consentresolve.com). The worker holds partner tokens
// and lead routing; the dashboard owns customer identity. This module is the
// server-to-server handshake between them — contract spec for the dashboard
// side lives in docs/crm/JOBBER-MARKETPLACE-PROVISIONING.md.
//
// Env (wrangler secrets):
//   DASHBOARD_PROVISION_URL     e.g. https://dashboard.consentresolve.com/api/provision/partner
//   DASHBOARD_PROVISION_SECRET  shared HMAC key (long random; same value on both sides)
//
// Both unset → provisioning is off and marketplace connects park as
// unclaimed (the concierge flow). Provisioning failures do the same: a
// contractor's connect NEVER errors because our provisioning hiccupped.

const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

export async function signPayload(secret, body) {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  return hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body)));
}

export const provisioningConfigured = (env) =>
  Boolean(env.DASHBOARD_PROVISION_URL && env.DASHBOARD_PROVISION_SECRET);

/**
 * Ask the dashboard to create-or-match a customer for a marketplace connect.
 * Returns { customer_key, finish_url } or null (not configured / any failure).
 * Idempotency is the dashboard's job: same email or same jobber_account_id
 * must resolve to the same customer on repeat connects.
 */
export async function provisionCustomer(env, { partner, email, accountId, accountName }) {
  if (!provisioningConfigured(env) || !email) return null;
  try {
    const body = JSON.stringify({
      source: "partner_marketplace",
      partner,                       // "jobber"
      email,                         // authorizing admin's email (linking key)
      partner_account_id: accountId, // e.g. Jobber account EncodedId
      account_name: accountName || null,
      ts: new Date().toISOString(),
    });
    const res = await fetch(env.DASHBOARD_PROVISION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CR-Signature": await signPayload(env.DASHBOARD_PROVISION_SECRET, body),
      },
      body,
    });
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    return data && data.customer_key ? { customer_key: data.customer_key, finish_url: data.finish_url || null } : null;
  } catch { return null; }
}
