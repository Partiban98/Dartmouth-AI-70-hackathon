// Deterministic Rules Engine. Pure functions. The model never computes, grades, writes answers, validates methods, or redacts.
import { normalize } from "./text.js";

export function validateStandards(table) {
  const errors = [];
  if (!table || typeof table !== "object") return { ok: false, errors: ["table missing"] };
  for (const k of ["id", "version", "owner"]) if (typeof table[k] !== "string" || !table[k]) errors.push(`${k} missing`);
  if (table.status !== "approved") errors.push("status is not approved");
  if (typeof table.max !== "number" || !(table.max >= 0)) errors.push("max must be a number >= 0");
  if (!Array.isArray(table.codes) || !table.codes.length) errors.push("codes missing");
  else {
    const ids = table.codes.map((c) => c.code);
    if (new Set(ids).size !== ids.length) errors.push("duplicate codes");
    for (const c of table.codes) if (typeof c.deduction !== "number" || c.deduction > 0) errors.push(`code ${c.code} deduction must be a number <= 0`);
    for (const req of ["OK", "UNSURE"]) {
      const c = table.codes.find((x) => x.code === req);
      if (!c) errors.push(`code ${req} missing`);
      else if (c.deduction !== 0) errors.push(`code ${req} must have deduction 0`);
    }
  }
  for (const m of table.methods ?? []) {
    if (!m.id || !m.label) errors.push("method missing id or label");
    try { new RegExp(m.signature, "i"); } catch { errors.push(`method ${m.id} signature does not compile`); }
  }
  return { ok: errors.length === 0, errors };
}

export function validateCodes(codes, table) {
  const allowed = new Set(table.codes.map((c) => c.code));
  const accepted = [], rejected = [];
  for (const c of codes) (allowed.has(c) ? accepted : rejected).push(c);
  return { accepted, rejected };
}

export function verifyQuote(quote, sourceText) {
  const q = normalize(quote), s = normalize(sourceText);
  if (!q) return { found: false, index: -1 };
  const index = s.indexOf(q);
  return { found: index >= 0, index };
}

/** Score from HUMAN-CONFIRMED codes only. Proposals never reach this function. */
export function score(confirmedCodes, table) {
  const ded = Object.fromEntries(table.codes.map((c) => [c.code, c.deduction]));
  const raw = table.max + confirmedCodes.reduce((s, c) => s + (ded[c] ?? 0), 0);
  return Math.min(table.max, Math.max(0, raw));
}

/** R-M1: a correct answer matching no listed method signature becomes M-UNLISTED, labelled Rule. */
export function methodSignatures(steps, finalAnswer, table) {
  const correct = Math.abs(Number(finalAnswer) - table.correctAnswer) <= table.tolerance;
  if (!correct) return [];
  const joined = steps.join("\n");
  const listed = (table.methods ?? []).some((m) => new RegExp(m.signature, "i").test(joined));
  return listed ? [] : [{ code: "M-UNLISTED", quote: steps[0], confidence: 1, source: "Rule" }];
}

/** Rule-based candidate detection from the final answer value. */
export function answerCheck(finalAnswer, table) {
  const x = Number(finalAnswer);
  const out = [];
  if (Math.abs(x - 10) <= 0.05) out.push({ code: "E-VAR-SD", quote: String(finalAnswer), confidence: 1, source: "Rule" });
  if (Math.abs(x - 2.83) <= 0.01) out.push({ code: "E-N-DENOM", quote: String(finalAnswer), confidence: 1, source: "Rule" });
  return out.filter((c) => table.codes.some((t) => t.code === c.code));
}

