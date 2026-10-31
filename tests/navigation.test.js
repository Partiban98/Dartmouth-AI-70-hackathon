// Exercise the real hook and pipeline with deferred provider responses; no browser or cloud calls.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import { runPipeline } from "../lib/pipeline.js";
import { makeIdeas } from "../lib/ideas.js";
import { course, companion, upskillStandards, gradeStandards, submissions } from "./helpers.js";

const require = createRequire(import.meta.url);
const swc = require("next/dist/build/swc");
const tick = () => new Promise((resolve) => setImmediate(resolve));
const response = (body) => ({ ok: true, status: 200, json: async () => body });

async function hook() {
  await swc.loadBindings();
  const compiled = await swc.transform(readFileSync(new URL("../components/grading/useGrading.ts", import.meta.url), "utf8"), {
    jsc: { parser: { syntax: "typescript" }, target: "es2022" }, module: { type: "commonjs" },
  });
  const states = []; let cursor = 0;
  const hooks = {
    useState(initial) { const i = cursor++; if (!(i in states)) states[i] = typeof initial === "function" ? initial() : initial; return [states[i], (v) => { states[i] = typeof v === "function" ? v(states[i]) : v; }]; },
    useRef(initial) { const i = cursor++; return states[i] ?? (states[i] = { current: initial }); },
    useCallback: (fn) => fn, useMemo: (fn) => fn(), useEffect() {},
  };
  const providers = [], decisions = [];
  const fetch = async (path, init) => {
    if (path === "/propose") return new Promise((resolve) => providers.push({ itemId: JSON.parse(init.body).itemId, resolve: (label) => resolve(response({ proposals: [], label })) }));
    if (path === "/log") { const record = JSON.parse(init.body); if (record.type === "decision") decisions.push(record); return response({}); }
    if (path === "/counts") return response({ decisions });
    if (path.includes("course.json")) return response(course);
    if (path.includes("companion")) return response(companion);
    if (path.includes("upskill")) return response(upskillStandards);
    if (path.startsWith("/api/rubric?")) return response(gradeStandards);
    if (path === "/api/imported") return response({ sets: [] });
    if (path === "/api/assignment") return response({ assignments: [] });
    return response(submissions);
  };
  const mod = { exports: {} };
  vm.runInNewContext(compiled.code, {
    module: mod, exports: mod.exports, fetch, setTimeout, clearTimeout,
    require: (name) => name === "react" ? hooks : name.includes("ideas") ? { makeIdeas } : { runPipeline: (idea, item, ui, deps) => runPipeline(idea, item, ui, { ...deps, fetchImpl: fetch }) },
  });
  const render = () => { cursor = 0; return mod.exports.useGrading(); };
  await render().reload();
  return { render, providers, decisions };
}

test("starting another paper cancels a pending gate without stopping the replacement paper", async () => {
  const h = await hook(); let g = h.render();
  const old = g.start(submissions[0]);
  const current = h.render().start(submissions[1]);
  await old;
  g = h.render();
  assert.equal(g.current.id, submissions[1].id);
  assert.equal(g.stage.kind, "privacy");
  g.answer(false); await current;
});

test("a late response for the old paper cannot replace the new paper's gate, label, or pending answer", async () => {
  const h = await hook(); let g = h.render();
  const old = g.start(submissions[0]);
  h.render().answer(true, { kind: "reading" }); await tick();
  assert.equal(h.providers[0].itemId, submissions[0].id);
  const current = h.render().start(submissions[1]);
  h.providers[0].resolve("OLD MODEL RESPONSE"); await tick();
  g = h.render();
  assert.equal(g.current.id, submissions[1].id);
  assert.equal(g.stage.kind, "privacy", "old model output must not replace the replacement paper's privacy question");
  assert.equal(g.modelLabel, "", "old model label must not become the replacement paper's label");
  // The visible gate must still own its answer. Complete only the replacement paper.
  g.answer(true, { kind: "reading" }); await tick();
  assert.equal(h.providers[1].itemId, submissions[1].id);
  h.providers[1].resolve("CURRENT MODEL RESPONSE"); await tick();
  assert.equal(h.render().stage.card.itemId, submissions[1].id);
  h.render().answer({ confirmed: [], overrides: [] }); await tick();
  assert.equal(h.render().stage.kind, "mark");
  h.render().answer({ decidedBy: "Test TA", grade: 10 });
  await Promise.all([old, current]);
  assert.deepEqual(h.decisions.map((d) => d.itemId), [submissions[1].id]);
  assert.equal(h.render().stage.kind, "saved");
});

test("switching papers as a review finishes cannot open the old paper's mark question", async () => {
  const h = await hook();
  const old = h.render().start(submissions[0]);
  h.render().answer(true); await tick();
  h.providers[0].resolve("OLD MODEL RESPONSE"); await tick();
  h.render().answer({ confirmed: [], overrides: [] });
  const current = h.render().start(submissions[1]);
  await tick();
  assert.equal(h.render().current.id, submissions[1].id);
  assert.equal(h.render().stage.kind, "privacy", "old review continuation must not open a mark question over the new paper");
  h.render().answer(false);
  await Promise.all([old, current]);
  assert.equal(h.decisions.length, 0);
});
