// One place that loads seeds, builds ideas, and wires the adapter and log for the Next route handlers.
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { makeIdeas } from "../lib/ideas.js";
import { makeAdapter } from "./adapter.js";
import { makeLog } from "./log.js";
import { loadDotenv } from "./env.js";
import { assignmentSets } from "./assignment.js";

const ROOT = process.cwd();
export const DATA_DIR = join(ROOT, "data");
// REMAIN_LOCAL_DIR lets a second server on one machine act as a second laptop (own id, own papers, own names).
export const LOCAL_DIR = process.env.REMAIN_LOCAL_DIR || join(ROOT, "local");
export const readData = (f) => JSON.parse(readFileSync(join(DATA_DIR, f), "utf8"));

/** Latest rubric: instructor edits saved under local/rubrics override the seed. */
export function loadStandards(file) {
  const seed = readData(file);
  const p = join(LOCAL_DIR, "rubrics", `${seed.id}.json`);
  return existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : seed;
}
export function saveStandards(table) {
  mkdirSync(join(LOCAL_DIR, "rubrics"), { recursive: true });
  writeFileSync(join(LOCAL_DIR, "rubrics", `${table.id}.json`), JSON.stringify(table, null, 2) + "\n");
}

let ctx = null;
export function getContext() {
  if (ctx) return ctx;
  loadDotenv(join(ROOT, ".env"));
  const course = readData("course.json");
  const gradingSets = {};
  if (existsSync(join(DATA_DIR, "demo201-q3q5.v1.0.json"))) gradingSets.grade93 = loadStandards("demo201-q3q5.v1.0.json");
  const ideas = () => makeIdeas({ gradeStandards: loadStandards("grade-q5.v1.0.json"), companion: readData("companion-ch3.json"), upskillStandards: readData("upskill-email.v1.0.json"), gradingSets: { ...assignmentSets(LOCAL_DIR), ...Object.fromEntries(Object.keys(gradingSets).map((k) => [k, loadStandards("demo201-q3q5.v1.0.json")])) } });
  ctx = { course, ideas, adapter: makeAdapter({ localDir: LOCAL_DIR }), log: makeLog(LOCAL_DIR, course) };
  return ctx;
}
