import { appendFileSync, readFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { assertLogSafe } from "../lib/logshape.js";
import { recordProblem, proposalProblem } from "./records.js";

export function makeLog(localDir, course) {
  mkdirSync(localDir, { recursive: true });
  const file = (name) => join(localDir, `${name}.jsonl`);
  return {
    append(name, record) { assertLogSafe(record, course); appendFileSync(file(name), JSON.stringify(record) + "\n"); return record; },
    // One damaged line (an interrupted write, a hand edit) is skipped and counted; it never hides the rows around it.
    readChecked(name) {
      let text; try { text = readFileSync(file(name), "utf8"); } catch { return { rows: [], damaged: 0 }; }
      const rows = []; let damaged = 0;
      for (const line of text.split("\n")) {
        if (!line.trim()) continue;
        let r; try { r = JSON.parse(line); } catch { damaged++; continue; }
        if ((name === "decisions" || name === "gate") && recordProblem(r)) { damaged++; continue; }
        if (name === "proposals" && proposalProblem(r)) { damaged++; continue; }
        rows.push(r);
      }
      return { rows, damaged };
    },
    read(name) { return this.readChecked(name).rows; },
    readAll() {
      const out = { damaged: {} };
      for (const n of ["gate", "proposals", "decisions", "blocked"]) { const { rows, damaged } = this.readChecked(n); out[n] = rows; if (damaged) out.damaged[n] = damaged; }
      return out;
    },
  };
}
