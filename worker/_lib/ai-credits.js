// worker/_lib/ai-credits.js
// Tracks a single, app-wide "Claude API is out of credits" flag so the CRM can show a
// top-nav alert instead of every AI feature (Intel lookup, prospecting owner-search,
// inbound reply classification, sequence analysis) silently going quiet one by one.
//
// One row, id=1, upserted by whichever Anthropic call site hits/clears the condition.
// Self-healing: any successful call clears it, so the banner disappears on its own once
// credits are topped up — no manual reset needed.

// Keyed on the env.DB binding itself (not a single module-level bool) so this stays correct
// if more than one D1 binding is ever in play in the same isolate (e.g. tests, local dev
// with multiple environments) — a real bug this exact pattern (bool-only) hit under test.
const _readyFor = new WeakSet();
async function ensure(env) {
  if (_readyFor.has(env.DB)) return;
  await env.DB.prepare(
    "CREATE TABLE IF NOT EXISTS ai_credits_status (id INTEGER PRIMARY KEY CHECK (id=1), low INTEGER NOT NULL DEFAULT 0, last_error TEXT, source TEXT, updated_at TEXT)"
  ).run().catch(() => {});
  _readyFor.add(env.DB);
}

// Anthropic's actual wording for an exhausted account balance (as opposed to a rate limit,
// a missing/invalid key, or a transient 5xx) is "Your credit balance is too low to access
// the Claude API." — match on the stable "credit balance" phrase so this survives minor
// message rewording, without also matching rate-limit or auth errors.
const CREDIT_ERROR_RE = /credit balance/i;
export const isCreditError = (message) => CREDIT_ERROR_RE.test(String(message || ""));

// Call after ANY Anthropic API response, success or failure. Best-effort — never throws,
// never blocks the caller's own error handling.
export async function reportAiOutcome(env, { ok, error, source }) {
  try {
    await ensure(env);
    if (!ok && isCreditError(error)) {
      await env.DB.prepare(
        "INSERT INTO ai_credits_status (id, low, last_error, source, updated_at) VALUES (1,1,?,?,datetime('now')) " +
        "ON CONFLICT(id) DO UPDATE SET low=1, last_error=excluded.last_error, source=excluded.source, updated_at=excluded.updated_at"
      ).bind(String(error).slice(0, 300), source || null).run();
    } else if (ok) {
      // A successful call proves credits are fine again — clear the flag (only writes when
      // it was actually set, so the happy path doesn't hit D1 on every single AI call).
      await env.DB.prepare("UPDATE ai_credits_status SET low=0, updated_at=datetime('now') WHERE id=1 AND low=1").run();
    }
  } catch (_) { /* status tracking must never break the feature it's tracking */ }
}

export async function getAiCreditsStatus(env) {
  try {
    await ensure(env);
    const r = await env.DB.prepare("SELECT low, last_error, source, updated_at FROM ai_credits_status WHERE id=1").first();
    if (!r) return { low: false };
    return { low: !!r.low, last_error: r.last_error || null, source: r.source || null, since: r.updated_at || null };
  } catch (_) { return { low: false }; }
}
