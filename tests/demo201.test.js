import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { score, validateStandards, methodSignatures, answerCheck } from "../lib/engine.js";
import { runGate } from "../lib/gate.js";
import { makeIdeas } from "../lib/ideas.js";
import { course, companion, upskillStandards, gradeStandards } from "./helpers.js";

const read = (f) => JSON.parse(readFileSync(new URL(`../data/${f}`, import.meta.url), "utf8"));
const table = read("demo201-q3q5.v1.0.json");
const subs = read("demo201-q3q5.submissions.json");
const labels = read("demo201-q3q5.submissions.eval.json").labels;
const ideas = makeIdeas({ gradeStandards, companion, upskillStandards, gradingSets: { grade93: table } });

test("DEMO-STATS 201 rubric validates and carries the four columns and six accepted methods", () => {
  assert.deepEqual(validateStandards(table), { ok: true, errors: [] });
  assert.equal(table.max, 2);
  assert.equal(table.columns.length, 4);
  assert.deepEqual(table.methods.map((m) => m.id), ["OFFICIAL", "BINOMIAL", "CONTINUITY", "WALD", "CHISQ", "CI"]);
});

test("the deduction table reproduces all 38 planted totals from the comment-derived codes", () => {
  assert.equal(Object.keys(labels).length, 38);
  for (const [id, l] of Object.entries(labels)) assert.equal(score(l.codes, table), l.total, `${id}: codes ${l.codes.join(",")} should give ${l.total}`);
});

test("per-column splits recorded by the TA match the codes' columns for the 14 papers with exact splits", () => {
  const col = Object.fromEntries(table.codes.map((c) => [c.code, c]));
  for (const [id, l] of Object.entries(labels)) {
    if (!l.split || l.codes.includes("G-ATTEMPT-ONLY")) continue;
    const got = { hyp: 0.5, val: 0.5, stat: 0.5, concl: 0.5 };
    for (const c of l.codes) got[col[c].column] = Math.max(0, got[col[c].column] + col[c].deduction);
    assert.deepEqual([got.hyp, got.val, got.stat, got.concl], l.split, id);
  }
});

test("second-course papers are gate-clean and carry the reported p-value as the final answer", () => {
  for (const s of subs) {
    assert.ok(s.steps.length >= 2, s.id);
    const g = runGate(s, ideas.grade93, course);
    assert.equal(g.blocked, false, `${s.id} gate blocked: ${JSON.stringify(g.flags)}`);
  }
  assert.equal(subs.find((s) => s.id === "T-23").finalAnswer, 0.9826);
  assert.equal(subs.find((s) => s.id === "T-31").finalAnswer, 0.0346);
  assert.equal(subs.find((s) => s.id === "T-25").finalAnswer, null);
});

test("rules on the second rubric: wrong tail and two-sided p are flagged by code; every accepted method is listed", () => {
  assert.deepEqual(answerCheck(0.9826, table).map((c) => c.code), ["D-WRONG-TAIL"]);
  assert.deepEqual(answerCheck(0.0346, table).map((c) => c.code), ["C-WRONG-TAIL"]);
  for (const id of ["T-01", "T-02", "T-03", "T-04", "T-05", "T-06", "T-07", "T-09", "T-12", "T-14"]) {
    const s = subs.find((x) => x.id === id);
    assert.deepEqual(methodSignatures(s.steps, s.finalAnswer, table), [], `${id} full-mark paper must not be M-UNLISTED`);
  }
});

test("no person names in the DEMO-STATS 201 data files", () => {
  const text = JSON.stringify([table, subs, labels]);
  assert.ok(!/Pushpendra|Singh/.test(text));
  assert.ok(!/\b[A-Z][a-z]+ [A-Z][a-z]+\b/.test(text.replace(/Quiz 3|Question 5|Validity|Hypotheses|Conclusion|Test statistic|Computational|Definitional|Continuity|Standard|Exact|Wald|Chi|Maximum|Observed|Two|One|Rule|Attempt|Marks|Reject|Not|No|H0|Ha|SE0|Let|At|Sample|Sum|Validity|Arithmetic|The|In|For|Each|Detail/g, "")), "a capitalised name-like pair remains");
});
