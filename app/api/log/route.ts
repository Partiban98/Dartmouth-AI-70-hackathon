import { getContext, LOCAL_DIR } from "@/server/context.js";
import { logProblem, withLocalIdentities } from "@/server/privacy.js";
import { recordProblem } from "@/server/records.js";

export async function POST(request: Request) {
  const { log, course, ideas } = getContext();
  const rec = await request.json();
  // A malformed record would break counts and exports for every later request, so it is refused before writing.
  const shape = recordProblem(rec, ideas() as any);
  if (shape) return Response.json({ error: shape }, { status: 400 });
  // This laptop's own students count as known names here too, so a note naming one is refused, never written.
  const problem = logProblem(rec, withLocalIdentities(course, LOCAL_DIR));
  if (problem) return Response.json({ error: problem }, { status: 422 });
  try { log.append(rec.type === "decision" ? "decisions" : "gate", rec); }
  catch (e: any) { return Response.json({ error: e.message }, { status: 400 }); }
  return Response.json({ ok: true });
}
