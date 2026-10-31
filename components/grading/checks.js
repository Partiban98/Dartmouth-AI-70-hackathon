// Small screen helpers in plain JS so tests can run them.

/** PUX-8: read a pasted pack for the join preview only. Any shape problem gives null ("unreadable"), never a crash.
 *  The server checks the pack again on join. Finds the pack inside a longer pasted message. */
export function packPreview(text) {
  const m = String(text ?? "").match(/REMAIN1:[A-Za-z0-9_-]+/);
  if (!m) return null;
  let a;
  try { a = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(m[0].slice(8).replace(/-/g, "+").replace(/_/g, "/")), (ch) => ch.charCodeAt(0)))); } catch { return null; }
  const s = (v) => typeof v === "string";
  if (!a || typeof a !== "object" || ![a.code, a.course, a.title, a.question].every(s)) return null;
  const st = a.standards;
  if (!st || typeof st !== "object" || !Array.isArray(st.codes) || !st.codes.every((c) => c && typeof c === "object" && s(c.code) && s(c.label))) return null;
  if (typeof st.max !== "number") return null;
  return { pack: m[0], code: a.code, course: a.course, title: a.title, question: a.question, version: s(a.version) ? a.version : "", createdBy: s(a.createdBy) ? a.createdBy : "",
    mistakes: st.codes.filter((c) => c.code !== "OK" && c.code !== "UNSURE").length, methods: Array.isArray(st.methods) ? st.methods.length : 0, max: st.max };
}

/** PUX-6: one row per paper in this set, at its latest decision; earlier decisions stay in the log as history. */
export function latestPerPaper(decisions, setId) {
  const latest = new Map();
  for (const d of decisions ?? []) if (d.idea === setId) latest.set(d.itemId, d);
  return [...latest.values()];
}

/** PUX-6: confirmed mistakes per code, counted from each paper's latest decision in this set only. */
export function classMistakes(decisions, setId) {
  const out = {};
  for (const d of latestPerPaper(decisions, setId)) for (const c of d.confirmed ?? []) (out[c] ??= { confirmed: 0 }).confirmed++;
  return out;
}
