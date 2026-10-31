# Grading Focus: Team Decision, Oct 30, 2026
## This tab changes build order only. It does not change the core rules.

Original Spec tab remains the source for the thesis, spine, Privacy Gate, Deterministic Rules Engine, seeds, and cut rules. This tab records the team's grading-first decision, the core that is already built, and the extra ideas as later improvements, with why each exists and how it connects to grading.

Working title: GuruAI. Final product name is to be decided later by the team. Do not rename code or files until the team decides.

## Team decision: grading first, interactive learning later if time

Team decided, Oct 30, 2026, late evening: build grading now, and add the interactive learning ideas later if time allows. This is not a permanent scrap of the other ideas. It is a build order decision, because the deadline is Sat Oct 31, 2026, 10:00 AM ET, and a finished, deep grading demo beats three thin beats.

Partiban's point, recorded: focusing on grading as the core lets the platform differentiate on functionality, rather than on a generic learning surface.

## Core already built: status as reported by Claude Code

Status label: as reported by Claude Code after its Mac build. Muse has NOT independently run these tests on the Mac. Do not present this as Muse-verified until Muse or Kishore re-runs npm test on the Mac.

Claude Code report, in short:
- Core implemented and verified. Server exit seen was Claude Code stopping the server after the browser check. Nothing is committed yet, per the project's run order.
- 40 files to add, about 1,500 lines, zero dependencies.
- data: DEMO-STATS 101 seeds, synthetic roster, glossary, AI rules, Grade Q5 standards v1.0 with M2 deliberately absent, 25 submissions with planted 10/4/2/3/6 distribution, S-07 valid M2, S-12 roster-name probe, eval labels in a separate file, Companion Ch. 3 source, key points, retest Q3, upskill standards and Dana task.
- lib: pure modules that run in browser and tests, gate A-01, R-01 to R-13, assertClean, alias remap, engine with all eleven named functions, schema validator, pipeline, three idea configs, prompts, log-record shapes.
- server: node:http server with exactly four routes, Claude API adapter with raw HTTP, structured output or strict tool mode, ladder, retry once per rung, call cap 150, SHA-256 cache, label from API-returned ID, JSONL writer that refuses unsafe records.
- public: shell with three tabs and six shared components. Teacher and TA tab mounts the core loop as the G1 proof.
- scripts/smoke-g0.js, tests with nine suites plus manual accessibility checklist, README.md extended on top of the team repo's own README.

Test results, as reported:
- npm test: 44 tests, 44 pass, 0 fail.
- Covers T01 to T30 as mapped in the handoff, G1 headless loop, ladder, server 422 path, public-repo hygiene check. No test touches the network.

Browser verification, as reported, in Chrome against npm run dev in replay mode with one clearly fake cache entry, since no key exists yet:
- S-07: gate panel, approve, review card showing AI item plus Rule item M-UNLISTED, both overridden with reasons, grade entered, receipt "Assigned by you (TA): Kishore (UI check)", decision log counts from JSONL. Label read "CACHED REHEARSAL: NOT LIVE MODEL OUTPUT" throughout. No console errors.
- S-12: gate panel showed NAME 1, roster name appeared nowhere on the page or in any log line.
- Fake fixture and logs it wrote were deleted afterwards, so local/ is empty.

Acceptance checklist, as reported: full loop on seeded data pass, gate blocks unclean payloads with 422 and nothing sent and logged pass, fake source line marked not found pass, score from confirmed codes only and clamped pass, no auto-submit path pass, eval labels never served pass, zero dependencies and nothing from local/ or .env would be committed pass.

Open items, unchanged from the handoff, plus two from the build:
1. Key holder sets ANTHROPIC_API_KEY, MODEL_DEMO, MODEL_DEV, then runs npm run smoke. Live calls stay refused until that passes.
2. Model IDs verified at G0. Label will show whatever the API returns.
3. Price check from local/smoke.json usage after G0.
4. Rung 3 is a stub. If a Gemini key is confirmed, Gemini wire format still needs building.
5. Zod question: hand-written validator used. Swapping is a one-file change.
6. Repo ownership and Rineetha's collaborator access, as noted in the handoff.
7. Manual accessibility checks T24 to T26 are written up in tests/a11y.md but not run.
8. Repo is public, so first push should happen only after confirming no key is set in any file, which the hygiene test also checks.

