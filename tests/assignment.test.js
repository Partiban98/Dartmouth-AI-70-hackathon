// A Quiz/Assignment is the unit of sharing: one head TA creates it, gets a code, others join. The pack carries it until a server exists.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createAssignment, encodePack, decodePack, joinAssignment, listAssignments, loadAssignment } from "../server/assignment.js";
import { gradeStandards } from "./helpers.js";

const draft = { course: "DEMO-STATS 101", title: "Quiz 5", question: gradeStandards.question, max: 10, codes: gradeStandards.codes, methods: gradeStandards.methods, answerRules: gradeStandards.answerRules, correctAnswer: gradeStandards.correctAnswer, tolerance: gradeStandards.tolerance };

test("createAssignment validates the scheme, assigns a short shareable code, and saves it on this laptop", () => {
  const localDir = mkdtempSync(join(tmpdir(), "assignment-"));
  const q = createAssignment({ ...draft }, { localDir, createdBy: "U0BA7" });
  assert.match(q.code, /^[A-Z0-9]{3}-[A-Z0-9]{3}$/, "six characters in two groups, as decision 5 says");
  assert.ok(!/[O0I1L]/.test(q.code.replace(/-/g, "")), "no O, 0, I, 1, L in codes");
  assert.equal(q.standards.id, q.code, "the code is the scheme id and the set id");
  assert.equal(q.standards.max, 10); assert.equal(q.standards.status, "approved"); assert.equal(q.createdBy, "U0BA7"); assert.equal(q.version, "1.0");
  assert.equal(loadAssignment(localDir, q.code).code, q.code);
  assert.throws(() => createAssignment({ ...draft, codes: draft.codes.map((c) => c.code === "E-MEAN" ? { ...c, deduction: 2 } : c) }, { localDir, createdBy: "U0BA7" }), /deduction/);
});

test("a pack round-trips the whole assignment and joinAssignment saves it unchanged under the same code", () => {
  const a = mkdtempSync(join(tmpdir(), "assignment-a-")), b = mkdtempSync(join(tmpdir(), "assignment-b-"));
  const q = createAssignment({ ...draft }, { localDir: a, createdBy: "U0BA7" });
  const pack = encodePack(q);
  assert.ok(pack.startsWith("REMAIN1:"));
  assert.ok(!/\s/.test(pack), "one token, safe to paste into chat");
  assert.deepEqual(decodePack(pack), q);
  const joined = joinAssignment(pack, { localDir: b });
  assert.equal(joined.code, q.code); assert.deepEqual(loadAssignment(b, q.code).standards, q.standards);
  assert.deepEqual(listAssignments(b).map((x) => x.code), [q.code]);
  assert.throws(() => joinAssignment("REMAIN1:notbase64!!", { localDir: b }), /pack/i);
  assert.throws(() => decodePack(pack.replace("REMAIN1:", "REMAIN9:")), /version/i);
  assert.throws(() => decodePack("hello there"), /pack/i);
});

test("joining a different scheme under a code already on this laptop is refused unless forced", () => {
  const a = mkdtempSync(join(tmpdir(), "assignment-a-")), b = mkdtempSync(join(tmpdir(), "assignment-b-"));
  const q = createAssignment({ ...draft }, { localDir: a, createdBy: "U0BA7" });
  joinAssignment(encodePack(q), { localDir: b });
  assert.doesNotThrow(() => joinAssignment(encodePack(q), { localDir: b }), "the same pack twice is harmless");
  const changed = { ...q, version: "1.1", standards: { ...q.standards, version: "1.1", max: 12 } };
  assert.throws(() => joinAssignment(encodePack(changed), { localDir: b }), /already/i);
  assert.equal(loadAssignment(b, q.code).standards.max, 10, "nothing overwritten");
  assert.equal(joinAssignment(encodePack(changed), { localDir: b, force: true }).standards.max, 12);
});

test("the pack never carries papers, names, or the id-to-name map", () => {
  const localDir = mkdtempSync(join(tmpdir(), "assignment-"));
  const q = createAssignment({ ...draft, papers: [{ id: "x" }], map: { x: "Priya" } }, { localDir, createdBy: "U0BA7" });
  const pack = decodePack(encodePack(q));
  assert.ok(!("papers" in pack) && !("map" in pack) && !("papers" in pack.standards) && !("map" in pack.standards));
  assert.ok(!encodePack(q).includes("U0BA7-P"), "no paper ids either");
});
