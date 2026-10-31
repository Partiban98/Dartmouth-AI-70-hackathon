// Builds log records and asserts they hold no raw values. Shared by server and tests.
import { PATTERN_RULES } from "./gate.js";

const now = () => new Date().toISOString();
export const gateRecord = (idea, itemId, report) => ({ ts: now(), type: "gate", idea, itemId, droppedFields: report.droppedFields, counts: report.counts, blockedRules: report.blockedRules });
export const blockedRecord = (idea, itemId, rule, count) => ({ ts: now(), type: "blocked", idea, itemId, rule, count });
export const proposalRecord = (idea, itemId, r) => ({ ts: now(), type: "proposal", idea, itemId, label: r.label, modelId: r.modelId ?? null, rung: r.rung, cacheHit: !!r.cacheHit, usage: r.usage ?? null,
  proposals: (r.proposals ?? []).map((p) => ({ code: p.code, confidence: p.confidence, quoteVerified: !!p.verified, source: p.source ?? "AI" })) });
export const decisionRecord = (idea, itemId, d) => ({ ts: now(), type: "decision", idea, itemId, decidedBy: d.decidedBy, proposed: d.proposed, confirmed: d.confirmed, overrides: d.overrides, computedScore: d.computedScore, grade: d.grade ?? null, reviewedAll: d.reviewedAll ?? null, receipt: d.receipt });

const FORBIDDEN_KEYS = new Set(["aliasMap", "header", "name", "netid", "email", "studentId", "quote", "payload"]);
const ALLOWED_TYPES = new Set(["gate", "blocked", "proposal", "decision"]);

/** Throws if a record could carry a stripped value. */
export function assertLogSafe(record, course) {
  if (!ALLOWED_TYPES.has(record?.type)) throw new Error(`log record type not allowed: ${record?.type}`);
  const names = [...(course?.roster ?? []), ...(course?.dictionary ?? [])].map((e) => e.name);
  const walk = (v, path) => {
    if (typeof v === "string") {
      for (const [rule, , , re] of PATTERN_RULES) if (new RegExp(re.source).test(v)) throw new Error(`log value at ${path} matches ${rule}`);
      for (const n of names) if (v.includes(n)) throw new Error(`log value at ${path} contains a roster name`);
    } else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}[${i}]`));
    else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) {
      if (FORBIDDEN_KEYS.has(k)) throw new Error(`log key not allowed: ${path}.${k}`);
      walk(x, `${path}.${k}`);
    }
  };
  walk(record, "record");
  return true;
}
