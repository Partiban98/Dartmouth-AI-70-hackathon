// Audit S1, E1, E4: what may leave this laptop for a model is checked on the server, against the whole request and this laptop's own known students.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runGate, assertClean } from "../lib/gate.js";
import { importFolder } from "../server/ingest.js";
import { projectPayload, withLocalIdentities, checkOutbound } from "../server/privacy.js";
import { course, ideas, read, gradeStandards } from "./helpers.js";

async function importOne(text) {
  const folder = mkdtempSync(join(tmpdir(), "priv-")), localDir = mkdtempSync(join(tmpdir(), "priv-local-"));
  writeFileSync(join(folder, "paper.txt"), text);
  const { papers } = await importFolder({ folder, setId: "my-stack", rubricId: "grade-q5", course, localDir, ideaConfig: ideas.grade });
  return { paper: papers[0], localDir };
}

test("S1: only the idea's allowlisted fields, with plain types, may be sent to a model", () => {
  assert.deepEqual(projectPayload({ steps: ["a", "b"], finalAnswer: 3.162 }, ideas.grade), { steps: ["a", "b"], finalAnswer: 3.162 });
  assert.deepEqual(projectPayload({ steps: [], finalAnswer: null }, ideas.grade), { steps: [], finalAnswer: null });
  assert.throws(() => projectPayload({ steps: ["3.162"], finalAnswer: 3.162, studentid: 123456789 }, ideas.grade), (e) => e.status === 400 && /studentid/.test(e.error));
  assert.throws(() => projectPayload({ steps: ["3.162"], finalAnswer: 3.162, gradingTable: { points: 8 } }, ideas.grade), (e) => e.status === 400);
  assert.throws(() => projectPayload({ steps: [{ x: 1 }], finalAnswer: 3 }, ideas.grade), (e) => e.status === 400);
  assert.throws(() => projectPayload({ steps: "3.162", finalAnswer: { n: 1 } }, ideas.grade), (e) => e.status === 400);
  assert.throws(() => projectPayload(null, ideas.grade), (e) => e.status === 400);
  const dana = read("upskill-dana-task.json");
  assert.doesNotThrow(() => projectPayload({ text: dana.text, facts: dana.facts, draft: "x" }, ideas.upskill), "flat fact tables still pass");
});

test("E1: a name, NetID, email or student ID this laptop imported is blocked before any model call, even in another script or case", async () => {
  const { paper, localDir } = await importOne("Name: 王伟\nNetID: ww42zz\nEmail: wang.wei@example.org\nStudent ID: 123456789\n王伟 ww42zz 123456789 calculated 320 / 10\nwang.wei@example.org checked it\n3.162\n");
  const gate = runGate(paper, ideas.grade, course);
  assert.equal(gate.blocked, false);
  assert.doesNotThrow(() => assertClean(gate.payload, course), "the seeded roster alone misses them: this is the gap");
  const local = withLocalIdentities(course, localDir);
  const send = (payload) => checkOutbound({ idea: "grade", itemId: "S-01", payload }, ideas.grade, local);
  assert.throws(() => send(gate.payload), (e) => e.status === 422);
  for (const step of ["王伟 did it", "ww42zz did it", "student 123456789", "wang.wei@example.org"]) assert.throws(() => send({ steps: [step], finalAnswer: 1 }), (e) => e.status === 422, step);
  const lower = await importOne("Name: Lucia Moreau\nSD = 3.162\n");
  assert.throws(() => checkOutbound({ idea: "grade", payload: { steps: ["lucia moreau checked"], finalAnswer: 1 } }, ideas.grade, withLocalIdentities(course, lower.localDir)), (e) => e.status === 422, "lowercased full name");
});

