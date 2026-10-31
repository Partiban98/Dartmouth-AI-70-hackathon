import { test } from "node:test";
import assert from "node:assert/strict";
import { runGate, assertClean, remap, HONEST_LIMIT } from "../lib/gate.js";
import { gateRecord, blockedRecord, assertLogSafe } from "../lib/logshape.js";
import { course, ideas, dana, sub } from "./helpers.js";

const textIdea = { allowlistFields: ["text"] };
const probe = (text, picks) => runGate({ text }, textIdea, course, picks);

test("T01..T08 each identifier pattern is aliased and counted", () => {
  const cases = [
    ["EMAIL", "mail me at someone@example.org now", /EMAIL-1/],
    ["PHONE", "call 603-555-0142 today", /PHONE-1/],
    ["STUDENT_ID", "id 900110137 on file", /SID-1/],
    ["NETID", "login demo-abc123 works", /NETID-1/],
    ["EMPLOYEE_ID", "badge EMP-00042 issued", /EMPID-1/],
    ["INTERNAL_ID", "ticket REQ-20417 open", /INTID-1/],
    ["ADDRESS", "lives at 12 Maple Street now", /ADDR-1/],
    ["URL", "see https://example.org/x for details", /URL-1/],
  ];
  for (const [type, text, tok] of cases) {
    const g = probe(text);
    assert.equal(g.report.counts[type], 1, type);
    assert.match(g.payload.text, tok, type);
    const original = Object.values(g.aliasMap)[0];
    assert.ok(!g.payload.text.includes(original), `${type} original leaked`);
  }
});

test("T09 A-01 allowlist drops header fields and counts them", () => {
  const g = runGate(sub("S-01"), ideas.grade, course);
  assert.deepEqual(Object.keys(g.payload).sort(), ["finalAnswer", "steps"]);
  assert.equal(g.report.droppedFields, 2); // header, id
  assert.equal(g.blocked, false);
});

test("T06 documented limit: a lowercase non-roster name is not caught", () => {
  const g = probe("i asked maya for help with the mean");
  assert.equal(g.payload.text, "i asked maya for help with the mean");
  assert.equal(g.report.counts.NAME, 0);
  assert.ok(HONEST_LIMIT.includes("cannot guarantee 100 percent"));
});

test("T11 name-injection probe: S-12 roster name and Dana email never in payload, report, or log records", () => {
  const g = runGate(sub("S-12"), ideas.grade, course);
  const name = course.roster[3].name;
  const payloadText = JSON.stringify(g.payload);
  assert.ok(!payloadText.includes(name), "roster name in payload");
  assert.ok(payloadText.includes("S-04"), "alias missing");
  assert.equal(g.report.counts.NAME, 1);
  assert.ok(!JSON.stringify(g.report).includes(name));
  const rec = gateRecord("grade", "S-12", g.report);
  assertLogSafe(rec, course);
  assert.ok(!JSON.stringify(rec).includes(name));

  const d = runGate(dana, ideas.upskill, course);
  const out = JSON.stringify(d.payload) + JSON.stringify(d.report) + JSON.stringify(gateRecord("upskill", "dana", d.report));
  for (const v of Object.values(d.aliasMap)) assert.ok(!out.includes(v), `value leaked: ${v}`);
  assert.ok(!out.includes("@example.org"));
  assert.throws(() => assertLogSafe({ type: "gate", aliasMap: d.aliasMap }, course));
  assert.throws(() => assertLogSafe({ type: "gate", note: "someone@example.org" }, course));
});

test("Dana task gate counts match the spec expectation", () => {
  const d = runGate(dana, ideas.upskill, course);
  const c = d.report.counts;
  assert.deepEqual({ HEADER_LINE: c.HEADER_LINE, NAME: c.NAME, EMAIL: c.EMAIL, STUDENT_ID: c.STUDENT_ID, PHONE: c.PHONE, INTERNAL_ID: c.INTERNAL_ID }, dana.expectedGateCounts);
  assert.equal(d.blocked, false, JSON.stringify(d.flags));
  assert.ok(d.payload.text.includes("PERSON-1") && d.payload.text.includes("PERSON-2") && d.payload.text.includes("S-10"));
  assert.ok(!d.payload.text.includes("From:"));
});

test("R-11 blocks until a human picks; flagged token stays local; R-12 DOB blocks", () => {
  const g = probe("talked to Jordan Blake about it");
  assert.equal(g.blocked, true);
  assert.deepEqual(g.report.blockedRules, ["R-11"]);
  assert.deepEqual(g.flags, [{ token: "Jordan Blake", rule: "R-11" }]);
  assert.ok(!JSON.stringify(gateRecord("x", "y", g.report)).includes("Jordan"));
  const asName = probe("talked to Jordan Blake about it", { "Jordan Blake": "name" });
  assert.equal(asName.blocked, false); assert.match(asName.payload.text, /PERSON-\d/); assert.equal(asName.report.counts.NAME, 1);
  const notName = probe("talked to Jordan Blake about it", { "Jordan Blake": "not-name" });
  assert.equal(notName.blocked, false); assert.ok(notName.payload.text.includes("Jordan Blake"));
  const gloss = probe("see Standard Deviation in Ch. 3");
  assert.equal(gloss.blocked, false);
  const dob = probe("born 04/12/2001");
  assert.equal(dob.blocked, true); assert.ok(dob.report.blockedRules.includes("R-12")); assert.ok(!dob.payload.text.includes("2001"));
});

test("T12 assertClean passes the gate payload and blocks anything unclean with 422", () => {
  const g = runGate(dana, ideas.upskill, course);
  assert.equal(assertClean(g.payload, course), true);
  for (const [bad, rule] of [["x someone@example.org", "R-01"], [`x ${course.roster[0].name}`, "R-09"], ["x Prof. Ada Byron", "R-10"], ["x Jordan Blake", "R-11"], ["x 2001-04-12", "R-12"]]) {
    assert.throws(() => assertClean({ text: bad }, course), (e) => e.status === 422 && e.code === "BLOCKED" && e.rule === rule, rule);
  }
  const rec = blockedRecord("upskill", "dana", "R-01", 1);
  assertLogSafe(rec, course);
});

test("remap restores originals locally", () => {
  const g = runGate(sub("S-12"), ideas.grade, course);
  assert.equal(remap("Checked with S-04, mean is 8", g.aliasMap), `Checked with ${course.roster[3].name}, mean is 8`);
});
