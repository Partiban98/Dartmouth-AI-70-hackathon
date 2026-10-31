# Bug: uploaded papers get no AI suggestions ("unknown idea")

Found by: Rineetha · Oct 31, 2026 · on `main` at 8b3c5df, **not introduced by my branches**
**Status (05:55): already fixed by PR #11** *("Audit repairs 3: uploaded sets get
suggestions again")*, which landed `uploadedSets(localDir, standards)` in
`server/context.js` from Codex's audit. This report was written independently,
from the other direction — the prompt-injection probe tried to upload a paper
and hit the same 400 — so treat it as a second reproduction confirming #11
rather than a new request. Nothing further is needed once #11 merges.

Severity: breaks a headline feature in the demo path. A TA who uploads their own
PDFs sees *"Suggestions did not arrive. You can still mark the paper yourself."*
on every paper.

## What happens

1. Start screen → *Your papers* → Choose files → Read these papers.
2. Grade the first paper → **Check this paper**.
3. `POST /propose` returns **400 `{"error":"unknown idea"}`**; the grading screen
   falls back to its no-answer state.

Reproduced from the terminal:

```
$ curl -X POST localhost:3000/propose -d '{"idea":"injection-probe", ...}'
{"error":"unknown idea"}

$ curl -X POST localhost:3000/propose -d '{"idea":"grade", ...}'
200
```

## Cause

The browser and the server build different idea lists.

- `components/grading/useGrading.ts` builds ideas with a `gradingSets` entry for
  every **imported** set (`for (const m of imported) gradingSets[m.id] = ...`),
  so the client happily sends `idea: "<uploaded-set-id>"`.
- `server/context.js` builds ideas from `assignmentSets(LOCAL_DIR)` plus
  `grade93` only. Imported sets are never added, so `ideas()[body.idea]` is
  undefined and `app/api/propose/route.ts` returns 400 at its first check.

On this machine the server knows: `MCH-SPT, grade93, grade, companion, upskill`
— no uploaded set among them.

## Why it matters now

`SETUP.md` and the Start screen both advertise grading your own papers, and
`scripts/ingest.js` is in the README. If anyone uploads a stack during the
rehearsal or the recording, every paper comes back with no suggestions.

Assignment-code sets (`MCH-SPT`) are **not** affected: those do reach the server
through `assignmentSets`.

## Suggested fix (yours to make, it is in your area)

In `server/context.js`, fold the imported sets into the same `gradingSets` the
client builds — roughly:

```js
import { listImported, loadImported } from "./ingest.js";
// ...
for (const m of listImported(LOCAL_DIR)) {
  gradingSets[m.id] = loadStandards(m.rubric === "demo201-q3q5" ? "demo201-q3q5.v1.0.json" : "grade-q5.v1.0.json");
}
```

That is the one place the two lists diverge. No frozen file is involved, which
is why I have written it down rather than done it: `server/context.js` wires
the whole app and is not mine to change mid-rehearsal.
