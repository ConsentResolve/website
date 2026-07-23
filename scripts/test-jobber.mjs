// Offline smoke test for the Jobber adapter's pure logic — run: node scripts/test-jobber.mjs
// Covers everything testable without a Jobber dev account: mutation/document
// construction (incl. quoting of hostile input), name splitting, JWT expiry
// decode, and an HMAC sign/verify round-trip matching Jobber's webhook scheme.
import assert from "node:assert/strict";
import crypto from "node:crypto";
import {
  splitName, buildClientCreateMutation, buildConsentNote, buildNoteMutation,
  accessTokenExpiry, verifyWebhookSignature, jobberAuthUrl,
} from "../worker/_lib/partners/jobber.js";

let passed = 0;
const test = (name, fn) => Promise.resolve().then(fn).then(() => { passed++; console.log("  ok:", name); });

await test("splitName handles full, single, and missing names", () => {
  assert.deepEqual(splitName("Jane Q Doe"), { first: "Jane", last: "Q Doe" });
  assert.deepEqual(splitName("Cher"), { first: "Cher", last: "(ConsentResolve)" });
  assert.deepEqual(splitName("", "bob@roof.co"), { first: "bob", last: "(ConsentResolve)" });
});

await test("clientCreate mutation matches Jobber's documented shape", () => {
  const m = buildClientCreateMutation({ email: "jane@example.com", name: "Jane Doe", phone: "555-0100", company: "Jane's Roofing" });
  assert.match(m, /clientCreate\(/);
  assert.match(m, /firstName: "Jane"/);
  assert.match(m, /lastName: "Doe"/);
  assert.match(m, /companyName: "Jane's Roofing"/);
  assert.match(m, /emails: \[\{ description: MAIN, primary: true, address: "jane@example.com" \}\]/);
  assert.match(m, /phones: \[\{ description: MAIN, primary: true, number: "555-0100" \}\]/);
  assert.match(m, /userErrors \{ message path \}/);
});

await test("hostile strings stay safely quoted", () => {
  const m = buildClientCreateMutation({ email: 'x"y@example.com', name: 'A"B } mutation {' });
  // Every user value must remain inside a JSON-escaped string literal.
  assert.ok(m.includes('firstName: "A\\"B"'), m);
  assert.ok(m.includes('lastName: "} mutation {"'), m);
  assert.ok(m.includes('address: "x\\"y@example.com"'), m);
  const note = buildNoteMutation("id1", 'line1\n"quoted" }');
  assert.ok(note.includes('message: "line1\\n\\"quoted\\" }"'), note);
});

await test("no phones/company blocks when absent", () => {
  const m = buildClientCreateMutation({ email: "a@b.c" });
  assert.ok(!m.includes("phones:"));
  assert.ok(!m.includes("companyName:"));
});

await test("consent note carries the trail", () => {
  const note = buildConsentNote({
    consent: { ts: "2026-07-21T10:00:00Z", policyVersion: "v3", sourceUrl: "https://acme-roofing.com/quote" },
    session: { firstSeen: "2026-07-20T09:00:00Z", pages: ["/", "/quote"] },
  });
  assert.match(note, /Consent given: 2026-07-21T10:00:00Z/);
  assert.match(note, /Policy version: v3/);
  assert.match(note, /Pages viewed: \/, \/quote/);
  const m = buildNoteMutation("Q2xpZW50LTE=", note);
  assert.match(m, /clientNoteCreate\(clientId: "Q2xpZW50LTE="/);
});

await test("accessTokenExpiry reads JWT exp (minus 60s skew)", () => {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const jwt = ["e30", Buffer.from(JSON.stringify({ exp })).toString("base64url"), "sig"].join(".");
  assert.equal(accessTokenExpiry(jwt), new Date(exp * 1000 - 60_000).toISOString());
  // Opaque token falls back to ~54 minutes out.
  const fallback = new Date(accessTokenExpiry("not-a-jwt")).getTime() - Date.now();
  assert.ok(fallback > 50 * 60_000 && fallback < 56 * 60_000);
});

await test("webhook HMAC round-trip + tamper rejection", async () => {
  const secret = "test-secret";
  const body = '{"data":{"webHookEvent":{"topic":"APP_DISCONNECT","accountId":"MQ=="}}}';
  const sig = crypto.createHmac("sha256", secret).update(body).digest("base64");
  assert.equal(await verifyWebhookSignature(secret, body, sig), true);
  assert.equal(await verifyWebhookSignature(secret, body + " ", sig), false);
  assert.equal(await verifyWebhookSignature(secret, body, "AAAA"), false);
  assert.equal(await verifyWebhookSignature(secret, body, ""), false);
});

await test("auth URL carries the documented params", () => {
  const u = new URL(jobberAuthUrl({ JOBBER_CLIENT_ID: "cid" }, "https://consentresolve.com/api/partners/jobber/callback", "st4te"));
  assert.equal(u.origin + u.pathname, "https://api.getjobber.com/api/oauth/authorize");
  assert.equal(u.searchParams.get("response_type"), "code");
  assert.equal(u.searchParams.get("client_id"), "cid");
  assert.equal(u.searchParams.get("state"), "st4te");
});

console.log(`\n${passed} tests passed`);
