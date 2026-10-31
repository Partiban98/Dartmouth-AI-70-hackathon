// Quiz/Assignment codes on this laptop: list, create (head TA), join by pasting a pack. Nothing here talks to a model.
import { LOCAL_DIR } from "@/server/context.js";
import { uploaderId } from "@/server/ingest.js";
import { createAssignment, encodePack, joinAssignment, listAssignments } from "@/server/assignment.js";

export const dynamic = "force-dynamic";
const fail = (e: any) => Response.json({ ok: false, error: e.message }, { status: 400 });

export async function GET() {
  return Response.json({ me: uploaderId(LOCAL_DIR), assignments: listAssignments(LOCAL_DIR).map((a: any) => ({ ...a, pack: encodePack(a) })) });
}
export async function POST(request: Request) {
  try { const a = createAssignment(await request.json(), { localDir: LOCAL_DIR, createdBy: uploaderId(LOCAL_DIR) }); return Response.json({ ok: true, assignment: { ...a, pack: encodePack(a) } }); }
  catch (e: any) { return fail(e); }
}
/** PUT { pack, force } saves the head TA's Quiz/Assignment on this laptop. */
export async function PUT(request: Request) {
  const { pack, force } = await request.json();
  try { return Response.json({ ok: true, assignment: joinAssignment(pack, { localDir: LOCAL_DIR, force: !!force }) }); }
  catch (e: any) { return fail(e); }
}
