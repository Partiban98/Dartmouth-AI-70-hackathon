// A Quiz/Assignment: one head TA sets the question and scheme, gets a code, and shares a pack. Other laptops join by pasting the pack.
// Saved at local/assignments/<CODE>.json. Carries the scheme only: never papers, never names, never the id-to-name map.
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { randomInt } from "node:crypto";
import { validateStandards } from "../lib/engine.js";

const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"; // no 0, O, 1, I, L: read over a phone, typed on a laptop
/** A code is also the set id, the ingest folder and the file name, so a pasted one must match exactly. */
export const CODE_RE = new RegExp(`^[${ALPHABET}]{3}-[${ALPHABET}]{3}$`);
const PREFIX = "REMAIN1:";
const DIR = (localDir) => join(localDir, "assignments");
const file = (localDir, code) => { if (!CODE_RE.test(code)) throw new Error("That is not a Quiz/Assignment code"); return join(DIR(localDir), `${code}.json`); };

function newCode(localDir) {
  for (let tries = 0; tries < 50; tries++) {
    const s = Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
    const code = `${s.slice(0, 3)}-${s.slice(3)}`;
    if (!existsSync(file(localDir, code))) return code;
  }
  throw new Error("could not find a free code");
}

function save(localDir, a) {
  mkdirSync(DIR(localDir), { recursive: true });
  writeFileSync(file(localDir, a.code), JSON.stringify(a, null, 2) + "\n");
  return loadAssignment(localDir, a.code);
}

// A pack is untrusted input, so only these fields, with these types, are ever read from one or written into one.
const str = (v) => (typeof v === "string" ? v : undefined);
const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
const pick = (o, spec) => Object.fromEntries(Object.entries(spec).map(([k, f]) => [k, f(o?.[k])]).filter(([, v]) => v !== undefined));
const list = (spec) => (v) => (Array.isArray(v) ? v.map((x) => pick(x, spec)) : undefined);
const SCHEME = { id: str, version: str, owner: str, status: str, course: str, title: str, question: str, max: num,
  codes: list({ code: str, label: str, deduction: num }), methods: list({ id: str, label: str, signature: str }),
  answerRules: list({ near: num, tolerance: num, code: str, note: str }), correctAnswer: num, tolerance: num };
const PACK = { code: str, course: str, title: str, question: str, createdBy: str, createdAt: str, version: str };
// Precedents stay on the head TA's laptop: their text is typed by graders and can name a student.
const shareable = (st) => pick(st, SCHEME);
const local = (st) => ({ ...shareable(st), ...(Array.isArray(st?.precedents) ? { precedents: st.precedents.filter((x) => typeof x === "string") } : {}),
  ...(Array.isArray(st?.pendingPrecedents) ? { pendingPrecedents: st.pendingPrecedents.map((x) => pick(x, { code: str, reason: str, by: str, itemId: str, at: str })) } : {}) });

/** E6: a method pattern runs on every paper in the browser, where a regular expression cannot be timed out. So only a small,
 *  conservative grammar is accepted: literals, \d \s \w . and [sets], groups and alternatives; only a letter, \d or \s may repeat;
 *  a group may only be optional; and nothing a repeat could also match may follow it before the next required piece.
 *  Returns a plain reason or null. */
