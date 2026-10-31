import { getContext, LOCAL_DIR } from "@/server/context.js";
import { checkOutbound, withLocalIdentities } from "@/server/privacy.js";
import { verifyQuote } from "@/lib/engine.js";
import { blockedRecord, proposalRecord } from "@/lib/logshape.js";

const textOf = (payload: any, fields: string[]) => fields.map((f) => { const v = payload[f]; return Array.isArray(v) ? v.join("\n") : v && typeof v === "object" ? Object.values(v).join("\n") : String(v ?? ""); }).join("\n");

export async function POST(request: Request) {
  const { course, ideas, adapter, log } = getContext();
  const body = await request.json();
  const ideaConfig = (ideas() as any)[body.idea];
  if (!ideaConfig) return Response.json({ error: "unknown idea" }, { status: 400 });
  // Everything the model would see, checked here against this laptop's own students too. The browser's check is not trusted.
  let payload: any;
  try { payload = checkOutbound(body, ideaConfig, withLocalIdentities(course, LOCAL_DIR)); }
  catch (e: any) {
    if (e?.status === 422) { log.append("blocked", blockedRecord(body.idea, body.itemId, e.rule, e.count)); return Response.json({ code: "BLOCKED", rule: e.rule, count: e.count, where: e.where }, { status: 422 }); }
    if (e?.status === 400) return Response.json({ error: e.error }, { status: 400 });
    throw e;
  }
  const r = await adapter.propose({ ideaConfig, payload, promptName: body.promptName ?? ideaConfig.promptName });
  if (!r.ok) return Response.json({ error: r.error, attempts: r.attempts }, { status: 502 });
  const verifyText = textOf(payload, ideaConfig.verifyAgainst);
  const proposals = r.proposals.map((p: any) => ({ ...p, verified: verifyQuote(p.quote, verifyText).found }));
  log.append("proposals", proposalRecord(body.idea, body.itemId, { ...r, proposals }));
  return Response.json({ proposals: r.proposals, label: r.label, modelId: r.modelId, rung: r.rung, cacheHit: r.cacheHit, caveat: r.caveat, attempts: r.attempts });
}
