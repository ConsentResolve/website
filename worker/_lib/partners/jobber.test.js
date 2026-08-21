// node --test worker/_lib/partners/jobber.test.js
//
// connectionState is the single source of truth for what a partner_connections
// row means — the /status endpoint and the CRM Settings tile both read it, so
// they cannot drift apart and tell you two different things about whether your
// lead pipe is alive.
import { test } from "node:test";
import assert from "node:assert/strict";
import { connectionState } from "./jobber.js";

test("no row at all is 'none'", () => {
  assert.equal(connectionState(null), "none");
  assert.equal(connectionState(undefined), "none");
});

test("a healthy row is 'connected'", () => {
  assert.equal(connectionState({ status: "connected", account_id: "a" }), "connected");
});

test("a row whose refresh was rejected is 'needs_reauth', not 'connected'", () => {
  // The bug this guards: before markNeedsReauth existed, a dead refresh token
  // left status='connected' forever, so the connection reported healthy while
  // every lead push failed.
  assert.equal(connectionState({ status: "needs_reauth", account_id: "a" }), "needs_reauth");
});

test("an app-disconnected row is 'disconnected'", () => {
  assert.equal(connectionState({ status: "disconnected", account_id: "a" }), "disconnected");
});

test("an expired access token alone is still 'connected' (refresh self-heals it)", () => {
  const stale = { status: "connected", expires_at: "2020-01-01T00:00:00.000Z" };
  assert.equal(connectionState(stale), "connected");
});
