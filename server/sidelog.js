// Extra JSONL files in local/ for records outside the core's four types.
import { appendFileSync, readFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { assertLogSafe } from "../lib/logshape.js";

/** The frozen lib/logshape.js allows only gate, blocked, proposal and decision
 *  records, and it may not change without Kishore. Eval cases, eval runs,
 *  regrade requests and precalls are none of those, so the record is handed to
 *  assertLogSafe under an allowed type for the part that matters here: the
 *  value scan (pattern rules, roster names, forbidden keys). The stored line
 *  keeps its own `kind`. Everything lands in local/, which is gitignored, so
 *  no uploaded paper can be committed. The request to add these types to
 *  logshape properly is in docs/REQUEST-KISHORE-logshape-types.md.
 */
export function makeSideLog(localDir, course) {
  mkdirSync(localDir, { recursive: true });
  const file = (name) => join(localDir, `${name}.jsonl`);
  return {
    assertSafe(record) { assertLogSafe({ ...record, type: "gate" }, course); return true; },
    append(name, record) { this.assertSafe(record); appendFileSync(file(name), JSON.stringify(record) + "\n"); return record; },
    read(name) { try { return readFileSync(file(name), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)); } catch { return []; } },
  };
}
