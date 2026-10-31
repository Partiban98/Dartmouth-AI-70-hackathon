import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { makeAdapter, CALL_CAP, LABEL_REPLAY } from "../server/adapter.js";
import { runGate } from "../lib/gate.js";
import { ideas, course, sub } from "./helpers.js";

const payload = runGate(sub("S-01"), ideas.grade, course).payload;
const okResponse = (model) => ({ ok: true, status: 200, json: async () => ({ model, stop_reason: "end_turn", usage: { input_tokens: 10, output_tokens: 5 }, content: [{ type: "text", text: JSON.stringify({ proposals: [{ code: "E-VAR-SD", quote: "SD = 10", confidence: 0.9 }] }) }] }) });

function setup({ smoke = { ok: true, mode: "structured" }, calls = 0, env = {} } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "remain-"));
  if (smoke) writeFileSync(join(dir, "smoke.json"), JSON.stringify(smoke));
  writeFileSync(join(dir, "calls.json"), JSON.stringify({ count: calls }));
  const seen = [];
  const fetchImpl = async (url, init) => { seen.push(JSON.parse(init.body)); return okResponse("fake-model-x"); };
  const adapter = makeAdapter({ env: { ANTHROPIC_API_KEY: "test-key-not-real", MODEL_DEMO: "env-model-demo", MODEL_DEV: "env-model-dev", ...env }, fetchImpl, localDir: dir });
  return { adapter, seen, dir };
}

test("T28 label uses the API-returned model id, never the env value", async () => {
  const { adapter, seen } = setup();
  const r = await adapter.propose({ ideaConfig: ideas.grade, payload, promptName: "grade-propose" });
  assert.equal(r.ok, true); assert.equal(r.label, "LIVE API: fake-model-x"); assert.equal(r.rung, 1);
  assert.equal(seen[0].model, "env-model-demo");
  assert.equal(seen[0].output_config.format.type, "json_schema");
  assert.ok(!JSON.stringify(seen[0]).includes("aliasMap"));
});

test("T28 replay mode returns the cached rehearsal label", async () => {
  const { adapter, seen } = setup();
  await adapter.propose({ ideaConfig: ideas.grade, payload, promptName: "grade-propose" });
  const replay = makeAdapter({ env: { REPLAY_MODE: "1" }, fetchImpl: () => { throw new Error("no network in replay"); }, localDir: adapter.paths.cache.replace(/\/cache$/, "") });
  const r = await replay.propose({ ideaConfig: ideas.grade, payload, promptName: "grade-propose" });
  assert.equal(r.ok, true); assert.equal(r.label, LABEL_REPLAY); assert.equal(r.rung, 4); assert.equal(seen.length, 1);
});

test("T29 call cap: at 150 no fetch happens and the ladder falls to replay", async () => {
  const { adapter, seen } = setup({ calls: CALL_CAP });
  const r = await adapter.propose({ ideaConfig: ideas.grade, payload, promptName: "grade-propose" });
  assert.equal(seen.length, 0); assert.equal(r.ok, false);
  assert.ok(r.attempts.some((a) => a.includes("Call cap 150")));
});

test("T29 payload cache: same payload twice is one fetch; calls.json counts one", async () => {
  const { adapter, seen, dir } = setup();
  const a = await adapter.propose({ ideaConfig: ideas.grade, payload, promptName: "grade-propose" });
  const b = await adapter.propose({ ideaConfig: ideas.grade, payload, promptName: "grade-propose" });
  assert.equal(a.cacheHit, false); assert.equal(b.cacheHit, true); assert.equal(seen.length, 1);
  assert.equal(JSON.parse(readFileSync(join(dir, "calls.json"), "utf8")).count, 1);
});

test("T29 missing smoke.json refuses live calls (G0 before building on it)", async () => {
  const { adapter, seen } = setup({ smoke: null });
  const r = await adapter.propose({ ideaConfig: ideas.grade, payload, promptName: "grade-propose" });
  assert.equal(r.ok, false); assert.equal(seen.length, 0); assert.ok(r.attempts[0].includes("smoke-g0"));
});

test("ladder: rung 1 fails twice, rung 2 answers with the caveat; schema-invalid output is a failed attempt", async () => {
  const dir = mkdtempSync(join(tmpdir(), "remain-"));
  writeFileSync(join(dir, "smoke.json"), JSON.stringify({ ok: true, mode: "tool" }));
  let n = 0;
  const fetchImpl = async (url, init) => {
    const body = JSON.parse(init.body); n++;
    if (body.model === "env-model-demo") return { ok: true, status: 200, json: async () => ({ model: "env-model-demo", content: [{ type: "tool_use", name: "propose", input: { proposals: [{ code: "E-VAR-SD", quote: "x", confidence: 0.5, points: -3 }] } }] }) };
    return { ok: true, status: 200, json: async () => ({ model: "returned-dev-id", content: [{ type: "tool_use", name: "propose", input: { proposals: [] } }] }) };
  };
  const adapter = makeAdapter({ env: { ANTHROPIC_API_KEY: "k", MODEL_DEMO: "env-model-demo", MODEL_DEV: "env-model-dev" }, fetchImpl, localDir: dir });
  const r = await adapter.propose({ ideaConfig: ideas.grade, payload, promptName: "grade-propose" });
  assert.equal(r.rung, 2); assert.equal(r.label, "LIVE API: returned-dev-id"); assert.equal(n, 3);
  assert.ok(r.attempts.filter((a) => a.includes("SCHEMA_INVALID")).length === 2);
  assert.ok(r.caveat.includes("same key"));
});

test("smokeTest falls back from structured to tool mode and records the mode", async () => {
  const dir = mkdtempSync(join(tmpdir(), "remain-"));
  const fetchImpl = async (url, init) => {
    const body = JSON.parse(init.body);
    if (body.output_config) return { ok: false, status: 400, json: async () => ({ error: { type: "invalid_request_error", message: "no structured" } }) };
    return { ok: true, status: 200, json: async () => ({ model: "returned-id", usage: { input_tokens: 1, output_tokens: 1 }, content: [{ type: "tool_use", name: "propose", input: { proposals: [] } }] }) };
  };
  const adapter = makeAdapter({ env: { ANTHROPIC_API_KEY: "k", MODEL_DEMO: "env-model-demo" }, fetchImpl, localDir: dir });
  const r = await adapter.smokeTest({ ideaConfig: ideas.grade, payload });
  assert.equal(r.ok, true); assert.equal(r.mode, "tool"); assert.equal(r.modelId, "returned-id");
  assert.equal(JSON.parse(readFileSync(join(dir, "smoke.json"), "utf8")).mode, "tool");
});
