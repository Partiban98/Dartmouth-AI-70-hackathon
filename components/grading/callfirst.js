// The rule that keeps the AI out of the page before the TA has called it, in
// plain JS so node --test can check it. The panel renders nothing from the card
// until this returns it, so "not in the DOM" is a property of the data, not of
// a CSS class.
export const visibleCard = (card, { enabled, locked }) => (!enabled || locked ? card ?? null : null);

/** "Your call: E-VAR-SD · AI: E-VAR-SD · match" */
export const callChip = (myCode, aiCode) => `Your call: ${myCode} · AI: ${aiCode} · ${myCode === aiCode ? "match" : "differs"}`;

/** Under call-it-first the mark box starts empty: the TA's own number, typed
 *  after their own call, never seeded from the rubric computation. Outside the
 *  toggle the existing behaviour is untouched. */
export const markStartValue = (computedScore, { enabled }) => (enabled ? "" : String(computedScore));
