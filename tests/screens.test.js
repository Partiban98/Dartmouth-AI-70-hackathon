// Audit PUX-2 and PUX-3: grading keys never act through an open dialog, and only marks between 0 and full marks can be saved.
import { test } from "node:test";
import assert from "node:assert/strict";
import { ownsKey, markProblem } from "../components/grading/rules.js";

const ev = (key, tagName, insideDialog = false) => ({ key, target: { tagName, closest: (sel) => (insideDialog && /dialog/.test(sel) ? {} : null) }, preventDefault() { this.prevented = true; } });

test("PUX-2: Enter and 1/2/3 typed in the open marking-scheme dialog never reach the paper underneath", () => {
  for (const key of ["Enter", "1", "2", "3"]) {
    assert.equal(ownsKey(ev(key, "INPUT", true), true), false, `${key} in a dialog field`);
    assert.equal(ownsKey(ev(key, "BODY"), true), false, `${key} anywhere while a dialog is open`);
  }
  assert.equal(ownsKey(ev("Enter", "BODY"), false), true, "with no dialog, Enter still drives the panel");
  assert.equal(ownsKey(ev("Enter", "INPUT"), false), true, "the mark field's Enter still saves");
  for (const tag of ["A", "BUTTON", "SELECT", "TEXTAREA"]) assert.equal(ownsKey(ev("Enter", tag), false), false, tag);
});

test("PUX-3: empty, non-numeric, negative and above-full marks cannot be saved; 0 and full marks can", () => {
  for (const bad of ["", "  ", "abc", "-1", "-0.25", "10.25", "999", "Infinity", "NaN"]) assert.ok(markProblem(bad, 10), bad);
  for (const ok of ["0", "10", "7.5", "9.75"]) assert.equal(markProblem(ok, 10), null, ok);
});

test("PUX-2 review: every grading key listener ignores keys while a dialog is open, including Call it first", async () => {
  const { readFileSync } = await import("node:fs");
  const read = (f) => readFileSync(new URL(`../components/grading/${f}`, import.meta.url), "utf8");
  assert.match(read("CallItFirst.tsx"), /aria-modal="true"/, "Call it first");
  const grader = read("Grader.tsx");
  for (const block of grader.split('addEventListener("keydown"').slice(0, -1)) assert.match(block.slice(-1500), /own\(e\)/, "every Grader panel listener goes through own()");
});
