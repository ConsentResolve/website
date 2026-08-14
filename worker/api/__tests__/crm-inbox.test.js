// Regression test for the Snooze/Remind sweep bug: snoozed conversations weren't resurfacing
// into Open after their reminder time passed. Root cause was a string comparison between two
// different datetime formats (see the comment on SWEEP_SNOOZED_SQL in ../crm-inbox.js).
//
// This runs the REAL exported SQL (not a re-typed copy) against a real SQLite engine via Node's
// built-in node:sqlite, so it exercises actual SQLite date-function semantics, not a mock.
//
// Run: node --test worker/api/__tests__/crm-inbox.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { SWEEP_SNOOZED_SQL } from "../crm-inbox.js";

function freshDb() {
  const db = new DatabaseSync(":memory:");
  db.exec(`CREATE TABLE conversations (
    id TEXT PRIMARY KEY,
    status TEXT NOT NULL DEFAULT 'open',
    snooze_until TEXT,
    unread INTEGER DEFAULT 0,
    updated_at TEXT
  )`);
  return db;
}

function insertConvo(db, { id, status, snoozeUntil }) {
  db.prepare("INSERT INTO conversations (id, status, snooze_until, unread, updated_at) VALUES (?,?,?,0,'2020-01-01')")
    .run(id, status, snoozeUntil);
}

function statusOf(db, id) {
  return db.prepare("SELECT status, unread FROM conversations WHERE id=?").get(id);
}

test("a snooze due in the past (same UTC calendar day) resurfaces to Open", () => {
  // This is the exact bug repro: Tyler snoozed until 4:00 "today" and it never came back.
  // JS ISO format is what applyStatus() actually stores (new Date(...).toISOString()).
  const db = freshDb();
  const dueAnHourAgo = new Date(Date.now() - 3600_000).toISOString();
  insertConvo(db, { id: "c1", status: "snoozed", snoozeUntil: dueAnHourAgo });

  const r = db.exec(SWEEP_SNOOZED_SQL);
  const row = statusOf(db, "c1");

  assert.equal(row.status, "open", "a same-day past-due snooze must resurface to Open");
  assert.equal(row.unread, 1, "resurfacing should mark it unread again");
});

test("a snooze due in the future stays snoozed", () => {
  const db = freshDb();
  const dueInAnHour = new Date(Date.now() + 3600_000).toISOString();
  insertConvo(db, { id: "c1", status: "snoozed", snoozeUntil: dueInAnHour });

  db.exec(SWEEP_SNOOZED_SQL);
  const row = statusOf(db, "c1");

  assert.equal(row.status, "snoozed", "a not-yet-due snooze must not resurface early");
});

test("a snooze due exactly now resurfaces", () => {
  const db = freshDb();
  insertConvo(db, { id: "c1", status: "snoozed", snoozeUntil: new Date().toISOString() });

  db.exec(SWEEP_SNOOZED_SQL);
  const row = statusOf(db, "c1");

  assert.equal(row.status, "open");
});

test("null snooze_until is left alone (never matches, guarded by IS NOT NULL)", () => {
  const db = freshDb();
  insertConvo(db, { id: "c1", status: "snoozed", snoozeUntil: null });

  db.exec(SWEEP_SNOOZED_SQL);
  const row = statusOf(db, "c1");

  assert.equal(row.status, "snoozed");
});

test("non-snoozed conversations are never touched, even with a past snooze_until", () => {
  const db = freshDb();
  const dueAnHourAgo = new Date(Date.now() - 3600_000).toISOString();
  insertConvo(db, { id: "c1", status: "open", snoozeUntil: dueAnHourAgo });
  insertConvo(db, { id: "c2", status: "archived", snoozeUntil: dueAnHourAgo });
  insertConvo(db, { id: "c3", status: "nurture", snoozeUntil: dueAnHourAgo });

  db.exec(SWEEP_SNOOZED_SQL);

  assert.equal(statusOf(db, "c1").status, "open");
  assert.equal(statusOf(db, "c2").status, "archived");
  assert.equal(statusOf(db, "c3").status, "nurture");
});

test("multiple due snoozes all resurface in one sweep", () => {
  const db = freshDb();
  const past = new Date(Date.now() - 60_000).toISOString();
  insertConvo(db, { id: "c1", status: "snoozed", snoozeUntil: past });
  insertConvo(db, { id: "c2", status: "snoozed", snoozeUntil: past });
  insertConvo(db, { id: "c3", status: "snoozed", snoozeUntil: new Date(Date.now() + 60_000).toISOString() });

  db.exec(SWEEP_SNOOZED_SQL);

  assert.equal(statusOf(db, "c1").status, "open");
  assert.equal(statusOf(db, "c2").status, "open");
  assert.equal(statusOf(db, "c3").status, "snoozed", "the still-future one must not flip");
});
