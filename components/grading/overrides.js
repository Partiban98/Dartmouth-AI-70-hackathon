// Which saved decisions count as an override, in plain JS so node --test can
// check the rule the Saved panel uses to decide whether to offer a test case.
//
// The review step pushes to overrides for both "change" and "no mistake here":
// a change carries the code it was changed to, an override carries "OK". A
// confirm never reaches overrides at all. Only "OK" is the TA ruling out the
// suggestion, which is the only case worth testing the AI against.
export const firstTrueOverride = (overrides) => (overrides ?? []).find((o) => o && o.to === "OK") ?? null;

/** A rejected save stays a rejected save; the form owns retry state and the typed reason. */
export async function submitCase(input, fetchImpl = fetch) {
  const res = await fetchImpl("/api/eval-cases", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? "Could not save that case.");
  return json;
}