const TIME = /\b(\d{1,2}(?::\d{2})?)\s?(AM|PM)\b/g;
const DAY_DATE = /\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\w*,?\s+((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{1,2})\b/g;
const DATE = /\b((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*)\s+(\d{1,2})\b/g;
const ROOM = /\b[A-Z]-?\d{3}\b/g;
const NUMBER = /\b\d+(?:\.\d+)?\b/g;

/** Every date, time, room, or standalone number in the draft that is not in the facts fields. */
export function factsCheck(draftText, facts) {
  const factsText = normalize(Object.values(facts).join(" "));
  const has = (s) => factsText.includes(normalize(s));
  const found = [];
  const flag = (detail) => found.push({ detail, message: "Detail not in your facts" });
  let rest = String(draftText);
  rest = rest.replace(TIME, (m, hm, mer) => { if (!has(hm) || !has(mer)) flag(m); return " "; });
  rest = rest.replace(DAY_DATE, (m, day, date) => { if (!has(day) || !has(date)) flag(m); return " "; });
  rest = rest.replace(DATE, (m, mon, d) => { if (!has(`${mon.slice(0, 3)}`) || !has(d)) flag(m); return " "; });
  rest = rest.replace(ROOM, (m) => { if (!has(m)) flag(m); return " "; });
  rest.replace(NUMBER, (m) => { if (!has(m)) flag(m); return " "; });
  return found;
}

/** Numeric tolerance plus required and forbidden units, checked by code. */
export function retest(answerText, spec) {
  const reasons = [];
  const text = String(answerText);
  const lower = text.toLowerCase();
  const nums = text.match(/-?\d+(?:\.\d+)?/g) ?? [];
  if (!nums.length) reasons.push("no number found");
  else if (Math.abs(Number(nums[0]) - spec.expected) > spec.tolerance) reasons.push(`value ${nums[0]} is not within ${spec.tolerance} of ${spec.expected}`);
  for (const u of spec.forbiddenUnits ?? []) if (lower.includes(u.toLowerCase())) reasons.push(`forbidden unit "${u}"`);
  for (const v of spec.forbiddenValues ?? []) if (nums.some((n) => Number(n) === v)) reasons.push(`forbidden value ${v}`);
  if (spec.requiredUnit && !new RegExp(`\\b${spec.requiredUnit}\\b`, "i").test(text)) reasons.push(`missing unit "${spec.requiredUnit}"`);
  return { pass: reasons.length === 0, reasons };
}

export const NOT_FOUND = "Not found in source: I will not guess";

/** R-KP: a missing key point is shown only with a code-verified source line. */
export function keyPoints(proposals, companionSeed) {
  const source = companionSeed.source.join("\n\n");
  return proposals.map((p) => {
    const v = verifyQuote(p.quote, source);
    return v.found
      ? { code: p.code, status: "missing", sourceLine: p.quote, verified: true }
      : { code: p.code, status: "missing", sourceLine: null, verified: false, message: NOT_FOUND };
  });
}

/** Per-code proposed, confirmed, overridden counts, from decision records only. */
export function analytics(decisions) {
  const out = {};
  const bump = (code, k) => { out[code] ??= { proposed: 0, confirmed: 0, overridden: 0 }; out[code][k]++; };
  for (const d of decisions) {
    for (const c of d.proposed ?? []) bump(c, "proposed");
    for (const c of d.confirmed ?? []) bump(c, "confirmed");
    for (const o of d.overrides ?? []) bump(o.from, "overridden");
  }
  return out;
}

/** Every on-screen number comes from here. logs = { gate:[], proposals:[], decisions:[] } */
export function counters(logs) {
  const gate = logs.gate ?? [], proposals = logs.proposals ?? [], decisions = logs.decisions ?? [];
  const piiStripped = {};
  let headerLinesDropped = 0, fieldsDropped = 0;
  for (const g of gate) {
    fieldsDropped += g.droppedFields ?? 0;
    for (const [t, n] of Object.entries(g.counts ?? {})) {
      if (t === "HEADER_LINE") headerLinesDropped += n;
      else if (n) piiStripped[t] = (piiStripped[t] ?? 0) + n;
    }
  }
  let proposed = 0, quotesVerified = 0, quotesNotFound = 0;
  for (const p of proposals) for (const item of p.proposals ?? []) { proposed++; item.quoteVerified ? quotesVerified++ : quotesNotFound++; }
  const confirmed = decisions.reduce((s, d) => s + (d.confirmed?.length ?? 0), 0);
  const overridden = decisions.reduce((s, d) => s + (d.overrides?.length ?? 0), 0);
  return { proposed, confirmed, overridden, quotesVerified, quotesNotFound, piiStripped, headerLinesDropped, fieldsDropped, decisionsByHuman: decisions.length };
}
