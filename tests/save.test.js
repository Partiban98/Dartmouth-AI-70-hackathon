// Audit E2: a decision is "Saved" only when the log write succeeded. Uses the real pipeline with the fetch guard the grading screen passes it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { runPipeline } from "../lib/pipeline.js";
import { strictLogFetch } from "../lib/saveguard.js";
import { course, ideas, sub } from "./helpers.js";

function server({ gateStatus = 200, decisionStatus = 200 } = {}) {
  const calls = [];
  const fetchImpl = async (path, init) => {
    const body = init?.body ? JSON.parse(init.body) : null;
    calls.push(path === "/log" ? `log:${body.type}` : path);
    const json = (status, obj) => ({ status, ok: status < 400, json: async () => obj });
    if (path === "/log") { const s = body.type === "gate" ? gateStatus : decisionStatus; return json(s, s < 400 ? { ok: true } : { error: "log value at feedback contains a roster name" }); }
    if (path === "/propose") return json(200, { proposals: [], label: "LIVE API: fake", modelId: "fake", rung: 1, cacheHit: false });
    if (path === "/counts") return json(200, {});
    throw new Error(`unexpected ${path}`);
  };
  return { fetchImpl, calls };
}
const ui = { approveGate: async () => true, resolveFlags: async () => ({}), review: async () => ({ confirmed: [], overrides: [] }), decide: async ({ computedScore }) => ({ decidedBy: "TA", grade: computedScore, feedback: "Full marks." }) };

test("E2: when the privacy-check log fails, nothing is sent for suggestions and no receipt appears", async () => {
  const { fetchImpl, calls } = server({ gateStatus: 500 });
  await assert.rejects(runPipeline(ideas.grade, sub("S-01"), ui, { course, fetchImpl: strictLogFetch(fetchImpl) }), (e) => e.notSaved === true);
  assert.deepEqual(calls, ["log:gate"], "no /propose after a failed gate log");
});

test("E2: when the decision log fails, there is no Saved receipt and the reason is kept for the screen", async () => {
  const { fetchImpl, calls } = server({ decisionStatus: 400 });
  await assert.rejects(runPipeline(ideas.grade, sub("S-01"), ui, { course, fetchImpl: strictLogFetch(fetchImpl) }), (e) => e.notSaved === true && /roster name/.test(e.message));
  assert.ok(!calls.includes("/counts"), "the pipeline stopped before reporting a save");
});

test("E2: a healthy server still saves exactly one decision", async () => {
  const { fetchImpl, calls } = server();
  const r = await runPipeline(ideas.grade, sub("S-01"), ui, { course, fetchImpl: strictLogFetch(fetchImpl) });
  assert.equal(r.receipt, "Assigned by you (TA)");
  assert.equal(calls.filter((c) => c === "log:decision").length, 1);
});

test("E2: a dropped connection on a log write is a save failure too, not an unhandled error", async () => {
  const fetchImpl = async (path) => { if (path === "/log") throw new TypeError("Failed to fetch"); throw new Error("unexpected " + path); };
  await assert.rejects(runPipeline(ideas.grade, sub("S-01"), ui, { course, fetchImpl: strictLogFetch(fetchImpl) }), (e) => e.notSaved === true);
});

test("E2: the legacy grading page uses the same save guard", async () => {
  const { readFileSync } = await import("node:fs");
  const src = readFileSync(new URL("../legacy/public/grade.js", import.meta.url), "utf8");
  assert.ok(/fetchImpl: strictLogFetch\(fetch\)/.test(src) && src.includes('from "/lib/saveguard.js"'));
});
