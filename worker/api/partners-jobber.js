// Jobber connect + lead-push endpoints (mirrors the gads/gbp OAuth pattern).
//   GET  /api/partners/jobber/auth      -> redirect to Jobber consent (CRM-gated)
//   GET  /api/partners/jobber/callback  -> code -> tokens -> account{id,name} -> D1
//   GET  /api/partners/jobber/status    -> connection probe (CRM session or ?key=)
//   POST /api/partners/jobber/push      -> test-push a lead (CRM session or ?key=)
//   POST /api/partners/jobber/webhook   -> Jobber webhooks (HMAC-verified; APP_DISCONNECT)
//
// Setup (Jobber Developer Center, developer.getjobber.com):
//   1. Create the app; scopes: clients read/write (read needed for CLIENT_*
//      webhooks) + users read (auto-provisioning reads the authorizing
//      admin's email — see _lib/partners/provision.js).
//   2. OAuth Callback URL:  https://consentresolve.com/api/partners/jobber/callback
//   3. Webhook URL:         https://consentresolve.com/api/partners/jobber/webhook
//      Subscribe at minimum to APP_DISCONNECT (required for marketplace review).
//   4. wrangler secret put JOBBER_CLIENT_ID / JOBBER_CLIENT_SECRET
//   5. Visit /api/partners/jobber/auth from a logged-in /crm session to connect.
import { json, corsHeaders } from "../_lib/http.js";
import { crmAuthed, crmKey } from "../_lib/crm.js";
import { gBase } from "../_lib/gmail.js";
import {
  jobberConfigured, jobberVersion, jobberAuthUrl, exchangeCode, accessTokenExpiry,
  fetchAccount, fetchOwnerEmail, getConnection, listConnections, gql, pushLead,
  verifyWebhookSignature, handleWebhookEvent, saveConnection, claimConnection, connectionState,
} from "../_lib/partners/jobber.js";
import { provisionCustomer } from "../_lib/partners/provision.js";

const marketplaceEnabled = (env) => env.JOBBER_MARKETPLACE_ENABLED === "true";

const redirectUri = (env) => gBase(env) + "/api/partners/jobber/callback";

async function readAuthed(request, env) {
  if (await crmAuthed(request, env)) return true;
  const k = new URL(request.url).searchParams.get("key");
  return k === crmKey(env);
}

