import { getContext, LOCAL_DIR } from "@/server/context.js";
import { makeStudent } from "@/server/student.js";

// Stored for a person to read. Notifies nobody and writes to no system of record.
export async function POST(request: Request) {
  const { course, log } = getContext();
  const body = await request.json();
  const student = makeStudent({ localDir: LOCAL_DIR, course, decisions: () => log.read("decisions"), standardsOf: () => null, paperOf: () => null });
  const r = student.addRegrade({ anonId: body.anonId, questionId: body.questionId, text: body.text });
  if (r.status >= 400) return Response.json({ error: r.error }, { status: r.status });
  return Response.json({ saved: true }, { status: 201 });
}
