// Papers chosen in the browser are saved on this machine and imported. Nothing here talks to a model.
import { getContext, LOCAL_DIR } from "@/server/context.js";
import { importUploads, refreshSet, uploaderId } from "@/server/ingest.js";
import { loadAssignment } from "@/server/assignment.js";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { course, ideas } = getContext();
  const form = await request.formData();
  const files: { name: string; bytes: Buffer }[] = [];
  for (const [k, v] of form.entries()) if (k === "files" && v instanceof File) files.push({ name: v.name, bytes: Buffer.from(await v.arrayBuffer()) });
  // Papers for a Quiz/Assignment go under its code, graded with its scheme.
  const a = loadAssignment(LOCAL_DIR, String(form.get("assignment") ?? ""));
  const rubricId = a ? a.code : String(form.get("rubric") ?? "grade-q5");
  const setName = a ? a.code : String(form.get("name") ?? "");
  try {
    const r = await importUploads({ files, setName, title: a ? `${a.course} · ${a.title}` : undefined, rubricId, course, localDir: LOCAL_DIR, ideaConfig: (ideas() as any).grade });
    return Response.json({ ok: true, set: r.meta, report: r.report.map((x: any) => ({ id: x.id, steps: x.steps, counts: x.counts, blocked: x.blocked })) });
  } catch (e: any) {
    return Response.json({ ok: false, error: e.message }, { status: 400 });
  }
}

/** PUT { set } re-reads the folder the set came from and keeps ids. GET returns this laptop's uploader id. */
export async function PUT(request: Request) {
  const { course, ideas } = getContext();
  const { set } = await request.json();
  try { const r = await refreshSet({ setId: set, course, localDir: LOCAL_DIR, ideaConfig: (ideas() as any).grade }); return Response.json({ ok: true, count: r.papers.length }); }
  catch (e: any) { return Response.json({ ok: false, error: e.message }, { status: 400 }); }
}
export async function GET() { return Response.json({ uploader: uploaderId(LOCAL_DIR) }); }
