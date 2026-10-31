// Audit S3, S4, PUX-4, QA-02, QA-03: a paper's id always means the same student's same work, empty papers are never "ready", and exported text stays text.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { importFolder, importUploads, parsePaper, loadMap, loadImported, exportCsv } from "../server/ingest.js";
import { course, ideas } from "./helpers.js";

const opts = (folder, localDir) => ({ folder, setId: "t-set", rubricId: "grade-q5", course, localDir, ideaConfig: ideas.grade });
const up = (localDir, files) => importUploads({ files: files.map(([name, text]) => ({ name, bytes: Buffer.from(text) })), setName: "batch", rubricId: "grade-q5", course, localDir, ideaConfig: ideas.grade });

test("S4: deleting a file never lets a new paper reuse a surviving or old id, and the old id keeps its student", async () => {
  const folder = mkdtempSync(join(tmpdir(), "s4-")), localDir = mkdtempSync(join(tmpdir(), "s4l-"));
  writeFileSync(join(folder, "a.txt"), "Name: Ann Able\nSD = 3.162\n"); writeFileSync(join(folder, "b.txt"), "Name: Ben Bold\nSD = 3.162\n");
  const first = await importFolder(opts(folder, localDir));
  const idOf = (r, f) => r.report.find((x) => x.file === f).id;
  const [a, b] = [idOf(first, "a.txt"), idOf(first, "b.txt")];
  unlinkSync(join(folder, "a.txt")); await importFolder(opts(folder, localDir));
  writeFileSync(join(folder, "c.txt"), "Name: Cy Clear\nSD = 3.162\n");
  const third = await importFolder(opts(folder, localDir));
  const ids = third.papers.map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length, "ids are unique");
  assert.equal(idOf(third, "b.txt"), b);
  assert.ok(![a, b].includes(idOf(third, "c.txt")), "c gets a fresh id");
  assert.equal(loadMap(localDir, "t-set")[a].name, "Ann Able", "the removed paper's id still names its student, for its old mark");
});

test("S3: uploading a different paper under the same filename never moves the first student's id to it", async () => {
  const localDir = mkdtempSync(join(tmpdir(), "s3l-"));
  const r1 = await up(localDir, [["submission.txt", "Name: Alpha Student\nSD = 3.162\n"]]);
  const alphaId = r1.report[0].id;
  const r2 = await up(localDir, [["submission.txt", "Name: Beta Student\nSD = 10\n"]]);
  const map = loadMap(localDir, r2.meta.id);
  assert.equal(map[alphaId].name, "Alpha Student", "Alpha's id still means Alpha");
  const betaId = Object.keys(map).find((id) => map[id].name === "Beta Student");
  assert.ok(betaId && betaId !== alphaId, "Beta gets its own id");
  assert.equal(loadImported(localDir, r2.meta.id).papers.length, 2, "both papers are kept");
  const same = await up(localDir, [["submission.txt", "Name: Beta Student\nSD = 10\n"]]);
  assert.equal(loadImported(localDir, same.meta.id).papers.length, 2, "re-uploading the identical file adds nothing");
  const both = await up(mkdtempSync(join(tmpdir(), "s3m-")), [["a?b.txt", "Name: One\nSD = 1\n"], ["a*b.txt", "Name: Two\nSD = 2\n"]]);
  assert.equal(both.papers.length, 2, "two names that clean to the same filename stay two papers");
});

test("S3: a file replaced in place in a watched folder gets a new id; an unchanged file keeps its id", async () => {
  const folder = mkdtempSync(join(tmpdir(), "s3f-")), localDir = mkdtempSync(join(tmpdir(), "s3fl-"));
  writeFileSync(join(folder, "submission.txt"), "Name: Alpha Student\nSD = 3.162\n");
  const a = (await importFolder(opts(folder, localDir))).report[0].id;
  assert.equal((await importFolder(opts(folder, localDir))).report[0].id, a, "unchanged file, same id");
  writeFileSync(join(folder, "submission.txt"), "Name: Beta Student\nSD = 10\n");
  const b = (await importFolder(opts(folder, localDir))).report[0].id;
  assert.notEqual(b, a);
  const map = loadMap(localDir, "t-set");
  assert.equal(map[a].name, "Alpha Student"); assert.equal(map[b].name, "Beta Student");
});

test("PUX-4: a paper with no readable work is held with a reason, never offered for grading", async () => {
  const localDir = mkdtempSync(join(tmpdir(), "p4l-"));
  const r = await up(localDir, [["empty.txt", "Name: Test Pupil\n \n"], ["good.txt", "Name: Good One\nSD = 3.162\n"]]);
  assert.equal(r.papers.length, 1, "only the readable paper is ready");
  const held = r.report.find((x) => x.file === "empty.txt");
  assert.equal(held.held, "no readable work");
  assert.equal(loadImported(localDir, r.meta.id).papers.length, 1);
  await assert.rejects(up(mkdtempSync(join(tmpdir(), "p4m-")), [["blank.txt", "   \n"]]), /readable/);
});

test("QA-02: scientific notation and trailing page or question numbers give the real final answer", () => {
  assert.equal(parsePaper("p = 1.2e-4", "p.txt").finalAnswer, 0.00012);
  assert.equal(parsePaper("x = 3E+2", "p.txt").finalAnswer, 300);
  assert.equal(parsePaper("p = .016", "p.txt").finalAnswer, 0.016);
  assert.equal(parsePaper("p = 0.016\nQuestion 5", "p.txt").finalAnswer, 0.016);
  assert.equal(parsePaper("SD = 3.162\nPage 2 of 2", "p.txt").finalAnswer, 3.162);
  assert.equal(parsePaper("SD = 3.162", "p.txt").finalAnswer, 3.162);
});

test("QA-03: text that starts like a spreadsheet formula is exported as text; marks stay numbers", () => {
  const papers = [{ id: "U1-P-01", uploader: "U1" }];
  const map = { "U1-P-01": { file: "=cmd.txt", name: "=1+1" } };
  const logs = { decisions: [{ idea: "t", itemId: "U1-P-01", confirmed: [], overrides: [], computedScore: 7, grade: 7, decidedBy: "+TA", feedback: "@SUM(A1)", rubricVersion: "1.0", ts: "t1" }] };
  const row = exportCsv({ setId: "t", papers, map, logs, table: { version: "1.0" } }).trim().split("\n")[1];
  for (const bad of ["=1+1", "=cmd.txt", "+TA", "@SUM(A1)"]) assert.ok(row.includes(`'${bad}`) && !new RegExp(`(^|,)\\${bad[0]}`).test(row.replace(`'${bad}`, "")), `${bad} in ${row}`);
  assert.ok(/,7,7,/.test(row), "grades stay numbers");
});
