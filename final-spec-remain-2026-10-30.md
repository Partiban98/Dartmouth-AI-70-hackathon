# Remain: Final Agreed Product Spec
## Super app for the Dartmouth AI at 70 Student Hackathon

Status: AGREED PRODUCT SPEC, Oct 30, 2026, 22:25 ET.
Agreed by: Designer (Gemini), Product Manager (ChatGPT), Engineer (Claude), in verbatim and closing rounds, with core preserved per Kishore's Oct 30, 2026, 22:24 ET clarification.
Settled by: Muse and Claude, per Kishore's Oct 30, 2026, 22:21 ET instruction, using the three AI agreements as input.
Model provider: USER-DECIDED by Kishore, Oct 30, 2026, 22:17 ET. Claude API, not Gemini Argon. Argon agreement is superseded, not relitigated.
This spec is the handoff file for Claude Code. Muse does not write code. Claude Code builds from this file only, and must not change the core or remove big things without team approval.

## 1. Name, thesis, and one line

Product name: Remain.
Tagline: Show your work: AI proposes with evidence, a person decides.
Thesis, the spine of the whole app: AI proposes with evidence, a person decides.
One line: One web app where a student, an academic staff member, and a teacher or TA each get AI help on a real task, with the same privacy gate, the same deterministic checks, and a visible human decision at the end of every flow.

## 2. Who it serves, and why it matters

Three primary personas, all primary, none a side card inside another flow:
- Student, from Doc Idea 3, Course Companion. A student in a case-based course has notes, slides, cases, and rubrics in many files. AI summaries feel like learning, but the student often cannot explain the work in class.
- Academic Coordinator / Staff, from Doc Idea 1, Upskilling. Coordinators and admin staff get AI tools faster than they learn to use them well. They either avoid the tools or trust output blindly. Generic courses do not match their real tasks.
- Teacher / TA, from Doc Idea 2, Grading. Instructors and TAs grading free-response stats and math work make inconsistent calls on the same mistakes, and students get different marks for the same error.

If nothing changes, students submit work they cannot defend, staff waste or misuse AI on real work, and grading stays inconsistent. The shared problem is assistance without abdication: help that never takes the decision away.

## 3. What it is, and what it is not

It is:
- One web app with three tabs: Student, Academic Staff, Teacher and TA.
- One pipeline, one Privacy Gate, one Deterministic Rules Engine, one review pattern, reused across all three personas. That reuse is the point. It is not three apps.
- A demo with synthetic and public sample data only. No real student or company personal data in the demo.

It is not:
- An auto-grader, an answer writer, an auto-submitter, an identifier sender, or a loan ranker.
- A gradebook write-back, a Canvas auto-ingest or auto-submit, a multi-course system, a notification system, an analytics export, a photo or OCR tool, or a local LLM claim. All of those are cut for tonight.
- A claim that deterministic rules remove 100 percent of unknown names from arbitrary free text. See the honest limit in section 5.

## 4. Spine and pipeline

Every flow follows the same four stages, in order, on screen:
1. Privacy Gate, local, before any cloud call.
2. Model proposes, limited to allowlisted codes, quoted steps, and confidence.
3. Deterministic Rules Engine validates and computes.
4. Human confirms, edits, or overrides, and the decision is logged to a named person, with counts shown.

Pipeline function, shared: runPipeline(ideaConfig, input).
Stages: input, Privacy Gate on the demo machine, AI proposes codes plus exact quotes plus confidence, rules verify and compute, human reviews and confirms or overrides, decision plus receipt logged.
Shared components, frozen first: GatePanel (PG-01), ReviewCard (C-01), Queue list (C-03), DecisionBar, ReceiptPanel, Decision log (C-02).
JSON seeds. Append-only JSONL logs in a gitignored local folder. Eval labels, if any, are never loaded by the UI.

## 5. Local Privacy Gate (deterministic, away from the model)

The model never redacts. A deterministic local script, on the user's or campus or company-controlled machine, runs before ANY cloud API call.

