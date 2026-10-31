// Shape checks for gate and decision records, before they are written and when they are read back. Zero dependencies.
// The privacy check on log values is separate (lib/logshape.js); this one keeps counts, exports and analytics from breaking.
const str = (v) => typeof v === "string" && v.trim().length > 0;
const num = (v) => typeof v === "number" && Number.isFinite(v);
const strs = (v) => Array.isArray(v) && v.every((x) => typeof x === "string");
const nullOr = (f) => (v) => v === null || v === undefined || f(v);

/** A proposal row read back from the log: a list of proposals, each with a code. */
export function proposalProblem(rec) {
  if (!rec || typeof rec !== "object" || !Array.isArray(rec.proposals) || !rec.proposals.every((p) => p && typeof p === "object" && typeof p.code === "string")) return "proposals must be a list of codes";
  return null;
}

/** Returns a plain reason the record cannot be written, or null. `ideas` is the server's idea table; an idea it does not list is shape-checked only. */
export function recordProblem(rec, ideas = {}, { reading = false } = {}) {
  if (!rec || typeof rec !== "object") return "not a record";
  if (rec.type !== "gate" && rec.type !== "decision") return "only gate and decision records are accepted here";
  if (!str(rec.idea) || !str(rec.itemId)) return "the record must name its question set and paper";
  if (rec.type === "gate") {
    if (!(num(rec.droppedFields) && rec.droppedFields >= 0)) return "droppedFields must be a count";
    if (!rec.counts || typeof rec.counts !== "object" || !Object.values(rec.counts).every((n) => num(n) && n >= 0)) return "counts must be counts";
    if (!nullOr(strs)(rec.blockedRules)) return "blockedRules must be a list";
    return null;
  }
  if (!str(rec.decidedBy)) return "a decision must name the person who decided";
  if (!strs(rec.proposed) || !strs(rec.confirmed)) return "proposed and confirmed must be lists of codes";
  if (!Array.isArray(rec.overrides) || !rec.overrides.every((o) => o && typeof o === "object" && typeof o.from === "string" && typeof o.to === "string")) return "overrides must be from/to pairs";
  if (!rec.overrides.every((o) => str(o.reason))) return "every change from a suggestion needs a one-line reason";
  if (!nullOr(num)(rec.computedScore)) return "computedScore must be a number";
  if (!nullOr((v) => typeof v === "string")(rec.feedback) || !nullOr((v) => typeof v === "string")(rec.rubricVersion)) return "feedback and rubricVersion must be text";
  // A grading set needs the human's own mark. An idea this server does not list yet is an uploaded grading set.
  // On write, a grading set needs the human's mark; on read the idea table is not at hand, so history is shape-checked only.
  if (!reading && (rec.idea in ideas ? !!ideas[rec.idea].requiresGradeInput : true) && !num(rec.grade)) return "a grading decision needs the mark the person typed";
  const st = ideas[rec.idea]?.standards;
  const max = num(st?.max) ? st.max : Infinity;
  if (rec.grade !== null && rec.grade !== undefined && !(num(rec.grade) && rec.grade >= 0 && rec.grade <= max)) return `the mark must be a number from 0 to ${max === Infinity ? "full marks" : max}`;
  if (st) {
    const codes = new Set(st.codes.map((c) => c.code));
    if (![...rec.confirmed, ...rec.overrides.flatMap((o) => [o.from, o.to])].every((c) => codes.has(c))) return "a code is not in this marking scheme";
  }
  return null;
}
