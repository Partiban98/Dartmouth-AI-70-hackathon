import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import { stripTypeScriptTypes } from "node:module";
import { runPipeline } from "../lib/pipeline.js";
import { checkOutbound } from "../server/privacy.js";
import { createApp } from "../legacy/server.js";
import { course, ideas } from "./helpers.js";

const TERM = "Delta Method";
const payload = { steps: [`the ${TERM} applies.`], finalAnswer: 3.162 };
const fresh = (t) => { const dir = mkdtempSync(join(tmpdir(), "remain-clearance-")); t.after(() => rmSync(dir, { recursive: true, force: true })); return dir; };
const body = (cleared, value = payload) => ({ idea: "grade", itemId: "E5-01", promptName: "grade-propose", payload: value, ...(cleared === undefined ? {} : { cleared }) });
const known = (dir) => {
  const p = join(dir, "ingest", "exam"); mkdirSync(p, { recursive: true });
  writeFileSync(join(p, "meta.json"), JSON.stringify({ id: "exam" }));
  writeFileSync(join(p, "map.json"), JSON.stringify({ map: { P1: { name: "Lucia Moreau", netid: "lm42", studentId: "1234" } } }));
};
const provider = (seen) => async (_url, init) => {
  const request = JSON.parse(init.body); seen.push(request);
  assert.equal("cleared" in request, false, "clearance metadata is not sent to the provider");
  return { ok: true, status: 200, json: async () => ({ model: "fake-e5-model", stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify({ proposals: [{ code: "E-MEAN", quote: TERM, confidence: 0.8 }] }) }] }) };
};
const smoke = (dir) => writeFileSync(join(dir, "smoke.json"), JSON.stringify({ ok: true, mode: "structured" }));

// This exercises the actual pipeline and HTTP server, including the human flag response.
test("E5: a human's not-name choice reaches the server; logs retain its count, never the phrase list", async (t) => {
  const localDir = fresh(t), seen = []; smoke(localDir);
  const server = createApp({ localDir, env: { ANTHROPIC_API_KEY: "fake", MODEL_DEMO: "fake", MODEL_DEV: "fake" }, fetchImpl: provider(seen) });
  await new Promise((r) => server.listen(0, "127.0.0.1", r)); t.after(() => new Promise((r) => server.close(r)));
  const base = `http://127.0.0.1:${server.address().port}`;
  let sent;
  const fetchImpl = (path, init) => { if (path === "/propose") sent = JSON.parse(init.body); return fetch(base + path, init); };
  const result = await runPipeline(ideas.grade, { id: "E5-01", ...payload }, {
    resolveFlags: async (flags) => { assert.deepEqual(flags, [{ token: TERM, rule: "R-11" }]); return { [TERM]: "not-name" }; },
    approveGate: async () => true,
    review: async () => ({ confirmed: ["E-MEAN"], overrides: [] }),
    decide: async () => ({ decidedBy: "Test TA", grade: 8 }),
  }, { course, fetchImpl });
  assert.equal(result.receipt, "Assigned by you (TA)");
  assert.deepEqual(sent.cleared, [TERM]);
  assert.equal(seen.length, 1);
  const proposals = readFileSync(join(localDir, "proposals.jsonl"), "utf8").trim().split("\n").map(JSON.parse);
  assert.equal(proposals[0].clearedCount, 1);
  for (const f of readdirSync(localDir).filter((f) => f.endsWith(".jsonl"))) assert.equal(readFileSync(join(localDir, f), "utf8").includes(TERM), false, f);
});

test("E5: clearance is exact, short and request-scoped; it cannot clear identities, patterns or another phrase", () => {
  const glossary = [...course.glossary];
  assert.doesNotThrow(() => checkOutbound(body([TERM]), ideas.grade, course));
  assert.throws(() => checkOutbound(body(), ideas.grade, course), (e) => e.rule === "R-11", "not retained by the next request");
  for (const cleared of [["Ghost Phrase"], ["Delta"], [TERM.toLowerCase()], { term: TERM }, Array(33).fill(TERM)]) assert.throws(() => checkOutbound(body(cleared), ideas.grade, course), (e) => e.status === 422);
  assert.throws(() => checkOutbound(body([TERM], { ...payload, steps: [`Great ${TERM}`] }), ideas.grade, course), (e) => e.rule === "R-11", "a substring is not the actual flag");
  const long = "Capital ".repeat(12).trim();
  assert.throws(() => checkOutbound(body([long], { ...payload, steps: [long] }), ideas.grade, course), (e) => e.status === 422);
  for (const text of [course.roster[0].name, "person@example.edu", "EMP-12345", "Dr Unknown Person", "DOB 2000-01-02"]) assert.throws(() => checkOutbound(body([text], { ...payload, steps: [text] }), ideas.grade, course), (e) => e.status === 422, text);
  assert.deepEqual(course.glossary, glossary);
});

