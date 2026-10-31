// The fetch both grading pages give the shared pipeline. A failed /log write (HTTP error or no connection) throws,
// so the pipeline stops before asking for suggestions (privacy-check log) or before a receipt (decision log). Nothing is "Saved" unless it was written.
export function strictLogFetch(fetchImpl) {
  return async (path, init) => {
    let res;
    try { res = await fetchImpl(path, init); }
    catch (e) { if (path === "/log") throw Object.assign(new Error("no connection to this laptop's server"), { notSaved: true, status: 0 }); throw e; }
    if (path === "/log" && !res.ok) {
      let reason = "";
      try { reason = (await res.json())?.error ?? ""; } catch {}
      throw Object.assign(new Error(reason || `could not save (${res.status})`), { notSaved: true, status: res.status });
    }
    return res;
  };
}
