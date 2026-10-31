// Deterministic text from human-confirmed codes and rubric labels. The model never writes these.
export function feedbackLine(confirmed, table) {
  const codes = (confirmed ?? []).filter((c) => c !== "OK" && c !== "UNSURE");
  if (!codes.length) return "Full marks.";
  const labels = Object.fromEntries(table.codes.map((c) => [c.code, c.label]));
  return `Marks lost: ${codes.map((c) => labels[c] ?? c).join("; ")}.`;
}
/** "1.0" -> "1.1", "1.9" -> "1.10". A new rubric version for every instructor save. */
export function bumpVersion(version) { const [a, b = "0"] = String(version).split("."); return `${a}.${Number(b) + 1}`; }