Rules, in order:
- A-01, field allowlist: only config-listed fields are copied. Headers, filenames, timestamps, and profile fields are dropped and counted.
- R-01 EMAIL, R-02 PHONE, R-03 STUDENT_ID, R-04 NETID, R-05 EMPLOYEE_ID, R-06 INTERNAL_ID, R-07 ADDRESS, R-08 URL: replaced with alias tokens.
- R-09 NAME, roster dictionary: replaced with S-nn style aliases.
- R-10 NAME, honorific plus capitalized name: replaced with PERSON-n style aliases.
- R-11 possible NAME, two or more consecutive capitalized tokens not in the glossary: BLOCK until a human picks "Mark as name" or "Not a name". Exception, agreed in closing: a flagged R-11 token may be shown locally only, never logged or sent, while it waits for that human pick. The redaction log keeps types and counts only, never values.
- R-12 DOB: BLOCK.
- R-13 HEADER_LINE, From, To, Cc, Sent, Subject lines: drop the line.
- assertClean: the API route on the same machine re-runs R-01 to R-12 on the final payload. Any hit returns 422 BLOCKED, nothing is sent, and the blocked event is logged.
- Alias map: stays in browser memory only, never persisted, never in cloud payloads or logs. Responses are re-mapped locally before display.
- Before and after view: the user sees types and counts stripped, never the stripped values in any cloud log, and approves before any send. On any uncertainty, the send is BLOCKED and flagged for human review.
- Honest limit, stated on screen and in the repo: deterministic rules cannot guarantee 100 percent removal of an unknown name hidden in arbitrary free text. The design is fail-closed and structured: demo inputs are structured forms and seeded text, not arbitrary free paste, with a field allowlist, known pattern rules, and human review of the before and after payload before any send.
- Applies to all three personas, including company confidential tasks in upskilling. Only approved, redacted task text leaves the company-controlled environment. The upskilling flow includes the PR-00 module, "What never goes into AI", as a named module.

## 6. Deterministic Rules Engine (deterministic, away from the model)

The model proposes. Deterministic code decides what counts. The model never does arithmetic, never assigns a grade, never writes a final answer, never decides a method is valid, and never redacts.

Named functions, all code, all tested:
- validateCodes: rejects any code not in the allowlist.
- verifyQuote: normalizes whitespace and curly quotes, then requires an exact substring match against the uploaded source text. Anything not found is marked "not found in source" or unverified, never trusted from the model citation.
- score: computed from the standards table, from human-confirmed codes only, clamped 0 to max.
- methodSignatures: R-M1, a correct answer matching no listed method signature, becomes M-UNLISTED, labelled "Rule".
- answerCheck: rule-based candidate detection, for example a value near 10 points to E-VAR-SD, a value near 2.83 points to E-N-DENOM, both labelled "Rule".
- factsCheck, for upskilling: any date, time, number, or room in a draft that is not in the facts fields becomes "Detail not in your facts".
- retest, for the companion: numeric tolerance plus required and forbidden units, checked by code.
- validateStandards: validates the standards table itself before use.
- analytics: TA-confirmed counts beside AI-proposed counts, computed from logs, never from model text.
- counters: every on-screen number comes from decisions and proposals logs, never from a typed-in or illustrative number.

Model output is limited to: allowlist code, quoted step, confidence. Nothing else from the model counts.

## 7. Three persona flows, with acceptance criteria

### 7.1 Student: Course Companion (Doc Idea 3)

Flow:
- ST-01: Student answers first. The check button stays disabled until the answer is at least 20 characters.
- ST-02: Gap check. The tool shows only the missing point, with a code-verified source line, or says "Not found in source: I will not guess" when verification fails.
- ST-03: Student fixes the answer herself, then passes a retest.
- ST-04: Export a draft as text. The student submits it herself. The tool never auto-submits, never writes the final answer, never assigns a grade.
- Course AI rules lock: practice questions marked "Check my answer allowed" can be checked. Work marked "Locked by course AI rule" cannot. The lock is enforced by code, not by a model promise.

