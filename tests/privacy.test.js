// Audit S1, E1, E4: what may leave this laptop for a model is checked on the server, against the whole request and this laptop's own known students.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readdirSync } from "node:fs";
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
  assert.throws(() => assertClean(gate.payload, local), (e) => e.status === 422);
  for (const step of ["王伟 did it", "ww42zz did it", "student 123456789", "wang.wei@example.org"]) assert.throws(() => assertClean({ steps: [step], finalAnswer: 1 }, local), (e) => e.status === 422, step);
  const lower = await importOne("Name: Lucia Moreau\nSD = 3.162\n");
  assert.throws(() => assertClean({ steps: ["lucia moreau checked"], finalAnswer: 1 }, withLocalIdentities(course, lower.localDir)), (e) => e.status === 422, "lowercased full name");
});

test("E1: every sample paper still passes with this laptop's identities added, so grading the samples is unchanged", async () => {
  const { localDir } = await importOne("Name: Li Wu\nNetID: lw42ab\nSD = 3.162\n");
  for (const f of ["demo-papers"]) readdirSync(f); // demo folder exists
  const local = withLocalIdentities(course, localDir);
  for (const [file, idea] of [["grade-q5.submissions.json", ideas.grade], ["demo201-q3q5.submissions.json", ideas.grade]]) {
    for (const p of read(file)) {
      const g = runGate(p, idea, course);
      if (g.blocked || g.flags.length) continue;
      assert.doesNotThrow(() => assertClean(g.payload, local), `${file} ${p.id}`);
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
