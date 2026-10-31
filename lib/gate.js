// Local Privacy Gate. Deterministic. Runs before any cloud call. The model never redacts.
export const HONEST_LIMIT =
  "Deterministic rules cannot guarantee 100 percent removal of an unknown name hidden in arbitrary free text. " +
  "Inputs are structured and seeded, fields are allowlisted, known patterns are replaced, and you review the before and after payload before any send. " +
  "On any uncertainty the send is blocked.";

/** R-01 to R-08: [rule, type, aliasPrefix, regex]. Order matters. */
export const PATTERN_RULES = [
  ["R-01", "EMAIL", "EMAIL", /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g],
  ["R-02", "PHONE", "PHONE", /\(\d{3}\)\s?\d{3}-\d{4}|\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b/g],
  ["R-03", "STUDENT_ID", "SID", /\b9001\d{5}\b/g],
  ["R-04", "NETID", "NETID", /\bdemo-[a-z0-9]{6}\b/g],
  ["R-05", "EMPLOYEE_ID", "EMPID", /\bEMP-\d{5}\b/g],
  ["R-06", "INTERNAL_ID", "INTID", /\bREQ-\d{5}\b/g],
  ["R-07", "ADDRESS", "ADDR", /\b\d{1,5}\s+[A-Z][a-z]+(?:\s[A-Z][a-z]+)*\s(?:St|Street|Ave|Avenue|Rd|Road|Dr|Drive|Ln|Lane|Blvd)\b\.?/g],
  ["R-08", "URL", "URL", /\bhttps?:\/\/\S+|\bwww\.\S+/g],
];
const HEADER_LINE = /^(From|To|Cc|Sent|Subject):/;
const HONORIFIC = /\b(?:Dr|Prof|Professor|Mr|Mrs|Ms|Mx)\.?\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?/g;
const CAP_PAIR = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/g;
const DOB = /\b(?:0?[1-9]|1[0-2])\/(?:0?[1-9]|[12]\d|3[01])\/(?:19|20)\d{2}\b|\b(?:19|20)\d{2}-\d{2}-\d{2}\b/g;
export const TYPES = ["EMAIL", "PHONE", "STUDENT_ID", "NETID", "EMPLOYEE_ID", "INTERNAL_ID", "ADDRESS", "URL", "NAME", "HEADER_LINE", "DOB"];

function knownNames(course) {
  return [...(course.roster ?? []), ...(course.dictionary ?? [])].map((e) => ({ name: e.name, alias: e.alias }));
}
function personStart(course) {
  const nums = (course.dictionary ?? []).map((d) => Number((d.alias.match(/^PERSON-(\d+)$/) ?? [])[1] || 0));
  return Math.max(0, ...nums);
}

/**
 * Run the gate over one input item.
 * @returns {{payload:object, aliasMap:object, report:{droppedFields:number,counts:object,blockedRules:string[]}, flags:{token:string,rule:string}[], blocked:boolean}}
 */
export function runGate(input, ideaConfig, course, humanPicks = {}) {
  const counts = Object.fromEntries(TYPES.map((t) => [t, 0]));
  const aliasMap = {};
  const seen = new Map(); // original value -> alias token
  const seq = {};
  const flags = [];
  const blockedRules = new Set();
  let personN = personStart(course);
  const glossary = new Set(course.glossary ?? []);
  const names = knownNames(course);

  const alias = (prefix, original) => {
    if (seen.has(original)) return seen.get(original);
    seq[prefix] = (seq[prefix] ?? 0) + 1;
    const tok = `${prefix}-${seq[prefix]}`;
    seen.set(original, tok);
    aliasMap[tok] = original;
    return tok;
  };

  const redactString = (text) => {
    // R-13 header lines
    let out = text
      .split("\n")
      .filter((line) => {
        if (HEADER_LINE.test(line.trim())) { counts.HEADER_LINE++; return false; }
        return true;
      })
      .join("\n");
    // R-01..R-08
    for (const [, type, prefix, re] of PATTERN_RULES) {
      out = out.replace(re, (m) => { counts[type]++; return alias(prefix, m); });
    }
    // R-09 roster and dictionary names
    for (const { name, alias: a } of names) {
      const n = out.split(name).length - 1;
      if (!n) continue;
      out = out.split(name).join(a);
      counts.NAME += n;
      aliasMap[a] = name;
    }
    // R-10 honorific + capitalised name
    out = out.replace(HONORIFIC, (m) => {
      counts.NAME++;
      if (seen.has(m)) return seen.get(m);
      const tok = `PERSON-${++personN}`;
      seen.set(m, tok); aliasMap[tok] = m; return tok;
    });
    // R-11 possible name: two or more capitalised tokens not in glossary
    out = out.replace(CAP_PAIR, (m) => {
      if (glossary.has(m)) return m;
      const pick = humanPicks[m];
      if (pick === "not-name") return m;
      if (pick === "name") {
        counts.NAME++;
        if (seen.has(m)) return seen.get(m);
        const tok = `PERSON-${++personN}`;
        seen.set(m, tok); aliasMap[tok] = m; return tok;
      }
      flags.push({ token: m, rule: "R-11" });
      blockedRules.add("R-11");
      return m; // shown locally only; payload is blocked while this is pending
    });
    // R-12 DOB: block
    out = out.replace(DOB, () => { counts.DOB++; blockedRules.add("R-12"); return "[DOB]"; });
    return out;
  };
  const redact = (v) => {
    if (typeof v === "string") return redactString(v);
    if (Array.isArray(v)) return v.map(redact);
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, redact(x)]));
    return v;
  };

  const payload = {};
  let droppedFields = 0;
  for (const [k, v] of Object.entries(input)) {
    if (ideaConfig.allowlistFields.includes(k)) payload[k] = redact(v);
    else droppedFields++;
  }
  const report = { droppedFields, counts, blockedRules: [...blockedRules] };
  return { payload, aliasMap, report, flags, blocked: blockedRules.size > 0 };
}

/** Re-run R-01 to R-12 over a final payload. Throws {status:422, code:"BLOCKED", rule, count} on any hit. */
export function assertClean(payload, course) {
  const strings = [];
  const walk = (v) => {
    if (typeof v === "string") strings.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  walk(payload);
  const hit = (rule, count) => { throw { status: 422, code: "BLOCKED", rule, count }; };
  const glossary = new Set(course.glossary ?? []);
  const names = knownNames(course);
  // Each string is checked on its own, so two fields never form a false pair.
  for (const text of strings) {
    for (const [rule, , , re] of PATTERN_RULES) {
      const m = text.match(re);
      if (m) hit(rule, m.length);
    }
    for (const { name } of names) {
      const n = text.split(name).length - 1;
      if (n) hit("R-09", n);
    }
    const hon = text.match(HONORIFIC); if (hon) hit("R-10", hon.length);
    const pairs = (text.match(CAP_PAIR) ?? []).filter((m) => !glossary.has(m));
    if (pairs.length) hit("R-11", pairs.length);
    const dob = text.match(DOB); if (dob) hit("R-12", dob.length);
  }
  return true;
}

/** Replace alias tokens in text with originals, locally, for display only. */
export function remap(text, aliasMap) {
  let out = String(text);
  for (const tok of Object.keys(aliasMap).sort((a, b) => b.length - a.length)) out = out.split(tok).join(aliasMap[tok]);
  return out;
}
