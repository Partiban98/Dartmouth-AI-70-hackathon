// Two small screen rules, kept in plain JS so tests can run them.

/** Keys drive the grading panel. Links, buttons, menus and text boxes keep their own behaviour, and nothing acts
 *  through an open dialog: Enter or 1/2/3 typed in the marking scheme must never answer or save the paper underneath. */
export function ownsKey(e, dialogOpen) {
  const t = e.target;
  if (dialogOpen || t?.closest?.('[role="dialog"]')) return false;
  if (t && /^(A|BUTTON|SELECT|TEXTAREA)$/.test(t.tagName)) return false;
  if (e.key === "Enter") e.preventDefault();
  return true;
}

/** A final mark is a number from 0 to full marks. Returns what is wrong in plain words, or null. */
export function markProblem(raw, max) {
  const s = String(raw ?? "").trim();
  if (!s) return "Type a mark.";
  const n = Number(s);
  if (!Number.isFinite(n)) return "Type a number.";
  if (n < 0 || n > max) return `Marks go from 0 to ${max}.`;
  return null;
}
