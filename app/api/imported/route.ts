import { LOCAL_DIR } from "@/server/context.js";
import { listImported, loadImported } from "@/server/ingest.js";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const set = new URL(request.url).searchParams.get("set");
  if (!set) return Response.json({ sets: listImported(LOCAL_DIR) });
  const data = loadImported(LOCAL_DIR, set);
  if (!data) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json(data);
}
