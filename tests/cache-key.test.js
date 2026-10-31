// Audit E3: a cached suggestion is reused only for the same full request the model would see: task, question, codes and labels, and paper.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { makeAdapter } from "../server/adapter.js";
import { runGate } from "../lib/gate.js";
import { ideas, course, sub, gradeStandards } from "./helpers.js";

const payload = runGate(sub("S-01"), ideas.grade, course).payload;
const reply = (code) => ({ ok: true, status: 200, json: async () => ({ model: "fake-model-x", stop_reason: "end_turn", usage: { input_tokens: 1, output_tokens: 1 }, content: [{ type: "text", text: JSON.stringify({ proposals: [{ code, quote: payload.steps[0], confidence: 0.5 }] }) }] }) });
function setup() {
  const dir = mkdtempSync(join(tmpdir(), "cachekey-"));
  writeFileSync(join(dir, "smoke.json"), JSON.stringify({ ok: true, mode: "structured" })); writeFileSync(join(dir, "calls.json"), JSON.stringify({ count: 0 }));
  let calls = 0;
  const adapter = makeAdapter({ env: { ANTHROPIC_API_KEY: "test-key-not-real", MODEL_DEMO: "m", MODEL_DEV: "m" }, fetchImpl: async () => { calls++; return reply("E-MEAN"); }, localDir: dir });
  return { adapter, dir, calls: () => calls };
}
const withScheme = (patch) => ({ ...ideas.grade, standards: { ...gradeStandards, ...patch } });

test("E3: the same question and scheme hit the cache; a changed question, label or code list misses", async () => {
  const { adapter, calls } = setup();
  const ask = (idea) => adapter.propose({ ideaConfig: idea, payload, promptName: "grade-propose" });
  const first = await ask(ideas.grade); assert.equal(first.cacheHit, false);
  const same = await ask(ideas.grade); assert.equal(same.cacheHit, true); assert.equal(calls(), 1);
  assert.equal((await ask(withScheme({ question: "A different question." }))).cacheHit, false, "changed question");
  assert.equal((await ask(withScheme({ codes: gradeStandards.codes.map((c) => (c.code === "E-MEAN" ? { ...c, label: "Used the median" } : c)) }))).cacheHit, false, "changed label");
  const fewer = { ...ideas.grade, allowedCodes: ideas.grade.allowedCodes.filter((c) => c !== "E-ARITH") };
  assert.equal((await ask(fewer)).cacheHit, false, "changed allowed codes");
  assert.equal(calls(), 4);
});

test("E3: an old-format cache entry for the same paper is never replayed", async () => {
  const { adapter, dir, calls } = setup();
  const { createHash } = await import("node:crypto");
  const { SYSTEM } = await import("../lib/prompts.js");
  const oldKey = createHash("sha256").update(JSON.stringify({ system: SYSTEM, promptName: "grade-propose", payload })).digest("hex");
  writeFileSync(join(dir, "cache", `${oldKey}.m.json`), JSON.stringify({ modelId: "m", proposals: [{ code: "E-VAR-SD", quote: "x", confidence: 1 }] }));
  const r = await adapter.propose({ ideaConfig: ideas.grade, payload, promptName: "grade-propose" });
  assert.equal(r.cacheHit, false); assert.equal(calls(), 1); assert.equal(r.proposals[0].code, "E-MEAN");
  const replay = makeAdapter({ env: { REPLAY_MODE: "1" }, fetchImpl: () => { throw new Error("no network"); }, localDir: dir });
  assert.equal((await replay.propose({ ideaConfig: withScheme({ question: "Never asked." }), payload, promptName: "grade-propose" })).ok, false, "replay does not fall back to an entry for another request");
  assert.ok(readdirSync(join(dir, "cache")).includes(`${oldKey}.m.json`), "old entries are kept on disk, just never used");
});