async function exerciseRoute(post, localDir, seen) {
  assert.equal((await post(body([TERM]))).status, 200);
  const first = seen.length;
  assert.equal((await post(body())).status, 422, "clearance expires after the request");
  assert.equal((await post(body(["Ghost Phrase"]))).status, 422);
  assert.equal((await post(body([TERM], { ...payload, steps: [...payload.steps, "Lucia Moreau"] }))).status, 422, "a valid term clearance cannot excuse another identity");
  for (const text of ["Lucia Moreau", "LUCIA MOREAU", "person@example.edu", "student 1234"]) assert.equal((await post(body([text], { ...payload, steps: [text] }))).status, 422, text);
  assert.equal(seen.length, first, "blocked requests make no provider call");
  assert.equal((await post(body(["Ghost Phrase"], { steps: ["lowercase work"], finalAnswer: 3.162 }))).status, 200);
  const logs = readFileSync(join(localDir, "proposals.jsonl"), "utf8").trim().split("\n").map(JSON.parse);
  assert.deepEqual(logs.map((r) => r.clearedCount), [1, 0]);
  for (const f of readdirSync(localDir).filter((f) => f.endsWith(".jsonl"))) {
    const text = readFileSync(join(localDir, f), "utf8");
    assert.equal(text.includes(TERM) || text.includes("Ghost Phrase") || text.includes("Lucia Moreau"), false, f);
  }
}

test("E5: legacy propose route enforces the same clearance checks against imported identities", async (t) => {
  const localDir = fresh(t), seen = []; smoke(localDir); known(localDir);
  const server = createApp({ localDir, env: { ANTHROPIC_API_KEY: "fake", MODEL_DEMO: "fake", MODEL_DEV: "fake" }, fetchImpl: provider(seen) });
  await new Promise((r) => server.listen(0, "127.0.0.1", r)); t.after(() => new Promise((r) => server.close(r)));
  const url = `http://127.0.0.1:${server.address().port}/propose`;
  await exerciseRoute((data) => fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(data) }), localDir, seen);
});

test("E5: actual Next propose handler checks the same untrusted clearance and logs counts only", async (t) => {
  const localDir = fresh(t), seen = []; smoke(localDir); known(localDir);
  const keys = ["REMAIN_LOCAL_DIR", "ANTHROPIC_API_KEY", "MODEL_DEMO", "MODEL_DEV", "REPLAY_MODE"];
  const previous = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  const originalFetch = globalThis.fetch;
  try {
    Object.assign(process.env, { REMAIN_LOCAL_DIR: localDir, ANTHROPIC_API_KEY: "fake", MODEL_DEMO: "fake", MODEL_DEV: "fake", REPLAY_MODE: "0" });
    globalThis.fetch = provider(seen);
    const root = fileURLToPath(new URL("..", import.meta.url));
    let src = stripTypeScriptTypes(readFileSync(join(root, "app/api/propose/route.ts"), "utf8"));
    src = src.replace(/(["'])@\/([^"']+)\1/g, (_, q, p) => q + pathToFileURL(join(root, p)).href + q);
    const route = await import("data:text/javascript;base64," + Buffer.from(src).toString("base64"));
    await exerciseRoute((data) => route.POST(new Request("http://localhost/api/propose", { method: "POST", body: JSON.stringify(data) })), localDir, seen);
  } finally {
    globalThis.fetch = originalFetch;
    for (const k of keys) if (previous[k] === undefined) delete process.env[k]; else process.env[k] = previous[k];
  }
});

test("E5: the actual Names panel sends the person's No, keep it choice", async () => {
  const { createRequire } = await import("node:module");
  const vm = await import("node:vm");
  const require = createRequire(import.meta.url), swc = require("next/dist/build/swc"); await swc.loadBindings();
  const compile = async (source, tsx = false) => (await swc.transform(source, { jsc: { parser: { syntax: "typescript", tsx }, target: "es2022", transform: { react: { runtime: "automatic" } } }, module: { type: "commonjs" } })).code;
  const cm = { exports: {} };
  vm.runInNewContext(await compile(readFileSync(new URL("../components/grading/copy.ts", import.meta.url), "utf8")), { module: cm, exports: cm.exports });
  const states = []; let cursor = 0, picked;
  const hooks = { useState(v) { const i = cursor++; if (!(i in states)) states[i] = typeof v === "function" ? v() : v; return [states[i], (next) => { states[i] = typeof next === "function" ? next(states[i]) : next; }]; } };
  const m = { exports: {} };
  vm.runInNewContext(await compile(readFileSync(new URL("../components/grading/Grader.tsx", import.meta.url), "utf8") + "\nexport {Names};", true), { module: m, exports: m.exports, require: (s) => s === "react" ? hooks : s === "./copy" ? { COPY: cm.exports.COPY } : s === "react/jsx-runtime" ? require(s) : {} });
  const render = () => { cursor = 0; return m.exports.Names({ stage: { flags: [{ token: TERM, rule: "R-11" }] }, onDone: (p) => { picked = p; }, onSkip() {} }); };
  const find = (n, p) => { if (Array.isArray(n)) { for (const c of n) { const r = find(c, p); if (r) return r; } return null; } if (!n || typeof n !== "object") return null; return p(n) ? n : find(n.props?.children, p); };
  let tree = render();
  assert.equal(find(tree, (n) => n.type === "button" && n.props.children === "Check this paper").props.disabled, true);
  const keep = find(tree, (n) => n.type === "button" && n.props.children === "No, keep it");
  assert.ok(keep, "keep choice is offered"); keep.props.onClick(); tree = render();
  const check = find(tree, (n) => n.type === "button" && n.props.children === "Check this paper");
  assert.equal(check.props.disabled, false); check.props.onClick();
  assert.deepEqual(JSON.parse(JSON.stringify(picked)), { [TERM]: "not-name" });
});
