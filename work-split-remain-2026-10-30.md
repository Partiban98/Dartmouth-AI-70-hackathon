# Work Split: Remain (working title, final name to be decided later)
## Based on the final agreed spec in the Spec tab. Core is preserved. No scope creep, no mega project.

Working title: Remain. Final product name is to be decided later by the team. Do not rename code, files, or doc titles until the team decides.

## How the work runs, in order

1. Kishore builds the base and core first, using Claude Code, and pushes it to GitHub.
2. Rineetha, Partiban, and Xinyan pull from GitHub and work on their items.
3. No one builds in a silo that bypasses the shared pipeline, gate, engine, or components. If a journey needs a core change, raise it, Kishore decides, and the change goes to all journeys.
4. Kishore reviews and merges. No direct core changes without Kishore.
5. Each owner records their own demo beat. Xinyan assembles, captions, and submits, after the beats are recorded.
6. Hard deadline: submissions due Sat Oct 31, 2026, 10:00 AM ET. Demo video target 2:27, hard max 2:29, public link, opens with the team's finished sentence (team fill-in, not invented).

GitHub workflow: Kishore creates the repo, pushes base and core, and shares the link with the team. Teammates pull main, work on their own branch for their journey, and merge through Kishore's review. Repo name and link are for Kishore to share, they are not invented here.

## Kishore Theeraj Vasudevan Jaya: Base, core, and integration lead (FIRST)

Build first, before the other journeys start:
- Repo setup, base app, and GitHub push, using Claude Code.
- Shared pipeline: runPipeline(ideaConfig, input), with the four stages in order: Privacy Gate, model proposes, Deterministic Rules Engine, human decision.
- Shared components: GatePanel (PG-01), ReviewCard (C-01), Queue list (C-03), DecisionBar, ReceiptPanel, Decision log (C-02).
- Local Privacy Gate: A-01 field allowlist, R-01 to R-13, assertClean with 422 BLOCKED, alias map in browser memory only, before and after view with types and counts only, R-11 flagged-token exception shown locally only.
- Deterministic Rules Engine: validateCodes, verifyQuote with exact substring match, score from human-confirmed codes only clamped 0 to max, methodSignatures R-M1, answerCheck, factsCheck, retest, validateStandards, analytics from confirmed counts only, counters from logs only.
- Seeds: DEMO-STATS 101, with corrected Q5 values 320 / 10 / sqrt(10) about 3.162, S-07 valid M2, S-12 gate probe, Companion Ch. 3 source, Upskill Dana task.
- Provider adapter: Claude API, Sonnet 5.5 for demo and rehearsals, Haiku 5.5 for dev loops, fallback ladder, smoke gate G0, retry once per rung, call cap 150, SHA-256 payload cache, billing check, honest labels from the API-returned ID.
- Test harness and integration: gate probes including T11 name-injection probe, engine tests, Q5 seed sanity, no auto-submit path check, keyboard and grayscale checks, human TA review pass support.
- Integration and merges: review all journey branches, resolve conflicts, run the full test pass, confirm rehearsals run on the same model as the recording.

Acceptance for Kishore's base: one full propose, validate, review, decide loop works on seeded data; gate blocks unclean payloads; engine rejects a fake source line; score uses confirmed codes only; no code path auto-submits.
Do not build the full persona journeys here. Those are the other owners' items, built on this core.

## Rineetha Gunasekaran: Student journey (Course Companion)

Build after pulling Kishore's base:
- Student tab, flows ST-01 to ST-04.
- Answer-first gate: check stays disabled until the answer is at least 20 characters.
- Gap check UI: show only the missing point, with a code-verified source line, or "Not found in source: I will not guess" when verification fails.
- Fix and retest: student fixes the answer, passes retest Q3 (variance 16 cm squared, correct 4 cm; "cm squared" and "16" fail by code).
- Export draft as text only. Student submits herself. No auto-submit.
- Course AI rules lock UI: Practice Q2 "Check my answer allowed" can be checked; Problem Set 3 "Locked by course AI rule" cannot.
- Companion seeds: Ch. 3 Notes Spread, Q2 key points KP-1 square root, KP-2 squared vs original units, KP-3 easier to interpret, demo wrong answer missing square-root and units points.

