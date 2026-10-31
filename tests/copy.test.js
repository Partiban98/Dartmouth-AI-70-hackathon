// The grading screens are for people with no AI background. No engineering vocabulary may appear in their source.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SCREENS = ["GradeApp.tsx", "Start.tsx", "Grader.tsx", "Finish.tsx", "SchemeDrawer.tsx", "copy.ts", "useGrading.ts"].map((f) => join(ROOT, "components", "grading", f));
const BANNED = [/payload/i, /alias/i, /assertClean/, /\bpipeline\b/i, /\brung\b/i, /R-1[0-3]\b/, /LIVE API/, /CACHED REHEARSAL/, /\bmodel proposes/i, /rules engine/i, /allowlist/i, /deterministic/i, /\bregex\b/i, /confidence \d/];

test("every grading screen exists and uses plain words only", () => {
  for (const f of SCREENS) {
    assert.ok(existsSync(f), `${f} missing`);
    const src = readFileSync(f, "utf8").split("\n").filter((l) => !/^\s*import\b/.test(l) && !/^\s*\/\//.test(l)).join("\n");
    for (const re of BANNED) assert.ok(!re.test(src), `${f.split("/").pop()} contains ${re}`);
  }
});

test("the spec's honest strings still reach the screen through the footer and the receipt", () => {
  const src = readFileSync(join(ROOT, "components", "grading", "copy.ts"), "utf8");
  assert.ok(src.includes("Assigned by you (TA)"), "receipt subtitle");
  assert.ok(src.includes("Your decisions stay on this computer"));
  assert.ok(src.includes("cannot guarantee 100 percent"), "honest limit in plain words");
});

test("the Quiz/Assignment doors use Kishore's words, and the join field asks for the whole pack, not a code alone", () => {
  const src = readFileSync(join(ROOT, "components", "grading", "copy.ts"), "utf8");
  assert.ok(src.includes('"Start grading a Quiz/Assignment"'), "door label, Kishore's call");
  assert.ok(src.includes('"Join with a Quiz/Assignment code"'));
  assert.ok(src.includes('"Paste the Quiz/Assignment pack"'), "the short code cannot be looked up yet, so the field asks for the pack");
  assert.ok(!/\bquiz code\b/i.test(src) && !/start a new assignment/i.test(src), "no leftover wording from the draft");
});

test("E5 and PUX-5: the screens only offer what the system can do", () => {
  const copy = readFileSync(join(ROOT, "components", "grading", "copy.ts"), "utf8");
  const grader = readFileSync(join(ROOT, "components", "grading", "Grader.tsx"), "utf8");
  assert.ok(/No, keep it/.test(copy) && /"not-name"/.test(grader), "the human may keep a term through the server-checked path");
  assert.match(copy, /nameNotTerm: "[^"]*server still checks[^"]*only to this check/, "the explanation preserves server checks and request scope");
  assert.match(copy, /noAnswer: "[^"]*Mark it yourself[^"]*try again[^"]*"/, "no-answer message names the real choices, including marking by hand");
  assert.ok(/markByHand/.test(grader), "the button exists");
});
