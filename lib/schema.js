// Hand-written validator for the only model output shape that counts. Zero dependencies (core choice, HANDOFF 4.3).
const MAX_ITEMS = 6, MAX_QUOTE = 300;

/** JSON Schema sent to the provider (structured output or strict tool input). */
export function proposalJsonSchema(ideaConfig) {
  const item = {
    type: "object",
    properties: {
      code: { type: "string", enum: ideaConfig.allowedCodes },
      quote: { type: "string" },
      confidence: { type: "number" },
    },
    required: ["code", "quote", "confidence"],
    additionalProperties: false,
  };
  if (ideaConfig.allowSuggestion) item.properties.suggestion = { type: "string" };
  return { type: "object", properties: { proposals: { type: "array", items: item } }, required: ["proposals"], additionalProperties: false };
}

/** @returns {{ok:boolean, errors:string[], value?:{proposals:object[]}}} */
export function validateProposal(obj, ideaConfig) {
  const errors = [];
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return { ok: false, errors: ["response is not an object"] };
  const extra = Object.keys(obj).filter((k) => k !== "proposals");
  if (extra.length) errors.push(`unexpected keys: ${extra.join(", ")}`);
  if (!Array.isArray(obj.proposals)) errors.push("proposals is not an array");
  else {
    if (obj.proposals.length > MAX_ITEMS) errors.push(`more than ${MAX_ITEMS} proposals`);
    obj.proposals.forEach((p, i) => {
      if (!p || typeof p !== "object") { errors.push(`proposals[${i}] not an object`); return; }
      const allowed = ["code", "quote", "confidence", ...(ideaConfig.allowSuggestion ? ["suggestion"] : [])];
      for (const k of Object.keys(p)) if (!allowed.includes(k)) errors.push(`proposals[${i}].${k} not allowed`);
      if (!ideaConfig.allowedCodes.includes(p.code)) errors.push(`proposals[${i}].code ${p.code} not in allowlist`);
      if (typeof p.quote !== "string" || !p.quote.trim() || p.quote.length > MAX_QUOTE) errors.push(`proposals[${i}].quote invalid`);
      if (typeof p.confidence !== "number" || !(p.confidence >= 0 && p.confidence <= 1)) errors.push(`proposals[${i}].confidence not in 0..1`);
      if ("suggestion" in p && (typeof p.suggestion !== "string" || p.suggestion.length > MAX_QUOTE)) errors.push(`proposals[${i}].suggestion invalid`);
    });
  }
  return errors.length ? { ok: false, errors } : { ok: true, errors: [], value: { proposals: obj.proposals } };
}
