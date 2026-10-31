import { test } from "node:test";
import assert from "node:assert/strict";
import { runPipeline } from "../lib/pipeline.js";
import { assertLogSafe } from "../lib/logshape.js";
import { counters } from "../lib/engine.js";
import { course, ideas, sub } from "./helpers.js";

function fakeServer(proposalsByItem) {
  const logs = { gate: [], proposals: [], decisions: [], blocked: [] };
  const fetchImpl = async (path, init) => {
    const body = init?.body ? JSON.parse(init.body) : null;
    const json = (status, obj) => ({ status, ok: status < 400, json: async () => obj });
    if (path === "/log") { assertLogSafe(body, course); logs[body.type === "decision" ? "decisions" : body.type].push(body); return json(200, { ok: true }); }
    if (path === "/propose") {
      assert.ok(!JSON.stringify(body).includes("aliasMap"));
      const proposals = proposalsByItem[body.itemId] ?? [];
      logs.proposals.push({ type: "proposal", proposals: proposals.map((p) => ({ code: p.code, quoteVerified: true })) });
      return json(200, { proposals, label: "LIVE API: fake-model-x", modelId: "fake-model-x", rung: 1, cacheHit: false });
    }
    if (path === "/counts") return json(200, counters(logs));
    throw new Error(`unexpected fetch ${path}`);
  };
  return { fetchImpl, logs };
}

test("G1 headless full loop on S-07: AI item plus Rule item, TA overrides both with reasons, grade assigned", async () => {
  const s7 = sub("S-07");
  const { fetchImpl, logs } = fakeServer({ "S-07": [{ code: "E-ARITH", quote: s7.steps[0], confidence: 0.4 }] });
  let seenCard;
  const ui = {
    approveGate: async (report) => { assert.equal(report.droppedFields, 2); return true; },
    resolveFlags: async () => { throw new Error("no flags expected"); },
    review: async (card) => {
      seenCard = card;
      return { confirmed: [], overrides: card.items.map((i) => ({ from: i.code, to: "OK", reason: "Valid computational formula, M2 not yet in v1.0" })) };
    },
    decide: async ({ computedScore }) => ({ decidedBy: "Test TA", grade: computedScore }),
  };
  const r = await runPipeline(ideas.grade, s7, ui, { course, fetchImpl });
  assert.equal(r.receipt, "Assigned by you (TA)");
  assert.equal(r.computedScore, 10);
  assert.equal(r.label, "LIVE API: fake-model-x");
  assert.deepEqual(seenCard.items.map((i) => [i.code, i.source, i.verified]), [["E-ARITH", "AI", true], ["M-UNLISTED", "Rule", true]]);
  assert.equal(logs.decisions.length, 1);
  assert.equal(logs.decisions[0].overrides.length, 2);
  assert.equal(logs.decisions[0].decidedBy, "Test TA");
  assert.equal(r.counts.overridden, 2);
  assert.equal(r.counts.confirmed, 0);
});

test("loop on S-01: fake quote is marked not found; confirmed code drives the score", async () => {
  const s1 = sub("S-01");
  const { fetchImpl, logs } = fakeServer({ "S-01": [{ code: "E-VAR-SD", quote: "SD = 10", confidence: 0.9 }, { code: "E-MEAN", quote: "mean = 7", confidence: 0.3 }] });
  const ui = {
    approveGate: async () => true,
    review: async (card) => {
      const fake = card.items.find((i) => i.code === "E-MEAN");
      assert.equal(fake.verified, false, "fake source line must be not found");
      return { confirmed: ["E-VAR-SD"], overrides: [{ from: "E-MEAN", to: "OK", reason: "quote not in paper" }] };
    },
    decide: async ({ computedScore }) => ({ decidedBy: "Test TA", grade: computedScore }),
  };
  const r = await runPipeline(ideas.grade, s1, ui, { course, fetchImpl });
  assert.equal(r.computedScore, 7);
  assert.equal(logs.decisions[0].grade, 7);
});

test("override without a reason and a decision without a name are refused", async () => {
  const { fetchImpl } = fakeServer({});
  const base = { approveGate: async () => true, decide: async () => ({ decidedBy: "Test TA" }) };
  const noReason = await runPipeline(ideas.grade, sub("S-07"), { ...base, review: async (c) => ({ confirmed: [], overrides: c.items.map((i) => ({ from: i.code, to: "OK", reason: "" })) }) }, { course, fetchImpl });
  assert.equal(noReason.stopped, "review");
  const noName = await runPipeline(ideas.grade, sub("S-03"), { ...base, review: async () => ({ confirmed: [], overrides: [] }), decide: async () => ({ decidedBy: "" }) }, { course, fetchImpl });
  assert.equal(noName.stopped, "decide");
});

test("T12 gate decline sends nothing; 422 from server stops the loop", async () => {
  let proposeCalls = 0;
  const fetchImpl = async (path) => { if (path === "/propose") { proposeCalls++; return { status: 422, ok: false, json: async () => ({ code: "BLOCKED", rule: "R-01", count: 1 }) }; } return { status: 200, ok: true, json: async () => ({}) }; };
  const declined = await runPipeline(ideas.grade, sub("S-01"), { approveGate: async () => false }, { course, fetchImpl });
  assert.equal(declined.stopped, "gate"); assert.equal(proposeCalls, 0);
  const blocked = await runPipeline(ideas.grade, sub("S-01"), { approveGate: async () => true }, { course, fetchImpl });
  assert.equal(blocked.stopped, "blocked"); assert.equal(blocked.detail.code, "BLOCKED");
});

test("R-11 flow: pipeline asks the human, then proceeds with PERSON alias", async () => {
  const { fetchImpl } = fakeServer({});
  let asked = null;
  const input = { id: "S-99", steps: ["Worked with Jordan Blake on the mean", "Sample SD = sqrt(10) = 3.162"], finalAnswer: 3.162 };
  const ui = {
    resolveFlags: async (flags) => { asked = flags; return { "Jordan Blake": "name" }; },
    approveGate: async (report) => { assert.equal(report.counts.NAME, 1); return true; },
    review: async (card) => ({ confirmed: [], overrides: card.items.map((i) => ({ from: i.code, to: "OK", reason: "method fine" })) }),
    decide: async () => ({ decidedBy: "Test TA", grade: 10 }),
  };
  const r = await runPipeline(ideas.grade, input, ui, { course, fetchImpl });
  assert.deepEqual(asked, [{ token: "Jordan Blake", rule: "R-11" }]);
  assert.equal(r.receipt, "Assigned by you (TA)");
});
