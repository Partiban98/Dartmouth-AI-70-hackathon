# Request: four new record types in lib/logshape.js

Asked for by: Rineetha · Oct 31, 2026 · branches `rineetha/e1-test-cases`, `rineetha/s6-student-page`, `rineetha/t2-call-it-first`

## What I need

`ALLOWED_TYPES` in `lib/logshape.js` currently holds `gate`, `blocked`, `proposal`, `decision`. Three features need to append records that are none of those:

| Record | File in `local/` | Written by |
|---|---|---|
| `eval-case` | `eval-cases.jsonl` | a TA keeping an override as a test case (E1) |
| `eval-run` | `eval-runs.jsonl` | `npm run eval:overrides` (E1) |
| `regrade-request` | `regrade-requests.jsonl` | a student asking for a regrade (S6) |
| `precall` | `precalls.jsonl` | a TA's own call before the AI is revealed (T2) |

`lib/logshape.js` is on the never-change-without-you list, so I did not touch it.

## What I did instead

`server/sidelog.js` — a small helper that writes these files into `local/` (gitignored, so no uploaded paper is ever committed) and validates every record with the **existing frozen** `assertLogSafe`, by presenting the record under an allowed type purely for the value scan: pattern rules, roster-name check, forbidden keys. The stored line keeps its own `kind` field.

The safety property is therefore unchanged — no stripped value, no alias map, no roster name can reach these files, and the tests prove it (a case carrying a roster name is refused with 400).

## Why it still wants your decision

The type substitution is a workaround, not a design. It relies on `assertLogSafe` doing only a value scan for `type: "gate"`. If you later add type-specific checks, `server/sidelog.js` starts validating these records against the wrong rules and nobody will notice.

**The one-line fix I'd like, when you have a moment:** add the four names to `ALLOWED_TYPES`, and I'll delete the substitution and call `log.append` directly. Happy to do it in a PR you review.
