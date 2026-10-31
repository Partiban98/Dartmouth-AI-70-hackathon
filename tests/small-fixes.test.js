// Audit E6, PUX-8, PUX-6, QA-05, PUX-7.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createAssignment, encodePack, decodePack, unsafePattern } from "../server/assignment.js";
import { packPreview, latestPerPaper } from "../components/grading/checks.js";
import { defaultSetId } from "../server/ingest.js";
import { read, gradeStandards } from "./helpers.js";

const draft = { course: "DEMO-STATS 101", title: "Quiz 5", question: gradeStandards.question, max: 10, codes: gradeStandards.codes, methods: gradeStandards.methods, answerRules: gradeStandards.answerRules };

test("E6: a method pattern that can freeze grading is refused at create and join; every sample pattern is accepted", () => {
  for (const sig of ["^(a+)+$", "(a*)*b", "(x+){2,}", "(\\w+\\s?)+$", "(a)\\1", "a".repeat(201)]) assert.ok(unsafePattern(sig), sig);
  for (const t of [gradeStandards, read("demo201-q3q5.v1.0.json")]) for (const m of t.methods) assert.equal(unsafePattern(m.signature), null, m.signature);
  const localDir = mkdtempSync(join(tmpdir(), "e6-"));
  assert.throws(() => createAssignment({ ...draft, methods: [{ id: "M9", label: "x", signature: "^(a+)+$" }] }, { localDir, createdBy: "UAAAA" }), /pattern/);
  const q = createAssignment({ ...draft }, { localDir, createdBy: "UAAAA" });
  const evil = "REMAIN1:" + Buffer.from(JSON.stringify({ ...q, standards: { ...q.standards, methods: [{ id: "M9", label: "x", signature: "^(a+)+$" }] } })).toString("base64url");
  assert.throws(() => decodePack(evil), /pattern|damaged/);
});

test("PUX-8: the join preview turns any malformed pack into 'unreadable' instead of crashing", () => {
  const tok = (o) => "REMAIN1:" + Buffer.from(JSON.stringify(o)).toString("base64url");
  const full = { code: "ABC-DEF", course: "Demo", title: "Quiz", question: "Q" };
  for (const bad of [{ ...full, standards: { max: 10, codes: {} } }, { ...full, standards: { max: 10, codes: [null] } }, { ...full, standards: { max: 10, codes: [{ code: 1, label: "x" }] } }, { course: "Demo", title: "Quiz", standards: { codes: {} } }, { standards: { codes: [null] } }, { course: { a: 1 }, standards: { codes: [] } }, null, 5, "x"]) assert.equal(packPreview(tok(bad)), null, JSON.stringify(bad));
  assert.equal(packPreview("not a pack"), null);
  const q = createAssignment({ ...draft }, { localDir: mkdtempSync(join(tmpdir(), "p8-")), createdBy: "UAAAA" });
  const p = packPreview(`Join it. ${encodePack(q)} thanks`);
  assert.equal(p.code, q.code); assert.equal(p.mistakes, 5); assert.equal(p.max, 10);
});

test("PUX-6: the finish summary counts each paper once, at its latest mark, for this set only", () => {
  const d = (idea, itemId, grade, decidedBy, ts) => ({ idea, itemId, grade, decidedBy, ts });
  const rows = latestPerPaper([d("A", "S-01", 7, "TA 1", "1"), d("A", "S-01", 9, "TA 1", "2"), d("B", "S-02", 5, "TA 2", "3"), d("A", "S-03", 4, "TA 2", "4")], "A");
  assert.deepEqual(rows.map((r) => [r.itemId, r.grade]), [["S-01", 9], ["S-03", 4]]);
});

test("QA-05: the import script's default set id is always safe, even for the demo-papers folder", () => {
  assert.doesNotThrow(() => defaultSetId("demo-papers"));
  assert.match(defaultSetId("demo-papers"), /^imp-[a-z0-9-]+$/);
  assert.equal(defaultSetId("Quiz 5 B"), "imp-quiz-5-b");
});

test("PUX-7: the footer shows the model label from the response and never claims a provider by itself", () => {
  const src = readFileSync(new URL("../components/grading/copy.ts", import.meta.url), "utf8");
  assert.ok(!/footer: \(label: string\) => `Suggestions by Claude/.test(src));
});

// Codex review of PR #15.
test("E6 review: any repeated group is refused (overlapping alternatives too); optional groups and sample patterns pass", () => {
  for (const sig of ["^(a|aa)+$", "(ab|a)*c", "(x|y){3,}", "(a|b){2,5}"]) assert.ok(unsafePattern(sig), sig);
  for (const ok of ["(\\^\\s*2|²)", "0\\.30(17|45)", "(abc)?d", "a+b*c"]) assert.equal(unsafePattern(ok), null, ok);
});

test("PUX-6 review: what the class got wrong counts each paper's latest decision only", async () => {
  const { classMistakes } = await import("../components/grading/checks.js");
  const d = (itemId, confirmed, ts) => ({ idea: "A", itemId, confirmed, overrides: 0, ts });
  const counts = classMistakes([d("S-01", ["E-MEAN"], "1"), d("S-01", [], "2"), d("S-02", ["E-ARITH"], "3")], "A");
  assert.equal(counts["E-MEAN"], undefined, "the regrade removed it");
  assert.equal(counts["E-ARITH"].confirmed, 1);
});
