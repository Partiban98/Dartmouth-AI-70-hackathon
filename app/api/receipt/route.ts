import { getContext } from "@/server/context.js";
import { receiptFor } from "@/server/receipt.js";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { log } = getContext();
  const q = new URL(request.url).searchParams;
  const idea = q.get("idea") ?? "", itemId = q.get("itemId") ?? "";
  const r = receiptFor({ gate: log.read("gate"), proposals: log.read("proposals") }, idea, itemId);
  if (!r) return Response.json({ error: "no receipt for that paper yet" }, { status: 404 });
  return Response.json(r);
}
