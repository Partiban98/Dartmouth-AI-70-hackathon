// Gate G0: one schema-valid /propose-shaped call on the exact model. Writes local/smoke.json. Counts as one call.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { runGate, assertClean } from "../lib/gate.js";
import { makeIdeas } from "../lib/ideas.js";
import { makeAdapter } from "../server/adapter.js";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const read = (f) => JSON.parse(readFileSync(join(ROOT, "data", f), "utf8"));
const course = read("course.json");
const ideas = makeIdeas({ gradeStandards: read("grade-q5.v1.0.json"), companion: read("companion-ch3.json"), upskillStandards: read("upskill-email.v1.0.json") });
const s01 = read("grade-q5.submissions.json").find((s) => s.id === "S-01");
const gate = runGate(s01, ideas.grade, course);
assertClean(gate.payload, course);

const adapter = makeAdapter({ localDir: join(ROOT, "local") });
const r = await adapter.smokeTest({ ideaConfig: ideas.grade, payload: gate.payload });
if (r.ok) {
  console.log(`G0 PASS  model=${r.modelId}  mode=${r.mode}  in=${r.usage?.input_tokens ?? "?"} out=${r.usage?.output_tokens ?? "?"}`);
  if (r.modelId !== r.requestedModel) console.log(`NOTE: requested ${r.requestedModel}, API returned ${r.modelId}. The on-screen label uses the returned id.`);
  console.log("Billing check: open the provider console and confirm spend before rehearsal (team item)");
} else {
  console.error("G0 FAIL", JSON.stringify(r, null, 2));
  console.error("Fallback ladder applies. Nothing is silently substituted.");
  process.exit(1);
}
