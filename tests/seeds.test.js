import { test } from "node:test";
import assert from "node:assert/strict";
import { course, submissions, evalLabels, gradeStandards, companion, dana, sub } from "./helpers.js";

test("T30 Q5 corrected values present in every correct paper, wrong old values absent", () => {
  for (const s of submissions) {
    const text = s.steps.join("\n") + " " + s.finalAnswer;
    assert.ok(!/\b288\b/.test(text), `${s.id} contains 288`);
    assert.ok(!/variance\s*=\s*9\b/i.test(text), `${s.id} has variance 9`);
    assert.ok(!/SD\s*=\s*3\b(?!\.)/i.test(text), `${s.id} has SD 3`);
    if (evalLabels[s.id].planted === "OK") {
      assert.equal(s.finalAnswer, 3.162);
      assert.ok(/\b10\b/.test(text) && /3\.162/.test(text), `${s.id} lacks 10 / 3.162`);
      if (evalLabels[s.id].method === "M2") assert.ok(/\b320\b/.test(text) && /\b360\b/.test(text), `${s.id} M2 lacks 320/360`);
    }
  }
});

test("T30 planted distribution 10/4/2/3/6, S-07 valid M2, S-12 gate probe", () => {
  const tally = {};
  for (const [id, l] of Object.entries(evalLabels)) { const k = l.planted === "OK" ? l.method : l.planted; tally[k] = (tally[k] ?? 0) + 1; }
  assert.deepEqual(tally, { "E-VAR-SD": 10, "E-N-DENOM": 4, "E-ARITH": 2, M2: 3, M1: 6 });
  assert.equal(Object.keys(evalLabels).length, 25);
  assert.deepEqual(evalLabels["S-07"], { planted: "OK", method: "M2" });
  assert.equal(evalLabels["S-12"].gateProbe, true);
  const probe = sub("S-12").steps.join("\n");
  assert.ok(course.roster.some((r) => probe.includes(r.name)), "S-12 must contain a roster name");
});

test("T30 standards table values and M2 absence", () => {
  const d = Object.fromEntries(gradeStandards.codes.map((c) => [c.code, c.deduction]));
  assert.deepEqual(d, { "E-VAR-SD": -3, "E-N-DENOM": -2, "E-MEAN": -2, "E-ARITH": -1, "M-UNLISTED": -2, OK: 0, UNSURE: 0 });
  assert.equal(gradeStandards.max, 10);
  assert.deepEqual(gradeStandards.methods.map((m) => m.id), ["M1"]);
});

test("seed QA: no roster or dictionary name matches a teammate, conventions hold", () => {
  const banned = ["kishore", "theeraj", "vasudevan", "jaya", "rineetha", "gunasekaran", "partiban", "anathurai", "xinyan", "huang"];
  for (const e of [...course.roster, ...course.dictionary]) for (const b of banned) assert.ok(!e.name.toLowerCase().includes(b), `${e.name} matches teammate`);
  for (const r of course.roster) {
    assert.match(r.email, /@example\.org$/); assert.match(r.studentId, /^9001\d{5}$/); assert.match(r.netid, /^demo-[a-z0-9]{6}$/);
  }
  assert.equal(course.roster.length, 25);
});

test("companion key point source lines are exact substrings of the source; retest spec", () => {
  const src = companion.source.join("\n\n");
  for (const k of companion.keyPoints) assert.ok(src.includes(k.sourceLine), `${k.code} line not in source`);
  assert.equal(companion.retestQ3.expected, 4);
  assert.deepEqual(companion.retestQ3.forbiddenValues, [16]);
});

test("Dana task has the facts fields from the spec", () => {
  assert.deepEqual(dana.facts, { day: "Wed", date: "Nov 4", time: "6:00 to 7:00 PM", room: "B-101", topic: "Variance vs standard deviation" });
  assert.ok(dana.text.includes("Dana Whitcombe"));
});
