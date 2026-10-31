// The server's outbound privacy boundary, shared by both propose routes. Zero dependencies.
// The browser gate runs first; this re-checks everything the model would see: the paper fields, and the question and labels sent with them.
import { assertClean, runGate, PATTERN_RULES } from "../lib/gate.js";
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
function idsOf(people, noise = new Set()) {
  const ids = new Set();
  for (const m of people) {
    const name = String(m.name ?? "").trim();
    // Every full name and ID counts at any length. Split name words need two Latin letters (one character is a whole name in other scripts).
    for (const v of [name, m.email, m.netid, m.studentId]) { const t = String(v ?? "").trim(); if (t) ids.add(t); }
    // A name taken from a filename carries course words (ENGS, 93, Quiz); those are not identities. Real name words and id tokens stay.
    // Only a name that stood in for a missing Name line (the filename) loses course words; roster and header names keep every word.
    for (const raw of name.split(/\s+/)) { const w = raw.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ""); if (w.length >= (/^[\x00-\x7f]*$/.test(w) ? 2 : 1) && !(m.nameFromFile && noise.has(w.toLowerCase()))) ids.add(w); }
  }
  return ids;
}
export function withLocalIdentities(course, localDir) {
  const people = coursePeople(course);
  const noise = new Set(String(course.course ?? "").toLowerCase().split(/[^\p{L}\p{N}]+/u));
  for (const meta of listImported(localDir)) { people.push(...Object.values(loadMap(localDir, meta.id))); for (const w of `${meta.title ?? ""} ${meta.id ?? ""}`.toLowerCase().split(/[^\p{L}\p{N}]+/u)) noise.add(w); }
  const ids = idsOf(people, noise);
  const known = new Set(people.map((m) => m.name));
  const extra = [...ids].filter((t) => !known.has(t) && (/^[\x00-\x7f]*$/.test(t) ? t.length >= 4 && t.includes(" ") : true));
  return { ...course, identities: [...ids], dictionary: [...(course.dictionary ?? []), ...extra.map((name, i) => ({ name, alias: `STUDENT-${i + 1}` }))] };
}

/** Whole-word, any-case matcher for known identities. Numbers count as text, so a student ID sent as a number is found. */
function knownIn(course) {
  // An exact known ID fails closed even when it looks like ordinary maths.
  const ids = [...(course.identities ?? idsOf(coursePeople(course)))].sort((a, b) => b.length - a.length);
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

/** E4: a new Quiz/Assignment draft, checked exactly as its pack would carry it (every method label, answer-rule note, code and text), before anything is saved. */
export function draftProblem(draft, course) {
  return packProblem({ ...draft, standards: { ...draft, id: draft?.id, version: "1.0", owner: "head TA", status: "approved" } }, course);
}

/** E1 for logs: a record may name the grader who decided, never a known student. Returns a plain reason or null. */
export function logProblem(rec, course) {
  // The deciding grader's name is theirs to give; idea, itemId and the other system fields are ids checked by the record shape, not free text.
  try { checkTexts(texts(rec, new Set(["decidedBy"])), course, "log"); return null; }
  catch (e) { return e.rule === "R-09" ? "The note or a reason names a student." : `The note or a reason contains an identifier (${e.rule}).`; }
}

/** Validate human clearances from untrusted request metadata. No text is persisted or sent as model metadata. */
export function clearedPhrases(cleared, payload, course) {
  if (!Array.isArray(cleared) || cleared.length > 32) return [];
  const candidates = new Set(runGate(payload, { allowlistFields: Object.keys(payload) }, course).flags.map((f) => f.token));
  const known = knownIn(course);
  return [...new Set(cleared)].filter((t) => typeof t === "string" && t.length <= 80 && candidates.has(t) && !known(t)
    && !PATTERN_RULES.some(([, , , re]) => new RegExp(re.source, re.flags).test(t)));
}

/** Everything a propose request would send, checked. Returns the projected payload; throws { status } on any problem. */
export function checkOutbound(body, ideaConfig, course) {
  const payload = projectPayload(body?.payload, ideaConfig);
  // A grading paper with no readable work is marked by hand from the original; nothing is sent for it.
  if (Array.isArray(ideaConfig.allowlistFields) && ideaConfig.allowlistFields.includes("steps") && !(payload.steps ?? []).some((x) => String(x).trim())) fail(400, { error: "this paper has no readable work; mark it by hand from the original" });
  const cleared = clearedPhrases(body?.cleared, payload, course);
  const scoped = cleared.length ? { ...course, glossary: [...(course.glossary ?? []), ...cleared] } : course;
  assertClean(payload, scoped);
  checkTexts(texts(payload), course, "paper");
  checkScheme(ideaConfig.standards, course);
  return payload;
}
