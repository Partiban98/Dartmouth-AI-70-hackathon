// The TA's own error-code call, made before the AI's proposal is revealed.
// Stored so the agreement stat is read from the log, never from screen state.
// The precall is never sent to the model and never changes the AI request.
import { makeSideLog } from "./sidelog.js";

export const recordKey = (p) => `${p.idea}:${p.itemId}`;
/** The code the AI reported for a record: its first proposal, or "OK" when it proposed nothing. */
export const aiCodeOf = (proposal) => proposal?.proposals?.[0]?.code ?? "OK";

/** "N of M" over logged precalls and the proposals logged for the same records.
 *  A precall whose record has no logged proposal yet is not counted either way:
 *  nothing has been revealed to agree or disagree with. */
export function agreement(precalls, proposals, session) {
  const mine = (precalls ?? []).filter((p) => p.kind !== "reveal" && (!session || p.session === session));
  let matched = 0, total = 0;
  for (const p of mine) {
    const prop = (proposals ?? []).find((x) => x.idea === p.idea && x.itemId === p.itemId);
    if (!prop) continue;
    total++;
    if (aiCodeOf(prop) === p.code) matched++;
  }
  return { matched, total, text: `${matched} of ${total}` };
}

export function makePrecall({ localDir, course }) {
  const log = makeSideLog(localDir, course);
  return {
    /** One call per record. A second is refused so a TA cannot revise a call after seeing the AI. */
    add({ idea, itemId, code, by, session }) {
      if (!idea || !itemId || !code) return { status: 400, error: "idea, itemId and code are required" };
      const rec = { ts: new Date().toISOString(), kind: "precall", idea, itemId, code: String(code), by: by ?? null, session: session ?? null };
      const existing = log.read("precalls");
      if (existing.some((p) => recordKey(p) === recordKey(rec))) return { status: 409, error: "you have already made your call on this paper" };
      try { log.assertSafe(rec); } catch (e) { return { status: 400, error: e.message }; }
      log.append("precalls", rec);
      return { status: 201, saved: true };
    },
    /** The moment the AI's proposal was actually put on screen. Logged so that
     *  "the TA called it first" is checkable from the log rather than claimed:
     *  the precall for a record must carry an earlier timestamp than its
     *  reveal. The pipeline fetches the proposal before the review hook runs,
     *  so the proposal log line is not the reveal and cannot stand in for it.
     *  See docs/REQUEST-KISHORE-precall-before-model.md. */
    addReveal({ idea, itemId, session }) {
      if (!idea || !itemId) return { status: 400, error: "idea and itemId are required" };
      const rec = { ts: new Date().toISOString(), kind: "reveal", idea, itemId, session: session ?? null };
      try { log.assertSafe(rec); } catch (e) { return { status: 400, error: e.message }; }
      log.append("precalls", rec);
      return { status: 201, saved: true };
    },
    list() { return log.read("precalls").filter((p) => p.kind !== "reveal"); },
    reveals() { return log.read("precalls").filter((p) => p.kind === "reveal"); },
    agreement(proposals, session) { return agreement(log.read("precalls"), proposals, session); },
  };
}
