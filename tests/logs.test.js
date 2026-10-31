// Audit S5 and S7: only well-formed gate and decision records are written, and one damaged line never hides the rest of the history.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { recordProblem } from "../server/records.js";
import { makeLog } from "../server/log.js";
import { counters } from "../lib/engine.js";
import { course, ideas } from "./helpers.js";

const good = { ts: "t", type: "decision", idea: "grade", itemId: "S-01", decidedBy: "TA", proposed: ["E-MEAN"], confirmed: ["E-MEAN"], overrides: [], computedScore: 8, grade: 8, reviewedAll: null, receipt: "Assigned by you (TA)", feedback: "Marks lost: Mean wrong.", rubricVersion: "1.0" };
const gate = { ts: "t", type: "gate", idea: "grade", itemId: "S-01", droppedFields: 2, counts: { NAME: 1 }, blockedRules: [] };

test("S5: malformed decision and gate records are refused with a plain reason; good ones pass", () => {
  assert.equal(recordProblem(good, ideas), null);
  assert.equal(recordProblem(gate, ideas), null);
  for (const [why, rec] of [
    ["confirmed object", { ...good, confirmed: {} }], ["confirmed string", { ...good, confirmed: "NOT-AN-ARRAY" }],
    ["grade above full marks", { ...good, grade: 999 }], ["negative grade", { ...good, grade: -1 }], ["grade not a number", { ...good, grade: "10" }],
    ["unknown code", { ...good, confirmed: ["E-MADE-UP"] }], ["no grader", { ...good, decidedBy: " " }], ["no paper", { ...good, itemId: "" }],
    ["override shape", { ...good, overrides: [{ from: 1 }] }], ["gate counts", { ...gate, counts: { NAME: "x" } }], ["type", { ...good, type: "proposal" }],
  ]) assert.ok(recordProblem(rec, ideas), why);
  assert.equal(recordProblem({ ...good, idea: "my-uploaded-set" }, ideas), null, "a set this server does not list yet is shape-checked only");
  assert.ok(recordProblem({ ...good, idea: "my-uploaded-set", grade: -2 }, ideas));
});

test("S7: a truncated or malformed line is skipped and counted, never hiding the valid history around it", () => {
  const dir = mkdtempSync(join(tmpdir(), "log-"));
  writeFileSync(join(dir, "decisions.jsonl"), [JSON.stringify(good), '{"type":', JSON.stringify({ ...good, confirmed: {} }), JSON.stringify({ ...good, itemId: "S-02" }), ""].join("\n"));
  const log = makeLog(dir, course);
  const all = log.readAll();
  assert.deepEqual(all.decisions.map((d) => d.itemId), ["S-01", "S-02"]);
  assert.equal(all.damaged.decisions, 2, "one truncated line and one malformed record");
  assert.doesNotThrow(() => counters(all), "counts still work");
});

// Codex review of PR #13.
test("S5 review: a grading decision needs the human's mark, and every override needs a reason", () => {
  assert.ok(recordProblem({ ...good, grade: null }, ideas), "grade idea without a mark");
  assert.ok(recordProblem({ ...good, idea: "my-uploaded-set", grade: null }, ideas), "unknown sets are grading sets too");
  assert.ok(recordProblem({ ...good, overrides: [{ from: "E-MEAN", to: "OK", reason: null }] }, ideas));
  assert.ok(recordProblem({ ...good, overrides: [{ from: "E-MEAN", to: "OK", reason: "  " }] }, ideas));
  assert.equal(recordProblem({ ...good, overrides: [{ from: "E-MEAN", to: "OK", reason: "valid method" }] }, ideas), null);
  assert.equal(recordProblem({ ...good, idea: "upskill", proposed: [], confirmed: [], grade: null }, ideas), null, "ideas without a mark need none");
});

test("S7 review: a proposal row with a broken proposal list is skipped and counted, and counts still work", () => {
  const dir = mkdtempSync(join(tmpdir(), "logp-"));
  writeFileSync(join(dir, "proposals.jsonl"), [JSON.stringify({ type: "proposal", idea: "grade", itemId: "S-01", proposals: [{ code: "E-MEAN", quoteVerified: true }] }), JSON.stringify({ type: "proposal", idea: "grade", itemId: "S-02", proposals: [null] }), ""].join("\n"));
  const all = makeLog(dir, course).readAll();
  assert.equal(all.proposals.length, 1); assert.equal(all.damaged.proposals, 1);
  assert.doesNotThrow(() => counters(all));
});

test("S7 review: valid staff and student decisions without a mark are written and read back; grading still needs a mark on write", () => {
  const dir = mkdtempSync(join(tmpdir(), "logq-"));
  const log = makeLog(dir, course);
  const upskill = { ...good, idea: "upskill", proposed: [], confirmed: [], grade: null, computedScore: null, rubricVersion: null };
  const companion = { ...upskill, idea: "companion" };
  for (const r of [upskill, companion]) { assert.equal(recordProblem(r, ideas), null); log.append("decisions", r); }
  const all = log.readAll();
  assert.deepEqual(all.decisions.map((d) => d.idea), ["upskill", "companion"]);
  assert.equal(all.damaged.decisions, undefined);
  assert.ok(recordProblem({ ...good, grade: null }, ideas), "a grading write still needs the mark");
});