Acceptance: a student who answers wrong sees only the gap plus a verified source line, fixes it, passes the retest, and stops before submitting. No final answer is ever shown before an attempt.

### 7.2 Academic Staff: Upskilling (Doc Idea 1)

Flow:
- PR-00: "What never goes into AI" module, shown before any task.
- PR-01: Staff pastes or loads a real task, in the demo a seeded task.
- PR-02: Privacy Gate runs live, with the before and after view, and staff approves the redacted payload.
- PR-03: AI coach suggests prompts, checks, and edits, per edit, not as a finished draft to copy blindly.
- PR-04: Staff accepts each edit or keeps their own wording, checks the "I reviewed every change" box, and approves. Nothing auto-submits. Team progress shown to an employer is anonymized at individual level, team level only.

Acceptance: staff edits, reviews, and approves every change, and the gate view is visible on screen with types and counts stripped.

### 7.3 Teacher / TA: Grading (Doc Idea 2)

Flow:
- GR-01: Rubric. Instructor defines error types and deductions once, in a versioned, visible standards table, owned by the instructor. The table is validated by code before use.
- GR-02: Queue. A list of submissions to review, one by one. No bulk approval.
- GR-03: Review card. AI proposes a code, quotes the step, and gives confidence. TA confirms, changes the type, or overrides to no error. The TA enters the grade. Only human-confirmed codes count toward the score.
- GR-04: Class insights. Recurring mistakes from TA-confirmed decisions only, so the instructor knows what to reteach.

Acceptance: every call is confirmed or overridden by the TA, the TA assigns the grade, and a valid alternative method misflagged by the proposal is overridden on camera, with the reason recorded.

## 8. Seed data: DEMO-STATS 101 (one synthetic course, reused everywhere)

Course: DEMO-STATS 101, Intro Statistics, Fall 2026. Synthetic only. Conventions: emails at example.org, phones 555-01xx, student IDs synthetic 9-digit starting 9001, NetIDs demo-xxxxxx. QA check: no roster name matches a teammate or classmate.

### Grade, Q5
Question: "Quiz scores: 4, 6, 8, 10, 12. Find the sample standard deviation. Show your work." Max 10.
Standards, grade-q5.v1.0.json, owner instructor, approved: E-VAR-SD -3, E-N-DENOM -2, E-MEAN -2, E-ARITH -1, M-UNLISTED -2, OK 0, UNSURE 0.
Methods: M1 definitional formula, listed, with regex signature. M2 computational formula, sum of x squared minus (sum of x) squared over n, deliberately NOT listed in v1.0. That gap is planted on purpose.
Corrected worked values, verified by hand by Muse, Designer, and PM: sum = 40, sum of squares = 360, (sum squared)/n = 320, sample variance = (360-320)/(5-1) = 10, sample SD = sqrt(10), about 3.162. The old 288/9/3 values are wrong and must not appear in any shared copy.
Submissions S-01 to S-25, planted distribution: E-VAR-SD (final answer 10) x10, E-N-DENOM (about 2.83) x4, E-ARITH x2, valid M2 correct (including S-07) x3, correct M1 x6. Planted answers live only in submissions.eval.json, for tests only, never loaded by the UI.
Gate probe: one step in S-12 contains a roster name, to test the gate. Each paper header holds a synthetic name, NetID, email, timestamp, and filename, so the gate has something real to strip in the demo.

### Companion, Ch. 3 Notes: Spread
Source paragraphs: variance is average squared distance from the mean, units squared; SD is the square root of variance; SD is easier to interpret because it is in original units; plus filler on range and IQR.
Q2: explain variance vs SD and why we usually report one. Key points: KP-1 square root relation, KP-2 squared vs original units, KP-3 easier to interpret.
Demo wrong answer, typed by the student: a spread and easier-to-use answer missing the square-root relation and the units point.
Retest Q3: variance 16 cm squared, correct answer 4 cm. "cm squared" and "16" fail deterministically, by code.