test("E1: every sample paper still passes with this laptop's identities added, so grading the samples is unchanged", async () => {
  const { localDir } = await importOne("Name: Li Wu\nNetID: lw42ab\nSD = 3.162\n");
  for (const f of ["demo-papers"]) readdirSync(f); // demo folder exists
  const local = withLocalIdentities(course, localDir);
  for (const [file, idea] of [["grade-q5.submissions.json", ideas.grade], ["demo201-q3q5.submissions.json", ideas.grade]]) {
    for (const p of read(file)) {
      const g = runGate(p, idea, course);
      if (g.blocked || g.flags.length) continue;
      assert.doesNotThrow(() => checkOutbound({ idea: "grade", itemId: p.id, payload: g.payload }, idea, local), `${file} ${p.id}`);
    }
  }
});

test("E4: the question and mistake labels sent with a paper are checked too; ordinary statistics wording passes", async () => {
  const { localDir } = await importOne("Name: 王伟\nSD = 3.162\n");
  const local = withLocalIdentities(course, localDir);
  const r = course.roster[0];
  const withQ = (question, label) => ({ ...ideas.grade, standards: { ...gradeStandards, question, codes: gradeStandards.codes.map((c) => (c.code === "E-MEAN" ? { ...c, label } : c)) } });
  const body = { idea: "grade", itemId: "S-01", payload: { steps: ["SD = 3.162"], finalAnswer: 3.162 } };
  assert.doesNotThrow(() => checkOutbound(body, ideas.grade, local), "the sample scheme passes");
  assert.doesNotThrow(() => checkOutbound(body, withQ("Find the Mean Absolute Deviation of Quiz Scores.", "Used Mean Absolute Deviation"), local), "capitalised statistics terms are fine in scheme text");
  assert.throws(() => checkOutbound(body, withQ(`Student ${r.name} (${r.email}) collected this sample`, "Mean wrong"), local), (e) => e.status === 422);
  assert.throws(() => checkOutbound(body, withQ(gradeStandards.question, "王伟 used the median"), local), (e) => e.status === 422);
  assert.throws(() => checkOutbound({ ...body, payload: { ...body.payload, sid: 1 } }, ideas.grade, local), (e) => e.status === 400);
  const demo201 = read("demo201-q3q5.v1.0.json");
  assert.doesNotThrow(() => checkOutbound(body, { ...ideas.grade, standards: demo201 }, local), "the second sample scheme passes");
});

test("S1/E1 at the route: a forged field or a known imported student makes zero model calls and leaves no value in any log", async () => {
  const { createApp } = await import("../legacy/server.js");
  const localDir = mkdtempSync(join(tmpdir(), "priv-srv-")), folder = mkdtempSync(join(tmpdir(), "priv-f-"));
  writeFileSync(join(folder, "p.txt"), "Name: 王伟\nNetID: ww42zz\nSD = 3.162\n");
  await importFolder({ folder, setId: "my-stack", rubricId: "grade-q5", course, localDir, ideaConfig: ideas.grade });
  let calls = 0;
  const server = createApp({ env: {}, fetchImpl: () => { calls++; throw new Error("no network in tests"); }, localDir });
  await new Promise((ok) => server.listen(0, ok));
  const base = `http://localhost:${server.address().port}`;
  const post = (payload) => fetch(`${base}/propose`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ idea: "grade", itemId: "S-01", payload }) });
  try {
    const forged = await post({ steps: ["SD = 3.162"], finalAnswer: 3.162, studentid: 123456789 });
    assert.equal(forged.status, 400);
    const known = await post({ steps: ["王伟 got 3.162", "ww42zz"], finalAnswer: 3.162 });
    assert.equal(known.status, 422); assert.equal((await known.json()).rule, "R-09");
    assert.equal(calls, 0, "nothing reached the provider");
    const { readFileSync, statSync } = await import("node:fs");
    for (const f of readdirSync(localDir)) if (statSync(join(localDir, f)).isFile()) assert.ok(!/王伟|ww42zz|123456789/.test(readFileSync(join(localDir, f), "utf8")), f);
  } finally { server.close(); }
});

