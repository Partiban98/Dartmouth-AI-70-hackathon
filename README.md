# Dartmouth-AI-70-hackathon
Hackathon

## Remain (working title): shared core

Thesis: AI proposes with evidence, a person decides. One pipeline, one Privacy Gate, one Deterministic Rules Engine, one review pattern, reused by three personas: Student, Academic Staff, Teacher and TA.

This folder is the core built first by Kishore. Teammates build their journey on it, on their own branch, and merge through review. See `HANDOFF-CORE.md` for the full design, `final-spec-remain-2026-10-30.md` for the agreed spec, `work-split-remain-2026-10-30.md` for who builds what.

### Run

Requires Node 22 or newer.

```
npm install              # Next.js, React, Tailwind
npm run dev              # product UI on http://localhost:3000 (Next.js)
npm test                 # all tests, node --test, zero-dependency core
npm run smoke            # gate G0: one schema-valid call on the exact model, writes local/smoke.json
npm run smoke:gemini     # optional rung 3 check
npm run legacy           # the original no-build page on http://localhost:8787, same core, fallback
```

The core (`lib/`, `server/adapter.js`, `server/log.js`) stays zero-dependency and is what the tests cover. The Next.js app is the product surface on top: `app/` routes and `components/grading/`.

Environment variables go in a `.env` file in this folder (gitignored, loaded by `npm run dev` and the smoke scripts; a `.env` value fills any variable that is missing or empty in your shell) or in your shell. Copy `.env.example` and fill it in. Never commit it:

| Variable | Meaning |
|---|---|
| `ANTHROPIC_API_KEY` | Provider key. Read only by `server/`. Never in `public/`, never logged. |
| `MODEL_DEMO` | Exact model id for the recorded demo and rehearsals, verified at G0. |
| `MODEL_DEV` | Exact model id for dev loops. Fallback rung 2. |
| `NODE_ENV=development` | Use `MODEL_DEV` on rung 1. |
| `GEMINI_API_KEY`, `GEMINI_TIER=paid`, `GEMINI_MODEL` | Optional rung 3, the first real backup. Paid tier only, free tier never. Spec expects `gemini-2.5-flash`; the label shows the id the API returns. Run `npm run smoke:gemini` once. |
| `REPLAY_MODE=1` | Rung 4 only: cached rehearsal, labelled "CACHED REHEARSAL: NOT LIVE MODEL OUTPUT". |
| `PORT` | Server port, default 8787. |

Live calls are refused until `npm run smoke` has written a passing `local/smoke.json`. The on-screen model label always reads the id the API returned, never a typed-in string.

### Layout

- `lib/` shared pure modules, run in the browser and in tests: `gate.js`, `engine.js`, `schema.js`, `pipeline.js`, `ideas.js`, `prompts.js`, `logshape.js`, `text.js`
- `server/` tiny `node:http` server, provider adapter, JSONL log writer. Routes: static, `POST /propose`, `POST /log`, `GET /counts`
- `app/` Next.js App Router: `/grade` (Teacher and TA journey GR-01 to GR-04), `/student` and `/staff` placeholders, route handlers `/api/propose`, `/api/log`, `/api/counts`, `/api/rubric`, and `/data/[file]` (never serves `*.eval.json`). `/propose`, `/log`, `/counts` are rewritten to the API routes so the shared pipeline is unchanged.
- `components/grading/GradingWorkspace.tsx` the product surface: question-set selector, instructor rubric drawer (versioned, validated, precedents), queue with no bulk approval, paper view with quoted lines highlighted, gate panel, review card with keyboard grading (1, 2, 3, Enter), decision bar with the feedback line, receipt, class insights from confirmed decisions, decision log.
- `legacy/` the original no-build page and server, kept as the fallback. Same core.
- `data/` DEMO-STATS 101 seeds, synthetic only. `*.eval.json` is for tests and is never served
- `tests/` node --test suites, plus `a11y.md` manual checks
- `local/` gitignored: JSONL logs, payload cache, call counter, smoke result

### Honest limits, stated here and on screen

- Deterministic rules cannot guarantee 100 percent removal of an unknown name hidden in arbitrary free text. Inputs are structured and seeded, fields are allowlisted, known patterns are replaced, and a person reviews the before and after payload before any send. On any uncertainty the send is blocked. A lowercase non-roster name is not caught.
- The demo runs on a cloud model. Do not describe it as local.
- Provider data-use terms were not checked. Do not claim "no training on your data". The Privacy Gate is the primary protection.
- Do not give sponsorship as the reason for the model choice.
- Metrics on screen are real counts from `local/*.jsonl`, never illustrative.

### Rules for building a journey on this core

Reuse `runPipeline`, the gate, the engine, and the components. Do not copy them per persona. Do not change gate or engine rules, standards deductions, or seeds without Kishore. No auto-submit path, no gradebook write-back, no eval labels in the UI, no real personal data.
