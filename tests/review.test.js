// The grader's answers become the review the pipeline scores. A mistake neither the AI nor the marking scheme raised
// (S-09: one squared deviation written as 18) must still be recordable by the grader, and count like a confirmed one.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildReview, addableCodes } from "../components/grading/review.js";
import { runPipeline } from "../lib/pipeline.js";
import { analytics } from "../lib/engine.js";
import { gradeStandards, ideas, course, sub } from "./helpers.js";

const items = [{ code: "E-VAR-SD" }, { code: "E-MEAN" }, { code: "E-ARITH" }];

test("answers become confirmed codes and reasoned overrides; a missing answer or reason is refused", () => {
  const state = [{ action: "confirm", to: "E-VAR-SD", reason: "" }, { action: "override", to: "OK", reason: "mean is right" }, { action: "change", to: "E-N-DENOM", reason: "divided by n" }];
  assert.deepEqual(buildReview(items, state), {
    confirmed: ["E-VAR-SD", "E-N-DENOM"],
    overrides: [{ from: "E-MEAN", to: "OK", reason: "mean is right", precedent: undefined }, { from: "E-ARITH", to: "E-N-DENOM", reason: "divided by n", precedent: undefined }],
  });
  assert.deepEqual(buildReview(items, [state[0], { action: "", to: "E-MEAN", reason: "" }, state[2]]), { error: "choose", n: 2 });
  assert.deepEqual(buildReview(items, [state[0], { action: "override", to: "OK", reason: "  " }, state[2]]), { error: "why", n: 2 });
});

test("a mistake the grader adds counts as confirmed, once, and is never OK or UNSURE", () => {
  assert.deepEqual(buildReview([], [], ["E-ARITH"]), { confirmed: ["E-ARITH"], overrides: [] });
  assert.deepEqual(buildReview([{ code: "E-ARITH" }], [{ action: "confirm", to: "E-ARITH", reason: "" }], ["E-ARITH"]).confirmed, ["E-ARITH"]);
  assert.deepEqual(addableCodes(gradeStandards).map((c) => c.code), ["E-VAR-SD", "E-N-DENOM", "E-MEAN", "E-ARITH", "M-UNLISTED"]);
});

test("S-09: nothing suggested, the grader adds the slip, the mark from choices is 9 and insights count it", async () => {
  let bar, record;
  const fetchImpl = async (path, init) => {
    if (path === "/log" && JSON.parse(init.body).type === "decision") record = JSON.parse(init.body);
    return { status: 200, ok: true, json: async () => (path === "/propose" ? { proposals: [], label: "test" } : {}) };
  };
  const r = await runPipeline(ideas.grade, sub("S-09"), {
    approveGate: async () => true,
    review: async (card) => { assert.equal(card.items.length, 0, "S-09 raises nothing by rule"); return buildReview(card.items, [], ["E-ARITH"]); },
    decide: async (b) => { bar = b; return { decidedBy: "Test TA", grade: b.computedScore }; },
  }, { course, fetchImpl });
  assert.equal(bar.computedScore, 9);
  assert.equal(r.receipt, "Assigned by you (TA)");
  assert.deepEqual(record.confirmed, ["E-ARITH"]);
  assert.deepEqual(record.proposed, []);
  assert.deepEqual(analytics([record])["E-ARITH"], { proposed: 0, confirmed: 1, overridden: 0 });
});
