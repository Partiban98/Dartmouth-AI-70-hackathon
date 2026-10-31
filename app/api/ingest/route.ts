// Papers chosen in the browser are saved on this machine and imported. Nothing here talks to a model.
import { getContext, LOCAL_DIR } from "@/server/context.js";
import { importUploads } from "@/server/ingest.js";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { course, ideas } = getContext();
  const form = await request.formData();
  const files: { name: string; bytes: Buffer }[] = [];
  for (const [k, v] of form.entries()) if (k === "files" && v instanceof File) files.push({ name: v.name, bytes: Buffer.from(await v.arrayBuffer()) });
  const rubricId = String(form.get("rubric") ?? "grade-q5");
  const setName = String(form.get("name") ?? "");
  try {
    const r = await importUploads({ files, setName, rubricId, course, localDir: LOCAL_DIR, ideaConfig: (ideas() as any).grade });
    return Response.json({ ok: true, set: r.meta, report: r.report.map((x: any) => ({ id: x.id, steps: x.steps, counts: x.counts, blocked: x.blocked })) });
  } catch (e: any) {
    return Response.json({ ok: false, error: e.message }, { status: 400 });
  }
}