### Upskill, seeded staff task
Email-from-colleague task, from "Dana Whitcombe", sent Thu Oct 29, with facts fields: Wed, Nov 4, 6:00 to 7:00 PM, B-101, Variance vs standard deviation.
Expected gate result, confirmed by gate test, narrated in the video as whatever the code shows: 2 header lines dropped; 3 names, 1 email, 1 student ID, 1 phone, 1 internal ID stripped or aliased.
Upskill standards, upskill-email.v1.0.json, owner staff lead: tips P-GOAL, P-AUDIENCE, P-FACTS, P-FORMAT, P-SENSITIVE, P-CHECK; checks C-DATE-TIME, C-ROOM, C-NO-PRIVATE-INFO, C-TONE, C-NO-NEW-CLAIMS.
Course AI rules in the demo: Practice Q2 "Check my answer allowed"; Problem Set 3 "Locked by course AI rule".

## 9. Model: Claude API (user-decided)

Provider: Claude API. This replaces Gemini Argon. Argon is not a fallback requirement.
Tier: Sonnet 5.5 for the recorded demo and final rehearsals. Recording must match what was rehearsed. Haiku 5.5 for dev loops.
Sourced prices, as reported by the Engineer and matched by the PM's own check: Sonnet 5.5 $2 in / $10 out per million tokens; Haiku 5.5 $0.10 / $0.50 per million tokens for prompts up to 100K tokens. Token counts and full rehearsal costs are unsourced estimates, labelled as such: about 2,000/400 per TA paper, 2,500/500 per student check, 1,800/900 per staff task; full rehearsal about $0.23 Sonnet / $0.012 Haiku. "Fits the ~$10 budget" is estimate-dependent, not a measured spend.

Fallback ladder, in order, never silently substituted:
1. Claude Sonnet 5.5, if the smoke gate passes.
2. Claude Haiku 5.5, same adapter. Honest caveat: rungs 1 and 2 share one key, account, and billing, so rung 2 covers only model-specific failure, not an account failure.
3. Gemini 2.5 Flash paid tier, sourced $0.50 / $2.00 per million tokens, GEMINI_TIER=paid enforced, free tier never, only if a separate Gemini key is confirmed. This is the first real backup.
4. Labelled cached rehearsal under a REPLAY_MODE banner, with gate, engine, and human decisions still live.

Guards: retry once per rung; call cap 150 until spend is verified; SHA-256 payload cache; billing check after the smoke test.
Smoke gate G0: one schema-valid call through /propose on the exact model, before building on it. Structured output must be proven on 5.5 at the smoke gate, else fall back to tool use, with Zod validation either way.
Exact model ID: expected claude-sonnet-5-5 / claude-haiku-5-5, but verified against official Anthropic docs AND a live call, never a web picker, never a typed-in string. The on-screen label always reads the ID returned by the API.
Honest labels: "LIVE API: <model ID returned by the call>" or "CACHED REHEARSAL: NOT LIVE MODEL OUTPUT". Narration names only the model that actually ran, never "local".
Honesty limits: Anthropic API data-use terms were NOT checked tonight, so the video must not claim "no training on your data". The Privacy Gate stays the primary protection. Sponsorship must not be given in the video as the reason for choosing Claude.
Build-time confirmations, all UNCONFIRMED at spec time, stated plainly: working Claude API key, holder named, tested at G0; exact model ID; price check vs ~$10 after smoke test; optional Gemini key for rung 3.

## 10. Platform and architecture (conditional, by zero-setup rule)

