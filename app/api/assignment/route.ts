// Quiz/Assignment codes on this laptop: list, create (head TA), join by pasting a pack. Nothing here talks to a model.
import { LOCAL_DIR, getContext } from "@/server/context.js";
import { packProblem, withLocalIdentities } from "@/server/privacy.js";
import { uploaderId } from "@/server/ingest.js";
import { createAssignment, decodePack, encodePack, joinAssignment, listAssignments } from "@/server/assignment.js";

export const dynamic = "force-dynamic";
const fail = (e: any) => Response.json({ ok: false, error: e.message }, { status: 400 });
// The question and labels go to the model with every paper and travel in packs, so no student or identifier may be in them.
const known = () => withLocalIdentities(getContext().course, LOCAL_DIR);

export async function GET() {
  // Checked again every time a pack is made: a student imported after the scheme was written still counts.
  const k = known();
  return Response.json({ me: uploaderId(LOCAL_DIR), assignments: listAssignments(LOCAL_DIR).map((a: any) => { const p = packProblem(a, k); return p ? { ...a, pack: null, packProblem: p } : { ...a, pack: encodePack(a) }; }) });
}
export async function POST(request: Request) {
  const draft = await request.json();
  const p = packProblem({ ...draft, standards: { question: draft?.question, codes: draft?.codes } }, known()); if (p) return Response.json({ ok: false, error: p }, { status: 422 });
  try { const a = createAssignment(draft, { localDir: LOCAL_DIR, createdBy: uploaderId(LOCAL_DIR) }); return Response.json({ ok: true, assignment: { ...a, pack: encodePack(a) } }); }
  catch (e: any) { return fail(e); }
}
/** PUT { pack, force } saves the head TA's Quiz/Assignment on this laptop. */
export async function PUT(request: Request) {
  const { pack, force } = await request.json();
  try {
    const p = packProblem(decodePack(pack), known()); if (p) return Response.json({ ok: false, error: p }, { status: 422 });
    return Response.json({ ok: true, assignment: joinAssignment(pack, { localDir: LOCAL_DIR, force: !!force }) });
  }
  catch (e: any) { return fail(e); }
}
