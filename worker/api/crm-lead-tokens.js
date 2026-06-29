// Tokenize a campaign's leads: mint an opaque ?ld= token per lead (lead-prefill.js)
// and write it to the lead's Instantly custom_variables.crid, so the email link
// {{crid}} carries it. Gated by ?key=<CRM_WEBHOOK_TOKEN>; uses INSTANTLY_API_KEY +
// browser-UA. Dry-run (mints + stores in D1, does NOT touch Instantly) unless run=1.
//   POST /api/crm/instantly/leadtokens?id=<campaign>&key=…[&run=1]
//   POST …&inspect=1  -> dump the first lead's shape (to confirm the Instantly payload)
import { json } from "../_lib/http.js";
import { crmWebhookToken } from "../_lib/crm.js";
import { mintToken } from "./lead-prefill.js";

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const BASE = "https://api.instantly.ai/api/v2";
async function inst(env, method, path, body) {
  const opt = { method, headers: { Accept: "application/json", "User-Agent": UA, Authorization: "Bearer " + env.INSTANTLY_API_KEY } };
  if (body) { opt.headers["Content-Type"] = "application/json"; opt.body = JSON.stringify(body); }
  const r = await fetch(BASE + path, opt);
  let j = {}; try { j = await r.json(); } catch (_) {}
  return { ok: r.ok, status: r.status, body: j };
}
const pick = (o, keys) => { for (const k of keys) { if (o && o[k] != null && o[k] !== "") return o[k]; } return ""; };

export async function onRequestPost({ request, env }) {
  const url = new URL(request.url);
  if (!env.INSTANTLY_API_KEY) return json({ error: "no_key" }, { status: 400 });
  if ((url.searchParams.get("key") || "") !== crmWebhookToken(env)) return json({ error: "unauthorized" }, { status: 401 });
  const id = url.searchParams.get("id");
  if (!id) return json({ error: "id_required" }, { status: 400 });
  const run = url.searchParams.get("run") === "1";

  // Pull the campaign's leads (paginate).
  let leads = [], starting_after, pages = 0;
  do {
    const b = { campaign: id, limit: 100 };
    if (starting_after) b.starting_after = starting_after;
    const r = await inst(env, "POST", "/leads/list", b);
    if (!r.ok) return json({ error: "list_failed", status: r.status, detail: String(JSON.stringify(r.body)).slice(0, 200) }, { status: 200 });
    const items = r.body.items || r.body.data || [];
    leads.push(...items);
    starting_after = r.body.next_starting_after || r.body.starting_after;
    pages++;
  } while (starting_after && pages < 20);

  if (url.searchParams.get("inspect") === "1") {
    const s = leads[0] || null;
    return json({ count: leads.length, sample_keys: s ? Object.keys(s) : [], sample: s });
  }

  const results = [];
  for (const ld of leads) {
    const email = pick(ld, ["email"]) || pick(ld.payload || {}, ["email"]);
    if (!email) continue;
    const name = pick(ld, ["first_name", "firstName"]) || pick(ld.payload || {}, ["first_name", "firstName"]);
    const company = pick(ld, ["company_name", "companyName"]) || pick(ld.payload || {}, ["company_name", "companyName"]);
    const token = await mintToken(env, { email, name, company });
    let patched = false, perr = null;
    if (run && ld.id) {
      const existing = ld.custom_variables || (ld.payload && ld.payload.custom_variables) || {};
      const cv = Object.assign({}, existing, { crid: token });
      const pr = await inst(env, "PATCH", "/leads/" + ld.id, { custom_variables: cv });
      patched = pr.ok; if (!pr.ok) perr = pr.status;
    }
    results.push({ email, token, patched, perr });
  }
  return json({ ok: true, run, leads: leads.length, tokenized: results.length, results });
}
