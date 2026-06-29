// Opaque per-lead token -> first-party identity resolver.
//
// Cold-email links carry ?ld=<token> — an opaque id, NEVER the email/phone. The
// landing page (post-consent, inside the Crisp block) resolves it here to pre-fill the
// chat, so the email never rides in the URL. The token->email map lives in D1
// (lead_links), minted at tokenize time (crm-lead-tokens.js) or reused per email.
//
// Threat model: the token IS the bearer — anyone with the link resolves to that lead,
// so a forwarded link pre-fills the ORIGINAL recipient. Accepted: the values are
// low-stakes (a name/email we already cold-emailed), the token is 128-bit opaque (not
// enumerable), and we count uses so abuse is visible. Tighten later with a TTL or
// single-resolve if needed.
import { json } from "../_lib/http.js";

export async function ensureLeadLinks(env) {
  await env.DB.batch([
    env.DB.prepare(
      "CREATE TABLE IF NOT EXISTS lead_links (token TEXT PRIMARY KEY, email TEXT, name TEXT, company TEXT, created_at TEXT, uses INTEGER DEFAULT 0, last_used_at TEXT)"
    ),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_lead_links_email ON lead_links(email)"),
  ]);
}

// Mint (or reuse) an opaque token for an email; keeps name/company fresh.
export async function mintToken(env, { email, name, company }) {
  if (!email) return null;
  await ensureLeadLinks(env);
  const e = String(email).trim().toLowerCase();
  const ex = await env.DB.prepare("SELECT token FROM lead_links WHERE email=?").bind(e).first();
  if (ex && ex.token) {
    await env.DB.prepare("UPDATE lead_links SET name=?, company=? WHERE token=?").bind(name || "", company || "", ex.token).run();
    return ex.token;
  }
  const token = crypto.randomUUID().replace(/-/g, "");
  await env.DB.prepare("INSERT INTO lead_links (token,email,name,company,created_at,uses) VALUES (?,?,?,?,?,0)")
    .bind(token, e, name || "", company || "", new Date().toISOString()).run();
  return token;
}

// Public resolve, called client-side from the landing page (?ld=). Token is the bearer.
export async function onRequestGet({ request, env }) {
  const ld = (new URL(request.url).searchParams.get("ld") || "").trim();
  if (!ld) return json({ ok: false, error: "ld_required" }, { status: 400 });
  await ensureLeadLinks(env);
  const row = await env.DB.prepare("SELECT email,name FROM lead_links WHERE token=?").bind(ld).first();
  if (!row) return json({ ok: false });
  await env.DB.prepare("UPDATE lead_links SET uses=uses+1, last_used_at=? WHERE token=?").bind(new Date().toISOString(), ld).run();
  return json({ ok: true, n: row.name || "", e: row.email || "" });
}
