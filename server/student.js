// What one student is allowed to see about their own marks: the mark a named
// person typed, the rubric line behind each deduction, their own quoted step,
// and that TA's note. Nothing the AI proposed, nothing it was confident about,
// and no answer key passes through here.
import { makeSideLog } from "./sidelog.js";
import { methodSignatures, answerCheck } from "../lib/engine.js";
import { normalize } from "../lib/text.js";

/** code -> the line of the student's own paper that cost them the points:
 *  { line, text }, 1-based, so the page can say "your line 5" and show the
 *  whole step rather than a bare number.
 *
 *  Only the rules engine yields a quote; an AI-only code has none stored
 *  anywhere (lib/logshape.js forbids a quote in a log), so that deduction
 *  renders with its rubric line only, never with a guessed step.
 *
 *  Same rule the TA screen uses to light a line: a bare number is the final
 *  answer, which sits at the end of the paper, so the last match wins.
 */
export function locate(paper, quote) {
  const steps = paper?.steps ?? [];
  const q = normalize(String(quote ?? ""));
  if (!q) return null;
  const hits = steps.map((s, i) => (normalize(s).includes(q) ? i : -1)).filter((i) => i >= 0);
  if (!hits.length) return { line: null, text: String(quote) };
  const i = /^-?\d+(?:\.\d+)?$/.test(q) ? hits[hits.length - 1] : hits[0];
  return { line: i + 1, text: String(steps[i]) };
}

export function quoteMap(paper, standards) {
  if (!paper) return {};
  const out = {};
  for (const cand of [...methodSignatures(paper.steps ?? [], paper.finalAnswer, standards), ...answerCheck(paper.finalAnswer, standards)]) {
    if (cand.quote && !out[cand.code]) out[cand.code] = locate(paper, cand.quote);
  }
  return out;
}

export function makeStudent({ localDir, course, decisions, standardsOf, paperOf }) {
  const log = makeSideLog(localDir, course);
  return {
    /** null when nobody has marked anything for this id, so the route can 404 without leaking. */
    view(anonId) {
      const latest = new Map();
      for (const d of decisions() ?? []) if (d.type === "decision" && d.itemId === anonId) latest.set(d.idea, d);
      const mine = [...latest.values()];
      if (!mine.length) return null;
      const questions = mine.map((d) => {
        const available = standardsOf(d.idea, d.rubricVersion);
        // Never label today's deductions as the scheme used for an older mark.
        const standards = available && available.version === d.rubricVersion ? available : null;
        const quotes = standards ? quoteMap(paperOf(d.idea, anonId), standards) : {};
        // A change carries the code it was changed to and the TA's one line. An
        // override is to "OK": the TA ruled the suggestion out, so it is not a
        // deduction and never appears here.
        const changed = Object.fromEntries((d.overrides ?? []).filter((o) => o.to && o.to !== "OK").map((o) => [o.to, o.reason ?? null]));
        const deductions = [...new Set(d.confirmed ?? [])].filter((code) => code !== "OK" && code !== "UNSURE").map((code) => {
          const line = (standards?.codes ?? []).find((c) => c.code === code);
          const at = quotes[code] ?? null;
          return { code, points: line?.deduction ?? null, rubricLine: line?.label ?? `Confirmed ${code}; original rubric details unavailable`, quote: at?.text ?? null, quoteLine: at?.line ?? null, taReason: changed[code] ?? null };
        });
        return { questionId: d.idea, questionText: standards?.question ?? null, mark: d.grade ?? null, max: standards?.max ?? null, rubricVersion: d.rubricVersion ?? null, rubricUnavailable: !standards, note: d.feedback ?? null, decidedBy: "your TA", deductions };
      });
      const marks = questions.map((q) => Number(q.mark)).filter((n) => Number.isFinite(n));
      return { anonId, questions, total: marks.reduce((a, b) => a + b, 0), outOf: questions.every((q) => q.max != null) ? questions.reduce((a, q) => a + Number(q.max), 0) : null };
    },
    /** A regrade request is stored for a person to read. It notifies nobody and writes to no system of record. */
    addRegrade({ anonId, questionId, text }) {
      if (typeof anonId !== "string" || typeof questionId !== "string" || typeof text !== "string") return { status: 400, error: "anonId, questionId and text must be strings" };
      if (!(decisions() ?? []).some((d) => d.type === "decision" && d.itemId === anonId && d.idea === questionId)) return { status: 400, error: "no marked paper for that student and question" };
      const words = text.trim();
      if (words.length < 20) return { status: 400, error: "please explain in at least 20 characters so your TA has something to read" };
      const rec = { ts: new Date().toISOString(), kind: "regrade-request", anonId, questionId, text: words, status: "waiting for a person" };
      try { log.assertSafe(rec); } catch (e) { return { status: 400, error: e.message }; }
      log.append("regrade-requests", rec);
      return { status: 201, saved: true };
    },
    requests() { return log.read("regrade-requests"); },
  };
}
