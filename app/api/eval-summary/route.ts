import { getContext, LOCAL_DIR } from "@/server/context.js";
import { makeEvalCases } from "@/server/evalcases.js";

export const dynamic = "force-dynamic";

// Counts and the last run time only. No ruling, no label, no per-case expected answer.
export async function GET() {
  const { course } = getContext();
  return Response.json(makeEvalCases({ localDir: LOCAL_DIR, course }).summary());
}
