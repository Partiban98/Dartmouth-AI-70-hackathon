import { getContext } from "@/server/context.js";
import { recordProblem } from "@/server/records.js";

export async function POST(request: Request) {
  const { log, ideas } = getContext();
  const rec = await request.json();
  // A malformed record would break counts and exports for every later request, so it is refused before writing.
  const problem = recordProblem(rec, ideas() as any);
  if (problem) return Response.json({ error: problem }, { status: 400 });
  try { log.append(rec.type === "decision" ? "decisions" : "gate", rec); }
  catch (e: any) { return Response.json({ error: e.message }, { status: 400 }); }
  return Response.json({ ok: true });
}
