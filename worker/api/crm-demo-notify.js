// Manual trigger for the deferred demo-signup notification sweep (testing/ops).
// Gated by ?key=<CRM_WEBHOOK_TOKEN>. POST ?min=0 fires for ALL un-notified signups
// immediately (ignores the ~12-min wait); omit min to use the normal 12-min window.
import { json } from "../_lib/http.js";
import { crmWebhookToken } from "../_lib/crm.js";
import { sweepDemoNotifications } from "../_lib/demo-notify.js";

export async function onRequestPost({ request, env }) {
  const url = new URL(request.url);
  if ((url.searchParams.get("key") || "") !== crmWebhookToken(env)) return json({ error: "unauthorized" }, { status: 401 });
  const raw = url.searchParams.get("min");
  const min = raw == null ? 12 : parseInt(raw, 10);
  const r = await sweepDemoNotifications(env, { minMinutes: isNaN(min) ? 12 : min });
  return json({ ok: true, ...r });
}
