import { getContext } from "@/server/context.js";
import { counters, analytics } from "@/lib/engine.js";

export const dynamic = "force-dynamic";

export async function GET() {
  const { log } = getContext();
  const all = log.readAll();
  const byIdea: Record<string, any[]> = {};
  for (const d of all.decisions) (byIdea[d.idea] ??= []).push(d);
  const decisions = all.decisions.map((d: any) => ({ ts: d.ts, idea: d.idea, itemId: d.itemId, decidedBy: d.decidedBy, confirmed: d.confirmed, overrides: (d.overrides ?? []).length, computedScore: d.computedScore, grade: d.grade, feedback: d.feedback ?? null, rubricVersion: d.rubricVersion ?? null }));
  return Response.json({ ...counters(all), analytics: analytics(all.decisions), analyticsByIdea: Object.fromEntries(Object.entries(byIdea).map(([k, v]) => [k, analytics(v)])), decisions });
}
