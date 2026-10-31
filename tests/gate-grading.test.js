// Privacy Gate in the grading beat: S-01..S-25 through the real pipeline, gate, adapter (replay), and log.
// The local stack below mirrors app/api/propose, app/api/log, and app/api/counts. No network, temp dirs only.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, writeFileSync, readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runGate, assertClean } from "../lib/gate.js";
import { runPipeline } from "../lib/pipeline.js";
import { verifyQuote, counters } from "../lib/engine.js";
import { blockedRecord, proposalRecord } from "../lib/logshape.js";
import { SYSTEM } from "../lib/prompts.js";
import { makeAdapter, LABEL_REPLAY, cacheKey } from "../server/adapter.js";
import { makeLog } from "../server/log.js";
import { course, ideas, submissions, sub } from "./helpers.js";

const FAKE_MODEL = "fake-fixture-not-a-model";
const HEADER_KEYS = ["name", "netid", "email", "timestamp", "filename"];
const rosterValues = course.roster.flatMap((r) => [r.name, r.netid, r.email, r.studentId]);

function localStack() {
  const localDir = mkdtempSync(join(tmpdir(), "remain-gate-grading-"));
  const adapter = makeAdapter({ env: { REPLAY_MODE: "1" }, fetchImpl: () => { throw new Error("no network in tests"); }, localDir });
  const log = makeLog(localDir, course);
  const sent = [];
  let providerCalls = 0;
  const res = (status, json) => ({ status, ok: status < 400, json: async () => json });

  const fetchImpl = async (path, init) => {
    const body = init?.body ? JSON.parse(init.body) : null;
    if (body) sent.push({ path, body });
    if (path === "/propose") {
      try { assertClean(body.payload, course); }
      catch (e) {
        if (e?.status !== 422) throw e;
        log.append("blocked", blockedRecord(body.idea, body.itemId, e.rule, e.count));
        return res(422, { code: "BLOCKED", rule: e.rule, count: e.count });
      }
      providerCalls++;
      const ideaConfig = ideas[body.idea];
      const r = await adapter.propose({ ideaConfig, payload: body.payload, promptName: body.promptName ?? ideaConfig.promptName });
      if (!r.ok) return res(502, { error: r.error, attempts: r.attempts });
      const verifyText = ideaConfig.verifyAgainst.map((f) => [].concat(body.payload[f] ?? []).join("\n")).join("\n");
      log.append("proposals", proposalRecord(body.idea, body.itemId, { ...r, proposals: r.proposals.map((p) => ({ ...p, verified: verifyQuote(p.quote, verifyText).found })) }));
      return res(200, { proposals: r.proposals, label: r.label, modelId: r.modelId, rung: r.rung, cacheHit: r.cacheHit });
    }
    if (path === "/log") {
      if (body.type !== "gate" && body.type !== "decision") return res(400, { error: "only gate and decision records" });
      log.append(body.type === "decision" ? "decisions" : "gate", body);
      return res(200, { ok: true });
    }
    if (path === "/counts") return res(200, counters(log.readAll()));
    throw new Error(`unexpected fetch ${path}`);
  };

  /** Clearly fake replay fixture for one exact payload, written to this test's temp dir only. */
  const seedReplay = (payload, proposals = []) => {
    const ph = cacheKey(ideas.grade, "grade-propose", payload);
    writeFileSync(join(adapter.paths.cache, `${ph}.${FAKE_MODEL}.json`), JSON.stringify({ modelId: FAKE_MODEL, proposals }));
  };
  const logText = () => {
    const out = [];
    const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); statSync(p).isDirectory() ? walk(p) : f.endsWith(".jsonl") && out.push(readFileSync(p, "utf8")); } };
    walk(localDir);
    return out.join("\n");
  };
  const logLines = (name) => (existsSync(join(localDir, `${name}.jsonl`)) ? readFileSync(join(localDir, `${name}.jsonl`), "utf8").trim().split("\n").filter(Boolean) : []);
  return { fetchImpl, seedReplay, sent, logText, logLines, providerCalls: () => providerCalls };
}

