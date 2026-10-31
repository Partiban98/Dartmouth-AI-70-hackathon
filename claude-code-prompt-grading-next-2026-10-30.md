# Claude Code Prompt: Grading Tab Next, on Existing Core (Mac)
## Run in ~/Documents/Remain-Core, on your Mac, with Opus. Do not rebuild the core. Do not commit or push until Kishore says so.

## Full prompt to paste

```
You are Claude Code, model Opus, acting as the implementing engineer for the Remain hackathon project, grading-first phase.

<context>
Working directory is this folder, ~/Documents/Remain-Core, on Kishore's Mac. Core is already built and verified here, uncommitted. Do NOT rebuild the core.
Read these files first, in full, before you write any code:
@grading-focus-2026-10-30.md
@final-spec-remain-2026-10-30.md
@work-split-remain-2026-10-30.md
@HANDOFF-CORE.md, if it exists in this folder. If it does not exist, use grading-focus plus spec sections 7.3, 8, and 12 instead, and say so in your summary.
Team decision, Oct 30, 2026: grading first, interactive learning later if time. Student Companion and Staff Upskilling are later improvements, not this build. Do NOT build them in full now. Keep shared components, pipeline, gate, and engine reusable, so those stretch beats can plug in later. Do NOT hard-code the app to grading only.
Core that must not change: thesis AI proposes with evidence, a person decides; spine Privacy Gate, Deterministic Rules Engine, shared Human Review Queue, human decision; full gate rules A-01, R-01 to R-13, assertClean with 422 BLOCKED; full engine rules; DEMO-STATS 101 seeds with corrected Q5 values 320 / 10 / sqrt(10) about 3.162; cut rules in the spec.
</context>

<task>
Build the grading tab fully, on the existing core, in this order:
1. Hygiene and commit check first, no code changes yet. Confirm no key is set in any file, run the hygiene test if it exists, show git status, and show what would be committed. Do NOT commit or push. Wait for Kishore's go-ahead on commit and push, in a separate step.
2. Grading tab, GR-01 to GR-04, on runPipeline and the shared components:
   - GR-01: versioned, visible, instructor-owned standards table, validated by code before use, Grade Q5 standards E-VAR-SD -3, E-N-DENOM -2, E-MEAN -2, E-ARITH -1, M-UNLISTED -2, OK 0, UNSURE 0.
   - GR-02: queue S-01 to S-25, one by one, no bulk approval.
   - GR-03: review card, AI proposes code, quotes step, gives confidence, TA confirms, changes type, or overrides to no error, TA enters grade, score from human-confirmed codes only, clamped 0 to max.
   - GR-04: class insights from TA-confirmed decisions only.
   - Correction moment: S-07 valid M2, deliberately unlisted in v1.0, misflagged in the proposal, TA overrides it, records the reason, assigns the grade from confirmed codes only.
   - Privacy Gate live in the same beat: S-12 roster name stripped, gate panel shows types and counts only, no roster name on the page or in any log line.
   - Receipt on screen: "Assigned by you (TA)".
3. Tests and browser check. Run npm test, fix failures, do not skip a failing test. Run the G1 headless loop and a browser check in replay mode with a clearly fake cache entry if no key exists, since live calls stay refused until G0 smoke passes. Check S-07 override and S-12 gate, no console errors, label reads "CACHED REHEARSAL: NOT LIVE MODEL OUTPUT" if in replay mode, or "LIVE API: <API-returned ID>" if live. Delete any fake fixture and logs it wrote afterwards, so local/ is empty.
4. Stretch hooks only, no stretch builds. Leave Student Companion and Staff Upskilling as later improvements, with shared components and seeds ready to plug in, but do not build their tabs in full now.
</task>

<output_format>
When you finish, show me, in this order:
1. Files created and files changed, one line each, with what each file does. Say plainly if you changed any core file, and why.
2. Hygiene and git status: no key found, or the exact file and line if a key is found, plus git status summary. Do NOT commit or push.
3. Test results: every command you ran, and its output, including failures you fixed. Do not say tests pass unless you ran them and show the output.
4. Browser check results: S-07, S-12, label shown, console errors or none.
5. Verification checklist against spec sections 7.3, 8, and 12, each item marked pass or fail, with evidence.
6. Open items remaining: key holder and G0 smoke, model ID, price check, Gemini rung 3 stub, Zod swap, manual accessibility T24 to T26, human TA review pass, commit and push go-ahead, and anything you could not verify.
7. Next step for teammates: how they pull this grading build and build a stretch beat on it, in three lines or fewer.
</output_format>

<constraints>
- Follow grading-focus-2026-10-30.md and the final spec exactly. If they conflict on core rules, follow the final spec, and flag the conflict in your summary, do not silently resolve it.
- Use only facts from the files in this folder. Do not invent a price, key, model ID, repo URL, or team decision. Use environment variables for keys, never hardcode a key, never commit a key.
- Keep the code reusable and tight. Shared core first, no per-persona copies of gate, engine, or pipeline. No scope-out items, no real personal data, no illustrative metrics, no auto-submit path.
- If a requirement is ambiguous and the choice would change the core, stop and ask Kishore, do not guess. If the choice is only an implementation detail inside the grading tab, choose the simplest option that passes the tests, and record it in your summary.
- Run lint and typecheck commands if they exist in this project, and show their output. If no such commands exist, say so plainly.
- Do NOT commit or push until Kishore says so in this session. When you finish, show git status and diff summary, and wait for Kishore's go-ahead to commit and push.
- When you finish, do not claim the demo, stretch beats, or submission are done. Claim only: grading tab built on the existing core and verified, ready for review and for teammates to pull after commit and push.
</constraints>
```

## Short prompt version, same task

Read @grading-focus-2026-10-30.md, @final-spec-remain-2026-10-30.md, and @work-split-remain-2026-10-30.md in full. Core is already built here, do not rebuild it. First check hygiene and git status, do not commit or push yet. Then build the grading tab fully, GR-01 to GR-04, queue S-01 to S-25, no bulk approval, review card with confirm, change, or override, TA assigns the grade from confirmed codes only, S-07 override, S-12 gate, insights from confirmed decisions only. Run npm test and a replay browser check, fix failures, delete fake fixtures and logs after, show files changed, test output, browser results, and open items, and wait for my go-ahead to commit and push. Do not build Student or Staff tabs in full now, keep them as later stretch beats on the same core.
