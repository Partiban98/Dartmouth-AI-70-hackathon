// Instructor-owned rubric: read the latest version, save a new version. Validated by code before it is saved.
// A Quiz/Assignment code reads its own scheme; only the head TA's laptop may change it.
import { loadStandards, saveStandards, LOCAL_DIR, getContext } from "@/server/context.js";
import { schemeProblem, withLocalIdentities } from "@/server/privacy.js";
import { validateStandards } from "@/lib/engine.js";
import { loadAssignment, saveScheme, unsafePattern } from "@/server/assignment.js";
import { uploaderId } from "@/server/ingest.js";

export const dynamic = "force-dynamic";
const FILES: Record<string, string> = { "grade-q5": "grade-q5.v1.0.json", "demo201-q3q5": "demo201-q3q5.v1.0.json" };

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id") ?? "grade-q5";
  const a = loadAssignment(LOCAL_DIR, id);
  if (a) return Response.json(a.standards);
  if (!FILES[id]) return Response.json({ error: "unknown rubric" }, { status: 404 });
  return Response.json(loadStandards(FILES[id]));
}

export async function POST(request: Request) {
  const table = await request.json();
  const p = schemeProblem(table, withLocalIdentities(getContext().course, LOCAL_DIR));
  if (p) return Response.json({ ok: false, errors: [p] }, { status: 422 });
  if (loadAssignment(LOCAL_DIR, table?.id)) {
    const { errors } = saveScheme(LOCAL_DIR, table, uploaderId(LOCAL_DIR));
    return errors ? Response.json({ ok: false, errors }, { status: 422 }) : Response.json({ ok: true, version: table.version });
  }
  if (!FILES[table?.id]) return Response.json({ error: "unknown rubric" }, { status: 404 });
  const v = validateStandards(table);
  if (!v.ok) return Response.json({ ok: false, errors: v.errors }, { status: 422 });
  const unsafe = (table.methods ?? []).map((m: any) => unsafePattern(m.signature)).find(Boolean);
  if (unsafe) return Response.json({ ok: false, errors: [unsafe] }, { status: 422 });
  saveStandards(table);
  return Response.json({ ok: true, version: table.version });
}