test("E4 at the source: a scheme naming a known student or holding an identifier gets a plain message; the sample schemes get none", async () => {
  const { schemeProblem } = await import("../server/privacy.js");
  const r = course.roster[0];
  assert.equal(schemeProblem(gradeStandards, course), null);
  assert.equal(schemeProblem(read("demo201-q3q5.v1.0.json"), course), null);
  assert.match(schemeProblem({ ...gradeStandards, question: `Ask ${r.name} for help` }, course), /student's name/);
  assert.match(schemeProblem({ ...gradeStandards, question: "Email test@example.org" }, course), /identifier/);
});

// Codex review of PR #8: every variant of a known identity, in every part of what is sent, logged or shared.
test("E1 review: capitals, short NetIDs, first names and a numeric final answer are all caught; ordinary words are not", async () => {
  const { localDir } = await importOne("Name: Lucia Moreau\nNetID: lw42\nStudent ID: 123456789\nSD = 3.162\n");
  const local = withLocalIdentities(course, localDir);
  const body = (payload) => ({ idea: "grade", itemId: "S-01", payload });
  for (const steps of [["LUCIA MOREAU did it"], ["lw42 did it"], ["see LW42"], ["Nice work, Lucia"], ["moreau's answer"]]) assert.throws(() => checkOutbound(body({ steps, finalAnswer: 3.162 }), ideas.grade, local), (e) => e.status === 422, steps[0]);
  assert.throws(() => checkOutbound(body({ steps: ["SD = 3.162"], finalAnswer: 123456789 }), ideas.grade, local), (e) => e.status === 422, "numeric student ID");
  assert.doesNotThrow(() => checkOutbound(body({ steps: ["Lucidly, the limit is 3.162", "lw420 is not an id"], finalAnswer: 3.162 }), ideas.grade, local), "whole words only");
});

test("S1/E4 review: mistake code ids and fact-table keys are checked like everything else sent", async () => {
  const { localDir } = await importOne("Name: Lucia Moreau\nNetID: lw42\nSD = 3.162\n");
  const local = withLocalIdentities(course, localDir);
  const body = { idea: "grade", itemId: "S-01", payload: { steps: ["SD = 3.162"], finalAnswer: 3.162 } };
  const withCode = (code) => ({ ...ideas.grade, standards: { ...gradeStandards, codes: gradeStandards.codes.map((c) => (c.code === "E-MEAN" ? { ...c, code } : c)), answerRules: [] } });
  assert.throws(() => checkOutbound(body, withCode("lw42"), local), (e) => e.status === 422);
  assert.throws(() => checkOutbound(body, withCode("LW42"), local), (e) => e.status === 422);
  assert.throws(() => checkOutbound({ idea: "upskill", payload: { text: "draft notes", facts: { "person@example.org": "x" }, draft: "d" } }, ideas.upskill, local), (e) => e.status === 422);
  assert.doesNotThrow(() => checkOutbound({ idea: "upskill", payload: { text: "Send the summary by the end of the week.", facts: { due: "Friday" }, draft: "d" } }, ideas.upskill, course), "plain fact keys pass");
});

test("E1 review: a log record naming a known student in any case is refused; the deciding grader's own name is allowed", async () => {
  const { logProblem } = await import("../server/privacy.js");
  const { localDir } = await importOne("Name: Lucia Moreau\nNetID: lw42\nSD = 3.162\n");
  const local = withLocalIdentities(course, localDir);
  const rec = { type: "decision", idea: "grade", itemId: "S-01", decidedBy: "Lucia", confirmed: [], overrides: [], grade: 10, feedback: "Full marks." };
  assert.equal(logProblem(rec, local), null, "a grader may share a first name with a student");
  assert.ok(logProblem({ ...rec, feedback: "LUCIA did well" }, local));
  assert.ok(logProblem({ ...rec, overrides: [{ from: "E-MEAN", to: "OK", reason: "ask lw42" }] }, local));
});

test("E4 review: every shared field of a pack is checked, including the outer question, course and title", async () => {
  const { packProblem } = await import("../server/privacy.js");
  const { createAssignment } = await import("../server/assignment.js");
  const { localDir } = await importOne("Name: Lucia Moreau\nSD = 3.162\n");
  const local = withLocalIdentities(course, localDir);
  const a = createAssignment({ course: "DEMO-STATS 101", title: "Quiz 5", question: gradeStandards.question, max: 10, codes: gradeStandards.codes, methods: gradeStandards.methods, answerRules: gradeStandards.answerRules }, { localDir: mkdtempSync(join(tmpdir(), "pk-")), createdBy: "UAAAA" });
  assert.equal(packProblem(a, local), null);
  for (const patch of [{ question: "Lucia Moreau" }, { course: "Moreau section" }, { title: "Quiz for lucia" }]) assert.ok(packProblem({ ...a, ...patch }, local), JSON.stringify(patch));
});

// Codex re-review of PR #8.
test("E1 re-review: a one-character name and a four-digit student ID are known too; small numbers in maths are not", async () => {
  const { localDir } = await importOne("Name: 王\nStudent ID: 1234\nSD = 3.162\n");
  const local = withLocalIdentities(course, localDir);
  const send = (steps, finalAnswer = 3.162) => checkOutbound({ idea: "grade", payload: { steps, finalAnswer } }, ideas.grade, local);
  assert.throws(() => send(["王 did it"]), (e) => e.status === 422);
  assert.throws(() => send(["id 1234"]), (e) => e.status === 422);
  assert.throws(() => send(["SD = 3.162"], 1234), (e) => e.status === 422);
  assert.doesNotThrow(() => send(["Quiz scores: 4, 6, 8, 10, 12", "12345 is not this id"]));
});

test("E4 re-review: every field a pack shares is checked, including method labels and answer-rule notes; local-only notes are not shared so not checked", async () => {
  const { packProblem } = await import("../server/privacy.js");
  const { createAssignment } = await import("../server/assignment.js");
  const a = createAssignment({ course: "DEMO-STATS 101", title: "Quiz 5", question: gradeStandards.question, max: 10, codes: gradeStandards.codes, methods: gradeStandards.methods, answerRules: gradeStandards.answerRules }, { localDir: mkdtempSync(join(tmpdir(), "pk2-")), createdBy: "UAAAA" });
  const st = a.standards;
  assert.ok(packProblem({ ...a, standards: { ...st, methods: [{ ...st.methods[0], label: "ask learner@example.edu" }] } }, course));
  assert.ok(packProblem({ ...a, standards: { ...st, answerRules: [{ ...st.answerRules[0], note: "learner@example.edu" }] } }, course));
  assert.equal(packProblem({ ...a, standards: { ...st, pendingPrecedents: [{ code: "E-MEAN", reason: "learner@example.edu" }] } }, course), null, "pending reasons never travel in a pack");
});

test("E4 create review: the create route checks the whole draft as it will be shared, before the first save", async () => {
  const { draftProblem } = await import("../server/privacy.js");
  const draft = { course: "DEMO-STATS 101", title: "Quiz 5", question: gradeStandards.question, max: 10, codes: gradeStandards.codes, methods: gradeStandards.methods, answerRules: gradeStandards.answerRules };
  assert.equal(draftProblem(draft, course), null);
  assert.ok(draftProblem({ ...draft, methods: [{ ...draft.methods[0], label: "ask learner@example.edu" }] }, course), "method label");
  assert.ok(draftProblem({ ...draft, answerRules: [{ ...draft.answerRules[0], note: "learner@example.edu" }] }, course), "answer-rule note");
  const src = readFileSync(new URL("../app/api/assignment/route.ts", import.meta.url), "utf8");
  assert.match(src.split("export async function POST")[1].split("createAssignment(")[0], /draftProblem\(draft/, "the route checks the draft before createAssignment saves it");
});

test("E1 final review: every full imported name and ID counts at any length; only split name words need two letters", async () => {
  const { localDir } = await importOne("Name: Q\nStudent ID: 123\nSD = 3.162\n");
  const local = withLocalIdentities(course, localDir);
  const send = (steps, finalAnswer = 3.162) => checkOutbound({ idea: "grade", payload: { steps, finalAnswer } }, ideas.grade, local);
  assert.throws(() => send(["Q wrote this"]), (e) => e.status === 422);
  assert.throws(() => send(["student 123 wrote this"]), (e) => e.status === 422);
  assert.throws(() => send(["SD = 3.162"], 123), (e) => e.status === 422, "an exact known id fails closed even as a number");
  assert.doesNotThrow(() => send(["Quiz scores: 4, 6, 8, 10, 12", "1234 is not this id"]), "other numbers are fine");
  const two = await importOne("Name: Li Wu\nSD = 3.162\n");
  assert.doesNotThrow(() => checkOutbound({ idea: "grade", payload: { steps: ["a b c"], finalAnswer: 1 } }, ideas.grade, withLocalIdentities(course, two.localDir)), "single letters inside text are not name words");
});

test("E1 filename fallback: course and quiz words from a filename-derived name are not identities, and a record's own ids are not free text", async () => {
  const { logProblem } = await import("../server/privacy.js");
  const folder = mkdtempSync(join(tmpdir(), "fn-")), localDir = mkdtempSync(join(tmpdir(), "fnl-"));
  writeFileSync(join(folder, "(1027ABC) Ada Byron- DEMO-STATS 101 - Quiz 3 - Prof Smith.txt"), "SD = 3.162\n");
  await importFolder({ folder, setId: "demo-stats-101-quiz-3", rubricId: "grade-q5", course, localDir, ideaConfig: ideas.grade, title: "DEMO-STATS 101 Quiz 3" });
  const local = withLocalIdentities(course, localDir);
  const rec = { type: "decision", idea: "demo-stats-101-quiz-3", itemId: "U1-P-01", decidedBy: "TA", proposed: [], confirmed: ["E-MEAN"], overrides: [], grade: 7, feedback: "Marks lost: wrong tail.", rubricVersion: "1.0" };
  assert.equal(logProblem(rec, local), null, "the set id and a plain note are fine");
  assert.equal(logProblem({ ...rec, feedback: "Quiz 3 was hard; see the stats notes" }, local), null, "course words are not names");
  assert.ok(logProblem({ ...rec, feedback: "Ada did well" }, local), "the real name word is still caught");
  assert.ok(logProblem({ ...rec, feedback: "ask 1027ABC" }, local), "the id token is still caught");
  assert.doesNotThrow(() => checkOutbound({ idea: "grade", payload: { steps: ["Quiz 3: SD = 3.162"], finalAnswer: 3.162 } }, ideas.grade, local));
});

test("E1 scope: a set title can never suppress a real roster or header name; only filename-derived names lose course words", async () => {
  const { logProblem } = await import("../server/privacy.js");
  const folder = mkdtempSync(join(tmpdir(), "sc-")), localDir = mkdtempSync(join(tmpdir(), "scl-"));
  writeFileSync(join(folder, "p1.txt"), "Name: Lucia Moreau\nSD = 3.162\n");
  await importFolder({ folder, setId: "lucia-section", rubricId: "grade-q5", course, localDir, ideaConfig: ideas.grade, title: "Lucia section" });
  const local = withLocalIdentities(course, localDir);
  assert.throws(() => checkOutbound({ idea: "grade", payload: { steps: ["lucia checked it"], finalAnswer: 3.162 } }, ideas.grade, local), (e) => e.status === 422, "header name word stays an identity despite the title");
  const r = course.roster[0];
  assert.ok(logProblem({ type: "decision", idea: "grade", itemId: r.name, decidedBy: "TA", proposed: [], confirmed: [], overrides: [], grade: 7, feedback: "ok" }, local), "an itemId carrying a name is still caught");
});
