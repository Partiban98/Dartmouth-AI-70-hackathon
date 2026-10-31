// The grading screen's fetch for the shared pipeline. A failed /log write throws, so the pipeline stops before
// asking for suggestions (privacy-check log) or before showing a receipt (decision log). Nothing is "Saved" unless it was written.
export function strictLogFetch(fetchImpl) {
  return async (path, init) => {
    const res = await fetchImpl(path, init);
    if (path === "/log" && !res.ok) {
      let reason = "";
      try { reason = (await res.json())?.error ?? ""; } catch {}
      throw Object.assign(new Error(reason || `could not save (${res.status})`), { notSaved: true, status: res.status });
    }
    return res;
  };
}