export function unsafePattern(sig) {
  const s = String(sig ?? "");
  if (s.length > 200) return "A method pattern must be under 200 characters.";
  try { new RegExp(s, "i"); } catch { return "A method pattern must be a valid pattern."; }
  let i = 0;
  const fail = (m) => { throw new Error(m); };
  const DIGIT = (c) => /\d/.test(c), SPACE = (c) => /\s/.test(c), WORD = (c) => /\w/.test(c), ALL = () => true;
  const SAMPLES = Array.from({ length: 128 }, (_, n) => String.fromCharCode(n)).concat(["²", "é", "王", " "]);
  const overlap = (a, b) => (a.ch !== undefined ? b.has(a.ch) : b.ch !== undefined ? a.has(b.ch) : SAMPLES.some((c) => a.has(c.toLowerCase()) && b.has(c.toLowerCase())));
  const lit = (ch) => ({ ch, has: (c) => c.toLowerCase() === ch.toLowerCase(), repeatable: true });
  const cls = (has, repeatable) => ({ has, repeatable });
  function atom() {
    const c = s[i++];
    if (c === "\\") {
      const e = s[i++];
      if (/[1-9]/.test(e)) fail("A method pattern cannot refer back to an earlier group.");
      if (e === "b" || e === "B") return { zero: true };
      if (e === "d") return cls(DIGIT, true);
      if (e === "s") return cls(SPACE, true);
      if (e === "w") return cls(WORD, false);
      if (/[DSW]/.test(e)) return cls(ALL, false);
      // Only escaped punctuation is a plain character; any other letter or digit escape (\x61, \u0061, \t, \0, \p{..}) is refused.
      if (e === undefined || /[A-Za-z0-9]/.test(e)) fail("A method pattern can only use \\d, \\s, \\w and escaped punctuation.");
      return lit(e);
    }
    if (c === "^" || c === "$") return { zero: true };
    if (c === ".") return cls(ALL, false);
    if (c === "[") {
      // Scan to the closing bracket, stepping over escapes; [] and [^] are valid classes. Treated as "any character".
      let j = i; if (s[j] === "^") j++;
      while (j < s.length && s[j] !== "]") j += s[j] === "\\" ? 2 : 1;
      if (j >= s.length) fail("A method pattern has an unclosed [ ].");
      i = j + 1; return cls(ALL, false);
    }
    if (c === "(") {
      if (s[i] === "?") { if (s[i + 1] !== ":") fail("A method pattern cannot look ahead or behind."); i += 2; }
      const branches = alternation(); if (s[i++] !== ")") fail("A method pattern has an unclosed group.");
      // What a group can start with: each branch's first piece; anything unclear counts as "anything".
      const firsts = branches.map((b) => b.find((x) => !x.zero));
      const has = (ch) => firsts.some((f) => !f || f.min === 0 || f.has(ch));
      return { has, group: true, repeatable: false };
    }
    return lit(c);
  }
  function quant(a) {
    let min = 1, max = 1;
    const c = s[i];
    if (c === "*") { min = 0; max = Infinity; i++; } else if (c === "+") { max = Infinity; i++; } else if (c === "?") { min = 0; i++; }
    else if (c === "{") { const m = /^\{(\d+)(,(\d*))?\}/.exec(s.slice(i)); if (m) { min = +m[1]; max = m[2] ? (m[3] ? +m[3] : Infinity) : min; i += m[0].length; } }
    if (s[i] === "?" && max !== 1) i++; // lazy marker
    if (max !== 1 || min !== 1) {
      if (a.zero) fail("A method pattern cannot repeat an anchor.");
      if (a.group ? !(min === 0 && max === 1) : !a.repeatable) fail("Only a letter, a digit (\\d) or a space (\\s) may repeat in a method pattern; a group may only be optional.");
    }
    return { ...a, min, max };
  }
  function branch() {
    const out = [];
    while (i < s.length && s[i] !== "|" && s[i] !== ")") out.push(quant(atom()));
    // A piece that can vary in length must not be able to match what follows it before the next required piece.
    out.forEach((q, k) => {
      if (q.zero || q.min === q.max) return;
      for (let j = k + 1; j < out.length; j++) {
        const n = out[j]; if (n.zero) continue;
        if (overlap(q, n)) fail("Two repeating parts of a method pattern can match the same characters; make them distinct.");
        if (n.min > 0) break;
      }
    });
    return out;
  }
  function alternation() { const bs = [branch()]; while (s[i] === "|") { i++; bs.push(branch()); } return bs; }
  try { alternation(); if (i < s.length) fail("A method pattern has an unmatched bracket."); return null; } catch (e) { return e.message; }
}
const methodsProblem = (st) => (st?.methods ?? []).map((m) => unsafePattern(m.signature)).find(Boolean) ?? null;

