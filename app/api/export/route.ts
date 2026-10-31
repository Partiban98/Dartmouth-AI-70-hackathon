// CSV for the TA's sheet. Student names are re-attached from the LOCAL map on this machine; the model never saw them.
import { getContext, LOCAL_DIR, loadStandards } from "@/server/context.js";
import { exportCsv, loadImported, loadMap } from "@/server/ingest.js";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { log } = getContext();
  const url = new URL(request.url);
  const set = url.searchParams.get("set") ?? "grade";
  let papers: any[], map: Record<string, any> = {}, table: any;
  if (set === "grade" || set === "grade93") {
    papers = JSON.parse(readFileSync(join(process.cwd(), "data", set === "grade" ? "grade-q5.submissions.json" : "demo201-q3q5.submissions.json"), "utf8"));
    map = Object.fromEntries(papers.map((p: any) => [p.id, { file: p.header?.filename ?? "", name: p.header?.name ?? p.header?.code ?? "" }]));
    table = loadStandards(set === "grade" ? "grade-q5.v1.0.json" : "demo201-q3q5.v1.0.json");
  } else {
    const imp = loadImported(LOCAL_DIR, set);
    if (!imp) return Response.json({ error: "not found" }, { status: 404 });
    papers = imp.papers; map = loadMap(LOCAL_DIR, set);
    table = loadStandards(imp.meta.rubric === "demo201-q3q5" ? "demo201-q3q5.v1.0.json" : "grade-q5.v1.0.json");
  }
  const csv = exportCsv({ setId: set, papers, map, logs: log.readAll(), table });
  return new Response(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="remain-${set}.csv"` } });
}
