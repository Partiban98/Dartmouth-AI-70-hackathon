import { test } from "node:test";
import assert from "node:assert/strict";
import { validateStandards, validateCodes, verifyQuote, score, methodSignatures, answerCheck, factsCheck, retest, keyPoints, analytics, counters, NOT_FOUND } from "../lib/engine.js";
import { runPipeline } from "../lib/pipeline.js";
import { gradeStandards, companion, ideas, sub, course, dana, upskillStandards } from "./helpers.js";

test("T10 validateCodes rejects unknown codes", () => {
  assert.deepEqual(validateCodes(["E-VAR-SD", "E-TYPO"], gradeStandards), { accepted: ["E-VAR-SD"], rejected: ["E-TYPO"] });
});

test("T13 verifyQuote: fake line not found; whitespace and curly quotes normalized", () => {
  const steps = sub("S-01").steps.join("\n");
  assert.equal(verifyQuote("variance = 9", steps).found, false);
  assert.equal(verifyQuote("SD  =  10", steps).found, true);
  assert.equal(verifyQuote("“SD = 10”", 'the "SD = 10" line').found, true);
  assert.equal(verifyQuote("", steps).found, false);
});

test("T14 score uses confirmed codes only, clamped 0..max", () => {
  assert.equal(score(["E-VAR-SD"], gradeStandards), 7);
  assert.equal(score(["E-VAR-SD", "E-N-DENOM", "E-MEAN", "E-ARITH", "M-UNLISTED"], gradeStandards), 0);
  assert.equal(score([], gradeStandards), 10);
  assert.equal(score(["OK", "E-ARITH", "E-ARITH", "E-MEAN", "E-MEAN", "E-MEAN", "E-MEAN", "E-MEAN", "E-MEAN"], gradeStandards), 0);
});

test("T15 R-M1: S-07 valid M2 becomes M-UNLISTED labelled Rule; correct M1 paper does not", () => {
  const s7 = sub("S-07");
  const r = methodSignatures(s7.steps, s7.finalAnswer, gradeStandards);
  assert.equal(r.length, 1); assert.equal(r[0].code, "M-UNLISTED"); assert.equal(r[0].source, "Rule");
  const s3 = sub("S-03");
  assert.deepEqual(methodSignatures(s3.steps, s3.finalAnswer, gradeStandards), []);
  const s1 = sub("S-01");
  assert.deepEqual(methodSignatures(s1.steps, s1.finalAnswer, gradeStandards), [], "wrong answer never triggers R-M1");
});

test("T16 answerCheck: 10 -> E-VAR-SD, 2.83 -> E-N-DENOM, 3.162 -> nothing", () => {
  assert.deepEqual(answerCheck(10, gradeStandards).map((c) => c.code), ["E-VAR-SD"]);
  assert.deepEqual(answerCheck(2.83, gradeStandards).map((c) => c.code), ["E-N-DENOM"]);
  assert.deepEqual(answerCheck(3.162, gradeStandards), []);
  assert.equal(answerCheck(10, gradeStandards)[0].source, "Rule");
});

test("T17 R-KP: verified key point shows its source line; invented quote says not found", () => {
  const out = keyPoints([{ code: "KP-1", quote: companion.keyPoints[0].sourceLine, confidence: 0.9 }, { code: "KP-2", quote: "Variance is always larger than SD.", confidence: 0.9 }], companion);
  assert.equal(out[0].verified, true); assert.equal(out[0].sourceLine, companion.keyPoints[0].sourceLine);
  assert.equal(out[1].verified, false); assert.equal(out[1].sourceLine, null); assert.equal(out[1].message, NOT_FOUND);
});

test("T18 retest: 4 cm passes; 16 cm and 4 cm squared fail by code", () => {
  const spec = companion.retestQ3;
  assert.equal(retest("4 cm", spec).pass, true);
  assert.equal(retest("The SD is 4 cm.", spec).pass, true);
  const a = retest("16 cm", spec); assert.equal(a.pass, false); assert.ok(a.reasons.some((r) => r.includes("forbidden value 16")));
  const b = retest("4 cm squared", spec); assert.equal(b.pass, false); assert.ok(b.reasons.some((r) => r.includes("cm squared")));
  assert.equal(retest("4", spec).pass, false);
  assert.equal(retest("about four", spec).pass, false);
});

test("T19 factsCheck flags details not in facts and passes the seeded facts", () => {
  const bad = factsCheck("Join us Thursday, Nov 5 at 7:30 PM in B-102.", dana.facts);
  const details = bad.map((b) => b.detail);
  assert.ok(details.some((d) => d.includes("7:30 PM")) && details.some((d) => d.includes("Nov 5")) && details.includes("B-102"), JSON.stringify(details));
  assert.ok(bad.every((b) => b.message === "Detail not in your facts"));
  assert.deepEqual(factsCheck("Review session Wed, Nov 4, 6:00 to 7:00 PM, room B-101, on variance vs standard deviation.", dana.facts), []);
  assert.deepEqual(factsCheck("We meet from 6:00 PM to 7:00 PM on Wed, Nov 4 in B-101.", dana.facts), []);
});

test("T20 validateStandards: v1.0 tables ok; missing UNSURE or positive deduction fails", () => {
  assert.deepEqual(validateStandards(gradeStandards), { ok: true, errors: [] });
  assert.equal(validateStandards(upskillStandards).ok, true);
  assert.equal(validateStandards(ideas.companion.standards).ok, true);
  const noUnsure = { ...gradeStandards, codes: gradeStandards.codes.filter((c) => c.code !== "UNSURE") };
  assert.ok(validateStandards(noUnsure).errors.includes("code UNSURE missing"));
  const positive = { ...gradeStandards, codes: gradeStandards.codes.map((c) => c.code === "E-ARITH" ? { ...c, deduction: 1 } : c) };
  assert.equal(validateStandards(positive).ok, false);
  assert.equal(validateStandards({ ...gradeStandards, status: "draft" }).ok, false);
});

test("T23 course lock: Problem Set 3 cannot be checked; Practice Q2 runs", async () => {
  const locked = await runPipeline(ideas.companion, { item: "Problem Set 3", answer: "x".repeat(30), source: companion.source }, {}, { course, fetchImpl: () => { throw new Error("must not be called"); } });
  assert.deepEqual(locked, { locked: true, message: "Locked by course AI rule" });
  assert.equal(ideas.companion.lockRule({ item: "Practice Q2" }), false);
});

test("analytics and counters come from log records only", () => {
  const decisions = [
    { proposed: ["E-VAR-SD"], confirmed: ["E-VAR-SD"], overrides: [] },
    { proposed: ["E-VAR-SD"], confirmed: ["E-VAR-SD"], overrides: [] },
    { proposed: ["E-VAR-SD"], confirmed: [], overrides: [{ from: "E-VAR-SD", to: "OK", reason: "valid" }] },
  ];
  assert.deepEqual(analytics(decisions), { "E-VAR-SD": { proposed: 3, confirmed: 2, overridden: 1 } });
  const c = counters({ gate: [{ droppedFields: 5, counts: { EMAIL: 1, NAME: 2, HEADER_LINE: 2 } }], proposals: [{ proposals: [{ quoteVerified: true }, { quoteVerified: false }] }], decisions });
  assert.deepEqual(c, { proposed: 2, confirmed: 2, overridden: 1, quotesVerified: 1, quotesNotFound: 1, piiStripped: { EMAIL: 1, NAME: 2 }, headerLinesDropped: 2, fieldsDropped: 5, decisionsByHuman: 3 });
});
