// Gmail connect flow for the CRM (3 sub-paths, one module):
//   GET /api/crm/gmail/auth     -> redirect to Google consent (gated)
//   GET /api/crm/gmail/callback -> exchange code, store token (verified by state=key)
//   GET /api/crm/gmail/status   -> { configured, redirect_uri, accounts:[...] } (gated)
import { json, corsHeaders } from "../_lib/http.js";
import { crmAuthed, crmKey, addActivity } from "../_lib/crm.js";
import { gClientId, gAuthUrl, gExchange, emailFromIdToken, saveGmail, listGmailAccounts, gBase, gRedirect, searchThread, sendMessage } from "../_lib/gmail.js";

export async function onRequestOptions({ request, env }) {
  return new Response(null, { status: 204, headers: corsHeaders(request, env) });
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const path = url.pathname;

  // Callback returns from Google with no cookie/key — authenticate via state (the CRM key).
  if (path === "/api/crm/gmail/callback") {
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state") || "";
    const err = url.searchParams.get("error");
    if (err) return new Response("Google denied: " + err, { status: 400 });
    if (state !== crmKey(env)) return new Response("bad state", { status: 403 });
    if (!code) return new Response("missing code", { status: 400 });
    const data = await gExchange(env, code);
    if (!data.access_token) return new Response("token exchange failed: " + JSON.stringify(data).slice(0, 300), { status: 400 });
    const email = emailFromIdToken(data.id_token || "");
    if (!email) return new Response("could not read account email from token", { status: 400 });
    await saveGmail(env, email, data);
    return Response.redirect(gBase(env) + "/crm?key=" + encodeURIComponent(state) + "&connected=" + encodeURIComponent(email), 302);
  }

  const cors = corsHeaders(request, env);
  if (!(await crmAuthed(request, env))) return json({ error: "unauthorized" }, { status: 401 }, cors);

  if (path === "/api/crm/gmail/auth") {
    if (!gClientId(env)) return json({ error: "no_client", message: "Set GMAIL_CLIENT_ID + GMAIL_CLIENT_SECRET (or reuse GOOGLE_*) in Cloudflare." }, { status: 400 }, cors);
    const state = url.searchParams.get("key") || crmKey(env);
    return Response.redirect(gAuthUrl(env, state), 302);
  }

  if (path === "/api/crm/gmail/status") {
    return json({ configured: !!gClientId(env), redirect_uri: gRedirect(env), accounts: await listGmailAccounts(env) }, {}, cors);
  }

  if (path === "/api/crm/gmail/thread") {
    const email = (url.searchParams.get("email") || "").toLowerCase();
    if (!email) return json({ error: "email_required" }, { status: 400 }, cors);
    const accts = await listGmailAccounts(env);
    if (!accts.length) return json({ connected: false, messages: [] }, {}, cors);
    const account = url.searchParams.get("account") || accts[0].email;
    const res = await searchThread(env, account, email, 8);
    return json({ connected: true, account, ...res }, {}, cors);
  }

  return json({ error: "not_found" }, { status: 404 }, cors);
}

export async function onRequestPost({ request, env }) {
  const cors = corsHeaders(request, env);
  if (!(await crmAuthed(request, env))) return json({ error: "unauthorized" }, { status: 401 }, cors);
  if (new URL(request.url).pathname !== "/api/crm/gmail/send") return json({ error: "not_found" }, { status: 404 }, cors);
  let b = {};
  try { b = await request.json(); } catch { return json({ error: "bad_json" }, { status: 400 }, cors); }
  if (!b.to || !b.body) return json({ error: "to_and_body_required" }, { status: 400 }, cors);
  const accts = await listGmailAccounts(env);
  if (!accts.length) return json({ error: "no_account" }, { status: 400 }, cors);
  const account = b.account || accts[0].email;
  const res = await sendMessage(env, account, b.to, b.subject || "(no subject)", b.body, b.threadId);
  if (res.error) return json(res, { status: 400 }, cors);
  if (b.leadId) { try { await addActivity(env, b.leadId, "email_out", "Reply sent via Gmail (" + account + "): " + (b.subject || ""), account); } catch (_) {} }
  return json(res, {}, cors);
}
