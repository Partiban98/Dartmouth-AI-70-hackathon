// The server's outbound privacy boundary, shared by both propose routes. Zero dependencies.
// The browser gate runs first; this re-checks everything the model would see: the paper fields, and the question and labels sent with them.
import { assertClean, PATTERN_RULES } from "../lib/gate.js";
import { listImported, loadMap } from "./ingest.js";

const fail = (status, extra) => { throw { status, ...extra }; };
const plain = (v) => v === null || typeof v === "string" || (typeof v === "number" && Number.isFinite(v));
const str = (v) => typeof v === "string";
const strList = (v) => Array.isArray(v) && v.every(str);
const table = (v) => !!v && typeof v === "object" && !Array.isArray(v) && Object.values(v).every(plain);
// The shape each allowlisted field may have. A field not listed here may only be a plain value.
const SHAPES = { steps: strList, finalAnswer: (v) => v === null || (typeof v === "number" && Number.isFinite(v)), answer: (v) => str(v) || strList(v), source: (v) => str(v) || strList(v), text: str, facts: table, draft: (v) => v == null || str(v) };

/** S1: only the idea's allowlisted fields, each in its own shape. Throws { status: 400 } naming the field, never its value. */
export function projectPayload(payload, ideaConfig) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) fail(400, { error: "payload must be an object" });
  const out = {};
  for (const [k, v] of Object.entries(payload)) {
    if (!ideaConfig.allowlistFields.includes(k)) fail(400, { error: `field "${k}" may not be sent` });
    if (!(SHAPES[k] ?? plain)(v)) fail(400, { error: `field "${k}" has an unsupported shape` });
    out[k] = v;
  }
  return out;
}

/** E1: the course plus every student this laptop imported (full name, its lowercase form, email, NetID, student ID), as known names.
 *  Read on each call so papers imported after start-up count. Short Latin tokens are left out: the check matches substrings. */
export function withLocalIdentities(course, localDir) {
  const known = new Set([...(course.roster ?? []), ...(course.dictionary ?? [])].map((e) => e.name));
  const extra = new Set();
  for (const meta of listImported(localDir)) {
    for (const m of Object.values(loadMap(localDir, meta.id))) {
      const name = String(m.name ?? "").trim();
      for (const v of [name, name.toLowerCase(), m.email, m.netid, m.studentId]) {
        const s = String(v ?? "").trim();
        // Latin tokens under 4 letters would match inside ordinary words; names in other scripts are often 2 characters.
        const min = /^[\x00-\x7f]*$/.test(s) ? 4 : 2;
        if (s.length < min || (/^\d+$/.test(s) && s.length < 5) || known.has(s)) continue;
        extra.add(s);
      }
    }
  }
  return { ...course, dictionary: [...(course.dictionary ?? []), ...[...extra].map((name, i) => ({ name, alias: `STUDENT-${i + 1}` }))] };
}

/** E4: the question and mistake labels travel with every paper, so they must hold no identifier or known student. Statistics wording is not name-checked. */
export function checkScheme(standards, course) {
  const texts = [standards?.question, ...(standards?.codes ?? []).map((c) => c.label)].filter((t) => typeof t === "string");
  const names = [...(course.roster ?? []), ...(course.dictionary ?? [])].map((e) => e.name).filter(Boolean);
  for (const t of texts) {
    for (const [rule, , , re] of PATTERN_RULES) { const m = t.match(new RegExp(re.source, "g")); if (m) fail(422, { code: "BLOCKED", rule, count: m.length, where: "scheme" }); }
    for (const n of names) { const c = t.split(n).length - 1; if (c) fail(422, { code: "BLOCKED", rule: "R-09", count: c, where: "scheme" }); }
  }
}

/** The same check, as a message a head TA can act on when creating, saving or joining a scheme. null when clean. */
export function schemeProblem(standards, course) {
  try { checkScheme(standards, course); return null; }
  catch (e) { return e.rule === "R-09" ? "The question or a mistake label contains a student's name. Remove it before saving." : `The question or a mistake label contains an identifier (${e.rule}). Remove it before saving.`; }
}

/** Everything a propose request would send, checked. Returns the projected payload; throws { status } on any problem. */
export function checkOutbound(body, ideaConfig, course) {
  const payload = projectPayload(body?.payload, ideaConfig);
  assertClean(payload, course);
  checkScheme(ideaConfig.standards, course);
  return payload;
}