const reviewAll = async (card) => ({ confirmed: card.items.map((i) => i.code), overrides: [] });
const decide = async ({ computedScore }) => ({ decidedBy: "Test TA", grade: computedScore });

test("S-01..S-25: no header value or roster identifier reaches any payload, gate report, or log line", async () => {
  assert.equal(submissions.length, 25);
  const stack = localStack();
  for (const s of submissions) {
    for (const k of HEADER_KEYS) assert.ok(s.header?.[k], `${s.id} header.${k} missing from seed`);
    const g = runGate(s, ideas.grade, course);
    assert.equal(g.blocked, false, `${s.id} unexpectedly blocked`);
    assert.deepEqual(Object.keys(g.payload).sort(), ideas.grade.allowlistFields.slice().sort(), s.id);
    stack.seedReplay(g.payload, [{ code: "E-ARITH", quote: g.payload.steps[0], confidence: 0.5 }]);
    const reports = [];
    const r = await runPipeline(ideas.grade, s, { approveGate: async (report) => { reports.push(report); return true; }, review: reviewAll, decide }, { course, fetchImpl: stack.fetchImpl });
    assert.equal(r.receipt, "Assigned by you (TA)", `${s.id} did not complete`);
    assert.equal(r.label, LABEL_REPLAY, `${s.id} label`);

    const outbound = JSON.stringify(stack.sent.filter((x) => x.body.itemId === s.id)) + JSON.stringify(reports);
    for (const k of HEADER_KEYS) assert.ok(!outbound.includes(s.header[k]), `${s.id} header.${k} left the gate`);
  }
  assert.equal(LABEL_REPLAY, "CACHED REHEARSAL: NOT LIVE MODEL OUTPUT");
  assert.equal(stack.providerCalls(), 25);
  const everything = JSON.stringify(stack.sent) + stack.logText();
  for (const v of [...rosterValues, ...submissions.flatMap((s) => HEADER_KEYS.map((k) => s.header[k]))]) assert.ok(!everything.includes(v), `identifier reached a payload or log line: ${v.length} chars`);
  assert.ok(!everything.includes("aliasMap"));
  assert.equal(stack.logLines("gate").length, 25);
  assert.equal(stack.logLines("proposals").length, 25);
  assert.equal(stack.logLines("decisions").length, 25);
  assert.equal(stack.logLines("blocked").length, 0);
});

test("S-12: the roster name inside a step is aliased; the NAME count is the gate's own count everywhere", async () => {
  const s12 = sub("S-12");
  const g = runGate(s12, ideas.grade, course);
  const nameCount = g.report.counts.NAME;
  assert.ok(nameCount >= 1, "spec 8: one step in S-12 contains a roster name");

  const hits = course.roster.filter((r) => s12.steps.some((step) => step.includes(r.name)));
  assert.ok(hits.length >= 1);
  for (const r of hits) {
    const i = s12.steps.findIndex((step) => step.includes(r.name));
    assert.ok(!g.payload.steps[i].includes(r.name), "name left in the step");
    assert.ok(g.payload.steps[i].includes(r.alias), "step not aliased to the roster alias");
  }

  const stack = localStack();
  stack.seedReplay(g.payload);
  let shown;
  await runPipeline(ideas.grade, s12, { approveGate: async (report) => { shown = report; return true; }, review: reviewAll, decide }, { course, fetchImpl: stack.fetchImpl });
  assert.equal(shown.counts.NAME, nameCount, "count handed to the gate panel");
  const [gateLine] = stack.logLines("gate");
  assert.equal(JSON.parse(gateLine).counts.NAME, nameCount, "count in gate.jsonl");
  const counts = await (await stack.fetchImpl("/counts")).json();
  assert.equal(counts.piiStripped.NAME, nameCount, "count in /counts");
  for (const r of hits) assert.ok(!stack.logText().includes(r.name));
});

