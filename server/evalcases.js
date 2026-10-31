// Overrides the TA chose to keep as test cases, and the counts from running them.
// The TA's ruling is the expected result. Nothing here lets the model set or edit it.
import { makeSideLog } from "./sidelog.js";

export const caseKey = (c) => `${c.idea}:${c.itemId}`;
/** The code the AI would report for a case: its first accepted proposal, or "OK" when it proposes nothing. */
export const topCode = (proposals) => proposals?.[0]?.code ?? "OK";

export function makeEvalCases({ localDir, course }) {
  const log = makeSideLog(localDir, course);
  return {
    /** text must already be post-gate (alias tokens, header dropped). Rejected if it still carries a roster name or a pattern value. */
    add({ idea, itemId, aiCode, taRuling, reason, rubricVersion, text }) {
      if (!idea || !itemId) return { status: 400, error: "idea and itemId are required" };
      if (!String(reason ?? "").trim()) return { status: 400, error: "say in one line why this should be a test" };
      if (!String(text ?? "").trim()) return { status: 400, error: "post-gate text is required" };
      const rec = {
        ts: new Date().toISOString(), kind: "eval-case", idea, itemId,
        text: String(text), aiCode: aiCode ?? null, taRuling: String(taRuling ?? "OK"),
        reason: String(reason).trim(), rubricVersion: rubricVersion ?? null,
      };
      try { log.assertSafe(rec); } catch (e) { return { status: 400, error: e.message }; }
      const existing = log.read("eval-cases");
      if (existing.some((c) => caseKey(c) === caseKey(rec))) return { status: 200, duplicate: true, cases: existing.length };
      log.append("eval-cases", rec);
      return { status: 201, cases: existing.length + 1 };
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
