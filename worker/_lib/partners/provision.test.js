// node --test worker/_lib/partners/provision.test.js
//
// Guards the wire contract with the API worker's partnerProvisionSchema
// (crmono: cr-app/packages/shared/src/schemas/index.ts). That schema is
// strict about two fields, and getting either wrong makes the receiver
// answer 400 — which provisionCustomer swallows as `null`, silently
// dropping every marketplace connect into the concierge flow with no error
// anywhere. These assertions are the only thing standing between a typo and
// that silent failure.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildProvisionPayload } from "./provision.js";

const base = {
  partner: "jobber",
  email: "owner@acme-roofing.com",
  accountId: "Z2lkOi8vSm9iYmVyL0FjY291bnQvMTIzNDU2Nw==",
  accountName: "Acme Roofing",
};

test("ts is a number, not an ISO string", () => {
  const p = buildProvisionPayload(base);
  assert.equal(typeof p.ts, "number", "receiver requires z.number()");
  // Epoch ms, so the receiver's magnitude check reads it as ms (>= 1e12).
  assert.ok(p.ts >= 1e12);
  assert.ok(Math.abs(Date.now() - p.ts) < 5 * 60 * 1000, "must be inside the replay window");
});

test("account_name is omitted, never null, when there is no name", () => {
  for (const accountName of [null, undefined, ""]) {
    const p = buildProvisionPayload({ ...base, accountName });
    assert.equal(p.account_name, undefined);
    // The serialized body is what is signed and validated — null would 400.
    assert.ok(!("account_name" in JSON.parse(JSON.stringify(p))));
  }
});

test("account_name survives when present", () => {
  assert.equal(buildProvisionPayload(base).account_name, "Acme Roofing");
});

test("identity fields are passed through unchanged", () => {
  const p = buildProvisionPayload(base);
  assert.equal(p.source, "partner_marketplace");
  assert.equal(p.partner, "jobber");
  assert.equal(p.email, base.email);
  assert.equal(p.partner_account_id, base.accountId);
});

test("payload matches the receiver's schema rules", () => {
  // Mirrors partnerProvisionSchema without pulling zod into this repo.
  const p = JSON.parse(JSON.stringify(buildProvisionPayload(base)));
  assert.equal(p.source, "partner_marketplace");
  assert.match(p.partner, /^[a-z0-9_-]+$/);
  assert.ok(typeof p.email === "string" && p.email.includes("@"));
  assert.ok(typeof p.partner_account_id === "string" && p.partner_account_id.length > 0);
  assert.ok(p.account_name === undefined || typeof p.account_name === "string");
  assert.equal(typeof p.ts, "number");
});
