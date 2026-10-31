// Retrospective tests for modules that had none. Each was verified to go red under a deliberate mutation (see the mutation run in the commit message).
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { assertLogSafe, proposalRecord, gateRecord } from "../lib/logshape.js";
import { loadDotenv } from "../server/env.js";
import { buildUserPrompt, SYSTEM } from "../lib/prompts.js";
import { normalize } from "../lib/text.js";
import { feedbackLine, bumpVersion } from "../lib/feedback.js";
import { extractText, parsePaper } from "../server/ingest.js";
import { course, ideas, gradeStandards } from "./helpers.js";

test("assertLogSafe refuses forbidden keys even when their values look harmless", () => {
  for (const key of ["aliasMap", "header", "payload", "quote", "email", "netid", "name", "studentId"]) {
    assert.throws(() => assertLogSafe({ type: "gate", idea: "grade", [key]: { x: "harmless" } }, course), new RegExp(`log key not allowed: record\\.${key}`), key);
  }
  assert.throws(() => assertLogSafe({ type: "note" }, course), /type not allowed/);
  assert.equal(assertLogSafe(gateRecord("grade", "S-01", { droppedFields: 2, counts: { EMAIL: 0 }, blockedRules: [] }), course), true);
});

test("proposalRecord keeps codes, confidence, and the verified flag, never the quoted text", () => {
  const rec = proposalRecord("grade", "S-01", { label: "LIVE API: x", modelId: "x", rung: 1, cacheHit: false, usage: null, proposals: [{ code: "E-VAR-SD", quote: "secret line from the paper", confidence: 0.9, verified: true }] });
  assert.deepEqual(rec.proposals, [{ code: "E-VAR-SD", confidence: 0.9, quoteVerified: true, source: "AI" }]);
  assert.ok(!JSON.stringify(rec).includes("secret line"));
});

test("loadDotenv fills variables that are missing or empty, and never overrides a set one", () => {
  const dir = mkdtempSync(join(tmpdir(), "env-"));
  writeFileSync(join(dir, ".env"), "REMAIN_T_A=from-file\nREMAIN_T_B=from-file\nREMAIN_T_C=from-file\n");
  process.env.REMAIN_T_A = ""; process.env.REMAIN_T_B = "already-set"; delete process.env.REMAIN_T_C;
  const loaded = loadDotenv(join(dir, ".env"));
  assert.deepEqual(loaded.sort(), ["REMAIN_T_A", "REMAIN_T_C"]);
  assert.equal(process.env.REMAIN_T_A, "from-file"); assert.equal(process.env.REMAIN_T_B, "already-set"); assert.equal(process.env.REMAIN_T_C, "from-file");
  assert.deepEqual(loadDotenv(join(dir, "missing.env")), []);
  for (const k of ["REMAIN_T_A", "REMAIN_T_B", "REMAIN_T_C"]) delete process.env[k];
});

test("the user prompt lists allowed codes with labels and never the deductions, max, or correct answer", () => {
  const prompt = buildUserPrompt(ideas.grade, { steps: ["SD = 10"], finalAnswer: 10 });
  for (const c of ideas.grade.allowedCodes) assert.ok(prompt.includes(`- ${c}:`), c);
  assert.ok(!prompt.includes("- OK:") && !prompt.includes("- UNSURE:"), "OK and UNSURE are human-only codes");
  assert.ok(!/deduction|\bmax\b|points|3\.162|correctAnswer/i.test(prompt), "no scoring words or the answer reach the model");
  for (const c of gradeStandards.codes.filter((x) => x.deduction !== 0)) assert.ok(!prompt.includes(`${c.code} ${c.deduction}`) && !prompt.includes(`(${c.deduction})`) && !prompt.includes(`${c.code}: ${c.deduction}`), `deduction for ${c.code} leaked`);
  assert.ok(prompt.includes(gradeStandards.question));
  assert.ok(SYSTEM.includes("Never compute") && SYSTEM.includes("never redact"));
});

test("normalize collapses whitespace and straightens curly quotes", () => {
  assert.equal(normalize("  a “b”   c\n d ’e’ "), 'a "b" c d \'e\'');
  assert.equal(normalize(null), "");
});

test("feedbackLine is deterministic from confirmed codes; bumpVersion increments the minor part", () => {
  assert.equal(feedbackLine([], gradeStandards), "Full marks.");
  assert.equal(feedbackLine(["OK"], gradeStandards), "Full marks.");
  assert.equal(feedbackLine(["E-VAR-SD", "E-ARITH"], gradeStandards), "Marks lost: Reported variance as SD; Arithmetic slip.");
  assert.equal(bumpVersion("1.0"), "1.1"); assert.equal(bumpVersion("1.9"), "1.10"); assert.equal(bumpVersion("2"), "2.1");
});

test("extractText reads a PDF text layer and parsePaper separates the name from the steps", async () => {
  const text = await extractText(fileURLToPath(new URL("./fixtures/paper.pdf", import.meta.url)));
  assert.ok(text.includes("Name: Test Student"), text);
  const p = parsePaper(text, "paper.pdf");
  assert.equal(p.header.name, "Test Student");
  assert.deepEqual(p.steps, ["Mean = 40 / 5 = 8", "SD = 10"]);
  assert.equal(p.finalAnswer, 10);
});

test("saved rubric overrides the seed and is validated before it is read back", async () => {
  const { loadStandards, saveStandards } = await import("../server/context.js");
  const seed = loadStandards("grade-q5.v1.0.json");
  assert.equal(seed.id, "grade-q5");
  const local = join(process.cwd(), "local", "rubrics", "grade-q5.json");
  const had = existsSync(local) ? readFileSync(local, "utf8") : null;
  try {
    saveStandards({ ...seed, version: "9.9" });
    assert.equal(loadStandards("grade-q5.v1.0.json").version, "9.9");
  } finally {
    if (had === null) { const { rmSync } = await import("node:fs"); rmSync(local, { force: true }); } else writeFileSync(local, had);
  }
  assert.equal(loadStandards("grade-q5.v1.0.json").version, had ? JSON.parse(had).version : "1.0");
});
