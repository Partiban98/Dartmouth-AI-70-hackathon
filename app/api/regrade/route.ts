import { getContext, LOCAL_DIR } from "@/server/context.js";
import { makeStudent } from "@/server/student.js";

// Stored for a person to read. Notifies nobody and writes to no system of record.
export async function POST(request: Request) {
  const { course, log } = getContext();
  let body;
  try { body = await request.json(); } catch { return Response.json({ error: "invalid request" }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return Response.json({ error: "invalid request" }, { status: 400 });
  const student = makeStudent({ localDir: LOCAL_DIR, course, decisions: () => log.read("decisions"), standardsOf: () => null, paperOf: () => null });
  const r = student.addRegrade({ anonId: body.anonId, questionId: body.questionId, text: body.text });
  if (r.status >= 400) return Response.json({ error: r.error }, { status: r.status });
  return Response.json({ saved: true }, { status: 201 });
}