Rule, agreed by all three AIs: use whatever the team already has running tonight, introduce no new framework tonight. Decider is zero setup at lock.
- If Next.js (App Router) plus TypeScript plus Tailwind already runs: use it, with Zod validation, Vitest tests, JSON seeds in data, append-only JSONL logs in a gitignored local folder. Playwright only if ahead of schedule.
- If nothing runs: use the Designer's no-build single page, one HTML plus JS plus CSS, no build step, plus a tiny API server and local scripts.
- Typed and tested core, resolved middle path for the one open implementation point: the requirement stands in both branches. Full toolchain where Next.js runs. In the no-build branch, JSDoc-typed plain JS plus node --test, zero dependencies, for local scripts, with the same test cases. Node is already required for the key helper. No new toolchain is introduced tonight.
- Repo layout for the Next.js branch, as a guide, not a mandate for the no-build branch: app and components for shell, gate, queue, review, receipts; lib for gate rules, engine, provider adapter, seeds; data for seeds; local for logs, gitignored.
- Prompts, model output limits enforced in code: shared system prompt, plus upskill-coach, companion-gap, and grade-propose prompts. Model output never includes points, totals, grades, or final answers.
- Key handling: provider key lives outside the browser bundle, in a small local helper on the controlled machine, never in client code, never in the repo.

## 11. Scope in, scope out, cut order, and minimum version

Scope in, the reusable core only:
- One pipeline, one gate, one engine, one review pattern, three thin persona journeys, one seeded course, one demo script, one test pass, one submission.

Scope out, cut for tonight, do not re-add without team approval:
- Multi-course, analytics exports, notifications, gradebook write-back, Canvas auto-ingest, Canvas auto-submit, photo and OCR, local LLM claims, Aid, Hearing Ledger, advanced RAG, background observation, any feature without an on-screen number or decision, any feature that needs real student or company data.

Cut order, pre-committed, in order:
1. Study interactive extras.
2. Learn interactive extras.
3. Extra Assist features.
4. Analytics full page.
5. Rubric-validate button.
Never cut, in any order: the three decision beats, the Privacy Gate, the review queue, human assign and approve and submit, and the correction moments.
Minimum version that still counts, if behind at the G2 gate: all three ideas stay, one seeded item each. Grade: one live paper plus honestly counted earlier reviews. Companion: Check plus rule-checked retest only. Upskill: gate plus draft plus approve only. Cut depth within beats, never a whole beat. The Engineer's old Grade plus Upskill only fallback is withdrawn and must not be used. Any two-beat emergency choice, if the minimal three-beat build itself fails, is a team-lock decision, not a spec default.

## 12. Testing (must pass before recording)

Gate tests:
- T01 to T09, gate probes: each identifier pattern stripped or aliased, headers dropped, allowlist enforced, alias map never in payload or logs.
- T11, name-injection probe, the gate test: a planted synthetic name plus email must never appear in any cloud payload or log. Counts show stripped types only.
- T12, gate approve and block: approve sends redacted payload only; block sends nothing and flags for human review.
- T06, known limit documented: a lowercase non-roster name is not caught by the rules. This limit is stated, not hidden.

Engine tests:
- T10 to T21: validateCodes rejects unknown codes; verifyQuote rejects a fake source line and marks it not found; score uses human-confirmed codes only, clamped; method signature R-M1 and key points R-KP behave as specified; retest passes 4 cm and fails "cm squared" and "16"; factsCheck flags a detail not in facts; eval labels never load in the UI.
- T22, no-submission-path: no code path auto-submits to Canvas or anywhere else.
- T23, course lock: locked work cannot be checked.
- T28, model honesty: on-screen label matches the API-returned ID, or shows cached rehearsal.
- T29, spend guard: call cap 150, payload cache, billing check after smoke test.
- T30, seeds sanity: Q5 values 320 / 10 / 3.162, distribution counts, S-07 valid M2, S-12 gate probe, all present and consistent.

Demo and access tests:
- T24 to T26: keyboard-only path, grayscale legibility, read-aloud order, source lines not conveyed by colour alone, plain language, large readable text, captions throughout.
- 5-second comprehension test: a viewer with sound off understands the thesis and the human decision in each beat.
- Muted correction visibility: the S-07 override and the student fix and the staff approval are visible without sound.
- T27: captions, public link, logged-out playback check, model disclosure check.
- Human TA review pass: a human acting as TA genuinely reviews all 25 seeded papers plus rehearsals before recording, so counts in the video are real, not illustrative.

No test may depend on the model making a mistake. Correction moments are fixture-guaranteed: S-07 valid M2 unlisted, student gap, staff gate.

