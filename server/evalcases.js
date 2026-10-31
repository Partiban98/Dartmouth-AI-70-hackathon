// Overrides the TA chose to keep as test cases, and the counts from running them.
// The TA's ruling is the expected result. Nothing here lets the model set or edit it.
import { makeSideLog } from "./sidelog.js";
import { runGate, assertClean } from "../lib/gate.js";

export const caseKey = (c) => `${c.idea}:${c.itemId}`;
/** The code the AI would report for a case: its first accepted proposal, or "OK" when it proposes nothing. */
export const topCode = (proposals) => proposals?.[0]?.code ?? "OK";

/** Derive the expected ruling and exact checked input on the server, from a saved human override. */
export function prepareCase({ body, paper, ideaConfig, decision, course }) {
  const bad = (error) => ({ status: 400, error });
  if (!body || typeof body.reason !== "string" || !body.reason.trim()) return bad("say in one line why this should be a test");
  if (!paper || !ideaConfig || !decision || decision.idea !== body.idea || decision.itemId !== body.itemId) return bad("a saved decision for this paper is required");
  if (body.taRuling !== "OK" || typeof body.aiCode !== "string" || !ideaConfig.standards.codes.some((c) => c.code === body.aiCode)) return bad("that ruling is not supported");
  if (!(decision.overrides ?? []).some((o) => o.from === body.aiCode && o.to === "OK")) return bad("that suggestion was not ruled out in the saved decision");
  if (decision.rubricVersion !== ideaConfig.standards.version) return bad("the scheme changed; review this paper under the current scheme first");
  const gate = runGate(paper, ideaConfig, course, {});
  if (gate.blocked) return bad("this paper does not pass the privacy check on its own; not stored");
  try { assertClean(gate.payload, course); } catch { return bad("this paper does not pass the privacy check on its own; not stored"); }
  return { status: 200, value: { idea: body.idea, itemId: body.itemId, aiCode: body.aiCode, taRuling: "OK", reason: body.reason.trim(), rubricVersion: decision.rubricVersion, input: gate.payload } };
}

export function makeEvalCases({ localDir, course }) {
  const log = makeSideLog(localDir, course);
  return {
    /** text must already be post-gate (alias tokens, header dropped). Rejected if it still carries a roster name or a pattern value. */
    add({ idea, itemId, aiCode, taRuling, reason, rubricVersion, text, input }) {
      if (!idea || !itemId) return { status: 400, error: "idea and itemId are required" };
      if (!String(reason ?? "").trim()) return { status: 400, error: "say in one line why this should be a test" };
      if (!input && !String(text ?? "").trim()) return { status: 400, error: "post-gate input is required" };
      const rec = {
        ts: new Date().toISOString(), kind: "eval-case", idea, itemId,
        ...(input ? { input } : { text: String(text) }), aiCode: aiCode ?? null, taRuling: String(taRuling ?? "OK"),
        reason: String(reason).trim(), rubricVersion: rubricVersion ?? null,
      };
      try { log.assertSafe(rec); } catch (e) { return { status: 400, error: e.message }; }
      const existing = log.read("eval-cases");
      if (existing.some((c) => caseKey(c) === caseKey(rec))) return { status: 200, duplicate: true, cases: existing.length };
      log.append("eval-cases", rec);
      return { status: 201, cases: existing.length + 1 };
    },
    // Re-check local identities and all model-visible scheme text at evaluation time.
    checkForSend(c, ideaConfig) {
      const input = c.input;
      if (!input) throw new Error("case has no exact checked input");
      log.assertSafe({ ...c, kind: "eval-case", input: { ...input, steps: [...input.steps, ideaConfig.standards.question ?? "", ...ideaConfig.standards.codes.flatMap((x) => [x.code, x.label])] } });
    },
    list() { return log.read("eval-cases"); },
    appendRun({ total, match, mismatch }) { return log.append("eval-runs", { kind: "eval-run", run_at: new Date().toISOString(), total, match, mismatch }); },
    /** Counts only. No ruling, no label, no per-case expected answer leaves here. */
    summary() {
      const cases = log.read("eval-cases");
      const runs = log.read("eval-runs");
      const last = runs.length ? runs[runs.length - 1] : null;
      return { cases: cases.length, lastRun: last?.run_at ?? null, mismatch: last?.mismatch ?? null, checked: last?.total ?? null };
    },
  };
}
