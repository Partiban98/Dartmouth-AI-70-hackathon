# Request: a hook so the TA's call can happen before the model is asked

Asked for by: Rineetha · Oct 31, 2026 · branch `rineetha/t2-call-it-first`

## What works now, and what does not

"Call it first" (off by default, toggled on the setup screen) keeps the AI's
code, quote and confidence **out of the DOM** until the TA has locked their own
call: the panel is handed no card at all until then, which a test proves.

What it cannot do is stop the model being *asked* first. `lib/pipeline.js` runs
`POST /propose` (which logs a `proposal` record) and only then calls
`ui.review(card)`. So in the log, the proposal line for a paper is timestamped
**earlier** than the TA's precall, even though the TA saw nothing until after
they called it.

For a feature whose whole purpose is showing a judge that human judgment came
first, "trust us, it was not rendered" is weaker than it should be.

## What I did instead

The reveal is now its own logged event (`kind: "reveal"` in
`local/precalls.jsonl`), written only after the precall is stored. So the claim
is checkable from the log: for any paper, the precall timestamp is earlier than
its reveal. The proposal line is not the reveal and is not treated as one.

## The change I would like

One more `ui` hook in `runPipeline`, awaited between the gate and the propose
call — something like:

```js
if (ui.precall) await ui.precall({ itemId, codes: ideaConfig.standards.codes });
```

With that, the TA's call is logged before the model is ever asked, and the log
order matches the claim with nothing to explain. It is three lines in a frozen
file, so it is your call, not mine. Happy to write it in a PR you review.

Also needed either way: the four record types in
`docs/REQUEST-KISHORE-logshape-types.md`.
