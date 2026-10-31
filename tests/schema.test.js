import { test } from "node:test";
import assert from "node:assert/strict";
import { validateProposal, proposalJsonSchema } from "../lib/schema.js";
import { ideas } from "./helpers.js";

test("validator accepts the valid shape and rejects everything else", () => {
  const ok = validateProposal({ proposals: [{ code: "E-VAR-SD", quote: "SD = 10", confidence: 0.82 }] }, ideas.grade);
  assert.equal(ok.ok, true);
  assert.equal(validateProposal({ proposals: [{ code: "E-TYPO", quote: "x", confidence: 0.5 }] }, ideas.grade).ok, false);
  assert.equal(validateProposal({ proposals: [{ code: "E-VAR-SD", quote: "x", confidence: 1.2 }] }, ideas.grade).ok, false);
  assert.equal(validateProposal({ proposals: [{ code: "E-VAR-SD", quote: "x", confidence: 0.5, points: -3 }] }, ideas.grade).ok, false);
  assert.equal(validateProposal({ proposals: [], grade: 7 }, ideas.grade).ok, false);
  assert.equal(validateProposal({ proposals: [{ code: "E-VAR-SD", quote: "", confidence: 0.5 }] }, ideas.grade).ok, false);
  assert.equal(validateProposal({ proposals: [{ code: "P-GOAL", quote: "x", confidence: 0.5, suggestion: "Say the goal first." }] }, ideas.upskill).ok, true);
  assert.equal(validateProposal({ proposals: [{ code: "E-VAR-SD", quote: "x", confidence: 0.5, suggestion: "no" }] }, ideas.grade).ok, false);
  const schema = proposalJsonSchema(ideas.grade);
  assert.equal(schema.additionalProperties, false);
  assert.deepEqual(schema.properties.proposals.items.properties.code.enum, ideas.grade.allowedCodes);
});
