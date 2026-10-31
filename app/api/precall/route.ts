import { getContext, LOCAL_DIR } from "@/server/context.js";
import { makePrecall } from "@/server/precall.js";

export const dynamic = "force-dynamic";

// The TA's own call, logged before the AI is revealed. Never sent to the model.
export async function POST(request: Request) {
  const { course, log } = getContext();
  const body = await request.json();
  const store = makePrecall({ localDir: LOCAL_DIR, course });
  const r = body.kind === "reveal"
    ? store.addReveal({ idea: body.idea, itemId: body.itemId, session: body.session, proposalTs: log.read("proposals").filter((p: any) => p.idea === body.idea && p.itemId === body.itemId).at(-1)?.ts })
    : store.add({ idea: body.idea, itemId: body.itemId, code: body.code, by: body.by, session: body.session });
  if (r.status >= 400) return Response.json({ error: r.error, call: r.call }, { status: r.status });
  return Response.json({ saved: true, call: r.call }, { status: r.status });
}

// Blind agreement for one session, computed from the logs only.
export async function GET(request: Request) {
  const { course, log } = getContext();
  const session = new URL(request.url).searchParams.get("session") ?? undefined;
  return Response.json(makePrecall({ localDir: LOCAL_DIR, course }).agreement(log.read("proposals"), session));
}
