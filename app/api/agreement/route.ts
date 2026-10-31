import { getContext } from "@/server/context.js";
import { agreementByCode } from "@/server/agreement.js";

export const dynamic = "force-dynamic";

// Counts per code, from the decisions log. No paper text, no student id, no label.
export async function GET(request: Request) {
  const { log } = getContext();
  const idea = new URL(request.url).searchParams.get("idea") ?? undefined;
  return Response.json(agreementByCode(log.read("decisions"), idea));
}