## 13. Demo script (target 2:27, hard max 2:29)

Video must OPEN with the team's finished sentence. Slot, team fill-in, never invented by an AI:
"In our project, a person always [TEAM FILL-IN]."
Candidate finishes, options only, team picks: makes the final decision; reviews the evidence before acting; stays in control while AI proposes.

Timing, target:
- 0:00 to 0:08: opening sentence, team spoken.
- 0:08 to 0:18: spine card, thesis, gate, engine, human decision, in plain words.
- 0:18 to 0:58: Beat 1, Student. Student answers wrong, sees only the missing point with a code-verified source line, fixes it herself, passes the retest, stops before submitting. Receipt on screen: "Fixed by you".
- 0:58 to 1:36: Beat 2, Staff. Privacy Gate runs live, before and after types and counts, staff approves redacted payload, edits each AI suggestion, approves. Receipt: "Approved by you".
- 1:36 to 2:12: Beat 3, TA. AI proposal misflags S-07 valid M2, TA overrides it, records the reason, assigns the grade from confirmed codes only. Receipt: "Assigned by you (TA)". This is the visible human correction.
- 2:12 to 2:27: close. Real metrics strip from logs only, plus model disclosure naming the model that actually ran, plus team end card.
- Hard max 2:29. If the recording runs long, cut depth within beats, never a beat, and never the opening sentence.

Closing metrics, real counts only, never illustrative:
- Proposed, confirmed, overridden counts.
- Source lines verified by code vs not found.
- PII items stripped, by type and count, never values.
- Alias-only payload shown.
- Final decisions attributed to a human, in receipt language.

## 14. Risks, safeguards, and judge questions

Judge questions, each with a VISIBLE safeguard in the demo, not just in this doc:
- Who is this for: three named personas, one seeded task each, on screen.
- What could go wrong: see below, each with a safeguard on screen.
- Does it help people, or decide for them: every beat ends with a human decision, in receipt language.

Risks and safeguards:
- Power concentration, who owns the rules: versioned, visible, instructor and staff-owned standards table, plus a validate step before use.
- Autonomy erosion, rubber-stamping: no bulk approval, override-everything design, override counts on screen.
- Trust, hallucinated sources or grades: deterministic source verification, allowlist codes, "not found in source" on camera, score from confirmed codes only.
- Privacy, identifiers leaking to the cloud: Privacy Gate before and after view, stripped counts on screen, alias map local only, assertClean plus 422 block, fail-closed on uncertainty, honest limit stated.
- Cheating and course policy: student answers first, course AI rules lock, never writes a final answer, never auto-submits.
- Accessibility: plain language, keyboard path, captions, source lines not by colour alone, 5-second and muted tests.
- Cost and reliability: smoke gate, fallback ladder, call cap, payload cache, billing check, honest labels, rehearsals on the same model as the recording.
- Data-use honesty: video must not claim "no training on your data", terms unchecked. Video must not give sponsorship as the reason for choosing Claude.

## 15. What remains human, per feature

- Student: reasons, writes, submits. Teacher judges understanding.
- Staff: reviews every change, edits, approves, makes the final call. AI teaches and suggests, does not submit or decide.
- TA and instructor: instructor defines error types and deductions, TA confirms or overrides every call and assigns the grade, instructor decides valid alternative methods and what to reteach.
- In every flow: a person, named in the receipt, makes the final decision. The model proposes with evidence. That is the thesis, and it must be visible, not just stated.

## 16. SDLC: phases and gates (order agreed, clock times are team-lock)