Next step for the core, as reported: say "commit and push" and Claude Code will commit on main and push to the team repo so others can pull. Teammates then branch from main, build their tab on runPipeline and the components, and merge through Kishore's review. Do NOT commit or push automatically in the next prompt. Show git status and hygiene result first, and wait for Kishore's go-ahead.

## Grading focus: why grading is the demo core

Problem it solves: TAs and instructors grading free-response stats and math work make inconsistent calls on the same mistakes, and students get different marks for the same error. That is a real, checkable pain, not just time saved.

Why it differentiates: it is not a generic grader. It is a deterministic, human-decided grading loop. AI proposes a code, quotes the step, and gives confidence. Deterministic code validates the code, verifies the quote by exact substring match, and computes the score from human-confirmed codes only. The TA confirms, changes, or overrides, and assigns the grade. Every number on screen comes from logs, never from a typed-in number.

Demo core, in order:
- GR-01: versioned, visible, instructor-owned standards table, validated by code before use. Grade Q5 standards, E-VAR-SD -3, E-N-DENOM -2, E-MEAN -2, E-ARITH -1, M-UNLISTED -2, OK 0, UNSURE 0.
- GR-02: queue S-01 to S-25, one by one, no bulk approval.
- GR-03: review card, confirm, change type, or override to no error, TA enters grade, score from confirmed codes only.
- GR-04: class insights from TA-confirmed decisions only, so the instructor knows what to reteach.
- Correction moment, the strongest beat: S-07 valid M2, deliberately unlisted in v1.0, misflagged in the proposal, TA overrides it, records the reason, assigns the grade from confirmed codes only.
- Privacy Gate live in the same beat: S-12 roster name stripped, gate panel shows types and counts only, assertClean blocks unclean payloads with 422.

Thesis, still intact in grading alone: AI proposes with evidence, a person decides. Receipt on screen: "Assigned by you (TA)".

## Later improvements: extra ideas, why each exists, and how it connects to grading

These are later, not cut permanently, and not built before the grading beat passes. Each reuses the same core, so none of them is a second app.

### Later improvement 1: Student Companion, Course Companion

Why it exists: a student in a case-based course has notes, slides, cases, and rubrics in many files. AI summaries feel like learning, but the student often cannot explain the work in class, and then submits work they cannot defend. That is the same understanding gap grading exposes, from the other side of the desk.

How it connects to grading:
- Same spine, same pipeline, same Privacy Gate, same Deterministic Rules Engine, same ReviewCard and DecisionBar, no new core.
- Same DEMO-STATS 101 seeds: Companion Ch. 3 source, Q2 key points, retest Q3. The student gap check uses the same verifyQuote rule as grading, a source line must match exactly or it is marked not found.
- Grading feeds learning: GR-04 insights, recurring mistakes from TA-confirmed decisions, become the companion's reteach topics and key points. If many papers show E-VAR-SD, the companion teaches variance vs standard deviation first.
- Learning feeds grading back: a student who fixes a gap and passes the retest, with the same engine checking the answer, produces work that the same grading engine can then score consistently.
- Same human rule: student answers first, check disabled until at least 20 characters, tool shows only the missing point, never writes the final answer, never auto-submits. That is the student version of TA confirms and assigns.

What it adds, when time allows, in order: ST-01 answer first, ST-02 gap check with code-verified source line, ST-03 fix plus retest, ST-04 export draft as text only, with course AI rules lock enforced by code. First seeded item only: Q2 gap plus retest Q3. Do not build a full multi-course companion tonight.

### Later improvement 2: Academic Staff Upskilling

Why it exists: coordinators and admin staff get AI tools faster than they learn to use them well. They either avoid the tools or trust output blindly, and generic courses do not match their real tasks. That matters for grading too, because the people who own rubrics and announcements are often the same staff.

