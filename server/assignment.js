// A Quiz/Assignment: one head TA sets the question and scheme, gets a code, and shares a pack. Other laptops join by pasting the pack.
// Saved at local/assignments/<CODE>.json. Carries the scheme only: never papers, never names, never the id-to-name map.
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { randomInt } from "node:crypto";
import { validateStandards } from "../lib/engine.js";

const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"; // no 0, O, 1, I, L: read over a phone, typed on a laptop
const PREFIX = "REMAIN1:";
const DIR = (localDir) => join(localDir, "assignments");
const file = (localDir, code) => join(DIR(localDir), `${String(code).toUpperCase()}.json`);

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

/** Validates the scheme with the same rules as the rubric drawer, assigns a code, saves. Throws naming the first problem. */
export function createAssignment(draft, { localDir, createdBy }) {
  const code = newCode(localDir);
  const { course = "", title = "", question = "", max, codes, methods = [], answerRules = [], correctAnswer, tolerance } = draft;
  const standards = { id: code, version: "1.0", owner: "head TA", status: "approved", course, title, question, max, codes, methods, answerRules };
  if (correctAnswer != null) standards.correctAnswer = correctAnswer;
  if (tolerance != null) standards.tolerance = tolerance;
  const v = validateStandards(standards);
  if (!v.ok) throw new Error(v.errors.join("; "));
  return save(localDir, { code, course, title, question, standards, createdBy, createdAt: new Date().toISOString(), version: "1.0" });
}

export function encodePack(a) {
  const { code, course, title, question, standards, createdBy, createdAt, version } = a;
  return PREFIX + Buffer.from(JSON.stringify({ code, course, title, question, standards, createdBy, createdAt, version })).toString("base64url");
}

export function decodePack(text) {
  const t = String(text ?? "").trim();
  if (!t.startsWith("REMAIN")) throw new Error("That is not a Quiz/Assignment pack. It starts with REMAIN1:");
  if (!t.startsWith(PREFIX)) throw new Error("This pack is from another version of Remain; ask for a fresh one");
  let a;
  try { a = JSON.parse(Buffer.from(t.slice(PREFIX.length), "base64url").toString("utf8")); } catch { throw new Error("This pack could not be read. Paste the whole token"); }
  if (!a || typeof a.code !== "string" || !validateStandards(a.standards).ok) throw new Error("This pack is incomplete");
  return a;
}

/** Saves a pasted pack on this laptop. A different scheme under a code already here is refused unless force. */
export function joinAssignment(pack, { localDir, force = false }) {
  const a = decodePack(pack);
  const here = loadAssignment(localDir, a.code);
  if (here && !force && JSON.stringify(here.standards) !== JSON.stringify(a.standards)) throw new Error(`Code ${a.code} is already on this laptop with a different scheme (version ${here.version}). Keep yours, or replace it with version ${a.version}.`);
  return save(localDir, a);
}

export function loadAssignment(localDir, code) {
  const p = file(localDir, code);
  return existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : null;
}

export function listAssignments(localDir) {
  if (!existsSync(DIR(localDir))) return [];
  return readdirSync(DIR(localDir)).filter((f) => f.endsWith(".json")).sort().map((f) => JSON.parse(readFileSync(join(DIR(localDir), f), "utf8")));
}
