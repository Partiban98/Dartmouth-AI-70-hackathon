#!/usr/bin/env node
// Runs every stored override case back through the model and reports how often
// the AI now agrees with the TA's ruling. The TA's ruling is the expected
// result. This script never writes a case, never edits one, and never asks the
// model what the answer should be.
//
//   node scripts/eval-overrides.js           live, under the adapter's call cap and payload cache
//   node scripts/eval-overrides.js --replay  cache only, makes no live call
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { makeAdapter } from "../server/adapter.js";
import { makeEvalCases, topCode } from "../server/evalcases.js";
import { makeIdeas } from "../lib/ideas.js";
import { loadDotenv } from "../server/env.js";

/** Pure. Counts agreement between each case's TA ruling and whatever propose() returns.
 *  propose is injected so a test can stand in for the model. */
export async function runEval({ cases, propose }) {
  let match = 0, mismatch = 0, live = 0, errors = 0;
  const rows = [];
  for (const c of cases) {
    const r = await propose(c);
    if (r && r.cacheHit === false) live++;
    // A call that failed is not evidence of agreement: an empty proposal list
    // reads as "OK", which would silently score a provider failure as the AI
    // agreeing with the TA. Unanswered cases are counted apart and are not
    // part of the total that match and mismatch divide.
    if (!r || r.ok === false) { errors++; rows.push({ idea: c.idea, itemId: c.itemId, agree: null }); continue; }
    const aiNow = topCode(r.proposals ?? []);
    const agree = aiNow === c.taRuling;
    if (agree) match++; else mismatch++;
    rows.push({ idea: c.idea, itemId: c.itemId, agree });
  }
  return { total: cases.length - errors, match, mismatch, live, errors, rows };
}

/** A stored case holds post-gate text only, so the payload is rebuilt from it:
 *  the lines are the steps the model saw, the last line is the final answer. */
export const payloadOf = (text) => { const lines = String(text).split("\n").filter((l) => l.trim()); return { steps: lines, finalAnswer: lines[lines.length - 1] ?? "" }; };

async function main() {
  const ROOT = fileURLToPath(new URL("..", import.meta.url));
  const replay = process.argv.includes("--replay");
  loadDotenv(join(ROOT, ".env"));
  const env = replay ? { ...process.env, REPLAY_MODE: "1" } : process.env;
  const localDir = process.env.REMAIN_LOCAL_DIR || join(ROOT, "local");
  const readData = (f) => JSON.parse(readFileSync(join(ROOT, "data", f), "utf8"));
  const course = readData("course.json");
  const gradingSets = {};
  if (existsSync(join(ROOT, "data", "demo201-q3q5.v1.0.json"))) gradingSets.grade93 = readData("demo201-q3q5.v1.0.json");
  const ideas = makeIdeas({ gradeStandards: readData("grade-q5.v1.0.json"), companion: readData("companion-ch3.json"), upskillStandards: readData("upskill-email.v1.0.json"), gradingSets });
  const store = makeEvalCases({ localDir, course });
  const cases = store.list();
  if (!cases.length) { console.log("No test cases yet. Override a suggestion in the app and press Make this a test case."); return; }

  const adapter = makeAdapter({ localDir, env });
  const propose = async (c) => {
    const ideaConfig = ideas[c.idea];
    if (!ideaConfig) return { proposals: [] };
    try { return await adapter.propose({ ideaConfig, payload: payloadOf(c.text), promptName: ideaConfig.promptName }); }
    catch (e) { console.log(`  ${c.itemId}: ${e.message}`); return { ok: false, proposals: [] }; }
  };

  const r = await runEval({ cases, propose });
  store.appendRun(r);
  console.log(`${r.total} case${r.total === 1 ? "" : "s"} checked${replay ? " from cache only" : ""}: ${r.match} agree with the TA, ${r.mismatch} still disagree.`);
  if (r.errors) console.log(`${r.errors} case${r.errors === 1 ? "" : "s"} got no answer from the provider and were not scored.`);
  console.log(`Live model calls made: ${r.live}${replay ? " (replay, cache only)" : ` (cap ${(await import("../server/adapter.js")).CALL_CAP})`}`);
  for (const row of r.rows) console.log(`  ${row.idea} ${row.itemId}: ${row.agree === null ? "no answer" : row.agree ? "agrees" : "disagrees"}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main();
