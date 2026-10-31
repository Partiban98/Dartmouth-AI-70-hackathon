import { test } from "node:test";
import assert from "node:assert/strict";
import { receiptFor } from "../server/receipt.js";
import { course } from "./helpers.js";

const LOGS = {
  gate: [
    { ts: "2026-10-31T07:00:00.000Z", type: "gate", idea: "grade", itemId: "S-12", droppedFields: 1,
      counts: { NAME: 1, EMAIL: 0, STUDENT_ID: 2, HEADER_LINE: 1 }, blockedRules: [] },
    { ts: "2026-10-31T07:05:00.000Z", type: "gate", idea: "grade", itemId: "S-01", droppedFields: 0, counts: { NAME: 0 }, blockedRules: [] },
  ],
  proposals: [
    { ts: "2026-10-31T07:00:02.000Z", type: "proposal", idea: "grade", itemId: "S-12", label: "LIVE API: claude-sonnet-5-5",
      modelId: "claude-sonnet-5-5", rung: 1, cacheHit: false, usage: { input_tokens: 960 },
      proposals: [{ code: "E-VAR-SD", confidence: 0.9, quoteVerified: true, source: "AI" }],
      payloadHash: "188f9f02eaff63e6a7151c8934036cb2ad097f5c7fd5fc242108187b2befd0c5" },
  ],
};

test("E2: the receipt shows what was removed, by type, highest first", () => {
  const r = receiptFor(LOGS, "grade", "S-12");
  assert.deepEqual(r.removed, [{ type: "STUDENT_ID", n: 2 }, { type: "HEADER_LINE", n: 1 }, { type: "NAME", n: 1 }]);
  assert.equal(r.droppedFields, 1);
});

test("E2: types with nothing removed are left out rather than shown as zero", () => {
  assert.equal(receiptFor(LOGS, "grade", "S-12").removed.some((x) => x.type === "EMAIL"), false);
  assert.deepEqual(receiptFor(LOGS, "grade", "S-01").removed, []);
});

test("E2: the receipt carries the hash, both timestamps and the model the API returned", () => {
  const r = receiptFor(LOGS, "grade", "S-12");
  assert.equal(r.payloadHash, "188f9f02eaff63e6a7151c8934036cb2ad097f5c7fd5fc242108187b2befd0c5");
  assert.equal(r.checkedAt, "2026-10-31T07:00:00.000Z");
  assert.equal(r.sentAt, "2026-10-31T07:00:02.000Z");
  assert.equal(r.modelId, "claude-sonnet-5-5");
  assert.ok(r.checkedAt < r.sentAt, "the paper is checked before anything is sent");
});

test("E2: no raw text, no removed value, no quote and no student identity is in the receipt", () => {
  const r = receiptFor(LOGS, "grade", "S-12");
  const flat = JSON.stringify(r);
  for (const e of [...course.roster, ...(course.dictionary ?? [])]) assert.equal(flat.includes(e.name), false);
  for (const banned of ["quote", "payload\"", "steps", "finalAnswer", "aliasMap", "text"]) assert.equal(flat.includes(banned), false, `receipt must not carry ${banned}`);
  // The hash is hex, so a run of digits inside it is expected and means
  // nothing. Scan everything except the hash, and check the roster's own
  // 9-digit convention (9001xxxxx) against the whole thing.
  const { payloadHash, ...rest } = r;
  assert.equal(/\d{9}/.test(JSON.stringify(rest)), false, "no 9-digit run outside the hash");
  assert.equal(/\b9001\d{5}\b/.test(flat), false, "no student id anywhere, hash included");
  assert.equal(payloadHash.length, 64, "the hash is a sha-256, not a value");
});

test("E2: a paper with no logs yet has no receipt, rather than an empty-looking one", () => {
  assert.equal(receiptFor(LOGS, "grade", "S-99"), null);
  assert.equal(receiptFor({ gate: [], proposals: [] }, "grade", "S-01"), null);
});

test("E2: a paper checked but never sent still shows the gate half, with no model and no hash", () => {
  const r = receiptFor(LOGS, "grade", "S-01");
  assert.equal(r.checkedAt, "2026-10-31T07:05:00.000Z");
  assert.equal(r.sentAt, null);
  assert.equal(r.modelId, null);
  assert.equal(r.payloadHash, null);
});

test("E2: the newest run for a paper is the one shown", () => {
  const twice = { gate: [...LOGS.gate, { ts: "2026-10-31T08:00:00.000Z", type: "gate", idea: "grade", itemId: "S-12", droppedFields: 0, counts: { NAME: 3 }, blockedRules: [] }], proposals: LOGS.proposals };
  assert.deepEqual(receiptFor(twice, "grade", "S-12").removed, [{ type: "NAME", n: 3 }]);
});
