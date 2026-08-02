// worker/_lib/nurture-sweep.js
// The cold→nurture→warm lifecycle mover (Phase 1). Runs on the cron:
//   1. Rescore contacts whose behavior changed (lead-scoring.js).
//   2. Promote nurture conversations back to OPEN when the lead turns Warm/Hot OR replies —
//      this is "if we get a response it becomes a Warm lead in the Open section."
//   3. Cold-detect: an OPEN conversation with 30 days of silence + a Cold score drops into
//      the NURTURE bucket for the ongoing newsletter touchpoints.
// Never touches customers, opted-out/suppressed contacts, or leads mid-sequence.
import { rescoreDueContacts, ensureScoringSchema } from "./lead-scoring.js";

const COLD_DAYS = 30;

export async function nurtureTick(env) {
  await ensureScoringSchema(env);
  const { rescored, promoted } = await rescoreDueContacts(env, { limit: 300 });

  // 2a. Warm/Hot leads sitting in Nurture → bring them into Open (unread, so they're seen).
  const warmUp = await env.DB.prepare(
    `UPDATE conversations SET status='open', unread=1, updated_at=datetime('now')
      WHERE status='nurture'
        AND contact_id IN (SELECT id FROM contacts WHERE tier IN ('warm','hot'))`
  ).run().catch(() => ({}));

  // 2b. Any Nurture lead who REPLIED (email/SMS) or called in the last 7 days → Open.
  const replyUp = await env.DB.prepare(
    `UPDATE conversations SET status='open', unread=1, updated_at=datetime('now')
      WHERE status='nurture'
        AND contact_id IN (
          SELECT DISTINCT contact_id FROM crm_events
           WHERE type IN ('replied','sms_received','inbound_call')
             AND occurred_at > datetime('now','-7 day') AND contact_id IS NOT NULL)`
  ).run().catch(() => ({}));

  // 3. Cold-detect: Open + 30d silent + Cold score + not a customer + not mid-sequence → Nurture.
  const cooled = await env.DB.prepare(
    `UPDATE conversations SET status='nurture', updated_at=datetime('now')
      WHERE status='open'
        AND COALESCE(last_message_at, created_at) < datetime('now', ?)
        AND contact_id IN (
          SELECT id FROM contacts
           WHERE COALESCE(tier,'cold')='cold'
             AND COALESCE(lifecycle_stage,'') NOT IN ('customer'))
        AND contact_id NOT IN (
          SELECT contact_id FROM workflow_runs WHERE status='active' AND contact_id IS NOT NULL)
        AND contact_id NOT IN (
          SELECT contact_id FROM suppressions WHERE channel IN ('all','email') AND contact_id IS NOT NULL)`
  ).bind(`-${COLD_DAYS} day`).run().catch(() => ({}));

  const n = (r) => (r && r.meta && r.meta.changes) || 0;
  return {
    rescored,
    promoted: promoted.length,
    warmed_to_open: n(warmUp) + n(replyUp),
    cooled_to_nurture: n(cooled),
  };
}
