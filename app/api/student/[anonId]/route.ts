import { getContext, LOCAL_DIR, readData } from "@/server/context.js";
import { makeStudent } from "@/server/student.js";
import { loadImported } from "@/server/ingest.js";

export const dynamic = "force-dynamic";

const SEED_FILE: Record<string, string> = { grade: "grade-q5.submissions.json", grade93: "demo201-q3q5.submissions.json" };
const paperOf = (idea: string, id: string) => {
  try { if (SEED_FILE[idea]) return (readData(SEED_FILE[idea]) as any[]).find((p) => p.id === id) ?? null; } catch { /* imported next */ }
  return (loadImported(LOCAL_DIR, idea)?.papers ?? []).find((p: any) => p.id === id) ?? null;
};

export async function GET(_request: Request, { params }: { params: Promise<{ anonId: string }> }) {
  const { anonId } = await params;
  const { course, ideas, log } = getContext();
  const student = makeStudent({
    localDir: LOCAL_DIR, course,
    decisions: () => log.read("decisions"),
    standardsOf: (idea: string) => (ideas() as any)[idea]?.standards ?? null,
    paperOf,
  });
  const view = student.view(anonId);
  if (!view) return Response.json({ error: "no marks for that id" }, { status: 404 });
  return Response.json(view);
}
