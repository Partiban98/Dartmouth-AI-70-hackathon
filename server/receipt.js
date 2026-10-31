// The Privacy Gate receipt for one paper: what was removed, when, what was
// sent (as a hash) and which model answered. Built from the gate and proposal
// log records only. No raw text, no removed value, no alias map -- none of
// those are in the logs to begin with, which is the point.
export function receiptFor({ gate, proposals }, idea, itemId) {
  const last = (rows) => rows.filter((r) => r.idea === idea && r.itemId === itemId).at(-1) ?? null;
  const g = last(gate ?? []);
  const p = last(proposals ?? []);
  if (!g && !p) return null;
  const counts = Object.entries(g?.counts ?? {}).filter(([, n]) => Number(n) > 0).map(([type, n]) => ({ type, n: Number(n) }));
  return {
    itemId, idea,
    checkedAt: g?.ts ?? null,
    removed: counts.sort((a, b) => b.n - a.n || a.type.localeCompare(b.type)),
    droppedFields: g?.droppedFields ?? 0,
    blockedRules: g?.blockedRules ?? [],
    sentAt: p?.ts ?? null,
    // The model id the API returned, never the one we asked for.
    modelId: p?.modelId ?? null,
    label: p?.label ?? null,
    cacheHit: p?.cacheHit ?? null,
    payloadHash: p?.payloadHash ?? null,
  };
}
