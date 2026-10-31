/** Normalize text before exact matching: curly quotes to straight, collapse whitespace, trim. */
export function normalize(s) {
  return String(s ?? "")
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[“”„‟]/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}
