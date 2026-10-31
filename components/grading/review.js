// Turns the grader's answers into the review the pipeline scores. Plain JS so node tests can run it.
// A mistake the grader adds (one nobody suggested) counts exactly like a confirmed one, once.

/** @returns {{confirmed:string[], overrides:object[]} | {error:"choose"|"why", n:number}} */
export function buildReview(items, state, added = []) {
  const confirmed = [], overrides = [];
  for (const [i, s] of state.entries()) {
    const from = items[i].code;
    if (!s.action) return { error: "choose", n: i + 1 };
    if (s.action === "confirm") confirmed.push(from);
    else {
      if (!s.reason.trim()) return { error: "why", n: i + 1 };
      // One decision per mistake, however many sources suggested it.
      overrides.push({ from, to: s.to, reason: s.reason, precedent: s.precedent });
      if (s.action === "change") confirmed.push(s.to);
    }
  }
  for (const code of added) if (!confirmed.includes(code)) confirmed.push(code);
  return { confirmed, overrides };
}

/** Mistakes a grader may add from the marking scheme. "No error" and "needs instructor" are not mistakes. */
export const addableCodes = (table) => table.codes.filter((c) => c.code !== "OK" && c.code !== "UNSURE");
