// The original paper file is shown beside the extracted text (local only), and a TA can mark a paper by hand when suggestions fail.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { importFolder, originalFile } from "../server/ingest.js";
import { manualRecord } from "../components/grading/manual.js";
import { recordProblem } from "../server/records.js";
import { course, ideas, gradeStandards } from "./helpers.js";

test("the original file of an uploaded paper is found inside its own folder only", async () => {
  const folder = mkdtempSync(join(tmpdir(), "orig-")), localDir = mkdtempSync(join(tmpdir(), "origl-"));
  writeFileSync(join(folder, "alpha.txt"), "Name: Alpha\nSD = 3.162\n");
  const { papers } = await importFolder({ folder, setId: "my-stack", rubricId: "grade-q5", course, localDir, ideaConfig: ideas.grade });
  const f = originalFile(localDir, "my-stack", papers[0].id);
  assert.equal(f.path, join(folder, "alpha.txt")); assert.equal(f.type, "text/plain; charset=utf-8");
  assert.equal(originalFile(localDir, "my-stack", "nope"), null);
  assert.equal(originalFile(localDir, "../x", papers[0].id), null);
  const { readFileSync, writeFileSync: wf } = await import("node:fs");
  const mapFile = join(localDir, "ingest", "my-stack", "map.json"); const m = JSON.parse(readFileSync(mapFile, "utf8"));
  m.map[papers[0].id].file = "../../etc/passwd"; wf(mapFile, JSON.stringify(m));
  assert.equal(originalFile(localDir, "my-stack", papers[0].id), null, "a map entry cannot point outside the folder");
});

test("a hand-marked decision is a normal, valid decision: the TA's mistakes, the scheme's score, the TA's final mark", () => {
  const rec = manualRecord({ idea: "grade", itemId: "S-01", codes: ["E-VAR-SD"], grade: 7, decidedBy: "TA", feedback: "Reported variance.", table: gradeStandards });
  assert.equal(rec.type, "decision"); assert.deepEqual(rec.proposed, []); assert.deepEqual(rec.confirmed, ["E-VAR-SD"]);
  assert.equal(rec.computedScore, 7); assert.equal(rec.grade, 7); assert.equal(rec.rubricVersion, gradeStandards.version);
  assert.equal(recordProblem(rec, ideas), null, "the server's record check accepts it");
  assert.ok(recordProblem({ ...rec, grade: 99 }, ideas), "out-of-range marks are still refused");
});
