# Remain: rules for any agent working in this repo

Thesis: AI proposes with evidence, a person decides. Every change must keep that visible on screen.

## Never change without Kishore
- `lib/gate.js`, `lib/engine.js`, `lib/pipeline.js`, `lib/schema.js`, `lib/logshape.js`: the Privacy Gate, rules engine, pipeline, model-output shape, log safety.
- Rubric deductions and seeds in `data/`. Q5 values stay 320 / 10 / 3.162.
- The model never computes, grades, writes an answer, redacts, or sees a point value. The grade is a human text box.

## Hygiene, every commit
- No key, token, or `.env` in the tree. `local/`, `grading-data/`, `node_modules/`, `.next/` stay ignored.
- Logs hold types, counts, codes, ids, names of deciding humans, and reasons. Never a stripped value, never the alias map.
- Eval files (`*.eval.json`) are tests-only and are never served or loaded by the UI.
- On-screen numbers come from logs. On-screen model name comes from the API response.
- Commit and push only when Kishore says so.

## Build
- Zero dependencies in `lib/` and `server/adapter.js`. The Next.js app (`app/`, `components/`) is the only place with packages.
- Smallest change that fully works. No options, wrappers, or features nobody asked for. Delete before you add.
- One pipeline, one gate, one engine, one review pattern. No per-persona copies.

## Test
- New behaviour: failing test first (`node --test tests/`), then the minimal code. Watch it fail, watch it pass.
- Tests written after the code: break the function on purpose and show the test goes red before keeping it.
- `npm test` must be green before any commit. Verify UI changes in the real browser, then delete fake fixtures and logs.

## Scope
- Grading first. Student and Staff pages are later beats on the same core.
- Out of scope: multi-course, analytics export, notifications, gradebook write-back, Canvas, OCR, local-LLM claims, auto-submit.
- Never claim "local" for cloud output, never claim "no training on your data".

Keep this file lean. If a rule stops earning its place, delete it.
