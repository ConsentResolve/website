// Speed-to-Lead — runtime settings, incl. the simulate↔live switch that lets us
// internally test the whole engine before any real SMS / AI-voice / booking fires.
//
// mode = "simulate": adapters record the intended send to stl_touchpoints and
//   stl_events but never call the provider. Full flow is exercisable safely.
// mode = "live": adapters call the real provider — BUT if a test-recipient
//   allowlist is set, only those emails/phones actually get real sends; everyone
//   else is still simulated. This is the "go live to ourselves first" safety valve.
import { ensureStlSchema } from "./schema.js";

export const DEFAULTS = {
  mode: "simulate",           // simulate | live
  live_email: "0",            // per-channel live enables (only matter when mode=live)
  live_sms: "0",
  live_call_ai: "0",
  live_call_human: "0",
  test_emails: "",            // csv allowlist; empty = allow all (once live)
  test_phones: "",            // csv allowlist (E.164)
  paused: "0",                // "1" halts all dispatch (kill switch)
};

export async function getSettings(env) {
  await ensureStlSchema(env);
  const out = { ...DEFAULTS };
  try {
    const rows = (await env.DB.prepare("SELECT k, v FROM stl_settings").all()).results || [];
    for (const r of rows) out[r.k] = r.v;
  } catch (_) {}
  return out;
}

export async function setSetting(env, k, v) {
  await ensureStlSchema(env);
  await env.DB.prepare(
    `INSERT INTO stl_settings (k, v, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(k) DO UPDATE SET v=excluded.v, updated_at=excluded.updated_at`
  ).bind(String(k), String(v), Date.now()).run();
}

const csv = (s) => String(s || "").split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);

// Decide what a given channel send should actually do right now.
// Returns { act: "live" | "simulate" | "paused" }.
export function decideDispatch(settings, channel, recipient) {
  if (settings.paused === "1") return { act: "paused" };
  if (settings.mode !== "live") return { act: "simulate" };
  const liveKey = { email: "live_email", sms: "live_sms", call_ai: "live_call_ai", call_human: "live_call_human" }[channel];
  if (!liveKey || settings[liveKey] !== "1") return { act: "simulate" };
  // Live for this channel — apply the internal test allowlist if present.
  const allow = channel === "email" ? csv(settings.test_emails) : csv(settings.test_phones);
  if (allow.length && recipient && !allow.includes(String(recipient).trim().toLowerCase())) {
    return { act: "simulate" }; // real send suppressed: recipient not on the internal allowlist
  }
  return { act: "live" };
}
