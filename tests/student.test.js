import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { makeStudent } from "../server/student.js";
import { course, gradeStandards, sub } from "./helpers.js";

// One fixture log: a confirm, a change, and an override the TA ruled out.
const FIXTURE = [
  { type: "decision", idea: "grade", itemId: "S-03", decidedBy: "A. Grader", grade: 7,
    proposed: ["E-VAR-SD", "E-ARITH", "M-UNLISTED"],
    confirmed: ["E-VAR-SD", "E-N-DENOM"],
    overrides: [{ from: "E-ARITH", to: "E-N-DENOM", reason: "the slip is the denominator, not the arithmetic" },
                { from: "M-UNLISTED", to: "OK", reason: "a valid method the scheme did not list" }],
    computedScore: 5, feedback: "Check which denominator the sample formula uses.", rubricVersion: "1.0" },
];

const make = (decisions = FIXTURE) => makeStudent({
  localDir: mkdtempSync(join(tmpdir(), "remain-student-")), course,
  decisions: () => decisions,
  standardsOf: () => gradeStandards,
  paperOf: (_idea, id) => sub(id) ?? null,
});

test("S6: only the reasons the TA confirmed or changed to appear; the overridden proposal is absent", () => {
  const v = make().view("S-03");
  const codes = v.questions[0].deductions.map((d) => d.code);
  assert.deepEqual(codes.sort(), ["E-N-DENOM", "E-VAR-SD"]);
  assert.equal(codes.includes("M-UNLISTED"), false, "the suggestion the TA ruled out must not show as a deduction");
  assert.equal(codes.includes("E-ARITH"), false, "the proposal the TA changed away from must not show");
  const changed = v.questions[0].deductions.find((d) => d.code === "E-N-DENOM");
  assert.match(changed.taReason, /denominator/);
});

test("S6: the page carries no AI confidence, no proposal and no answer key", () => {
  const v = make().view("S-03");
  const keys = new Set();
  (function walk(x) { if (Array.isArray(x)) x.forEach(walk); else if (x && typeof x === "object") for (const [k, y] of Object.entries(x)) { keys.add(k); walk(y); } })(v);
  for (const banned of ["confidence", "answer_key", "answerKey", "correctAnswer", "proposal", "proposed", "model", "modelId", "label"]) assert.equal(keys.has(banned), false, `must not expose ${banned}`);
  assert.equal(JSON.stringify(v).includes("3.162"), false, "the correct answer must not reach the student page");
});

test("S6: a regrade replaces the prior mark for the same question", () => {
  const two = [...FIXTURE, { ...FIXTURE[0], idea: "grade", itemId: "S-03", grade: 9, confirmed: ["E-ARITH"], overrides: [] }];
  const v = make(two).view("S-03");
  assert.deepEqual(v.questions.map((q) => q.mark), [9]);
  assert.equal(v.total, 9);
  assert.equal(v.outOf, 10);
});

test("S6: an unknown id returns nothing at all", () => {
  assert.equal(make().view("S-99"), null);
});

test("S6: a regrade request needs 20 characters, and one request writes exactly one line", () => {
  const s = make();
  assert.equal(s.addRegrade({ anonId: "S-03", questionId: "grade", text: "wrong" }).status, 400);
  assert.equal(s.requests().length, 0);
  const r = s.addRegrade({ anonId: "S-03", questionId: "grade", text: "I used the n-1 denominator on line 4 and I think it was marked twice." });
  assert.equal(r.status, 201);
  assert.equal(s.requests().length, 1);
  const rec = s.requests()[0];
  assert.equal(rec.anonId, "S-03");
  assert.equal(rec.questionId, "grade");
  assert.ok(rec.ts, "stored with a timestamp");
});

test("S6: the deduction carries the rubric line, and the quoted step is a real line of the student's own paper", () => {
  const v = make().view("S-03");
  const d = v.questions[0].deductions.find((x) => x.code === "E-VAR-SD");
  assert.equal(d.rubricLine, "Reported variance as SD");
  assert.equal(d.points, -3);

  // S-11 is a paper that really does report the variance as the SD, so the
  // deduction must point at the line that cost the points, not a bare value.
  const onEleven = makeStudent({
    localDir: mkdtempSync(join(tmpdir(), "remain-student-")), course,
    decisions: () => [{ ...FIXTURE[0], itemId: "S-11", confirmed: ["E-VAR-SD"], overrides: [] }],
    standardsOf: () => gradeStandards, paperOf: (_i, id) => sub(id) ?? null,
  }).view("S-11");
  const hit = onEleven.questions[0].deductions[0];
  assert.equal(hit.code, "E-VAR-SD");
  assert.equal(typeof hit.quoteLine, "number", "the student is told which line");
  assert.equal(hit.quote, sub("S-11").steps[hit.quoteLine - 1], "the quote is that whole line of their paper");
});


test("S6: an old rubric version never borrows changed deductions or max from today's scheme", () => {
  const changed = { ...gradeStandards, version: "1.1", max: 20,
    codes: gradeStandards.codes.map((c) => c.code === "E-VAR-SD" ? { ...c, deduction: -8, label: "Changed label" } : c) };
  const v = makeStudent({ localDir: mkdtempSync(join(tmpdir(), "remain-student-")), course,
    decisions: () => FIXTURE, standardsOf: () => changed, paperOf: (_i, id) => sub(id) }).view("S-03");
  assert.equal(v.questions[0].mark, 7);
  assert.equal(v.questions[0].rubricVersion, "1.0");
  assert.equal(v.questions[0].max, null);
  assert.equal(v.outOf, null);
  assert.equal(v.questions[0].rubricUnavailable, true);
  assert.ok(v.questions[0].deductions.every((d) => d.points === null && d.quote === null));
  assert.ok(!JSON.stringify(v).includes("Changed label"));
});

test("S6: regrade requests must belong to a marked paper and question and use scalar text", () => {
  const s = make();
  const text = "Please review the denominator in my work.";
  for (const draft of [
    { anonId: "S-99", questionId: "grade", text },
    { anonId: "S-03", questionId: "not-a-question", text },
    { anonId: { value: "S-03" }, questionId: "grade", text },
    { anonId: "S-03", questionId: "grade", text: { note: text } },
  ]) assert.equal(s.addRegrade(draft).status, 400);
  assert.equal(s.requests().length, 0);
});
