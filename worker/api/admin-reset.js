// Clear demo/test data from D1 — /api/admin-reset?key=<FEEDBACK_KEY>[&confirm=DELETE_ALL_DEMOS]
// Without confirm: dry-run, returns row counts that WOULD be deleted.
// With confirm: deletes ALL rows from participants, events, traffic (test-data reset).
import { json } from "../_lib/http.js";

export async function onRequestGet({ request, env }) {
  const u = new URL(request.url);
  if (!env.FEEDBACK_KEY || u.searchParams.get("key") !== env.FEEDBACK_KEY)
    return json({ error: "unauthorized" }, { status: 401 });
  const count = async (t) => { try { return (await env.DB.prepare(`SELECT COUNT(*) c FROM ${t}`).first())?.c || 0; } catch { return 0; } };
  const tables = ["events", "participants", "traffic"]; // events first (FK to participants)
  const before = {}; for (const t of tables) before[t] = await count(t);
  if (u.searchParams.get("confirm") !== "DELETE_ALL_DEMOS")
    return json({ dryRun: true, would_delete: before, hint: "add &confirm=DELETE_ALL_DEMOS to execute" });
  for (const t of tables) { try { await env.DB.prepare(`DELETE FROM ${t}`).run(); } catch (e) { /* ignore */ } }
  const after = {}; for (const t of tables) after[t] = await count(t);
  return json({ reset: true, deleted: before, now: after });
}
