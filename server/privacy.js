// The server's outbound privacy boundary, shared by both propose routes. Zero dependencies.
// The browser gate runs first; this re-checks everything the model would see: the paper fields, and the question and labels sent with them.
import { assertClean, PATTERN_RULES } from "../lib/gate.js";
import { listImported, loadMap } from "./ingest.js";
import { encodePack } from "./assignment.js";

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

/** E1: every student this laptop knows: the course roster plus everything it imported (full name, each name word, email, NetID, student ID).
 *  Read on each call so papers imported after start-up count. Returned on the course as `identities`, matched as whole words in any case;
 *  long values are also added as known names so the shared gate's own check (substring, case-sensitive) blocks them too. */
const coursePeople = (course) => [...(course.roster ?? []), ...(course.dictionary ?? []).map((d) => ({ name: d.name }))];
function idsOf(people) {
  const ids = new Set();
  for (const m of people) {
    const name = String(m.name ?? "").trim();
    // Latin tokens need two letters to be a name; one character can be a whole name in other scripts.
    for (const v of [name, ...name.split(/\s+/), m.email, m.netid, m.studentId]) { const t = String(v ?? "").trim(); if (t.length >= (/^[\x00-\x7f]*$/.test(t) ? 2 : 1)) ids.add(t); }
  }
  return ids;
}
export function withLocalIdentities(course, localDir) {
  const people = coursePeople(course);
  for (const meta of listImported(localDir)) people.push(...Object.values(loadMap(localDir, meta.id)));
  const ids = idsOf(people);
  const known = new Set(people.map((m) => m.name));
  const extra = [...ids].filter((t) => !known.has(t) && (/^[\x00-\x7f]*$/.test(t) ? t.length >= 4 && t.includes(" ") : true));
  return { ...course, identities: [...ids], dictionary: [...(course.dictionary ?? []), ...extra.map((name, i) => ({ name, alias: `STUDENT-${i + 1}` }))] };
}

/** Whole-word, any-case matcher for known identities. Numbers count as text, so a student ID sent as a number is found. */
function knownIn(course) {
  // Numeric ids from four digits up: shorter numbers are ordinary maths (scores like 4, 6, 8, 10, 12).
  const ids = [...(course.identities ?? idsOf(coursePeople(course)))].filter((t) => !/^\d+$/.test(t) || t.length >= 4).sort((a, b) => b.length - a.length);
  if (!ids.length) return () => 0;
  const re = new RegExp(`(?<![\\p{L}\\p{N}])(?:${ids.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})(?![\\p{L}\\p{N}])`, "giu");
  return (text) => (String(text).match(re) ?? []).length;
}

/** Every string, object key and number inside a value, as text. `skip` names keys whose values are not checked. */
function texts(v, skip = new Set(), out = []) {
  if (typeof v === "string") out.push(v);
  else if (typeof v === "number" && Number.isFinite(v)) out.push(String(v));
  else if (Array.isArray(v)) v.forEach((x) => texts(x, skip, out));
  else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) { out.push(k); if (!skip.has(k)) texts(x, skip, out); }
  return out;
}

/** Identifier patterns and known students, in any of the given texts. Throws { status: 422 } with the rule and count only. */
function checkTexts(list, course, where) {
  const known = knownIn(course);
  for (const t of list) {
    for (const [rule, , , re] of PATTERN_RULES) { const m = t.match(new RegExp(re.source, "g")); if (m) fail(422, { code: "BLOCKED", rule, count: m.length, where }); }
    const n = known(t); if (n) fail(422, { code: "BLOCKED", rule: "R-09", count: n, where });
  }
}

const CODE_ID = /^[A-Z][A-Z0-9-]{0,23}$/;
/** E4: the question, mistake labels and code ids travel with every paper, so they must hold no identifier or known student. Statistics wording is not name-checked. */
export function checkScheme(standards, course) {
  const codes = standards?.codes ?? [];
  for (const c of codes) if (!CODE_ID.test(String(c.code))) fail(422, { code: "BLOCKED", rule: "CODE", count: 1, where: "scheme" });
  checkTexts([standards?.question, ...codes.map((c) => c.label), ...codes.map((c) => c.code)].filter((t) => typeof t === "string"), course, "scheme");
}

/** The same check, as a message a head TA can act on when creating, saving or joining a scheme. null when clean. */
export function schemeProblem(standards, course) {
  try { checkScheme(standards, course); return null; }
  catch (e) { return e.rule === "R-09" ? "The question or a mistake label contains a student's name. Remove it before saving." : e.rule === "CODE" ? "A mistake code must be capital letters, digits and dashes, like E-MEAN." : `The question or a mistake label contains an identifier (${e.rule}). Remove it before saving.`; }
}

/** E4: everything a pack shares: course, title and question as well as the scheme. null when clean. */
export function packProblem(a, course) {
  // Exactly what a pack would carry (encodePack's allowlist), every string, key and number in it.
  let shared;
  try { shared = JSON.parse(Buffer.from(encodePack({ ...a, standards: a?.standards ?? {} }).slice(8), "base64url").toString("utf8")); } catch { return "This Quiz/Assignment could not be prepared for sharing."; }
  try { checkTexts(texts(shared), course, "pack"); }
  catch (e) { return e.rule === "R-09" ? "The course, title or question names a student. Remove it before sharing." : `The course, title or question contains an identifier (${e.rule}). Remove it before sharing.`; }
  return schemeProblem(a?.standards, course);
}

/** E1 for logs: a record may name the grader who decided, never a known student. Returns a plain reason or null. */
export function logProblem(rec, course) {
  try { checkTexts(texts(rec, new Set(["decidedBy"])), course, "log"); return null; }
  catch (e) { return e.rule === "R-09" ? "The note or a reason names a student." : `The note or a reason contains an identifier (${e.rule}).`; }
}

/** Everything a propose request would send, checked. Returns the projected payload; throws { status } on any problem. */
export function checkOutbound(body, ideaConfig, course) {
  const payload = projectPayload(body?.payload, ideaConfig);
  assertClean(payload, course);
  checkTexts(texts(payload), course, "paper");
  checkScheme(ideaConfig.standards, course);
  return payload;
}
