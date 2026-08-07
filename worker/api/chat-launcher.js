// Chat-launcher config — controls the custom orb + teaser + nudge that front the Retell
// chat on the marketing site (src/layouts/BaseLayout.astro).
//
//   GET  /api/chat-launcher            → public; the site fetches this at boot (cached 60s)
//   POST /api/chat-launcher  {config}  → gated (crmAuthed); saved from the /crm/speed console
//
// One JSON blob in site_config under key 'chat_launcher'. Everything is optional and
// deep-merged over DEFAULTS, so a partial save never drops a field.
import { crmAuthed } from "../_lib/crm.js";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};
const json = (o, init = {}) => new Response(JSON.stringify(o), {
  ...init, headers: { "Content-Type": "application/json", ...CORS, ...(init.headers || {}) },
});

export const DEFAULTS = {
  enabled: true,                 // master switch for the whole custom launcher
  agentName: "Mack",
  status: "Online",
  greeting: "Do you want more leads for your existing website? (Yes or No)",
  phone: "+17279999846",         // tel + display are derived from this on the site
  entranceDelay: 700,            // ms before the orb pops in
  teaser: {
    enabled: true,
    delay: 8000,                 // ms after load before the teaser card shows (0 = time trigger off)
    scroll: 0.45,                // 0..1 scroll fraction that also triggers it (0 = off)
    exitIntent: true,            // desktop mouse-leave-top trigger
  },
  nudge: {
    enabled: true,
    every: 16000,                // ms between orb "nudge" wiggles (0 = off)
    max: 3,                      // stop after this many
  },
  badge: "honest",               // 'honest' (on teaser) | 'always' | 'off'
};

let _ready = false;
async function ensure(env) {
  if (_ready) return;
  try {
    await env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS site_config (
         k TEXT PRIMARY KEY, v TEXT NOT NULL DEFAULT '{}',
         updated_at TEXT NOT NULL DEFAULT (datetime('now')))`
    ).run();
  } catch (_) {}
  _ready = true;
}

async function readConfig(env) {
  await ensure(env);
  let stored = {};
  try {
    const r = await env.DB.prepare("SELECT v FROM site_config WHERE k='chat_launcher'").first();
    if (r && r.v) stored = JSON.parse(r.v);
  } catch (_) {}
  return merge(DEFAULTS, stored);
}

// One-level deep merge (teaser/nudge are nested objects; everything else is scalar).
function merge(base, patch) {
  const out = { ...base };
  for (const k of Object.keys(patch || {})) {
    const bv = base[k], pv = patch[k];
    if (bv && typeof bv === "object" && !Array.isArray(bv) && pv && typeof pv === "object") out[k] = { ...bv, ...pv };
    else if (pv !== undefined) out[k] = pv;
  }
  return out;
}

const clampNum = (v, lo, hi, dflt) => { const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : dflt; };
const bool = (v) => v === true || v === "1" || v === "true" || v === 1;

// Sanitize an incoming config so a bad value from the console can't break the site.
function sanitize(inp) {
  const c = inp || {};
  const t = c.teaser || {}, n = c.nudge || {};
  return {
    enabled: bool(c.enabled),
    agentName: String(c.agentName ?? DEFAULTS.agentName).slice(0, 40),
    status: String(c.status ?? DEFAULTS.status).slice(0, 80),
    greeting: String(c.greeting ?? DEFAULTS.greeting).slice(0, 240),
    phone: String(c.phone ?? DEFAULTS.phone).replace(/[^\d+]/g, "").slice(0, 18),
    entranceDelay: clampNum(c.entranceDelay, 0, 60000, DEFAULTS.entranceDelay),
    teaser: {
      enabled: bool(t.enabled),
      delay: clampNum(t.delay, 0, 600000, DEFAULTS.teaser.delay),
      scroll: clampNum(t.scroll, 0, 1, DEFAULTS.teaser.scroll),
      exitIntent: bool(t.exitIntent),
    },
    nudge: {
      enabled: bool(n.enabled),
      every: clampNum(n.every, 0, 600000, DEFAULTS.nudge.every),
      max: clampNum(n.max, 0, 50, DEFAULTS.nudge.max),
    },
    badge: ["honest", "always", "off"].includes(c.badge) ? c.badge : DEFAULTS.badge,
  };
}

export async function onRequestOptions() {
  return new Response(null, { headers: CORS });
}

export async function onRequestGet({ env }) {
  const cfg = await readConfig(env);
  return json(cfg, { headers: { "Cache-Control": "public, max-age=60" } });
}

export async function onRequestPost({ request, env }) {
  if (!(await crmAuthed(request, env))) return json({ ok: false, error: "unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const clean = sanitize(merge(DEFAULTS, body.config || body || {}));
  await ensure(env);
  await env.DB.prepare(
    `INSERT INTO site_config (k, v, updated_at) VALUES ('chat_launcher', ?, datetime('now'))
     ON CONFLICT(k) DO UPDATE SET v=excluded.v, updated_at=excluded.updated_at`
  ).bind(JSON.stringify(clean)).run();
  return json({ ok: true, config: clean });
}
