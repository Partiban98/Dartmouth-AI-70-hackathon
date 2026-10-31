import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { score, validateStandards, methodSignatures, answerCheck } from "../lib/engine.js";
import { runGate } from "../lib/gate.js";
import { makeIdeas } from "../lib/ideas.js";
import { course, companion, upskillStandards, gradeStandards } from "./helpers.js";

const read = (f) => JSON.parse(readFileSync(new URL(`../data/${f}`, import.meta.url), "utf8"));
const table = read("engs93-q3q5.v1.0.json");
const subs = read("engs93-q3q5.submissions.json");
const labels = read("engs93-q3q5.submissions.eval.json").labels;
const ideas = makeIdeas({ gradeStandards, companion, upskillStandards, gradingSets: { grade93: table } });

test("ENGS 93 rubric validates and carries the four columns and six accepted methods", () => {
  assert.deepEqual(validateStandards(table), { ok: true, errors: [] });
  assert.equal(table.max, 2);
  assert.equal(table.columns.length, 4);
  assert.deepEqual(table.methods.map((m) => m.id), ["OFFICIAL", "BINOMIAL", "CONTINUITY", "WALD", "CHISQ", "CI"]);
});

test("the deduction table reproduces all 38 real TA totals from the comment-derived codes", () => {
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

test("reconstructed papers are labelled, gate-clean, and carry the student's reported p-value as the final answer", () => {
  for (const s of subs) {
    assert.equal(s.reconstructed, true, s.id);
    assert.ok(s.steps.length >= 2, s.id);
    const g = runGate(s, ideas.grade93, course);
    assert.equal(g.blocked, false, `${s.id} gate blocked: ${JSON.stringify(g.flags)}`);
  }
  assert.equal(subs.find((s) => s.id === "Q3-23").finalAnswer, 0.9826);
  assert.equal(subs.find((s) => s.id === "Q3-31").finalAnswer, 0.0346);
  assert.equal(subs.find((s) => s.id === "Q3-25").finalAnswer, null);
});

test("rules on the real rubric: wrong tail and two-sided p are flagged by code; every accepted method is listed", () => {
  assert.deepEqual(answerCheck(0.9826, table).map((c) => c.code), ["D-WRONG-TAIL"]);
  assert.deepEqual(answerCheck(0.0346, table).map((c) => c.code), ["C-WRONG-TAIL"]);
  for (const id of ["Q3-01", "Q3-02", "Q3-03", "Q3-04", "Q3-05", "Q3-06", "Q3-07", "Q3-09", "Q3-12", "Q3-14"]) {
    const s = subs.find((x) => x.id === id);
    assert.deepEqual(methodSignatures(s.steps, s.finalAnswer, table), [], `${id} full-mark paper must not be M-UNLISTED`);
  }
});

test("no real names in the ENGS 93 data files", () => {
  const text = JSON.stringify([table, subs, labels]);
  assert.ok(!/Pushpendra|Singh/.test(text));
  assert.ok(!/\b[A-Z][a-z]+ [A-Z][a-z]+\b/.test(text.replace(/Quiz 3|Question 5|Validity|Hypotheses|Conclusion|Test statistic|Computational|Definitional|Continuity|Standard|Exact|Wald|Chi|Maximum|Observed|Two|One|Rule|Attempt|Marks|Reject|Not|No|H0|Ha|SE0|Let|At|Sample|Sum|Validity|Arithmetic|The|In|For|Each|Detail/g, "")), "a capitalised name-like pair remains");
});
