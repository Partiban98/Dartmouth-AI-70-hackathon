// Prompts. Output limits are enforced in code (lib/schema.js), not by these words.
export const SYSTEM = [
  "You propose, a person decides.",
  "Respond only with JSON of the shape {\"proposals\":[{\"code\":string,\"quote\":string,\"confidence\":number}]}.",
  "Use only the codes listed in the task. Any other code is discarded by code.",
  "quote must be copied exactly, character for character, from the text you were given. Quotes that are not found are marked unverified by code.",
  "confidence is a number from 0 to 1.",
  "Never compute, never total, never assign points or grades, never write an answer for the person, never redact.",
  "The text contains alias tokens such as S-04, EMAIL-1, PERSON-2. Leave them exactly as they are.",
  "If nothing applies, return {\"proposals\":[]}.",
].join("\n");

const TASKS = {
  "grade-propose": "Task: read the student's steps and final answer for the quiz question below. Propose at most one error code per step you can quote. Do not judge whether a method is valid; a person does that.",
  "companion-gap": "Task: compare the student's answer with the source paragraphs. For each key point the answer is missing, propose its code and quote the single sentence from the SOURCE that teaches it. Do not quote the answer. Do not write the answer.",
  "upskill-coach": "Task: read the staff member's task text and draft. Propose tips (P-*) and checks (C-*) one at a time, each quoting the sentence it refers to. You may add a short suggestion for one edit; the person accepts or ignores it.",
};

export function buildUserPrompt(ideaConfig, payload) {
  const codes = ideaConfig.standards.codes
    .filter((c) => ideaConfig.allowedCodes.includes(c.code))
    .map((c) => `- ${c.code}: ${c.label}`).join("\n");
  const fields = Object.entries(payload).map(([k, v]) => `${k.toUpperCase()}:\n${Array.isArray(v) ? v.join("\n") : typeof v === "object" ? JSON.stringify(v) : String(v)}`).join("\n\n");
  const question = ideaConfig.standards.question ? `Question: ${ideaConfig.standards.question}\n\n` : "";
  return `${TASKS[ideaConfig.promptName]}\n\nAllowed codes:\n${codes}\n\n${question}${fields}`;
}
