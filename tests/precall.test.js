import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { makePrecall, agreement, aiCodeOf } from "../server/precall.js";
import { visibleCard, callChip, markStartValue } from "../components/grading/callfirst.js";
import { course } from "./helpers.js";

const fresh = () => makePrecall({ localDir: mkdtempSync(join(tmpdir(), "remain-precall-")), course });
const CALL = { idea: "grade", itemId: "S-07", code: "E-VAR-SD", by: "A. Grader", session: "s1" };

test("T2: one call per paper; a second is refused and the log still holds one", () => {
  const p = fresh();
  assert.equal(p.add(CALL).status, 201);
  const second = p.add({ ...CALL, code: "E-ARITH" });
  assert.equal(second.status, 409);
  assert.equal(p.list().length, 1);
  assert.equal(p.list()[0].code, "E-VAR-SD", "the first call stands");
});

test("T2: the stat counts matches from the logged precalls and proposals only", () => {
  const precalls = [
    { idea: "grade", itemId: "S-01", code: "E-VAR-SD", session: "s1" },
    { idea: "grade", itemId: "S-02", code: "E-ARITH", session: "s1" },
    { idea: "grade", itemId: "S-03", code: "OK", session: "s1" },
  ];
  const proposals = [
    { idea: "grade", itemId: "S-01", proposals: [{ code: "E-VAR-SD" }] },
    { idea: "grade", itemId: "S-02", proposals: [{ code: "E-N-DENOM" }] },
    { idea: "grade", itemId: "S-03", proposals: [] },
  ];
  const revealed = precalls.map((p) => ({ ...p, kind: "reveal", proposalTs: "proposal" }));
  assert.equal(agreement([...precalls, ...revealed], proposals.map((p) => ({ ...p, ts: "proposal" })), "s1").text, "2 of 3");
});

test("T2: a fresh session shows 0 of 0", () => {
  assert.equal(fresh().agreement([], "brand-new").text, "0 of 0");
  assert.equal(agreement([], [], "brand-new").text, "0 of 0");
});

test("T2: a precall with no revealed proposal yet is counted neither way", () => {
  const precalls = [{ idea: "grade", itemId: "S-01", code: "OK", session: "s1" }];
  assert.equal(agreement(precalls, [], "s1").text, "0 of 0");
});

test("T2: another session's calls are not counted in this one", () => {
  const precalls = [{ idea: "grade", itemId: "S-01", code: "OK", session: "other" }];
  const proposals = [{ idea: "grade", itemId: "S-01", proposals: [] }];
  assert.equal(agreement(precalls, proposals, "s1").text, "0 of 0");
});

test("T2: nothing from the card is available to render before the call is locked", () => {
  const card = { items: [{ code: "E-VAR-SD", quote: "SD = 10", confidence: 0.91 }], label: "LIVE API: x" };
  assert.equal(visibleCard(card, { enabled: true, locked: false }), null, "before the lock the panel gets no card at all");
  assert.equal(visibleCard(card, { enabled: true, locked: true }), card);
  assert.equal(visibleCard(card, { enabled: false, locked: false }), card, "toggle off leaves the existing flow untouched");
});

test("T2: the chip says match or differs without leaking anything else", () => {
  assert.equal(callChip("E-VAR-SD", "E-VAR-SD"), "Your call: E-VAR-SD · AI: E-VAR-SD · match");
  assert.equal(callChip("OK", "E-ARITH"), "Your call: OK · AI: E-ARITH · differs");
});

test("T2: with the toggle on the mark box starts empty, and is unchanged with it off", () => {
  assert.equal(markStartValue(7, { enabled: true }), "");
  assert.equal(markStartValue(7, { enabled: false }), "7");
});

test("T2: an empty proposal list reads as OK, so a blind OK call can match it", () => {
  assert.equal(aiCodeOf({ proposals: [] }), "OK");
  assert.equal(aiCodeOf(undefined), "OK");
});

test("T2: the call is logged before the reveal, and reveals are not counted as calls", () => {
  const p = fresh();
  p.add(CALL);
  p.addReveal({ idea: "grade", itemId: "S-07", session: "s1", proposalTs: "proposal" });
  const call = p.list()[0], reveal = p.reveals()[0];
  assert.equal(p.list().length, 1, "a reveal is not a call");
  assert.ok(call.ts <= reveal.ts, `the call (${call.ts}) must not be later than the reveal (${reveal.ts})`);
  // A reveal must never be read as a blind call, however the file is ordered.
  const proposals = [{ idea: "grade", itemId: "S-07", ts: "proposal", proposals: [{ code: "E-VAR-SD" }] }];
  assert.equal(agreement([...p.reveals(), ...p.list()], proposals, "s1").text, "1 of 1");
});

test('T2 review: duplicate call returns the original immutable prediction for redisplay', () => {
  const p = fresh();
  p.add(CALL);
  const r = p.add({ ...CALL, code: 'E-ARITH' });
  assert.equal(r.status, 409);
  assert.equal(r.call.code, CALL.code);
});

test('T2 review: agreement uses the proposal actually linked to reveal, not a stale earlier run', () => {
  const p = fresh();
  p.add(CALL);
  const proposals = [
    { idea: CALL.idea, itemId: CALL.itemId, ts: 'old', proposals: [{ code: 'E-MEAN' }] },
    { idea: CALL.idea, itemId: CALL.itemId, ts: 'new', proposals: [{ code: CALL.code }] },
  ];
  assert.equal(p.agreement(proposals, CALL.session).total, 0, 'not revealed is not counted');
  assert.equal(p.addReveal({ ...CALL, proposalTs: 'new' }).status, 201);
  assert.equal(p.agreement(proposals, CALL.session).text, '1 of 1');
});

test('T2 review: reveal without a prior call is refused', () => {
  assert.equal(fresh().addReveal({ idea: 'grade', itemId: 'S-99', session: 's1' }).status, 409);
});

test('T2 review: UI locking uses persisted call after 409 and requires reveal acknowledgement', async () => {
  const { lockPrecall } = await import('../components/grading/callfirst.js');
  const responses = [
    { status: 409, ok: false, json: async () => ({ call: { code: 'E-MEAN' } }) },
    { status: 201, ok: true, json: async () => ({ saved: true }) },
  ];
  assert.equal(await lockPrecall({ fetchImpl: async () => responses.shift(), call: { ...CALL, code: 'E-ARITH' } }), 'E-MEAN');
  await assert.rejects(() => lockPrecall({ fetchImpl: async () => ({ status: 500, ok: false, json: async () => ({}) }), call: CALL }), /saved/);
});
