// Regression tests for the "Claude API out of credits" nav-bar alert (worker/_lib/ai-credits.js).
// Exercises the REAL exported functions — not a re-typed copy of the SQL — against a real
// SQLite engine via node:sqlite, through a tiny shim that mimics the D1 binding shape
// (env.DB.prepare(sql).bind(...).run()/.first()) so no Cloudflare runtime is needed.
//
// Run: node --test worker/_lib/ai-credits.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { isCreditError, reportAiOutcome, getAiCreditsStatus } from "./ai-credits.js";

function fakeEnv() {
  const db = new DatabaseSync(":memory:");
  return {
    DB: {
      prepare(sql) {
        return {
          bind(...args) {
            return {
              run: async () => { db.prepare(sql).run(...args); return { success: true }; },
              first: async () => db.prepare(sql).get(...args) || null,
            };
          },
          run: async () => { db.exec(sql); return { success: true }; },
          first: async () => db.prepare(sql).get() || null,
        };
      },
    },
  };
}

// ---- isCreditError: must fire on the real Anthropic billing message, not on unrelated errors ----

test("isCreditError matches the real Anthropic low-balance message", () => {
  assert.equal(isCreditError("Your credit balance is too low to access the Claude API. Please go to Plans & Billing to upgrade or purchase credits."), true);
});

test("isCreditError does NOT match rate limits, auth errors, or overload", () => {
  assert.equal(isCreditError("Number of request tokens has exceeded your per-minute rate limit"), false);
  assert.equal(isCreditError("invalid x-api-key"), false);
  assert.equal(isCreditError("Overloaded"), false);
  assert.equal(isCreditError(null), false);
  assert.equal(isCreditError(undefined), false);
});

// ---- reportAiOutcome + getAiCreditsStatus: the full set/clear lifecycle ----

test("a credit-balance failure sets the flag, visible via getAiCreditsStatus", async () => {
  const env = fakeEnv();
  await reportAiOutcome(env, { ok: false, error: "Your credit balance is too low to access the Claude API.", source: "crm-lookup.claudeEnrich" });
  const status = await getAiCreditsStatus(env);
  assert.equal(status.low, true);
  assert.equal(status.source, "crm-lookup.claudeEnrich");
  assert.match(status.last_error, /credit balance/i);
});

test("a non-credit failure (rate limit) does NOT set the flag", async () => {
  const env = fakeEnv();
  await reportAiOutcome(env, { ok: false, error: "rate limit exceeded", source: "crm-lookup.claudeEnrich" });
  const status = await getAiCreditsStatus(env);
  assert.equal(status.low, false);
});

test("a later successful call clears a previously-set flag (self-healing)", async () => {
  const env = fakeEnv();
  await reportAiOutcome(env, { ok: false, error: "Your credit balance is too low to access the Claude API.", source: "crm-lookup.claudeEnrich" });
  assert.equal((await getAiCreditsStatus(env)).low, true, "sanity: flag is set before recovery");

  await reportAiOutcome(env, { ok: true, source: "apollo-prospect.claudeFindOwner" });
  const status = await getAiCreditsStatus(env);
  assert.equal(status.low, false, "a successful call from ANY call site must clear the flag");
});

test("a success when the flag is already clear is a no-op (no row thrash)", async () => {
  const env = fakeEnv();
  await reportAiOutcome(env, { ok: true, source: "crm-inbox.classifyReply" });
  const status = await getAiCreditsStatus(env);
  assert.equal(status.low, false);
});

test("getAiCreditsStatus on a fresh app (no row yet) reports low:false, not an error", async () => {
  const env = fakeEnv();
  const status = await getAiCreditsStatus(env);
  assert.equal(status.low, false);
});

test("multiple call sites failing in sequence keep the flag set with the latest source", async () => {
  const env = fakeEnv();
  await reportAiOutcome(env, { ok: false, error: "Your credit balance is too low to access the Claude API.", source: "crm-lookup.claudeEnrich" });
  await reportAiOutcome(env, { ok: false, error: "Your credit balance is too low to access the Claude API.", source: "crm-seq-report.aiCompare" });
  const status = await getAiCreditsStatus(env);
  assert.equal(status.low, true);
  assert.equal(status.source, "crm-seq-report.aiCompare");
});
