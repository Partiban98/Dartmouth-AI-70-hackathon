import { test } from "node:test";
import assert from "node:assert/strict";
import { agreementByCode } from "../server/agreement.js";

// Three marked papers: a kept suggestion, a changed one, a ruled-out one, and
// a code suggested twice in one paper by two sources.
const LOG = [
  { type: "decision", idea: "grade", itemId: "S-01", decidedBy: "A",
    proposed: ["E-VAR-SD"], confirmed: ["E-VAR-SD"], overrides: [] },
  { type: "decision", idea: "grade", itemId: "S-02", decidedBy: "A",
    proposed: ["E-VAR-SD", "E-ARITH"], confirmed: ["E-VAR-SD", "E-N-DENOM"],
    overrides: [{ from: "E-ARITH", to: "E-N-DENOM", reason: "denominator, not arithmetic" }] },
  { type: "decision", idea: "grade", itemId: "S-07", decidedBy: "B",
    proposed: ["M-UNLISTED", "M-UNLISTED"], confirmed: [],
    overrides: [{ from: "M-UNLISTED", to: "OK", reason: "valid method the scheme did not list" }] },
  { type: "gate", idea: "grade", itemId: "S-01" },
  { type: "decision", idea: "grade93", itemId: "P-01", proposed: ["E-VAR-SD"], confirmed: ["E-VAR-SD"], overrides: [] },
];

test("E4: each suggestion is counted as kept, changed or ruled out", () => {
  const { rows } = agreementByCode(LOG, "grade");
  const by = Object.fromEntries(rows.map((r) => [r.code, r]));
  assert.deepEqual({ ...by["E-VAR-SD"] }, { code: "E-VAR-SD", confirmed: 2, changed: 0, overridden: 0, total: 2 });
  assert.deepEqual({ ...by["E-ARITH"] }, { code: "E-ARITH", confirmed: 0, changed: 1, overridden: 0, total: 1 });
  assert.deepEqual({ ...by["M-UNLISTED"] }, { code: "M-UNLISTED", confirmed: 0, changed: 0, overridden: 1, total: 1 });
});

test("E4: a code suggested twice on one paper is one suggestion, not two", () => {
  const { rows } = agreementByCode([LOG[2]], "grade");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].total, 1, "two sources raising one mistake is still one decision");
});

test("E4: the code the TA changed TO is not counted as a suggestion the AI made", () => {
  const { rows } = agreementByCode(LOG, "grade");
  assert.equal(rows.some((r) => r.code === "E-N-DENOM"), false, "E-N-DENOM was the TA's own call, never proposed");
});

test("E4: only this question set is counted, and only decision records", () => {
  assert.equal(agreementByCode(LOG, "grade").totals.total, 4);
  assert.equal(agreementByCode(LOG, "grade93").totals.total, 1);
  assert.equal(agreementByCode(LOG).totals.total, 5, "no set filter counts every set");
});

test("E4: an empty log gives empty rows and zero totals, never a fabricated figure", () => {
  const { rows, totals } = agreementByCode([], "grade");
  assert.deepEqual(rows, []);
  assert.deepEqual(totals, { confirmed: 0, changed: 0, overridden: 0, total: 0 });
});

test("E4: rows are ordered by how often the suggestion came up", () => {
  const rows = agreementByCode(LOG, "grade").rows;
  assert.deepEqual(rows.map((r) => r.code), ["E-VAR-SD", "E-ARITH", "M-UNLISTED"]);
});
