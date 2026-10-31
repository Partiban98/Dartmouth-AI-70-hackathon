import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { makeSideLog } from "../server/sidelog.js";
import { makeEvalCases } from "../server/evalcases.js";
import { makePrecall } from "../server/precall.js";
import { makeStudent } from "../server/student.js";
import { importFolder } from "../server/ingest.js";
import { course, ideas } from "./helpers.js";

const fresh = (t) => { const dir = mkdtempSync(join(tmpdir(), "remain-side-")); t.after(() => rmSync(dir, { recursive: true, force: true })); return dir; };
const call = { ts: "2026-10-31T12:00:00Z", kind: "precall", idea: "grade", itemId: "S-01", code: "OK", by: "A. Grader", session: "s1" };

test("side stores reject imported identities after construction, in every case, script and numeric value", async (t) => {
  const localDir = fresh(t), log = makeSideLog(localDir, course);
  const folder = join(localDir, "papers"); mkdirSync(folder);
  writeFileSync(join(folder, "one.txt"), "Name: 王伟\nStudent ID: 123456789\nNetID: ww42\nSD = 3.162");
  writeFileSync(join(folder, "two.txt"), "Name: María Nguyen\nStudent ID: 876543210\nNetID: mn21\nSD = 3.162");
  await importFolder({ folder, setId: "exam", rubricId: "grade-q5", course, localDir, ideaConfig: ideas.grade });
  for (const by of ["王伟", "王伟 wrote", "MARÍA NGUYEN", "nguyen", "WW42", "123456789", 123456789, { "王伟": "x" }]) {
    assert.throws(() => log.append("precalls", { ...call, by }), /identity|shape/i, `must refuse ${typeof by}`);
  }
  assert.equal(log.read("precalls").length, 0);
  assert.doesNotThrow(() => log.append("precalls", { ...call, by: "K. Grader" }));
  assert.equal(log.read("precalls").length, 1);
});

test("all three new stores reject known imported names in their typed notes", async (t) => {
  const localDir = fresh(t), folder = join(localDir, "papers"); mkdirSync(folder);
  writeFileSync(join(folder, "paper.txt"), "Name: 王伟\nStudent ID: 123456789\nNetID: ww42\ns = 3.162");
  await importFolder({ folder, setId: "exam", rubricId: "grade-q5", course, localDir, ideaConfig: ideas.grade });
  const cases = makeEvalCases({ localDir, course });
  const precalls = makePrecall({ localDir, course });
  const student = makeStudent({ localDir, course, decisions: () => [{ type: "decision", idea: "grade", itemId: "S-01", grade: 8 }], standardsOf: () => null, paperOf: () => null });
  assert.equal(cases.add({ idea: "grade", itemId: "S-01", aiCode: "E-ARITH", taRuling: "OK", reason: "王伟 uses another method", text: "s = 3.162" }).status, 400);
  assert.equal(precalls.add({ idea: "grade", itemId: "S-01", code: "OK", by: "WW42", session: "s1" }).status, 400);
  assert.equal(student.addRegrade({ anonId: "S-01", questionId: "grade", text: "Student 123456789 asks for this marking to be checked." }).status, 400);
  assert.equal(cases.list().length + precalls.list().length + student.requests().length, 0);
});

test("side records cannot smuggle fields or write through a different file name", (t) => {
  const log = makeSideLog(fresh(t), course);
  for (const extra of [{ map: { anonymous: "private work" } }, { by: { arbitrary: "private work" } }, { kind: "decision" }]) {
    assert.throws(() => log.append("precalls", { ...call, ...extra }), /shape|kind/i);
  }
  assert.throws(() => log.append("../outside", call), /file/i);
  assert.throws(() => log.append("eval-runs", call), /kind/i);
});

test("one damaged side-log line does not erase earlier or later valid records", (t) => {
  const localDir = fresh(t), log = makeSideLog(localDir, course);
  log.append("precalls", call);
  const p = join(localDir, "precalls.jsonl");
  writeFileSync(p, readFileSync(p, "utf8") + '{incomplete\n' + JSON.stringify({ ...call, itemId: "S-02" }) + '\n');
  assert.deepEqual(log.read("precalls").map((r) => r.itemId), ["S-01", "S-02"]);
});