test("gate panel input is types and counts only, never values", () => {
  for (const s of submissions) {
    const { report } = runGate(s, ideas.grade, course);
    assert.deepEqual(Object.keys(report).sort(), ["blockedRules", "counts", "droppedFields"]);
    assert.equal(typeof report.droppedFields, "number");
    for (const [t, n] of Object.entries(report.counts)) { assert.match(t, /^[A-Z_]+$/); assert.equal(typeof n, "number"); }
    for (const rule of report.blockedRules) assert.match(rule, /^R-\d\d$/);
  }
});

test("T12 approve sends only the redacted payload; stop sends nothing", async () => {
  const s12 = sub("S-12");
  const g = runGate(s12, ideas.grade, course);

  const declined = localStack();
  const d = await runPipeline(ideas.grade, s12, { approveGate: async () => false }, { course, fetchImpl: declined.fetchImpl });
  assert.equal(d.stopped, "gate");
  assert.equal(declined.sent.length, 0, "stop must send nothing, not even a gate log record");
  assert.equal(declined.providerCalls(), 0);
  assert.equal(declined.logText(), "");

  const approved = localStack();
  approved.seedReplay(g.payload);
  await runPipeline(ideas.grade, s12, { approveGate: async () => true, review: reviewAll, decide }, { course, fetchImpl: approved.fetchImpl });
  const proposes = approved.sent.filter((x) => x.path === "/propose");
  assert.equal(proposes.length, 1);
  assert.deepEqual(proposes[0].body.payload, g.payload, "exactly the redacted payload is sent");
  assert.deepEqual(Object.keys(proposes[0].body).sort(), ["idea", "itemId", "payload", "promptName"]);
});

test("T12 local block (R-12) flags for human review and sends nothing, even if approve is pressed", async () => {
  const paper = { ...sub("S-01"), id: "S-01", steps: [...sub("S-01").steps, "born 04/12/2001"] };
  const stack = localStack();
  let seen;
  const r = await runPipeline(ideas.grade, paper, { approveGate: async (report, flags, opts) => { seen = { report, opts }; return true; } }, { course, fetchImpl: stack.fetchImpl });
  assert.equal(seen.opts.blocked, true, "panel is told the send is blocked");
  assert.ok(seen.report.blockedRules.includes("R-12"));
  assert.equal(r.stopped, "gate");
  assert.equal(stack.sent.length, 0);
  assert.equal(stack.providerCalls(), 0);
});

test("T12 server 422: assertClean blocks an unclean payload, logs a blocked event without the value, sends nothing", async () => {
  const s01 = sub("S-01");
  const stack = localStack();
  const tampering = async (path, init) => {
    if (path !== "/propose") return stack.fetchImpl(path, init);
    const body = JSON.parse(init.body);
    body.payload.steps = [...body.payload.steps, `contact ${s01.header.email}`];
    return stack.fetchImpl(path, { ...init, body: JSON.stringify(body) });
  };
  const r = await runPipeline(ideas.grade, s01, { approveGate: async () => true, review: () => { throw new Error("must not reach review"); } }, { course, fetchImpl: tampering });
  assert.equal(r.stopped, "blocked");
  assert.equal(r.detail.code, "BLOCKED");
  assert.equal(r.detail.rule, "R-01");
  assert.equal(stack.providerCalls(), 0, "nothing reaches the provider");
  const blocked = stack.logLines("blocked");
  assert.equal(blocked.length, 1);
  assert.deepEqual(Object.keys(JSON.parse(blocked[0])).sort(), ["count", "idea", "itemId", "rule", "ts", "type"]);
  assert.equal(stack.logLines("proposals").length, 0);
  assert.equal(stack.logLines("decisions").length, 0);
  assert.ok(!stack.logText().includes(s01.header.email));
});
