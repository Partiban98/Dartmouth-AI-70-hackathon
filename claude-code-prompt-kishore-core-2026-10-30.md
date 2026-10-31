# Claude Code Prompt for Kishore's Core Only: GuruAI
## Two prompts, in order. Prompt A plans and writes the handoff. Prompt B, run with Opus, implements fully from that handoff.

How this prompt was built: it follows Anthropic's official Claude Code prompt patterns, from the official Prompt Library at https://code.claude.com/docs/en/prompt-library : describe the outcome, not the steps; give Claude a way to check its own work; point at a reference file; state a measurable target; give it the artifact; say how you want the answer; use plan mode for larger or riskier changes so you see the file list before any edits happen.

Model note, corrected Oct 30, 2026: Planner for Prompt A is fable, a Claude Code model alias listed in claude --help alongside opus and sonnet. Implementer for Prompt B is Opus, as Kishore asked.

Working title: GuruAI. Final product name is to be decided later by the team. Do not rename code or files until the team decides.

Core only means: Kishore's base and core from the final spec and the work split. It does NOT mean the three persona journeys in full, the demo video, or submission. Those are teammates' items, built later on this core.

Files to give Claude Code with these prompts, in the working directory, before you paste Prompt A:
- Final spec: final-spec-remain-2026-10-30.md (sections 1 to 10, 12, 16, 18 are the core sections)
- Work split: work-split-remain-2026-10-30.md (Kishore section only, for scope)

In Claude Code, reference them with @, for example @final-spec-remain-2026-10-30.md, so Claude reads the source instead of a description of it.

---

## PROMPT A: PLAN ONLY, WRITE THE HANDOFF FILE (do not implement yet)

Copy and paste this whole block into Claude Code, in plan mode if you can, with model fable. In plan mode, Claude Code researches and proposes changes without making them, and edits stay blocked until you approve the plan. For this prompt, the ONE file you are allowed to create is HANDOFF-CORE.md, and only after you approve the plan. Do not create code files, do not edit other files, do not commit, do not push.

