import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { makeEvalCases } from "../server/evalcases.js";
import { runEval } from "../scripts/eval-overrides.js";
import { firstTrueOverride } from "../components/grading/overrides.js";
import { course } from "./helpers.js";

const fresh = () => makeEvalCases({ localDir: mkdtempSync(join(tmpdir(), "remain-eval-")), course });
const store = (s) => s.list();
const good = { idea: "grade", itemId: "S-07", aiCode: "M-UNLISTED", taRuling: "OK", reason: "valid method the scheme did not list", rubricVersion: "1.0", text: "x = 320 / 10\ns = 3.162" };

test("E1: a case with an empty reason is refused and nothing is stored", () => {
  const s = fresh();
  const r = s.add({ ...good, reason: "   " });
  assert.equal(r.status, 400);
  assert.match(r.error, /why/i);
  assert.equal(store(s).length, 0);
});

test("E1: a case whose text still carries a roster name is refused", () => {
  const s = fresh();
  const r = s.add({ ...good, text: `${course.roster[0].name} wrote: s = 3.162` });
  assert.equal(r.status, 400);
  assert.match(r.error, /roster name/);
  assert.equal(store(s).length, 0);
});

test("E1: the same paper and question twice stores one case", () => {
  const s = fresh();
  assert.equal(s.add(good).status, 201);
  const again = s.add({ ...good, reason: "a second thought" });
  assert.equal(again.duplicate, true);
  assert.equal(store(s).length, 1);
});

test("E1: the summary is zero and null before anything is stored or run", () => {
  const s = fresh();
  assert.deepEqual(s.summary(), { cases: 0, lastRun: null, mismatch: null, checked: null });
});

test("E1: the summary carries no ruling, label, expected answer or per-case field", () => {
  const s = fresh();
  s.add(good);
  s.appendRun({ total: 1, match: 0, mismatch: 1 });
  const seen = new Set();
  (function walk(v) {
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) { seen.add(k); walk(x); }
  })(s.summary());
  for (const banned of ["ta_ruling", "taRuling", "label", "expected", "answer", "text", "reason"]) assert.equal(seen.has(banned), false, `summary must not expose ${banned}`);
  assert.equal(s.summary().cases, 1);
  assert.equal(s.summary().mismatch, 1);
});

test("E1: a run that agrees with the TA counts a match, one that disagrees counts a mismatch", async () => {
  const cases = [{ idea: "grade", itemId: "S-07", taRuling: "OK", text: "s = 3.162" }];
  const agree = await runEval({ cases, propose: async () => ({ proposals: [{ code: "OK" }], cacheHit: true }) });
  assert.equal(agree.total, 1); assert.equal(agree.match, 1); assert.equal(agree.mismatch, 0);
  const differ = await runEval({ cases, propose: async () => ({ proposals: [{ code: "E-VAR-SD" }], cacheHit: true }) });
  assert.equal(differ.total, 1); assert.equal(differ.match, 0); assert.equal(differ.mismatch, 1);
});

test("E1: a run reports how many live calls it made", async () => {
  const cases = [{ idea: "grade", itemId: "S-07", taRuling: "OK", text: "s" }, { idea: "grade", itemId: "S-09", taRuling: "OK", text: "s" }];
  const r = await runEval({ cases, propose: async (c) => ({ proposals: [{ code: "OK" }], cacheHit: c.itemId === "S-07" }) });
  assert.equal(r.live, 1);
});

test("E1: a stored case holds post-gate text and the TA ruling, and no student identity", () => {
  const s = fresh();
  s.add(good);
  const rec = store(s)[0];
  assert.deepEqual(Object.keys(rec).sort(), ["aiCode", "idea", "itemId", "kind", "reason", "rubricVersion", "taRuling", "text", "ts"]);
  const line = JSON.stringify(rec);
  for (const e of [...course.roster, ...(course.dictionary ?? [])]) assert.equal(line.includes(e.name), false);
  assert.equal(/\d{9}/.test(line), false, "no student id");
});

test("E1: a case the provider could not answer is not scored as agreement", async () => {
  const cases = [{ idea: "grade", itemId: "S-07", taRuling: "OK", text: "s = 3.162" }];
  const r = await runEval({ cases, propose: async () => ({ ok: false, proposals: [] }) });
  assert.equal(r.errors, 1);
  assert.equal(r.total, 0);
  assert.equal(r.match, 0);
  assert.equal(r.mismatch, 0);
});

test("E1: the test-case button is offered for an override only, never a confirm or a change", () => {
  // A confirm never reaches overrides; a change carries the code it changed to.
  assert.equal(firstTrueOverride([]), null);
  assert.equal(firstTrueOverride(undefined), null);
  assert.equal(firstTrueOverride([{ from: "E-ARITH", to: "E-VAR-SD", reason: "different mistake" }]), null);
  const o = firstTrueOverride([{ from: "M-UNLISTED", to: "OK", reason: "valid method" }]);
  assert.equal(o.from, "M-UNLISTED");
});
