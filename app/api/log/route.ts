import { getContext } from "@/server/context.js";

export async function POST(request: Request) {
  const { log } = getContext();
  const rec = await request.json();
  if (rec.type !== "gate" && rec.type !== "decision") return Response.json({ error: "only gate and decision records are accepted here" }, { status: 400 });
  try { log.append(rec.type === "decision" ? "decisions" : "gate", rec); }
  catch (e: any) { return Response.json({ error: e.message }, { status: 400 }); }
  return Response.json({ ok: true });
}