```
You are Claude Code, acting as a senior planning engineer for the GuruAI hackathon project.

<context>
Project: GuruAI, a Dartmouth AI at 70 Student Hackathon super app, working title only, final name to be decided later by the team.
Thesis: AI proposes with evidence, a person decides.
Read these files first, in full, before you plan anything:
@final-spec-remain-2026-10-30.md
@work-split-remain-2026-10-30.md
Scope for this task is Kishore's core only, from the work split: base repo, shared pipeline, Local Privacy Gate, Deterministic Rules Engine, shared components, DEMO-STATS 101 seeds, Claude API provider adapter with smoke gate, test harness, and integration. Do NOT build the Student, Staff, or Teacher/TA journeys in full. Do NOT build the demo video or submission. Teammates build those later on this core.
Core that must not change: thesis and spine (Privacy Gate, Deterministic Rules Engine, shared Human Review Queue, human decision), all three personas primary, full gate rules, full engine rules, shared components and one pipeline, DEMO-STATS 101 seeds, binding cut order and never-cut items, what-remains-human table.
</context>

<task>
Plan the core build, then write ONE handoff file. Do not implement code in this step.
1. Explore first. List what already exists in this working directory, what is missing, and which stack already runs here, if any. Apply the zero-setup rule from the spec: if Next.js already runs, use it; if nothing runs, use the no-build single page plus local scripts. Record which branch you chose and why, do not guess a stack that is not here.
2. Write HANDOFF-CORE.md in the working directory. This file is the ONLY file you may create in this step, and it must be complete enough for Opus to implement the core fully, without asking Kishore for spec details again.
</task>

<output_format>
HANDOFF-CORE.md must contain, in this order, with headings:
1. Goal and outcome: what "core done" means, in one paragraph, plus the acceptance checklist from the spec.
2. Architecture: pipeline runPipeline(ideaConfig, input), four stages in order, shared components GatePanel, ReviewCard, Queue list, DecisionBar, ReceiptPanel, Decision log, JSON seeds, append-only JSONL logs in a gitignored local folder.
3. File layout: exact folders and files to create, in dependency order, with one line per file saying what it does. No persona journey files in this layout, except the shared components they will reuse.
4. Module by module tasks, in dependency order, each with: inputs, outputs, exact behaviour, and one concrete example.
   - Privacy Gate: A-01 allowlist, R-01 to R-13, assertClean with 422 BLOCKED, alias map in browser memory only, before and after view with types and counts only, R-11 flagged-token exception shown locally only, honest limit stated.
   - Deterministic Rules Engine: validateCodes, verifyQuote with exact substring match after normalization, score from human-confirmed codes only clamped 0 to max, methodSignatures R-M1, answerCheck, factsCheck, retest, validateStandards, analytics from confirmed counts only, counters from logs only. Model output limited to allowlist code, quoted step, confidence. Model never redacts, computes, grades, writes a final answer, or validates a method.
   - Provider adapter: Claude API, Sonnet 5.5 for demo and rehearsals, Haiku 5.5 for dev loops, fallback ladder Sonnet, Haiku, Gemini 2.5 Flash paid only with a confirmed separate key, labelled cached rehearsal, retry once per rung, call cap 150, SHA-256 payload cache, billing check, honest labels from the API-returned ID, smoke gate G0 with one schema-valid /propose call, structured output proven at smoke gate else tool use with Zod validation either way.
   - Seeds: DEMO-STATS 101, Grade Q5 with corrected values sum 40, sum of squares 360, (sum squared)/n 320, sample variance 10, sample SD sqrt(10) about 3.162, standards E-VAR-SD -3, E-N-DENOM -2, E-MEAN -2, E-ARITH -1, M-UNLISTED -2, OK 0, UNSURE 0, M1 listed, M2 deliberately unlisted, S-01 to S-25 distribution, S-07 valid M2, S-12 gate probe, Companion Ch. 3 source and retest Q3, Upskill Dana task with facts fields. Planted answers live only in submissions.eval.json, for tests only, never loaded by the UI.
5. Tests, with expected results: gate probes, T11 name-injection probe (planted synthetic name plus email must never appear in any cloud payload or log), engine tests, Q5 seed sanity, no auto-submit path check, keyboard and grayscale checks, spend guard check. State the exact command to run each test, or say plainly if no test runner exists yet and the handoff must create one.
6. Acceptance criteria, measurable: one full propose, validate, review, decide loop works on seeded data; gate blocks unclean payloads; engine rejects a fake source line and marks it not found; score uses confirmed codes only; no code path auto-submits; all tests in section 5 pass, with output shown.
7. What NOT to do: no persona journeys in full, no demo video, no submission, no scope-out items (multi-course, analytics exports, notifications, gradebook write-back, Canvas auto-ingest, Canvas auto-submit, photo or OCR, local LLM claims, Aid, Hearing Ledger, advanced RAG, background observation), no real student or company personal data, no illustrative metrics, no invented prices, keys, or model IDs.
8. Open items for Kishore, not for you to invent: working Claude API key holder tested at G0, exact model ID verified against official Anthropic docs and a live call, price check vs about $10 budget after smoke test, optional Gemini key, stack by zero-setup rule, final product name, team opening sentence, clock times for sleep and pivot.
9. Risks: shared key and billing caveat for Sonnet and Haiku rungs, structured output risk at smoke gate, known limit that a lowercase non-roster name is not caught, data-use terms unchecked so the video must not claim "no training on your data".
</output_format>

<constraints>
- Use only facts from the two spec files and from this working directory. Do not invent a price, key, model ID, repo URL, or team decision.
- If the spec and the working directory disagree, say so in HANDOFF-CORE.md under Open items, do not silently pick one.
- Keep the handoff reusable and tight. Cut extras, do not add features. Core only, no mega project.
- When you finish, stop. Do not implement, do not commit, do not push. Show me: the file path of HANDOFF-CORE.md, a one paragraph summary, and the open items list. Wait for my approval before any implementation step.
</constraints>
```

After Prompt A finishes: read HANDOFF-CORE.md yourself, fix anything wrong in it, and only then paste Prompt B.

---

## PROMPT B: OPUS IMPLEMENTS FULLY FROM THE HANDOFF (run with Opus)

