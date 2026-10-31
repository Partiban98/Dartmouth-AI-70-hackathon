import { getContext, LOCAL_DIR } from "@/server/context.js";
import { assertLogSafe } from "@/lib/logshape.js";
import { withLocalIdentities } from "@/server/privacy.js";

export async function POST(request: Request) {
  const { log, course } = getContext();
  const rec = await request.json();
  if (rec.type !== "gate" && rec.type !== "decision") return Response.json({ error: "only gate and decision records are accepted here" }, { status: 400 });
  // This laptop's own students count as known names here too, so a note naming one is refused, never written.
  try { assertLogSafe(rec, withLocalIdentities(course, LOCAL_DIR)); }
  catch (e: any) { return Response.json({ error: e.message }, { status: 422 }); }
  try { log.append(rec.type === "decision" ? "decisions" : "gate", rec); }
  catch (e: any) { return Response.json({ error: e.message }, { status: 400 }); }
  return Response.json({ ok: true });
}
