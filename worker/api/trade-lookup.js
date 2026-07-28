// GET /api/trade-lookup?domain=yourshop.com
// Fetches the homepage and classifies the trade from its content (best keyword match),
// so the claim-50 form can auto-detect the trade and skip asking. Also serves as domain
// validation: reachable:false means the site didn't resolve. SSRF-guarded.
import { corsHeaders, json } from "../_lib/http.js";
import { TRADE_OPTIONS } from "../_lib/trades.js";

const KW = {
  hvac: /\b(hvac|air ?condition|a\/c\b|ac repair|furnace|heat pump|heating (and|&) (air|cooling)|cooling)\b/gi,
  plumber: /\b(plumb|drain clean|water heater|sewer|repipe|faucet|clogged)\b/gi,
  roofing: /\b(roof|shingle|reroof|gutter)\b/gi,
  electrician: /\b(electric|panel upgrade|rewir|breaker|ev charger)\b/gi,
  "general-contractor": /\b(general contract|remodel|renovation|home addition|construction)\b/gi,
  handyman: /\bhandyman\b/gi,
  "tree-removal": /\b(tree removal|tree service|arborist|stump grind)\b/gi,
  locksmith: /\b(locksmith|rekey|lockout)\b/gi,
  painter: /\b(painting|painter|repaint)\b/gi,
  "deck-fence": /\b(deck build|fence|fencing|pergola)\b/gi,
  "garage-door": /\bgarage door\b/gi,
  "appliance-repair": /\bappliance repair\b/gi,
  "house-cleaning": /\b(house cleaning|maid service|cleaning service|housekeep)\b/gi,
  "pest-control": /\b(pest control|exterminat|termite|rodent|bed bug)\b/gi,
  "power-washing": /\b(power wash|pressure wash|soft wash)\b/gi,
  "lawn-care": /\b(lawn care|landscap|mowing|lawn service)\b/gi,
  "mobile-car-service": /\b(mobile mechanic|mobile auto|auto repair|car repair)\b/gi,
};
const labelFor = (v) => (TRADE_OPTIONS.find((o) => o.value === v) || {}).label || "";

function isPublicHttpUrl(u) {
  let x; try { x = new URL(u); } catch { return false; }
  if (x.protocol !== "http:" && x.protocol !== "https:") return false;
  const h = x.hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".local") || /^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(h) || /^172\.(1[6-9]|2\d|3[01])\./.test(h)) return false;
  return true;
}

export async function onRequestOptions({ request, env }) {
  return new Response(null, { status: 204, headers: corsHeaders(request, env) });
}

export async function onRequestGet({ request, env }) {
  const cors = corsHeaders(request, env);
  let d = (new URL(request.url).searchParams.get("domain") || "").trim().toLowerCase();
  d = d.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(d)) return json({ ok: false, reason: "bad_format" }, {}, cors);
  const url = "https://" + d;
  if (!isPublicHttpUrl(url)) return json({ ok: false, reason: "blocked" }, {}, cors);

  let html = "";
  try {
    const r = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(6000), headers: { "User-Agent": "Mozilla/5.0 (compatible; ConsentResolveBot/1.0)" } });
    if (!r.ok) return json({ ok: true, reachable: false, domain: d }, {}, cors);
    const buf = await r.arrayBuffer();
    html = new TextDecoder().decode(buf.slice(0, 300000)).toLowerCase();
  } catch {
    return json({ ok: true, reachable: false, domain: d }, {}, cors);
  }

  let best = "", bestN = 0;
  for (const [slug, re] of Object.entries(KW)) {
    const n = (html.match(re) || []).length;
    if (n > bestN) { bestN = n; best = slug; }
  }
  const trade = bestN >= 2 ? best : "";
  return json({ ok: true, reachable: true, domain: d, trade, label: labelFor(trade), confidence: bestN }, {}, cors);
}
