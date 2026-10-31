// Audit S2: an ordinary uploaded set (not a Quiz/Assignment code) must be a grading idea on the server too, with the rubric it was uploaded under.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { importFolder } from "../server/ingest.js";
import { uploadedSets } from "../server/context.js";
import { makeIdeas } from "../lib/ideas.js";
import { course, ideas, read, gradeStandards, companion, upskillStandards } from "./helpers.js";

test("S2: uploaded sets resolve on the server under their own rubric, codes stay with assignments, unknown ids still fail", async () => {
  const localDir = mkdtempSync(join(tmpdir(), "up-"));
  for (const [setId, rubricId] of [["my-stack", "grade-q5"], ["q3-stack", "demo201-q3q5"], ["ABC-DEF", "ABC-DEF"]]) {
    const folder = mkdtempSync(join(tmpdir(), "upf-")); writeFileSync(join(folder, "p.txt"), "SD = 3.162\n");
    await importFolder({ folder, setId, rubricId, course, localDir, ideaConfig: ideas.grade, title: `Title ${setId}` });
  }
  const grade93 = read("demo201-q3q5.v1.0.json");
  const sets = uploadedSets(localDir, { grade: gradeStandards, grade93 });
  assert.deepEqual(Object.keys(sets).sort(), ["my-stack", "q3-stack"], "a Quiz/Assignment code is resolved from its own file, not here");
  assert.equal(sets["my-stack"].id, gradeStandards.id); assert.equal(sets["q3-stack"].id, grade93.id);
  assert.equal(sets["my-stack"].course, "Title my-stack");
  const all = makeIdeas({ gradeStandards, companion, upskillStandards, gradingSets: sets });
  assert.equal(all["my-stack"].id, "my-stack", "the decision is filed under the set");
  assert.equal(all["nope"], undefined);
});
