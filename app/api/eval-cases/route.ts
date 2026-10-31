import { getContext, LOCAL_DIR, readData } from "@/server/context.js";
import { makeEvalCases } from "@/server/evalcases.js";
import { loadImported } from "@/server/ingest.js";
import { runGate } from "@/lib/gate.js";

// Same shape the pipeline verifies quotes against, so a stored case is the text the model actually saw.
const textOf = (payload: any, fields: string[]) => fields.map((f) => { const v = payload[f]; return Array.isArray(v) ? v.join("\n") : v && typeof v === "object" ? Object.values(v).join("\n") : String(v ?? ""); }).join("\n");

const SEED_FILE: Record<string, string> = { grade: "grade-q5.submissions.json", grade93: "demo201-q3q5.submissions.json" };

function findPaper(idea: string, itemId: string) {
  try { if (SEED_FILE[idea]) return (readData(SEED_FILE[idea]) as any[]).find((p) => p.id === itemId) ?? null; } catch { /* falls through to imported */ }
  return (loadImported(LOCAL_DIR, idea)?.papers ?? []).find((p: any) => p.id === itemId) ?? null;
}

export async function POST(request: Request) {
  const { course, ideas, log } = getContext();
  const body = await request.json();
  const ideaConfig = (ideas() as any)[body.idea];
  if (!ideaConfig) return Response.json({ error: "unknown idea" }, { status: 400 });
  const cases = makeEvalCases({ localDir: LOCAL_DIR, course });

  // The text is derived here by running the frozen gate, never taken from the browser,
  // so a stored case can only ever hold post-gate text.
  let text = "";
  const paper = findPaper(body.idea, body.itemId);
  if (paper) {
    const gate = runGate(paper, ideaConfig, course, {});
    if (gate.blocked) return Response.json({ error: "this paper does not pass the privacy check on its own; not stored" }, { status: 400 });
    text = textOf(gate.payload, ideaConfig.verifyAgainst);
  }
  if (!text) return Response.json({ error: "could not find that paper to take its checked text from" }, { status: 400 });

  const r = cases.add({ idea: body.idea, itemId: body.itemId, aiCode: body.aiCode, taRuling: body.taRuling, reason: body.reason, rubricVersion: ideaConfig.standards?.version ?? null, text });
  if (r.status >= 400) return Response.json({ error: r.error }, { status: r.status });
  void log;
  return Response.json({ added: !r.duplicate, duplicate: !!r.duplicate, ...cases.summary() }, { status: r.status });
}
