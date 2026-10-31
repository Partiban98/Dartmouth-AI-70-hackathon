// runPipeline(ideaConfig, input, ui, deps): gate -> propose -> engine -> human review -> human decision -> log.
import { runGate, remap } from "./gate.js";
import { validateStandards, validateCodes, verifyQuote, score, methodSignatures, answerCheck, factsCheck, keyPoints } from "./engine.js";
import { gateRecord, decisionRecord } from "./logshape.js";

async function post(fetchImpl, path, body) {
  const res = await fetchImpl(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  let json = null;
  try { json = await res.json(); } catch { json = null; }
  return { status: res.status, ok: res.ok, json };
}

const textOf = (payload, fields) => fields.map((f) => { const v = payload[f]; return Array.isArray(v) ? v.join("\n") : typeof v === "object" && v ? Object.values(v).join("\n") : String(v ?? ""); }).join("\n");

export async function runPipeline(ideaConfig, input, ui, deps = {}) {
  const fetchImpl = deps.fetchImpl ?? globalThis.fetch;
  const course = deps.course;
  const itemId = input.id ?? input.item ?? "item";

  // 0. Course AI rules lock, enforced by code before anything runs.
  if (ideaConfig.lockRule && ideaConfig.lockRule(input)) return { locked: true, message: "Locked by course AI rule" };

  // 0b. Standards validated before use.
  const vs = validateStandards(ideaConfig.standards);
  if (!vs.ok) return { stopped: "standards", errors: vs.errors };

  // 1. Privacy Gate, local. Alias map stays in this closure, never sent, never logged.
  let picks = {};
  let gate = runGate(input, ideaConfig, course, picks);
  while (gate.blocked && gate.report.blockedRules.includes("R-11") && !gate.report.blockedRules.includes("R-12")) {
    const answer = await ui.resolveFlags(gate.flags, gate.report);
    if (!answer) return { stopped: "gate", report: gate.report };
    picks = { ...picks, ...answer };
    gate = runGate(input, ideaConfig, course, picks);
  }
  if (gate.blocked) { await ui.approveGate(gate.report, gate.flags, { blocked: true }); return { stopped: "gate", report: gate.report }; }
  const approved = await ui.approveGate(gate.report, gate.flags, { blocked: false });
  if (!approved) return { stopped: "gate", report: gate.report };
  await post(fetchImpl, "/log", gateRecord(ideaConfig.id, itemId, gate.report));

  // 2. Model proposes, via the local server which re-runs assertClean.
  const prop = await post(fetchImpl, "/propose", { idea: ideaConfig.id, itemId, payload: gate.payload, promptName: ideaConfig.promptName });
  if (prop.status === 422) return { stopped: "blocked", detail: prop.json };
  if (!prop.ok) return { stopped: "provider", detail: prop.json };
  const label = prop.json.label;

  // 3. Deterministic Rules Engine.
  const { accepted } = validateCodes((prop.json.proposals ?? []).map((p) => p.code), ideaConfig.standards);
  const verifyText = textOf(gate.payload, ideaConfig.verifyAgainst);
  let items = (prop.json.proposals ?? [])
    .filter((p) => accepted.includes(p.code))
    .map((p) => ({ ...p, source: "AI", verified: verifyQuote(p.quote, verifyText).found }));
  if (ideaConfig.ruleCandidates.includes("methodSignatures")) items.push(...methodSignatures(gate.payload.steps, gate.payload.finalAnswer, ideaConfig.standards).map((c) => ({ ...c, verified: true })));
  if (ideaConfig.ruleCandidates.includes("answerCheck")) items.push(...answerCheck(gate.payload.finalAnswer, ideaConfig.standards).map((c) => ({ ...c, verified: true })));
  if (ideaConfig.ruleCandidates.includes("keyPoints")) items = keyPoints(items, ideaConfig.companion).map((k, i) => ({ ...items[i], ...k, source: "AI" }));
  const facts = ideaConfig.ruleCandidates.includes("factsCheck") && gate.payload.draft ? factsCheck(gate.payload.draft, gate.payload.facts ?? {}) : [];
  // Re-map alias tokens to originals for display only.
  const card = { itemId, label, items: items.map((it) => ({ ...it, quote: remap(it.quote ?? "", gate.aliasMap), sourceLine: it.sourceLine ? remap(it.sourceLine, gate.aliasMap) : it.sourceLine })), facts, codes: ideaConfig.standards.codes };

  // 4. Human review: every item confirmed, changed, or overridden; override needs a reason.
  const review = await ui.review(card);
  if (!review) return { stopped: "review" };
  for (const o of review.overrides ?? []) if (!o.reason || !String(o.reason).trim()) return { stopped: "review", error: "override without reason" };
  // A code confirmed on an AI row and again on a Rule row counts once; a mistake is one mistake.
  const confirmed = [...new Set(review.confirmed ?? [])];
  const computedScore = score(confirmed, ideaConfig.standards);

  // 5. Human decision, attributed to a named person.
  const decision = await ui.decide({ computedScore, confirmed, requiresGradeInput: !!ideaConfig.requiresGradeInput, requiresReviewedAllCheckbox: !!ideaConfig.requiresReviewedAllCheckbox, receipt: ideaConfig.receiptText });
  if (!decision || !decision.decidedBy || !String(decision.decidedBy).trim()) return { stopped: "decide", error: "decidedBy required" };
  if (ideaConfig.requiresReviewedAllCheckbox && !decision.reviewedAll) return { stopped: "decide", error: "reviewedAll required" };

  const record = decisionRecord(ideaConfig.id, itemId, { decidedBy: decision.decidedBy, proposed: items.map((i) => i.code), confirmed, overrides: review.overrides ?? [], computedScore, grade: decision.grade, reviewedAll: decision.reviewedAll, receipt: ideaConfig.receiptText, feedback: decision.feedback, rubricVersion: ideaConfig.standards.version });
  await post(fetchImpl, "/log", record);
  const counts = await fetchImpl("/counts").then((r) => r.json()).catch(() => null);
  return { receipt: ideaConfig.receiptText, decidedBy: decision.decidedBy, computedScore, grade: decision.grade, feedback: decision.feedback, label, counts, itemId, confirmed, overrides: review.overrides ?? [], rubricVersion: ideaConfig.standards.version, proposed: items };
}
