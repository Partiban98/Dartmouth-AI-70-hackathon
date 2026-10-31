import { getContext, LOCAL_DIR, readData } from "@/server/context.js";
import { makeEvalCases, prepareCase } from "@/server/evalcases.js";
import { loadImported } from "@/server/ingest.js";

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

  const decision = log.read("decisions").filter((d: any) => d.idea === body.idea && d.itemId === body.itemId).at(-1);
  const prepared = prepareCase({ body, paper: findPaper(body.idea, body.itemId), ideaConfig, decision, course });
  if (prepared.status >= 400) return Response.json({ error: prepared.error }, { status: prepared.status });
  const r = cases.add(prepared.value);
  if (r.status >= 400) return Response.json({ error: r.error }, { status: r.status });
  return Response.json({ added: !r.duplicate, duplicate: !!r.duplicate, ...cases.summary() }, { status: r.status });
}