Copy and paste this whole block into a fresh Claude Code session, with model Opus, in the same working directory, with HANDOFF-CORE.md and the two spec files present.

```
You are Claude Code, model Opus, acting as the implementing engineer for the GuruAI hackathon project.

<context>
Read these files first, in full, before you write any code:
@HANDOFF-CORE.md
@final-spec-remain-2026-10-30.md
@work-split-remain-2026-10-30.md
Scope is core only, exactly as defined in HANDOFF-CORE.md and in Kishore's section of the work split. Do NOT build the Student, Staff, or Teacher/TA journeys in full. Do NOT build the demo video or submission. Teammates build those later on this core.
Core that must not change: thesis and spine, all three personas primary, full gate rules, full engine rules, shared components and one pipeline, DEMO-STATS 101 seeds, binding cut order and never-cut items, what-remains-human table.
</context>

<task>
Implement the core fully, in the dependency order given in HANDOFF-CORE.md, in this order:
1. Shared pipeline, components, and seeds.
2. Local Privacy Gate, with assertClean and the before and after view.
3. Deterministic Rules Engine, with all named functions.
4. Claude API provider adapter, with smoke gate G0, fallback ladder, guards, and honest labels.
5. Test harness, with every test in HANDOFF-CORE.md.
After each module, run its tests, fix failures, and only then move to the next module. Do not skip a failing test and move on.
</task>

<output_format>
When you finish, show me, in this order:
1. Files created and files changed, one line each, with what each file does.
2. Test results: every command you ran, and its output, including any failures you fixed. Do not say tests pass unless you ran them and show the output.
3. Verification checklist against HANDOFF-CORE.md acceptance criteria, each item marked pass or fail, with evidence.
4. Open items remaining for Kishore: key holder, exact model ID, price check, stack decision you made and why, final product name, and anything you could not verify.
5. Next step for teammates: how they pull this core and build their journey on it, in three lines or fewer.
</output_format>

<constraints>
- Follow HANDOFF-CORE.md exactly. If it conflicts with the final spec, follow the final spec on core rules, and flag the conflict in your summary, do not silently resolve it.
- Use only facts from the handoff and spec files and from this working directory. Do not invent a price, key, model ID, repo URL, or team decision. Use environment variables for keys, never hardcode a key, never commit a key.
- Keep the code reusable and tight. Shared core first, no per-persona copies of gate, engine, or pipeline. No scope-out items, no real personal data, no illustrative metrics, no auto-submit path.
- If a requirement is ambiguous and the choice would change the core, stop and ask Kishore, do not guess. If the choice is only an implementation detail inside the core, choose the simplest option that passes the tests, and record it in your summary.
- Run lint and typecheck commands if they exist in this project, and show their output. If no such commands exist, say so plainly.
- Do NOT commit or push until Kishore says so in this session. When you finish, show the git status and diff summary, and wait for Kishore's go-ahead to commit and push.
- When you finish, do not claim the demo, journeys, or submission are done. Claim only: core implemented and verified, ready for teammates to pull.
</constraints>
```

---

## How to run this, step by step

1. Put final-spec-remain-2026-10-30.md, work-split-remain-2026-10-30.md, and this prompt file in the working directory where Claude Code will run.
2. Paste Prompt A into Claude Code, in plan mode if you can, with model fable. Approve only the HANDOFF-CORE.md write. Read the handoff, fix it if needed.
3. Start a fresh Claude Code session with Opus, paste Prompt B, with HANDOFF-CORE.md present.
4. Review the diff and test output yourself. Only then tell Opus to commit and push to GitHub, so Rineetha, Partiban, and Xinyan can pull the core.
5. Do not run Prompt B until Prompt A is approved. That order, explore, plan, implement, verify, is the point: changing a plan takes a minute, undoing the wrong feature can burn the whole session.

Sources for the prompt patterns used here, official Claude Code docs checked Oct 30, 2026:
- Prompt Library, official Claude Code Docs: https://code.claude.com/docs/en/prompt-library
- Patterns used: describe the outcome, not the steps; give it a way to check its own work; point at a reference; state a measurable target; give it the artifact; say how you want the answer; use plan mode for larger or riskier changes.
