// The original file of a paper this laptop uploaded, shown to the grader beside the extracted text. Local only: it is
// never sent to a model or written to a log, so a TA can check the original if text extraction missed something.
import { readFileSync } from "node:fs";
import { LOCAL_DIR } from "@/server/context.js";
import { originalFile } from "@/server/ingest.js";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const f = originalFile(LOCAL_DIR, q.get("set") ?? "", q.get("id") ?? "");
  if (!f) return Response.json({ error: "no original file for this paper" }, { status: 404 });
  return new Response(readFileSync(f.path), { headers: { "content-type": f.type, "content-disposition": "inline", "cache-control": "no-store", "x-content-type-options": "nosniff" } });
}