How it connects to grading:
- Same spine, same pipeline, same Privacy Gate, same Deterministic Rules Engine, same per-edit ReviewCard pattern, no new core.
- Same gate, at its most sensitive: company and colleague tasks, PR-00 "What never goes into AI" module, before and after types and counts, staff approves the redacted payload. That is the same gate that strips S-12 paper headers in grading.
- Same engine, different check: factsCheck flags any date, time, number, or room in a draft that is not in the facts fields. That is the staff version of verifyQuote in grading, a claim must match a source or it is flagged.
- Direct loop to grading quality: academic coordinators own the standards tables in GR-01. Upskilling them on prompting, checking, and editing AI output improves the rubrics themselves, which improves grading consistency. A staff member who learns to check an AI draft about variance vs standard deviation is also learning to check a grading announcement or feedback draft on the same topic.
- Same human rule: staff accepts each edit or keeps their own wording, checks "I reviewed every change", and approves. Nothing auto-submits. That is the staff version of TA confirms and assigns.

What it adds, when time allows, in order: PR-00 module, PR-01 seeded Dana task, PR-02 live gate view with approval, PR-03 per-edit coach suggestions, PR-04 per-edit accept or keep mine plus approve. First seeded item only: Dana task, Wed Nov 4, 6:00 to 7:00 PM, B-101, Variance vs standard deviation. Team progress to an employer is team level only, anonymized at individual level.

### Later improvements from the core build itself, not personas

Each of these is later, in this order, after the grading beat:
- Live Claude API: key holder, G0 smoke test, price check vs about $10 budget. Why: demo must honestly name the model that actually ran, and rehearsals must run on the same model as the recording. Connects to grading: live proposals replace cached rehearsal, but gate, engine, and TA decision stay the same, and the label changes to LIVE API with the API-returned ID.
- Gemini rung 3 wire format: only if a separate Gemini key is confirmed. Why: first real backup if Claude account fails, since Sonnet and Haiku share one key and billing. Connects to grading: same adapter interface, same gate and engine, different provider only.
- Zod swap: one-file change from the hand-written validator. Why: cleaner schema validation if the team wants it, not a core change. Connects to grading: same validation rules, different library.
- Manual accessibility checks T24 to T26, run, not just written. Why: keyboard path, grayscale legibility, read-aloud order, source lines not by colour alone. Connects to grading: TA review card and queue must be usable without sound or colour.
- Human TA review pass over all 25 seeded papers before recording, so video counts are real, not illustrative. Why: closing metrics must come from logs only. Connects to grading: this is the GR-04 evidence base.
- Demo video and submission: target 2:27, hard max 2:29, opens with the team's finished sentence, team fill-in only, public link, captions, logged-out playback check, submit by Sat Oct 31, 2026, 10:00 AM ET.

## Work order for grading-first

1. Hygiene and commit check, Kishore only: confirm no key in any file, show git status and hygiene test result, then Kishore says commit and push. Do not push automatically.
2. Grading tab, full build, on the existing core. Do not rebuild the core. Do not change gate, engine, pipeline, or components without Kishore's review.
3. Stretch beats, only if the grading beat passes: Student Companion first seeded item, then Staff Upskilling first seeded item. Cut depth within beats, never a whole beat that is already recorded.
4. Record, captions, public link, logged-out check, submit by Sat Oct 31, 2026, 10:00 AM ET, with buffer.

## Teammate order for grading-first

- Kishore: core, integration, hygiene, commit and push, review all merges. Core is already built, uncommitted.
- Partiban: grading tab, full, GR-01 to GR-04, queue, review card, insights, S-07 correction beat. This is the recorded demo core.
- Rineetha: grading support first, queue and insights and tests, then Student Companion stretch if time. Her original Student journey becomes the first stretch beat, not the first build.
- Xinyan: grading gate view support and demo assembly first, then Staff Upskilling stretch if time. Her original Staff journey becomes the second stretch beat, not the first build.
- If the team wants a different split for Rineetha and Xinyan, edit this tab. Do not let two people build the same grading file on different branches without Kishore's merge review.

## What stays cut, even in grading-first

Multi-course, analytics exports, notifications, gradebook write-back, Canvas auto-ingest, Canvas auto-submit, photo or OCR, local LLM claims, Aid, Hearing Ledger, advanced RAG, background observation, any feature without an on-screen number or decision, any feature that needs real student or company data. Synthetic and public sample data only in the demo.
