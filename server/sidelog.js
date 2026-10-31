// Local records for evaluation, regrade requests and first calls. No provider calls.
import { appendFileSync, readFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { assertLogSafe } from "../lib/logshape.js";
import { listImported, loadMap } from "./ingest.js";

const fields = {
  "eval-case": ["ts", "kind", "idea", "itemId", "text", "aiCode", "taRuling", "reason", "rubricVersion", "input"],
  "eval-run": ["kind", "run_at", "total", "match", "mismatch"],
  "regrade-request": ["ts", "kind", "anonId", "questionId", "text", "status"],
  precall: ["ts", "kind", "idea", "itemId", "code", "by", "session"],
  reveal: ["ts", "kind", "idea", "itemId", "session", "proposalTs"],
};
const kinds = { "eval-cases": ["eval-case"], "eval-runs": ["eval-run"], "regrade-requests": ["regrade-request"], precalls: ["precall", "reveal"] };
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export function makeSideLog(localDir, course) {
  mkdirSync(localDir, { recursive: true });
  const file = (name) => { if (!kinds[name]) throw new Error("side file not allowed"); return join(localDir, `${name}.jsonl`); };
  const assertSafe = (record) => {
    const allowed = fields[record?.kind];
    if (!allowed) throw new Error("side record kind not allowed");
    for (const [key, value] of Object.entries(record)) {
      if (!allowed.includes(key)) throw new Error("side record shape not allowed");
      if (key === "input") {
        if (!value || !Array.isArray(value.steps) || !value.steps.every((x) => typeof x === "string") || !(value.finalAnswer === null || Number.isFinite(value.finalAnswer)) || Object.keys(value).some((k) => !["steps", "finalAnswer"].includes(k))) throw new Error("side input shape not allowed");
      } else if (record.kind === "eval-run" && ["total", "match", "mismatch"].includes(key)) {
        if (!Number.isSafeInteger(value) || value < 0) throw new Error("side count shape not allowed");
      } else if (value !== null && typeof value !== "string") throw new Error("side record shape not allowed");
    }
    // Reuse the core value scan; the explicit side schema above validates its own kind.
    assertLogSafe({ ...record, type: "gate" }, course);
    const words = [];
    for (const meta of listImported(localDir)) for (const m of Object.values(loadMap(localDir, meta.id))) {
      words.push(m.name, m.netid, m.email, m.studentId, ...String(m.name ?? "").split(/\s+/).filter((s) => s.length >= 2));
    }
    const identities = [...new Set(words.filter((s) => s != null && String(s).trim()).map((s) => String(s).trim()))];
    const serialized = JSON.stringify(record);
    if (identities.some((s) => new RegExp(`(?<![\\p{L}\\p{N}])${escape(s)}(?![\\p{L}\\p{N}])`, "iu").test(serialized))) throw new Error("side record contains a local student identity");
    return true;
  };
  return {
    assertSafe,
    append(name, record) { const path = file(name); if (!kinds[name].includes(record?.kind)) throw new Error("side record kind does not match file"); assertSafe(record); appendFileSync(path, JSON.stringify(record) + "\n"); return record; },
    read(name) {
      let text; try { text = readFileSync(file(name), "utf8"); } catch (e) { if (e.code === "ENOENT") return []; throw e; }
      return text.split("\n").filter(Boolean).flatMap((line) => { try { const r = JSON.parse(line); assertSafe(r); return kinds[name].includes(r.kind) ? [r] : []; } catch { return []; } });
    },
  };
}
