// Manual trigger for the deferred demo-signup notification sweep (testing/ops).
// Gated by ?key=<CRM_WEBHOOK_TOKEN>.
//   ?min=0            -> fire for ALL un-notified signups now (skip the ~12-min wait)
//   ?email=<addr>     -> re-fire for one signup by email, ignoring notified_at + age (re-test)
//   (omit both)       -> normal 12-min window
import { json } from "../_lib/http.js";
import { crmWebhookToken } from "../_lib/crm.js";
import { sweepDemoNotifications } from "../_lib/demo-notify.js";

export async function onRequestPost({ request, env }) {
  const url = new URL(request.url);
  if ((url.searchParams.get("key") || "") !== crmWebhookToken(env)) return json({ error: "unauthorized" }, { status: 401 });
  const email = url.searchParams.get("email") || null;
  const raw = url.searchParams.get("min");
  const min = raw == null ? 12 : parseInt(raw, 10);
  const r = await sweepDemoNotifications(env, { minMinutes: isNaN(min) ? 12 : min, email });
  return json({ ok: true, ...r });
}