/** Validates the scheme with the same rules as the rubric drawer, assigns a code, saves. Throws naming the first problem. */
export function createAssignment(draft, { localDir, createdBy }) {
  const code = newCode(localDir);
  const { course = "", title = "", question = "", max, codes, methods = [], answerRules = [], correctAnswer, tolerance } = draft;
  const standards = shareable({ id: code, version: "1.0", owner: "head TA", status: "approved", course, title, question, max, codes, methods, answerRules });
  if (correctAnswer != null) standards.correctAnswer = correctAnswer;
  if (tolerance != null) standards.tolerance = tolerance;
  const v = validateStandards(standards);
  if (!v.ok) throw new Error(v.errors.join("; "));
  const mp = methodsProblem(standards); if (mp) throw new Error(mp);
  return save(localDir, { code, course, title, question, standards, createdBy, createdAt: new Date().toISOString(), version: "1.0" });
}

export function encodePack(a) {
  return PREFIX + Buffer.from(JSON.stringify({ ...pick(a, PACK), standards: shareable(a.standards) })).toString("base64url");
}

export function decodePack(text) {
  const t = String(text ?? "").trim();
  if (!t.startsWith("REMAIN")) throw new Error("That is not a Quiz/Assignment pack. It starts with REMAIN1:");
  if (!t.startsWith(PREFIX)) throw new Error("This pack is from another version of Remain; ask for a fresh one");
  let raw;
  try { raw = JSON.parse(Buffer.from(t.slice(PREFIX.length), "base64url").toString("utf8")); } catch { throw new Error("This pack could not be read. Paste the whole token"); }
  const a = { ...pick(raw, PACK), standards: shareable(raw?.standards) };
  if (!a || !CODE_RE.test(a.code) || a.standards?.id !== a.code || !validateStandards(a.standards).ok || methodsProblem(a.standards)) throw new Error("This pack is incomplete or damaged (or has an unsafe method pattern); ask for a fresh one");
  return a;
}

/** Saves a pasted pack on this laptop as joined. A joined laptop never becomes the owner, whatever the pack says.
 *  A different scheme under a code already here is refused unless force; the laptop that created a code refuses packs for it. */
export function joinAssignment(pack, { localDir, force = false }) {
  const a = decodePack(pack);
  const here = loadAssignment(localDir, a.code);
  if (here && !here.joined) throw new Error(`This laptop created code ${a.code}. Edit its scheme here instead of pasting a pack.`);
  if (here && !force && JSON.stringify(shareable(here.standards)) !== JSON.stringify(a.standards)) throw new Error(`Code ${a.code} is already on this laptop with a different scheme (version ${here.version}). Keep yours, or replace it with version ${a.version}.`);
  const pendingPrecedents = here?.standards?.pendingPrecedents ?? []; // changes this laptop proposed survive the head TA's new version
  return save(localDir, { ...a, createdBy: here?.createdBy ?? a.createdBy, joined: true, standards: pendingPrecedents.length ? { ...a.standards, pendingPrecedents } : a.standards });
}

export function loadAssignment(localDir, code) {
  if (!CODE_RE.test(code)) return null;
  const p = file(localDir, code);
  return existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : null;
}

export function listAssignments(localDir) {
  if (!existsSync(DIR(localDir))) return [];
  return readdirSync(DIR(localDir)).filter((f) => f.endsWith(".json")).sort().map((f) => JSON.parse(readFileSync(join(DIR(localDir), f), "utf8")));
}

/** Scheme edits on this laptop. The head TA's laptop saves a new version; any other laptop may only add proposed changes. Returns { errors }. */
export function saveScheme(localDir, table, me) {
  const a = loadAssignment(localDir, table?.id);
  if (!a) return { errors: ["unknown Quiz/Assignment"] };
  const next = local(table);
  const same = (x) => { const { pendingPrecedents, ...rest } = x; return JSON.stringify(rest); };
  if ((a.joined || a.createdBy !== me) && same(next) !== same(local(a.standards))) return { errors: ["Only the head TA's laptop can change this scheme. Propose a change instead."] };
  const v = validateStandards(next);
  if (!v.ok) return { errors: v.errors };
  const mp = methodsProblem(next); if (mp) return { errors: [mp] };
  save(localDir, { ...a, version: next.version, standards: next });
  return { errors: null };
}

/** Grading sets for makeIdeas, keyed by code. The title shown is "course · title". */
export function assignmentSets(localDir) {
  return Object.fromEntries(listAssignments(localDir).map((a) => [a.code, { ...a.standards, course: `${a.course} · ${a.title}` }]));
}
