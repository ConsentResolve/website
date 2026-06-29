// Instantly campaign read/edit via API (so campaign copy updates can be applied in one
// shot instead of the UI). Gated by ?key=<CRM_WEBHOOK_TOKEN>. Uses the stored
// INSTANTLY_API_KEY + the browser-UA CF bypass. Safety model: GET the campaign, mutate
// ONLY variant subject/body in place, PATCH the whole sequences array back — so step
// delays, schedule, and variant flags are preserved (never reconstructed).
//   GET  /api/crm/instantly/campaign?id=<id>&key=…           -> read steps (subject/body)
//   POST /api/crm/instantly/campaign?id=<id>&key=… { ... }   -> edit (dry-run unless run=1)
//     body: { fallbacks: {firstName:"there", companyName:"your business"},
//             set: [{step, variant, subject?, body?}], run: true }
import { json } from "../_lib/http.js";
import { crmWebhookToken } from "../_lib/crm.js";

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const BASE = "https://api.instantly.ai/api/v2";

async function inst(env, method, path, body) {
  const opt = { method, headers: { Accept: "application/json", "User-Agent": UA, Authorization: "Bearer " + env.INSTANTLY_API_KEY } };
  if (body) { opt.headers["Content-Type"] = "application/json"; opt.body = JSON.stringify(body); }
  const r = await fetch(BASE + path, opt);
  let j = {}; try { j = await r.json(); } catch (_) {}
  return { ok: r.ok, status: r.status, body: j };
}
const summarize = (steps) => (steps || []).map((st, i) => ({ step: i, delay: st.delay, variants: (st.variants || []).map((v, j) => ({ variant: j, subject: v.subject, body: v.body, disabled: !!v.v_disabled })) }));

function gate(request, env) {
  if (!env.INSTANTLY_API_KEY) return { err: json({ error: "no_key", message: "INSTANTLY_API_KEY not set" }, { status: 400 }) };
  if ((new URL(request.url).searchParams.get("key") || "") !== crmWebhookToken(env)) return { err: json({ error: "unauthorized" }, { status: 401 }) };
  return {};
}

export async function onRequestGet({ request, env }) {
  const g = gate(request, env); if (g.err) return g.err;
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return json({ error: "id_required" }, { status: 400 });
  const res = await inst(env, "GET", "/campaigns/" + id);
  if (!res.ok) return json({ error: "fetch_failed", status: res.status, detail: String(JSON.stringify(res.body)).slice(0, 200) }, { status: 200 });
  const c = res.body; const seq = (c.sequences && c.sequences[0]) || {};
  return json({ id, name: c.name, status: c.status, steps: summarize(seq.steps) });
}

export async function onRequestPost({ request, env }) {
  const g = gate(request, env); if (g.err) return g.err;
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return json({ error: "id_required" }, { status: 400 });
  let b = {}; try { b = await request.json(); } catch { return json({ error: "bad_json" }, { status: 400 }); }

  const cur = await inst(env, "GET", "/campaigns/" + id);
  if (!cur.ok) return json({ error: "fetch_failed", status: cur.status }, { status: 200 });
  const seqs = cur.body.sequences || [];
  if (!seqs.length || !seqs[0].steps) return json({ error: "no_sequence_steps" }, { status: 200 });
  const steps = seqs[0].steps;

  const fb = b.fallbacks || {};
  const applyFb = (text) => {
    let out = String(text || "");
    for (const k of Object.keys(fb)) {
      // Add |fallback ONLY to bare {{var}} that don't already have a pipe.
      const re = new RegExp("\\{\\{\\s*" + k + "\\s*\\}\\}", "g");
      out = out.replace(re, "{{" + k + "|" + fb[k] + "}}");
    }
    return out;
  };

  let changed = 0;
  if (Object.keys(fb).length) {
    for (const st of steps) for (const v of (st.variants || [])) {
      const ns = applyFb(v.subject), nb = applyFb(v.body);
      if (ns !== v.subject) { v.subject = ns; changed++; }
      if (nb !== v.body) { v.body = nb; changed++; }
    }
  }
  for (const s of (b.set || [])) {
    const v = steps[s.step] && steps[s.step].variants && steps[s.step].variants[s.variant || 0];
    if (v) { if (s.subject !== undefined) { v.subject = s.subject; changed++; } if (s.body !== undefined) { v.body = s.body; changed++; } }
  }

  if (b.run !== true) return json({ ok: true, dry: true, changed, preview: summarize(steps) });
  const res = await inst(env, "PATCH", "/campaigns/" + id, { sequences: seqs });
  return json({ ok: res.ok, status: res.status, changed, detail: res.ok ? undefined : String(JSON.stringify(res.body)).slice(0, 200) });
}
