import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { recurring, analytics } from "../lib/engine.js";
import { runPipeline } from "../lib/pipeline.js";
import { createApp } from "../legacy/server.js";
import { gradeStandards, submissions, ideas, course, sub } from "./helpers.js";

const ROOT = new URL("..", import.meta.url).pathname;

test("GR-02 queue is S-01 to S-25 in order; no bulk approval control exists in the page", () => {
  assert.deepEqual(submissions.map((s) => s.id), Array.from({ length: 25 }, (_, i) => `S-${String(i + 1).padStart(2, "0")}`));
  const pub = readdirSync(join(ROOT, "legacy", "public")).map((f) => readFileSync(join(ROOT, "legacy", "public", f), "utf8")).join("\n");
  assert.ok(!/["'`](select all|approve all|confirm all|approve remaining)/i.test(pub), "no bulk approval control text");
  assert.ok(!/type:\s*"checkbox"[^\n]*queue/i.test(pub), "no checkbox in the queue");
});

test("GR-01 rubric is validated by code before use; an invalid table stops the pipeline before the gate", async () => {
  const bad = { ...ideas.grade, standards: { ...gradeStandards, codes: gradeStandards.codes.map((c) => c.code === "E-MEAN" ? { ...c, deduction: 2 } : c) } };
  const r = await runPipeline(bad, sub("S-01"), { approveGate: async () => { throw new Error("gate must not run"); } }, { course, fetchImpl: () => { throw new Error("no fetch"); } });
  assert.equal(r.stopped, "standards"); assert.ok(r.errors[0].includes("E-MEAN"));
});

test("GR-04 recurring mistakes use confirmed decisions only, most confirmed first, OK and UNSURE excluded", () => {
  const decisions = [
    { proposed: ["E-VAR-SD"], confirmed: ["E-VAR-SD"], overrides: [] },
    { proposed: ["E-VAR-SD"], confirmed: ["E-VAR-SD"], overrides: [] },
    { proposed: ["E-N-DENOM"], confirmed: ["E-N-DENOM"], overrides: [] },
    { proposed: ["E-ARITH", "M-UNLISTED"], confirmed: [], overrides: [{ from: "E-ARITH", to: "OK", reason: "x" }, { from: "M-UNLISTED", to: "OK", reason: "valid M2" }] },
    { proposed: [], confirmed: ["OK"], overrides: [] },
  ];
  const list = recurring(analytics(decisions), gradeStandards);
  assert.deepEqual(list.map((r) => [r.code, r.confirmed, r.proposed, r.overridden]), [["E-VAR-SD", 2, 2, 0], ["E-N-DENOM", 1, 1, 0]]);
  assert.ok(!list.some((r) => r.code === "M-UNLISTED" || r.code === "E-ARITH"), "overridden proposals never count as mistakes");
});

test("GR-04 server: /counts analytics and decision rows reflect posted decisions, reasons stay out", async () => {
  const localDir = mkdtempSync(join(tmpdir(), "remain-grade-"));
  const server = createApp({ env: {}, fetchImpl: () => { throw new Error("no network"); }, localDir });
  await new Promise((ok) => server.listen(0, ok));
  const base = `http://localhost:${server.address().port}`;
  try {
    const post = (rec) => fetch(`${base}/log`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(rec) });
    await post({ type: "decision", idea: "grade", itemId: "S-01", decidedBy: "TA One", proposed: ["E-VAR-SD"], confirmed: ["E-VAR-SD"], overrides: [], computedScore: 7, grade: 7, receipt: "Assigned by you (TA)" });
    await post({ type: "decision", idea: "grade", itemId: "S-07", decidedBy: "TA One", proposed: ["E-ARITH", "M-UNLISTED"], confirmed: [], overrides: [{ from: "M-UNLISTED", to: "OK", reason: "secret reason text" }, { from: "E-ARITH", to: "OK", reason: "fine" }], computedScore: 10, grade: 10, receipt: "Assigned by you (TA)" });
    const c = await (await fetch(`${base}/counts`)).json();
    assert.equal(c.analytics["E-VAR-SD"].confirmed, 1);
    assert.equal(c.analytics["M-UNLISTED"].overridden, 1);
    assert.equal(c.analytics["M-UNLISTED"].confirmed, 0);
    assert.deepEqual(c.decisions.map((d) => [d.itemId, d.overrides, d.grade]), [["S-01", 0, 7], ["S-07", 2, 10]]);
    assert.ok(!JSON.stringify(c).includes("secret reason text"));
    assert.deepEqual(recurring(c.analytics, gradeStandards).map((r) => r.code), ["E-VAR-SD"]);
  } finally { server.close(); }
});

test("GR-03 TA grade comes from confirmed codes only; the model never assigns it", async () => {
  const fetchImpl = async (path, init) => {
    const json = (o) => ({ status: 200, ok: true, json: async () => o });
    if (path === "/propose") return json({ proposals: [{ code: "E-VAR-SD", quote: "SD = 10", confidence: 0.9 }, { code: "E-MEAN", quote: "Mean = (4 + 6 + 8 + 10 + 12) / 5 = 40 / 5 = 8", confidence: 0.6 }], label: "LIVE API: fake", modelId: "fake", rung: 1 });
    return json({});
  };
  let bar;
  const r = await runPipeline(ideas.grade, sub("S-01"), {
    approveGate: async () => true,
    review: async (card) => ({ confirmed: ["E-VAR-SD"], overrides: [{ from: "E-MEAN", to: "OK", reason: "mean is right" }] }),
    decide: async (b) => { bar = b; return { decidedBy: "TA One", grade: 6.5 }; },
  }, { course, fetchImpl });
  assert.equal(bar.computedScore, 7, "7 from E-VAR-SD only; the Rule candidate E-VAR-SD duplicates the AI one but is counted once by the TA");
  assert.equal(bar.requiresGradeInput, true);
  assert.equal(r.receipt, "Assigned by you (TA)");
});

test("GR-03 the same code confirmed on the AI row and the Rule row deducts once", async () => {
  const fetchImpl = async (path) => ({ status: 200, ok: true, json: async () => path === "/propose" ? { proposals: [{ code: "E-VAR-SD", quote: "SD = 10", confidence: 0.9 }], label: "LIVE API: fake", modelId: "fake", rung: 1 } : {} });
  let bar;
  await runPipeline(ideas.grade, sub("S-01"), {
    approveGate: async () => true,
    review: async (card) => { assert.deepEqual(card.items.map((i) => [i.code, i.source]), [["E-VAR-SD", "AI"], ["E-VAR-SD", "Rule"]]); return { confirmed: card.items.map((i) => i.code), overrides: [] }; },
    decide: async (b) => { bar = b; return { decidedBy: "TA One", grade: b.computedScore }; },
  }, { course, fetchImpl });
  assert.equal(bar.computedScore, 7);
});