Acceptance: a student who answers wrong sees only the gap plus a verified source line, fixes it, passes the retest, and stops before submitting. No final answer is shown before an attempt.
Demo beat: Beat 1, Student, receipt "Fixed by you". Rineetha records this beat.
Depends on: Kishore's core, gate, engine, and seeds. Do not change gate or engine rules, do not show a final answer before an attempt, do not add auto-submit.

## Partiban Anathurai: Teacher and TA journey (Grading)

Build after pulling Kishore's base:
- Teacher and TA tab, flows GR-01 to GR-04.
- Rubric: instructor-owned, versioned, visible standards table, validated by code before use. Grade Q5 standards: E-VAR-SD -3, E-N-DENOM -2, E-MEAN -2, E-ARITH -1, M-UNLISTED -2, OK 0, UNSURE 0.
- Queue: S-01 to S-25, one by one, no bulk approval.
- Review card: AI proposes code, quotes step, gives confidence. TA confirms, changes type, or overrides to no error. TA enters the grade. Score uses human-confirmed codes only.
- Class insights: recurring mistakes from TA-confirmed decisions only.
- Correction moment: S-07 valid M2, deliberately unlisted in v1.0, misflagged in the proposal, TA overrides it, records the reason, assigns the grade from confirmed codes only.

Acceptance: every call is confirmed or overridden by the TA, the TA assigns the grade, the S-07 override is visible and reproducible, insights counts match confirmed decisions.
Demo beat: Beat 3, TA, receipt "Assigned by you (TA)". Partiban records this beat.
Depends on: Kishore's core, gate, engine, and seeds. Do not change rubric deductions without the instructor owner, do not let the model assign a grade, do not add gradebook write-back.

## Xinyan Huang: Academic Staff journey (Upskilling) plus demo and submission

Build the staff journey after pulling Kishore's base. Demo and submission work starts after the beats are recorded, not before.
- Staff tab, flows PR-00 to PR-04.
- PR-00 module: "What never goes into AI", shown before any task.
- PR-01: load the seeded staff task.
- PR-02: Privacy Gate view, live, before and after types and counts, staff approves the redacted payload.
- PR-03: AI coach suggests prompts, checks, and edits, per edit, not as a finished draft to copy blindly.
- PR-04: staff accepts each edit or keeps their own wording, checks "I reviewed every change", and approves. Nothing auto-submits. Team progress shown to an employer is team level only, anonymized at individual level.
- Upskill seeds: Dana Whitcombe task, facts fields Wed Nov 4, 6:00 to 7:00 PM, B-101, Variance vs standard deviation; standards upskill-email.v1.0.json; tips and checks as in the spec.
- Demo and submission, led by Xinyan: assemble beats in order Student, Staff, TA; opening sentence slot first, team fill-in only; captions throughout; muted legibility check; 5-second comprehension check; target 2:27, hard max 2:29; public link; logged-out playback, captions, and model disclosure check; submit by Sat Oct 31, 2026, 10:00 AM ET, with buffer.

Acceptance for staff: staff edits, reviews, and approves every change, and the gate view is visible with types and counts stripped. Acceptance for demo: video opens with the team's finished sentence, each beat ends in a visible human decision with its receipt, closing metrics are real counts from logs only, and the model named is the model that actually ran.
Demo beat: Beat 2, Staff, receipt "Approved by you". Xinyan records this beat, then assembles all three beats.
Depends on: Kishore's core, gate, engine, and seeds; all three beats recorded. Do not add analytics exports, notifications, or any scope-out item.

## Shared rules for all four teammates

- Reuse the core. Do not rebuild a gate, engine, pipeline, or review card per persona.
- Do not build scope-out items: multi-course, analytics exports, notifications, gradebook write-back, Canvas auto-ingest, Canvas auto-submit, photo or OCR, local LLM claims, Aid, Hearing Ledger, advanced RAG, background observation, any feature without an on-screen number or decision, any feature that needs real student or company data.
- Demo data is synthetic and public sample only. No real personal data.
- Metrics in the video are real counts from logs only, never illustrative.
- If a build slips, cut depth within beats, never a whole beat. Never cut the three decision beats, the Privacy Gate, or the review queue.
- Final name is to be decided later by the team. Working title Remain is used until then. Do not rename code or doc titles until the team decides.
