// Requeue rows wrongly parked as "scheduled" by the old same-zone urlOk() 522 bug.
// /api/requeue?key=<FEEDBACK_KEY>[&confirm=1]  (GET, key-gated)
// Targets ONLY the park signature — status='scheduled' AND scheduled_at IS NULL — for
// the live launch platforms, flipping them back to ready_to_publish. Rows with a real
// scheduled_at (genuinely future-dated) are left alone. Read-only without &confirm=1.
import { json } from "../_lib/http.js";
import { nowIso } from "../_lib/db.js";

const PLATFORMS = ["x", "google_business_profile"];

export async function onRequestGet({ request, env }) {
  const u = new URL(request.url);
  if (!env.FEEDBACK_KEY || u.searchParams.get("key") !== env.FEEDBACK_KEY)
    return json({ error: "unauthorized" }, { status: 401 });

  const ph = PLATFORMS.map(() => "?").join(",");
  const before = await env.DB.prepare(
    `SELECT platform, COUNT(*) c FROM social_queue
     WHERE status='scheduled' AND scheduled_at IS NULL AND platform IN (${ph}) GROUP BY platform`)
    .bind(...PLATFORMS).all().then((r) => r.results || []).catch(() => []);

  if (u.searchParams.get("confirm") !== "1")
    return json({ dry: true, would_requeue: before, note: "add &confirm=1 to requeue" });

  const res = await env.DB.prepare(
    `UPDATE social_queue SET status='ready_to_publish', updated_at=?
     WHERE status='scheduled' AND scheduled_at IS NULL AND platform IN (${ph})`)
    .bind(nowIso(), ...PLATFORMS).run();

  return json({ requeued: res.meta?.changes ?? null, by_platform_before: before });
}
