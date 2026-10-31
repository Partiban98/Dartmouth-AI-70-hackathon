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
  const p01 = Object.keys(map).find((k) => k.endsWith("-P-01"));
  assert.match(p01, /^U[0-9A-F]{4}-P-01$/, "ids carry this laptop's uploader id");
  assert.equal(map[p01].name, r4.name);
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

test("a Quiz/Assignment CSV adds assignment, laptop and proposed change, and leaves names and file names out unless asked", () => {
  const papers = [{ id: "UB1C2-P-01", uploader: "UB1C2" }, { id: "UB1C2-P-02", uploader: "UB1C2" }];
  const map = { "UB1C2-P-01": { file: "Ada_Byron.txt", name: "Ada Byron" }, "UB1C2-P-02": { file: "b.txt", name: "Bob Lin" } };
  const logs = { decisions: [{ idea: "7K3-Q2M", itemId: "UB1C2-P-01", confirmed: [], overrides: [{ from: "E-MEAN", to: "OK" }], grade: 10, decidedBy: "TA 2", rubricVersion: "1.1", ts: "t1" }] };
  const table = { version: "1.1", pendingPrecedents: [{ code: "E-MEAN", reason: "median on purpose", itemId: "UB1C2-P-01" }] };
  const shared = exportCsv({ setId: "7K3-Q2M", papers, map, logs, table, assignment: "7K3-Q2M" }).trim().split("\n");
  const head = shared[0].split(",");
  assert.deepEqual(head.slice(-3), ["assignment", "laptop", "proposed_change"]);
  assert.ok(!shared.join("\n").includes("Ada") && !shared.join("\n").includes("Bob"), "no names, no file names by default");
  const row = shared[1].split(",");
  assert.equal(row[head.indexOf("rubric_version")], "1.1"); assert.equal(row[head.indexOf("assignment")], "7K3-Q2M");
  assert.equal(row[head.indexOf("laptop")], "UB1C2"); assert.equal(row[head.indexOf("proposed_change")], "E-MEAN: median on purpose");
  const owner = exportCsv({ setId: "7K3-Q2M", papers, map, logs, table, assignment: "7K3-Q2M", names: true });
  assert.ok(owner.includes("Ada Byron") && owner.includes("Ada_Byron.txt"), "the laptop that owns the map can ask for names");
});

test("the shared Quiz/Assignment CSV scrubs student names and identifiers a TA typed into the note or the proposed change", () => {
  const papers = [{ id: "UB1C2-P-01", uploader: "UB1C2" }];
  const map = { "UB1C2-P-01": { file: "Lucia_Moreau.txt", name: "Lucia Moreau" } };
  const logs = { decisions: [{ idea: "7K3-Q2M", itemId: "UB1C2-P-01", confirmed: [], overrides: [], grade: 10, decidedBy: "TA 2", feedback: "Nice work, lucia. Email lucia@example.edu if stuck.", rubricVersion: "1.0", ts: "t1" }] };
  const table = { version: "1.0", pendingPrecedents: [{ code: "E-MEAN", reason: "Moreau used the median on purpose", itemId: "UB1C2-P-01" }] };
  const shared = exportCsv({ setId: "7K3-Q2M", papers, map, logs, table, assignment: "7K3-Q2M" });
  assert.ok(!/lucia|moreau|example\.edu/i.test(shared), shared);
  assert.ok(shared.includes("Nice work, [student]") && shared.includes("[student] used the median"), "the rest of the note still reads");
  const owner = exportCsv({ setId: "7K3-Q2M", papers, map, logs, table, assignment: "7K3-Q2M", names: true });
  assert.ok(owner.includes("Nice work, lucia"), "the owner's file keeps the note as typed");
});

test("safeSetId rejects a set id that looks like an identifier, since it would be refused by the log and could leak", async () => {
  const { safeSetId } = await import("../server/ingest.js");
  assert.throws(() => safeSetId("demo-folder"), /R-04/);
  assert.equal(safeSetId("someone@example.org"), "someone-example-org", "punctuation is stripped before the identifier check");
  assert.equal(safeSetId("Quiz 5 Section B"), "quiz-5-section-b");
  assert.equal(safeSetId("imp-quiz5-papers"), "imp-quiz5-papers");
  assert.throws(() => safeSetId("imp-demo-papers"), /R-04/, "demo- plus six letters is the NetID shape, so the CLI must refuse it");
});

test("importUploads writes the chosen files to a local folder and imports them as a set with a local-only name map", async () => {
  const { importUploads } = await import("../server/ingest.js");
  const localDir = mkdtempSync(join(tmpdir(), "local-up-"));
  const files = [
    { name: "Priya_Raman_quiz5.txt", bytes: Buffer.from(`Name: ${r4.name}\n${sub("S-12").steps.join("\n")}\n`) },
    { name: "second paper.txt", bytes: Buffer.from(`Name: ${course.roster[0].name}\nSD = 10\n`) },
    { name: "notes.exe", bytes: Buffer.from("ignored") },
  ];
  const r = await importUploads({ files, setName: "Quiz 5 Section B", rubricId: "grade-q5", course, localDir, ideaConfig: ideas.grade });
  assert.equal(r.meta.id, "quiz-5-section-b");
  assert.equal(r.papers.length, 2, "only .pdf, .txt, .md are read");
  const m = loadMap(localDir, "quiz-5-section-b");
  assert.equal(m[Object.keys(m).find((k) => k.endsWith("-P-01"))].name, r4.name);
  assert.ok(existsSync(join(localDir, "uploads", "quiz-5-section-b", "Priya_Raman_quiz5.txt")));
  assert.equal(r.report[0].counts.NAME, 1);
});

test("each laptop has one stable uploader id, and imported paper ids carry it so two laptops never collide", async () => {
  const { uploaderId } = await import("../server/ingest.js");
  const localDir = mkdtempSync(join(tmpdir(), "local-id-"));
  const a = uploaderId(localDir), b = uploaderId(localDir);
  assert.equal(a, b, "stable across calls");
  assert.match(a, /^U[0-9A-F]{4}$/);
  assert.notEqual(uploaderId(mkdtempSync(join(tmpdir(), "local-id2-"))), a);
});

test("re-reading a folder keeps existing paper ids and appends new files with new ids", async () => {
  const folder = mkdtempSync(join(tmpdir(), "papers-")); const localDir = mkdtempSync(join(tmpdir(), "local-"));
  writeFileSync(join(folder, "b.txt"), "SD = 10\n"); writeFileSync(join(folder, "c.txt"), "SD = 10\n");
  const first = await importFolder({ folder, setId: "t-set", rubricId: "grade-q5", course, localDir, ideaConfig: ideas.grade });
  const ids = Object.fromEntries(first.papers.map((p) => [p.header.file ?? p.id, p.id]));
  assert.match(first.papers[0].id, /^U[0-9A-F]{4}-P-01$/, "paper ids carry the uploader id");
  writeFileSync(join(folder, "a.txt"), "SD = 10\n");
  const second = await importFolder({ folder, setId: "t-set", rubricId: "grade-q5", course, localDir, ideaConfig: ideas.grade });
  const map = loadMap(localDir, "t-set");
  const byFile = Object.fromEntries(Object.entries(map).map(([id, m]) => [m.file, id]));
  assert.equal(byFile["b.txt"], first.papers[0].id, "b keeps its id");
  assert.equal(byFile["c.txt"], first.papers[1].id, "c keeps its id");
  assert.match(byFile["a.txt"], /-P-03$/, "the new file gets the next id, not the first");
  assert.equal(second.papers.length, 3);
});
