# Mistake kinds: every code rolls up into concept, calculation, reading, or writing

Status: design only, written Oct 31, 2026 ~02:30 ET by Partiban's session. Not built. Needs Kishore's yes because it changes the scheme format and `lib/engine.js`. Do not start before the TA pass and the recording.

## Why

Partiban's feedback after using the app: each question grows its own list of codes, and "remember this for next time" keeps adding more. The list never says *why* students lost marks. A TA or instructor thinks in kinds of mistake: the student misunderstood the idea, slipped in the arithmetic, misread the question, or stated a right answer badly. The kind decides what to do next: reteach a concept, ignore a one-off slip, or rewrite an unclear question.

The model's job does not change. It still proposes one allowlisted code, an exact quote, and a confidence. It never picks a kind or a point value. The kind comes from the instructor's scheme, looked up by code, so a person still owns every rule and every mark.

## The kinds (proposal; plain words, so `tests/copy.test.js` stays happy)

| id | Grader sees | Meaning | What the instructor does about it |
|---|---|---|---|
| `concept` | Misunderstood the idea | Wrong method, wrong formula, wrong parameter, wrong tail | Reteach |
| `calc` | Calculation slip | Right method, wrong number | Usually nothing; flag if frequent |
| `reading` | Misread the question | Answered a different question, wrong direction or level from the prompt | Check the question wording |
| `writing` | Answer stated badly | Missing context, backwards wording, unevaluated expression | Model the write-up |

`OK`, `UNSURE`, and `M-UNLISTED` have no kind: they are not mistakes.

## Scheme format (backward compatible)

- The table gains `kinds: [{ id, label, defaultDeduction }]` and each code gains `kind: "<id>"`.
- `validateStandards`: only when `kinds` is present, every code except `OK`, `UNSURE`, `M-UNLISTED` must name a known kind, kind ids are unique, `defaultDeduction` is a number `<= 0`. Tables without `kinds` validate exactly as today, so nothing already recorded breaks.
- Deductions stay **per code**. The kind does not replace the instructor's points; it groups them. `defaultDeduction` is only the starting value when a new code is proposed through "remember this", and the head TA still approves it.
- Proposed mapping for the two sample schemes, for the instructor to confirm, not decided here:
  - Quiz 5: E-VAR-SD concept, E-N-DENOM concept, E-MEAN calc, E-ARITH calc.
  - DEMO-STATS 201 Q5: H-PARAM concept, H-DIRECTION reading, V-MISSING writing, V-SLIP calc, V-RULED-OUT concept, S-ARITH calc, S-UNFINISHED writing, S-MISSING writing, D-TWO-SIDED-FTR concept, D-WRONG-TAIL concept, C-WRONG-TAIL writing, C-NO-CONTEXT writing, C-BACKWARDS writing, C-PARTIAL writing, C-MISSING writing, G-ATTEMPT-ONLY writing.
  - The 201 scheme already has `columns` (which part of the answer). Kinds are a second, independent axis (what sort of mistake). Keep both.

## Where it shows

- Suggestion card: one small chip with the kind label next to the points off. Read from the scheme, never from the model.
- Finish, "What the class got wrong": group the confirmed mistakes by kind first ("Misunderstood the idea: 13 papers"), then the codes inside. Counted from confirmed decisions only, like today.
- Marking scheme drawer: a Kind column, editable by the head TA only.

## Would make Kishore wince

- The model choosing or seeing a kind or a point value.
- A kind computed from model text instead of a scheme lookup.
- Old decisions or old scheme versions failing validation after this lands.
- Insights counting proposed or overridden codes as mistakes.
- Engineering words on screen ("taxonomy", "category id").

## Plan, test-first, in order

1. `lib/engine.js` (Kishore's file): `validateStandards` kind checks; new pure `byKind(analytics, table)` returning `[{ kind, label, confirmed, codes: [...] }]` from confirmed counts only. Tests: table with kinds validates; unknown kind fails; table without kinds unchanged; `byKind` ignores proposed and overridden; mutation check by dropping the confirmed-only filter.
2. `data/grade-q5.v1.0.json` and `data/demo201-q3q5.v1.0.json`: add `kinds` and `kind` per code as a new scheme version, after the instructor confirms the mapping. Seeds tests still pass (Q5 values unchanged).
3. `components/grading/Finish.tsx`, `Grader.tsx`, `SchemeDrawer.tsx`, `copy.ts`: the three display points above.
4. Pack format from the assignment-codes work carries `kinds` with the scheme; joiners see them read-only.
5. Browser check on both sample sets; delete fixtures and logs.

Estimate: about 90 minutes including tests. Video line until then: "Next: every mistake rolls up into misunderstood, slip, misread, or badly stated, so the instructor sees why the class lost marks."
