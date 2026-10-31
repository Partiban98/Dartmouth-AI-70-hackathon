import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { DATA_DIR } from "@/server/context.js";

export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  // Eval labels are for tests only. Never served, never loaded by the UI.
  if (!/^[\w.-]+\.json$/.test(file) || file.endsWith(".eval.json")) return Response.json({ error: "not found" }, { status: 404 });
  const p = join(DATA_DIR, file);
  if (!existsSync(p)) return Response.json({ error: "not found" }, { status: 404 });
  return new Response(readFileSync(p), { headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
}
