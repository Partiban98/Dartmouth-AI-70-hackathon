import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { importFolder, parsePaper, rosterFromCsv, exportCsv, loadMap, loadImported } from "../server/ingest.js";
import { runGate, assertClean } from "../lib/gate.js";
import { course, ideas, sub } from "./helpers.js";

const r4 = course.roster[3];
test("parsePaper splits header fields from steps and takes the last number as the final answer", () => {
  const p = parsePaper(`Name: ${r4.name}\nNetID: ${r4.netid}\n\nMean = 40 / 5 = 8\nSD = 10\n`, "x.txt");
  assert.equal(p.header.name, r4.name); assert.equal(p.header.netid, r4.netid);
  assert.deepEqual(p.steps, ["Mean = 40 / 5 = 8", "SD = 10"]); assert.equal(p.finalAnswer, 10);
  assert.equal(parsePaper("SD = 10", "Priya_Raman_quiz5.txt").header.name, "Priya Raman quiz5");
});

test("importFolder: names go to the local map only; the gate payload and the sent text carry ids and aliases only", async () => {
  const folder = mkdtempSync(join(tmpdir(), "papers-")); const localDir = mkdtempSync(join(tmpdir(), "local-"));
  const s12 = sub("S-12");
  writeFileSync(join(folder, `${r4.name.replace(" ", "_")}.txt`), `Name: ${r4.name}\nEmail: ${r4.email}\n${s12.steps.join("\n")}\n`);
  writeFileSync(join(folder, "second.txt"), `Name: ${course.roster[0].name}\n${sub("S-01").steps.join("\n")}\n`);
  const { papers, report } = await importFolder({ folder, setId: "t-set", rubricId: "grade-q5", course, localDir, ideaConfig: ideas.grade });
  assert.equal(papers.length, 2);
  const map = loadMap(localDir, "t-set");
  assert.equal(map["P-01"].name, r4.name);
  for (const p of papers) {
    const g = runGate(p, ideas.grade, course);
    assert.equal(g.blocked, false, p.id);
    assertClean(g.payload, course);
    const sent = JSON.stringify({ itemId: p.id, payload: g.payload });
    for (const e of course.roster) assert.ok(!sent.includes(e.name), `${p.id} would send a name`);
    assert.ok(!sent.includes("@example.org"));
  }
  assert.equal(report[0].counts.NAME, 1, "S-12 probe name inside the steps is aliased and counted");
  assert.ok(existsSync(join(localDir, "ingest", "t-set", "map.json")));
  assert.equal(loadImported(localDir, "t-set").meta.rubric, "grade-q5");
});

test("rosterFromCsv assigns S-nn aliases in row order", () => {
  const r = rosterFromCsv("name,email,netid,studentId\nAda Byron,ada@example.org,demo-adabyr,900199999\nBob Lin,,,\n");
  assert.deepEqual(r.map((x) => [x.alias, x.name]), [["S-01", "Ada Byron"], ["S-02", "Bob Lin"]]);
});

test("exportCsv re-attaches names from the local map and joins proposals with the latest decision", () => {
  const papers = [{ id: "P-01" }, { id: "P-02" }];
  const map = { "P-01": { file: "a.txt", name: "Ada Byron" }, "P-02": { file: "b.txt", name: "Bob, Lin" } };
  const logs = {
    proposals: [{ idea: "t", itemId: "P-01", modelId: "m-1", proposals: [{ code: "E-VAR-SD" }] }],
    decisions: [{ idea: "t", itemId: "P-01", confirmed: ["E-VAR-SD"], overrides: [], computedScore: 7, grade: 7, decidedBy: "TA", feedback: "Marks lost: Reported variance as SD.", rubricVersion: "1.0", ts: "t1" }, { idea: "other", itemId: "P-02", confirmed: [], overrides: [], grade: 10, decidedBy: "x" }],
  };
  const csv = exportCsv({ setId: "t", papers, map, logs, table: { version: "1.0" } });
  const lines = csv.trim().split("\n");
  assert.equal(lines[0].split(",")[2], "student");
  assert.ok(lines[1].startsWith("P-01,a.txt,Ada Byron,E-VAR-SD,m-1,E-VAR-SD,,7,7,TA,"));
  assert.ok(lines[2].startsWith('P-02,b.txt,"Bob, Lin",,,,,,,,'), "other set's decision must not leak in");
});

test("safeSetId rejects a set id that looks like an identifier, since it would be refused by the log and could leak", async () => {
  const { safeSetId } = await import("../server/ingest.js");
  assert.throws(() => safeSetId("demo-folder"), /R-04/);
  assert.equal(safeSetId("someone@example.org"), "someone-example-org", "punctuation is stripped before the identifier check");
  assert.equal(safeSetId("Quiz 5 Section B"), "quiz-5-section-b");
  assert.equal(safeSetId("imp-quiz5-papers"), "imp-quiz5-papers");
  assert.throws(() => safeSetId("imp-demo-papers"), /R-04/, "demo- plus six letters is the NetID shape, so the CLI must refuse it");
});