Phases, in order. Clock times from the individual proposals are NOT agreed product, per Kishore's Oct 30, 2026, 22:02 ET correction. The team locks clock times, sleep shifts, and pivot times. Gates below are build checkpoints, in order, with the hard deadline fixed.
- Phase 0, Lock: spec lock, fixtures and seeds in place, framework by zero-setup rule, opening-sentence owner named, key holder named.
- Gate G0, Smoke: one schema-valid /propose call on the exact Claude model, price check, billing check. If the smoke gate fails, the fallback ladder runs, never a silent substitution.
- Phase 1, Spine: gate, adapter, engine, shared components frozen. One full propose, validate, review, decide loop live.
- Gate G1, Spine live: the full loop works end to end on seeded data.
- Phase 2, Three beats: minimum one seeded item per idea, each ending in a visible human decision.
- Gate G2, Three beats or pivot: three beats live, or hard pivot to labelled cached rehearsal, with gate, engine, and human decisions still live. No new features after this gate except privacy, decision, demo-path, and label fixes.
- Phase 3, Depth and integration: full seeds, insights, accessibility, test pass, human TA review pass.
- Gate G3, Feature freeze: no new features after this gate.
- Phase 4, Record and submit: P0 fixes only, code freeze, record target 2:27 max 2:29, edit and captions, publish a public link, verify playback and captions and model disclosure while logged out, submit, buffer to the deadline.
- Hard deadline, fixed: submissions due Sat Oct 31, 2026, 10:00 AM ET. Demo video 2 to 3 minutes on the site and slide, 2.5 minutes max in the form read-out, so 2:29 max in practice. Video must be a public link judges can open. New builds only.

## 17. Team-lock items (not decided by the AIs, not to be invented)

1. Team's finished opening sentence, due before the video slot. Team fill-in only.
2. Working Claude API key holder, tested at G0.
3. Exact Claude model ID, verified against official Anthropic docs and a live call.
4. Price check vs ~$10 budget, after the smoke test.
5. Optional Gemini key, for rung 3 to be a real backup.
6. Stack, by the zero-setup rule at lock: Next.js if it already runs, else no-build page.
7. Clock times, sleep shifts, and pivot times for the SDLC phases above.
8. Catastrophic two-beat choice, only if the minimal three-beat build itself fails. Default rule stays: never drop a whole beat, cut depth within beats.
9. Final name, only if the team dislikes Remain plus Show your work.

## 18. Claude Code handoff brief (build from this file only)

Task for Claude Code: build Remain exactly as specified in sections 1 to 17, reusable core first, no scope creep, no mega project.
- Build the shared core first: Privacy Gate, Deterministic Rules Engine, shared components, pipeline, JSON seeds, JSONL logs. Then wire the three thin journeys, one seeded item each, then depth.
- Do not change the core, do not remove big things, do not add scope-out items, do not invent prices, keys, model IDs, or team decisions.
- Do not load eval labels in the UI. Do not create any auto-submit path. Do not claim local if the demo runs on cloud. Do not claim no training on data.
- Pass the testing table in section 12 before recording, including the T11 name-injection probe and the Q5 seed sanity check (320 / 10 / 3.162).
- Stop at the G2 gate if the three beats are not live, and report back, with the labelled cached rehearsal option, instead of silently cutting a beat.
- Deliverable for review: a working local demo, a test report with real counts, and a recording-ready build, for Muse to review and for the team to record.
- Open items for the team, not for Claude Code to invent: section 17 list. If a build choice needs one of those items, ask the team through Muse, do not guess.

## Sources and labels in this spec

- Claude API prices Sonnet $2/$10 and Haiku $0.10/$0.50, and Gemini Flash $0.50/$2.00, as reported by the Engineer and matched by the PM's own check. Token counts and rehearsal costs are unsourced estimates, labelled as such.
- Q5 corrected values verified by hand by Muse, Designer, and PM: sum 40, sum of squares 360, (sum squared)/n 320, sample variance 10, SD sqrt(10) about 3.162.
- Argon findings from earlier rounds are superseded by the user-decided Claude API provider and are not part of this spec, except as a record that Argon was considered and dropped by user decision.
- Research claims from individual AI specs (FERPA, WCAG, testing effect, and similar) are as reported by those AIs, not independently verified by Muse, and are not load-bearing for the demo. The demo stands on seeded data, deterministic code, and visible human decisions.
- This spec contains no real student, employee, or company personal data. All names, IDs, emails, and phones in seeds are synthetic.
