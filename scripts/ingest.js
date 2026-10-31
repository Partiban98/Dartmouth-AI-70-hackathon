#!/usr/bin/env node
// Point Remain at a folder of papers on this Mac.
//   node scripts/ingest.js <folder> [--set my-quiz] [--rubric grade-q5|demo201-q3q5] [--roster roster.csv] [--propose]
// Reads .pdf (text layer), .txt, .md. Keeps the paper-to-student map in local/ingest/<set>/map.json, never sent, never logged.
// --propose runs every paper through the gate, assertClean, and the model now, so the portal opens instantly on cached proposals.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { runGate, assertClean } from "../lib/gate.js";
import { makeIdeas } from "../lib/ideas.js";
import { verifyQuote } from "../lib/engine.js";
import { proposalRecord } from "../lib/logshape.js";
import { makeAdapter } from "../server/adapter.js";
import { makeLog } from "../server/log.js";
import { loadDotenv } from "../server/env.js";
import { importFolder, rosterFromCsv, safeSetId, refreshSet, uploaderId } from "../server/ingest.js";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
loadDotenv(join(ROOT, ".env"));
const args = process.argv.slice(2);
const folder = args.find((a) => !a.startsWith("--"));
const opt = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
if (!folder) { console.error("usage: node scripts/ingest.js <folder> [--set id] [--rubric grade-q5|demo201-q3q5] [--roster roster.csv] [--propose]"); process.exit(1); }
const rubricId = opt("rubric", "grade-q5");
const setId = safeSetId(opt("set", `imp-${basename(resolve(folder))}`));
const read = (f) => JSON.parse(readFileSync(join(ROOT, "data", f), "utf8"));
const course = read("course.json");
if (opt("roster")) { course.roster = rosterFromCsv(readFileSync(resolve(opt("roster")), "utf8")); writeFileSync(join(ROOT, "local", "ingest-roster.json"), JSON.stringify(course.roster, null, 2)); }
const standards = read(rubricId === "demo201-q3q5" ? "demo201-q3q5.v1.0.json" : "grade-q5.v1.0.json");
const ideas = makeIdeas({ gradeStandards: read("grade-q5.v1.0.json"), companion: read("companion-ch3.json"), upskillStandards: read("upskill-email.v1.0.json"), gradingSets: { [setId]: standards } });
const ideaConfig = ideas[setId];

const { papers, report } = await importFolder({ folder: resolve(folder), setId, rubricId, course, localDir: join(ROOT, "local"), ideaConfig });
console.log(`Imported ${papers.length} papers from ${folder} as set "${setId}" on rubric ${rubricId}. This laptop: ${uploaderId(join(ROOT, "local"))}.`);
console.log("Paper | file | steps | fields dropped | identifiers replaced (types and counts) | gate");
for (const r of report) console.log(`${r.id} | ${r.file} | ${r.steps} | ${r.droppedFields} | ${Object.entries(r.counts).map(([k, v]) => `${k}:${v}`).join(" ") || "none"} | ${r.blocked ? "BLOCKED " + r.blockedRules.join(",") + " (human pick needed in the portal)" : r.clean ? "clean" : "assertClean would block"}`);
console.log(`Map of paper id to student saved LOCALLY at local/ingest/${setId}/map.json. It is never sent and never logged.`);

if (args.includes("--propose")) {
  const adapter = makeAdapter({ localDir: join(ROOT, "local") });
  const log = makeLog(join(ROOT, "local"), course);
  let sent = 0, skipped = 0;
  for (const p of papers) {
    const g = runGate(p, ideaConfig, course);
    if (g.blocked) { skipped++; console.log(`${p.id}: skipped, gate blocked (${g.report.blockedRules.join(",")}); decide in the portal`); continue; }
    try { assertClean(g.payload, course); } catch (e) { skipped++; console.log(`${p.id}: skipped, assertClean ${e.rule}`); continue; }
    const r = await adapter.propose({ ideaConfig, payload: g.payload, promptName: ideaConfig.promptName });
    if (!r.ok) { console.log(`${p.id}: no model answer (${r.error})`); continue; }
    const proposals = r.proposals.map((x) => ({ ...x, verified: verifyQuote(x.quote, g.payload.steps.join("\n")).found }));
    log.append("proposals", proposalRecord(setId, p.id, { ...r, proposals }));
    sent++;
    console.log(`${p.id}: ${r.label}${r.cacheHit ? " (cached)" : ""} proposed ${proposals.map((x) => `${x.code}${x.verified ? "" : "?"}`).join(" ") || "nothing"}`);
  }
  console.log(`Proposals ready for ${sent} papers, ${skipped} need a human at the gate. Open http://localhost:3000/grade and confirm each one. Nothing is graded until a person decides.`);
}

if (args.includes("--watch")) {
  console.log("Watching the folder. New .pdf, .txt, or .md files are added every 10 seconds with new ids; existing ids never change. Ctrl-C to stop.");
  let last = papers.length;
  setInterval(async () => {
    try { const r = await refreshSet({ setId, course, localDir: join(ROOT, "local"), ideaConfig }); if (r.papers.length !== last) { console.log(`${new Date().toLocaleTimeString()}: ${r.papers.length} papers (${r.papers.length - last} new)`); last = r.papers.length; } }
    catch (e) { console.log("watch error:", e.message); }
  }, 10_000);
}
