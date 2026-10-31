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

test('E1 review: a case keeps the exact server-gated payload including numeric finalAnswer', async () => {
  const { prepareCase } = await import('../server/evalcases.js');
  const { ideas, sub } = await import('./helpers.js');
  const { payloadOf } = await import('../scripts/eval-overrides.js');
  const paper = sub('S-01');
  const decision = { idea: 'grade', itemId: paper.id, rubricVersion: '1.0', overrides: [{ from: 'E-ARITH', to: 'OK' }] };
  const r = prepareCase({ body: { idea: 'grade', itemId: paper.id, aiCode: 'E-ARITH', taRuling: 'OK', reason: 'valid work' }, paper, ideaConfig: ideas.grade, decision, course });
  assert.equal(r.status, 200);
  assert.equal(r.value.input.finalAnswer, 10);
  assert.deepEqual(payloadOf(r.value), r.value.input);
});

test('E1 review: forged and stale rulings cannot become expected results', async () => {
  const { prepareCase } = await import('../server/evalcases.js');
  const { ideas, sub } = await import('./helpers.js');
  const body = { idea: 'grade', itemId: 'S-01', aiCode: 'E-ARITH', taRuling: 'OK', reason: 'valid work' };
  const base = { body, paper: sub('S-01'), ideaConfig: ideas.grade, course };
  assert.equal(prepareCase(base).status, 400);
  assert.equal(prepareCase({ ...base, decision: { idea: 'grade', itemId: 'S-01', rubricVersion: '1.0', overrides: [] } }).status, 400);
  assert.equal(prepareCase({ ...base, decision: { idea: 'grade', itemId: 'S-01', rubricVersion: '0.9', overrides: [{ from: 'E-ARITH', to: 'OK' }] } }).status, 400);
});

test('E1 review: another valid error does not count as repeating the overridden suggestion', async () => {
  const r = await runEval({ cases: [{ idea: 'grade', itemId: 'S-01', aiCode: 'E-MEAN', taRuling: 'OK' }], propose: async () => ({ ok: true, proposals: [{ code: 'E-ARITH' }] }) });
  assert.equal(r.match, 1);
  assert.equal(r.mismatch, 0);
});

test('E1 review: unknown assignment is an error, never automatic agreement', async () => {
  const { spawnSync } = await import('node:child_process');
  const { rmSync } = await import('node:fs');
  const dir = mkdtempSync(join(tmpdir(), 'remain-eval-cli-'));
  try {
    makeEvalCases({ localDir: dir, course }).add({ ...good, idea: 'ABC-DEF' });
    const r = spawnSync(process.execPath, ['scripts/eval-overrides.js', '--replay'], { cwd: new URL('..', import.meta.url), env: { ...process.env, REMAIN_LOCAL_DIR: dir }, encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /0 cases checked/);
    assert.match(r.stdout, /1 case got no answer/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('E1 review: test-case submission reports connection and server failures so the form can retry', async () => {
  const { submitCase } = await import('../components/grading/overrides.js');
  const input = { idea: 'grade', itemId: 'S-01', aiCode: 'E-ARITH', taRuling: 'OK', reason: 'valid work' };
  await assert.rejects(() => submitCase(input, async () => { throw new Error('connection lost'); }), /connection lost/);
  await assert.rejects(() => submitCase(input, async () => ({ ok: false, json: async () => ({ error: 'not saved' }) })), /not saved/);
  assert.deepEqual(await submitCase(input, async () => ({ ok: true, json: async () => ({ added: true }) })), { added: true });
});

test('evaluation checks the current scheme as well as the saved paper before sending', () => {
  const s = fresh();
  const c = { ...good, input: { steps: ['s = 3.162'], finalAnswer: 3.162 } };
  assert.throws(() => s.checkForSend(c, { standards: { question: `Work by ${course.roster[0].name}`, codes: [] } }), /roster name/);
  assert.doesNotThrow(() => s.checkForSend(c, { standards: { question: 'Find the sample SD.', codes: [{ code: 'E-ARITH', label: 'Arithmetic slip' }] } }));
});
