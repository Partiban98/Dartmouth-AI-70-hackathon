// Instructor-owned rubric: read the latest version, save a new version. Validated by code before it is saved.
import { loadStandards, saveStandards } from "@/server/context.js";
import { validateStandards } from "@/lib/engine.js";

export const dynamic = "force-dynamic";
const FILES: Record<string, string> = { "grade-q5": "grade-q5.v1.0.json", "engs93-q3q5": "engs93-q3q5.v1.0.json" };

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id") ?? "grade-q5";
  if (!FILES[id]) return Response.json({ error: "unknown rubric" }, { status: 404 });
  return Response.json(loadStandards(FILES[id]));
}

export async function POST(request: Request) {
  const table = await request.json();
  if (!FILES[table?.id]) return Response.json({ error: "unknown rubric" }, { status: 404 });
  const v = validateStandards(table);
  if (!v.ok) return Response.json({ ok: false, errors: v.errors }, { status: 422 });
  saveStandards(table);
  return Response.json({ ok: true, version: table.version });
}
