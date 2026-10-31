// A Quiz/Assignment is the unit of sharing: one head TA creates it, gets a code, others join. The pack carries it until a server exists.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createAssignment, encodePack, decodePack, joinAssignment, listAssignments, loadAssignment } from "../server/assignment.js";
import { gradeStandards, course } from "./helpers.js";
import { safeSetId } from "../server/ingest.js";
import { assertLogSafe, gateRecord } from "../lib/logshape.js";

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

test("a pasted pack with a code that is not ours is refused before anything is written", () => {
  const b = mkdtempSync(join(tmpdir(), "assignment-b-"));
  const q = createAssignment({ ...draft }, { localDir: mkdtempSync(join(tmpdir(), "assignment-")), createdBy: "U0BA7" });
  const forge = (patch) => "REMAIN1:" + Buffer.from(JSON.stringify({ ...q, ...patch })).toString("base64url");
  assert.throws(() => joinAssignment(forge({ code: "../../x", standards: { ...q.standards, id: "../../x" } }), { localDir: b }), /pack/i);
  assert.throws(() => joinAssignment(forge({ code: "ABC-DEF" }), { localDir: b }), /pack/i, "code must equal the scheme id");
  assert.throws(() => joinAssignment(forge({ code: "abc-def", standards: { ...q.standards, id: "abc-def" } }), { localDir: b }), /pack/i, "one case only");
  assert.deepEqual(listAssignments(b), []);
});

test("the code is used as the set id unchanged, and the log accepts it", () => {
  const q = createAssignment({ ...draft }, { localDir: mkdtempSync(join(tmpdir(), "assignment-")), createdBy: "U0BA7" });
  assert.equal(safeSetId(q.code), q.code, "uppercase survives, so folders, decisions and the scheme all use one form");
  assert.doesNotThrow(() => assertLogSafe(gateRecord(q.code, "U0BA7-P-01", { counts: {}, droppedFields: [], blocked: false, blockedRules: [] }), course));
});

test("changes a joiner proposed stay on their laptop: not in the pack, and kept when the head TA's new version is joined", () => {
  const a = mkdtempSync(join(tmpdir(), "assignment-a-")), b = mkdtempSync(join(tmpdir(), "assignment-b-"));
  const q = createAssignment({ ...draft }, { localDir: a, createdBy: "U0BA7" });
  const joined = joinAssignment(encodePack(q), { localDir: b });
  const pend = [{ code: "E-MEAN", reason: "used the median on purpose", by: "TA 2", itemId: "UB1C2-P-01" }];
  const withPend = { ...joined, standards: { ...joined.standards, pendingPrecedents: pend } };
  assert.ok(!decodePack(encodePack(withPend)).standards.pendingPrecedents, "typed reasons never travel in a pack");
  assert.doesNotThrow(() => joinAssignment(encodePack(q), { localDir: b, force: false }) , "own proposals alone are not a conflict");
  // simulate the joiner's laptop holding proposals, then the head TA shares version 1.1
  joinAssignment(encodePack(q), { localDir: b, force: true });
  writeFileSync(join(b, "assignments", `${q.code}.json`), JSON.stringify(withPend));
  const v11 = joinAssignment(encodePack({ ...q, version: "1.1", standards: { ...q.standards, version: "1.1" } }), { localDir: b, force: true });
  assert.equal(v11.version, "1.1"); assert.deepEqual(v11.standards.pendingPrecedents, pend);
});

test("only the laptop that created a Quiz/Assignment can change its scheme; a joiner can only add proposed changes", async () => {
  const { saveScheme } = await import("../server/assignment.js");
  const a = mkdtempSync(join(tmpdir(), "assignment-a-")), b = mkdtempSync(join(tmpdir(), "assignment-b-"));
  const q = createAssignment({ ...draft }, { localDir: a, createdBy: "U0BA7" });
  joinAssignment(encodePack(q), { localDir: b });
  const edited = { ...q.standards, version: "1.1", max: 12 };
  assert.match(saveScheme(b, edited, "UB1C2").errors.join(), /head TA/);
  assert.equal(loadAssignment(b, q.code).standards.max, 10);
  const pend = [{ code: "E-MEAN", reason: "median on purpose", by: "TA 2", itemId: "UB1C2-P-01" }];
  assert.equal(saveScheme(b, { ...q.standards, pendingPrecedents: pend }, "UB1C2").errors, null);
  assert.deepEqual(loadAssignment(b, q.code).standards.pendingPrecedents, pend);
  assert.equal(saveScheme(a, edited, "U0BA7").errors, null);
  const after = loadAssignment(a, q.code);
  assert.equal(after.version, "1.1"); assert.equal(after.standards.max, 12, "the head TA's edit bumps the version the pack carries");
  assert.match(saveScheme(a, { ...edited, codes: [] }, "U0BA7").errors.join(), /codes/);
});

test("every Quiz/Assignment on this laptop becomes a grading set under its code, titled course · title", async () => {
  const { assignmentSets } = await import("../server/assignment.js");
  const a = mkdtempSync(join(tmpdir(), "assignment-"));
  const q = createAssignment({ ...draft }, { localDir: a, createdBy: "U0BA7" });
  const sets = assignmentSets(a);
  assert.deepEqual(Object.keys(sets), [q.code]);
  assert.equal(sets[q.code].course, "DEMO-STATS 101 · Quiz 5"); assert.equal(sets[q.code].version, "1.0");
});
