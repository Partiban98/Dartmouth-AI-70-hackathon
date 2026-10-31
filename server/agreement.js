// How often a TA kept, changed or ruled out each suggested code.
// Counted from the decisions log alone: never from the planted eval labels,
// which measure the AI against an answer key rather than against people.
//
// What the decision record gives us per paper:
//   proposed   every code suggested that paper (AI and marking-scheme rules)
//   overrides  [{ from, to, reason }] -- a change carries the code it became,
//              an override carries "OK" (the TA ruled the suggestion out)
//   confirmed  the codes the TA stood behind
// A suggestion with no override entry against it is one the TA kept.
//
// The decision record does not record which source proposed a code, so a
// rules-engine suggestion counts here alongside an AI one. Saying otherwise
// would need the proposals log joined in, or a source field added to a frozen
// record shape.

export function agreementByCode(decisions, idea) {
  const rows = new Map();
  const bump = (code, key) => {
    const r = rows.get(code) ?? { code, confirmed: 0, changed: 0, overridden: 0, total: 0 };
    r[key]++; r.total++; rows.set(code, r);
  };
  for (const d of decisions ?? []) {
    if (d.type !== "decision") continue;
    if (idea && d.idea !== idea) continue;
    const confirmed = new Set(d.confirmed ?? []);
    const byFrom = new Map((d.overrides ?? []).filter((o) => o && o.from).map((o) => [o.from, o]));
    // One suggestion per code per paper, however many sources raised it.
    for (const code of new Set(d.proposed ?? [])) {
      const o = byFrom.get(code);
      if (o) bump(code, o.to === "OK" ? "overridden" : "changed");
      else if (confirmed.has(code)) bump(code, "confirmed");
    }
  }
  const list = [...rows.values()].sort((a, b) => b.total - a.total || a.code.localeCompare(b.code));
  const totals = list.reduce((a, r) => ({ confirmed: a.confirmed + r.confirmed, changed: a.changed + r.changed, overridden: a.overridden + r.overridden, total: a.total + r.total }), { confirmed: 0, changed: 0, overridden: 0, total: 0 });
  return { rows: list, totals };
}
