// Audit PUX-1 (Codex re-review): if refreshing the Quiz/Assignment list fails after a scheme save, the head TA keeps the scheme they saved,
// and Copy is withheld instead of sharing the old pack. Runs the real hook, compiled, with a fake server.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import { makeIdeas } from "../lib/ideas.js";
import { course, companion, upskillStandards, gradeStandards, submissions } from "./helpers.js";

const require = createRequire(import.meta.url);
const swc = require("next/dist/build/swc");
const response = (body, status = 200) => ({ ok: status < 400, status, json: async () => body });

test("PUX-1: a failed refresh after saving v1.1 keeps v1.1 on screen and withholds the old pack", async () => {
  await swc.loadBindings();
  const { code } = await swc.transform(readFileSync(new URL("../components/grading/useGrading.ts", import.meta.url), "utf8"), { jsc: { parser: { syntax: "typescript" }, target: "es2022" }, module: { type: "commonjs" } });
  const states = []; let cursor = 0;
  const hooks = { useState(i0) { const i = cursor++; if (!(i in states)) states[i] = typeof i0 === "function" ? i0() : i0; return [states[i], (v) => { states[i] = typeof v === "function" ? v(states[i]) : v; }]; }, useRef(i0) { const i = cursor++; return states[i] ?? (states[i] = { current: i0 }); }, useCallback: (f) => f, useMemo: (f) => f(), useEffect() {} };
  const scheme = { ...gradeStandards, id: "ABC-DEF", version: "1.0" };
  const assignment = { code: "ABC-DEF", course: "DEMO", title: "Quiz", version: "1.0", createdBy: "UAAAA", standards: scheme, pack: "REMAIN1:old" };
  let assignmentDown = false;
  const fetch = async (path, init) => {
    if (path === "/api/assignment") return assignmentDown ? response({ error: "down" }, 500) : response({ assignments: [assignment] });
    if (path === "/api/rubric" && init?.method === "POST") return response({ ok: true });
    if (path.includes("course.json")) return response(course);
    if (path.includes("companion")) return response(companion);
    if (path.includes("upskill")) return response(upskillStandards);
    if (path.startsWith("/api/rubric?")) return response(gradeStandards);
    if (path === "/api/imported") return response({ sets: [] });
    if (path === "/counts" || path === "/api/ingest") return response({});
    return response(submissions);
  };
  const mod = { exports: {} };
  vm.runInNewContext(code, { module: mod, exports: mod.exports, fetch, setTimeout, clearTimeout, require: (n) => (n === "react" ? hooks : n.includes("ideas") ? { makeIdeas } : { runPipeline: async () => ({}) }) });
  const render = () => { cursor = 0; return mod.exports.useGrading(); };
  await render().reload();
  render().setSetId("ABC-DEF");
  assert.equal(render().table.version, "1.0");
  assignmentDown = true;
  assert.equal(await render().saveRubric({ ...scheme, version: "1.1", max: 12 }), null);
  const g = render();
  assert.equal(g.table.version, "1.1", "the saved scheme stays, not the sample");
  assert.equal(g.table.max, 12);
  assert.equal(g.assignment.pack, null, "the old pack is not offered");
  assert.ok(g.assignment.packProblem);
});