export async function onRequestOptions({ request, env }) {
  return new Response(null, { status: 204, headers: corsHeaders(request, env) });
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const path = url.pathname;
  const cors = corsHeaders(request, env);

  if (path === "/api/partners/jobber/callback") {
    // Two legitimate arrivals:
    //  - internal connect: we initiated /auth and state carries our CRM key →
    //    the connection is ours ("default" tenant).
    //  - marketplace connect: Jobber's App Marketplace Connect button sends
    //    the user here with a code and NO state. Gated behind
    //    JOBBER_MARKETPLACE_ENABLED so it stays off until the listing is live.
    //    Stored unclaimed (no customer_key) — receives no leads until
    //    onboarding claims it — and the user lands on /jobber-connected/.
    const state = url.searchParams.get("state") || "";
    const internal = state === crmKey(env);
    const marketplace = !state && marketplaceEnabled(env);
    if (!internal && !marketplace) return new Response("bad state", { status: 403 });
    const code = url.searchParams.get("code");
    if (!code) return new Response("missing code", { status: 400 });
    try {
      const tok = await exchangeCode(env, code, redirectUri(env));
      const account = await fetchAccount(env, tok.access_token);
      await saveConnection(env, {
        accountId: account.id,
        accountName: account.name || null,
        accessToken: tok.access_token,
        refreshToken: tok.refresh_token || null,
        expiresAt: accessTokenExpiry(tok.access_token, tok.expires_in),
        customerKey: internal ? "default" : null,
      });
      if (internal) {
        return Response.redirect(gBase(env) + "/crm/app?jobber=connected#settings", 302);
      }
      // Marketplace: auto-provision a dashboard account keyed by the
      // authorizing admin's email, claim the connection for it, and hand the
      // contractor to the dashboard's finish-setup link. Every failure along
      // the way degrades to the concierge flow (unclaimed + landing page) —
      // a connect must never error on our side of the handshake.
      const email = await fetchOwnerEmail(env, tok.access_token);
      const prov = await provisionCustomer(env, {
        partner: "jobber", email, accountId: account.id, accountName: account.name,
      });
      if (prov?.customer_key) {
        await claimConnection(env, account.id, prov.customer_key);
        if (prov.finish_url) return Response.redirect(prov.finish_url, 302);
      }
      return Response.redirect(gBase(env) + "/jobber-connected/?account=" + encodeURIComponent(account.name || ""), 302);
    } catch (e) {
      return new Response("Jobber connect failed: " + String(e).slice(0, 300), { status: 400 });
    }
  }

  if (path === "/api/partners/jobber/status") {
    if (!(await readAuthed(request, env))) return json({ error: "unauthorized" }, { status: 401 }, cors);
    const customerKey = url.searchParams.get("customer") || "default";
    const conn = await getConnection(env, customerKey);
    const connections = await listConnections(env);
    const state = connectionState(conn);
    const base = {
      customer: customerKey, state, configured: jobberConfigured(env),
      marketplace_enabled: marketplaceEnabled(env), redirect_uri: redirectUri(env), connections,
    };
    if (!conn) return json({ ...base, connected: false }, {}, cors);

    const identity = {
      account_id: conn.account_id, account_name: conn.account_name,
      token_expires_at: conn.expires_at, api_version: jobberVersion(env),
    };
    // Don't probe a connection we already know is dead: the call would only
    // fail, and the reauth prompt is the answer either way.
    if (state === "needs_reauth") {
      return json({
        ...base, ...identity, connected: false, live: null,
        error: "reauth required — the stored refresh token was rejected by Jobber",
      }, {}, cors);
    }
    let live = null, error = null;
    try {
      const d = await gql(env, "{ account { id name } }", undefined, customerKey);
      live = d.account;
    } catch (e) { error = String(e).slice(0, 200); }
    return json({ ...base, ...identity, connected: true, live, error }, {}, cors);
  }

  if (!(await crmAuthed(request, env))) return json({ error: "unauthorized" }, { status: 401 }, cors);
  if (path === "/api/partners/jobber/auth") {
    if (!jobberConfigured(env)) {
      return json({ error: "no_client", message: "Set JOBBER_CLIENT_ID + JOBBER_CLIENT_SECRET (wrangler secret put)." }, { status: 400 }, cors);
    }
    return Response.redirect(jobberAuthUrl(env, redirectUri(env), crmKey(env)), 302);
  }

  return json({ error: "not_found" }, { status: 404 }, cors);
}

export async function onRequestPost({ request, env, ctx }) {
  const url = new URL(request.url);
  const path = url.pathname;
  const cors = corsHeaders(request, env);

  if (path === "/api/partners/jobber/webhook") {
    // Must answer inside 1s — verify, ack, then process via waitUntil.
    const raw = await request.text();
    const sig = request.headers.get("X-Jobber-Hmac-SHA256") || "";
    if (!env.JOBBER_CLIENT_SECRET) return json({ error: "unconfigured" }, { status: 503 });
    if (!(await verifyWebhookSignature(env.JOBBER_CLIENT_SECRET, raw, sig))) {
      return json({ error: "bad_signature" }, { status: 401 });
    }
    let event = null;
    try { event = JSON.parse(raw)?.data?.webHookEvent || null; } catch { /* ignored */ }
    if (event) ctx.waitUntil(handleWebhookEvent(env, event).catch(() => {}));
    return json({ ok: true });
  }

  if (path === "/api/partners/jobber/push") {
    if (!(await readAuthed(request, env))) return json({ error: "unauthorized" }, { status: 401 }, cors);
    let lead = {};
    try { lead = await request.json(); } catch { return json({ error: "bad_json" }, { status: 400 }, cors); }
    const customerKey = url.searchParams.get("customer") || "default";
    const result = await pushLead(env, lead, customerKey);
    return json(result, { status: result.ok ? 200 : 422 }, cors);
  }

  return json({ error: "not_found" }, { status: 404 }, cors);
}
