import { appendFileSync, readFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { assertLogSafe } from "../lib/logshape.js";

export function makeLog(localDir, course) {
  mkdirSync(localDir, { recursive: true });
  const file = (name) => join(localDir, `${name}.jsonl`);
  return {
    append(name, record) { assertLogSafe(record, course); appendFileSync(file(name), JSON.stringify(record) + "\n"); return record; },
    read(name) { try { return readFileSync(file(name), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)); } catch { return []; } },
    readAll() { return { gate: this.read("gate"), proposals: this.read("proposals"), decisions: this.read("decisions"), blocked: this.read("blocked") }; },
  };
}
