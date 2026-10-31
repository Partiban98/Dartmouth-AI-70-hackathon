# HANDOFF-CORE.md: GuruAI core build, for the implementing session

Working title: GuruAI. Final name is a team decision; do not rename anything.
Scope: Kishore's core only, per work-split section "Kishore Theeraj Vasudevan Jaya". No full persona journeys, no demo video, no submission.
Sources: final-spec-remain-2026-10-30.md (spec), work-split-remain-2026-10-30.md (split), claude-code-prompt-kishore-core-2026-10-30.md (prompt), README-MAC.md, and the state of this folder on Oct 30, 2026. Nothing else. Where this file had to make an implementation choice the spec leaves open, it is marked **core choice**. Where only the team can decide, it is in section 8, not decided here.

---

## 1. Goal and outcome

Core done means: one web app shell with three tabs runs locally from this folder with no build step, and one full propose, validate, review, decide loop runs end to end on seeded DEMO-STATS 101 data through the shared pipeline, with the Local Privacy Gate before any cloud call, the Deterministic Rules Engine after the model, the six shared components on screen, and a human decision logged to a named person in an append-only JSONL log. Teammates can pull it and build their journey on it without touching gate, engine, pipeline, or components.

Acceptance checklist (work split, Kishore's section):
- [ ] One full propose, validate, review, decide loop works on seeded data (G1).
- [ ] Gate blocks unclean payloads (assertClean returns 422 BLOCKED, nothing sent, event logged).
- [ ] Engine rejects a fake source line and marks it "not found in source".
- [ ] Score uses human-confirmed codes only, clamped 0 to max.
- [ ] No code path auto-submits anywhere.
- [ ] Every test in section 5 passes, with output shown.
- [ ] Smoke gate G0 script exists and runs; its live pass depends on the open items in section 8.

---

## 2. Architecture

### Stack: no-build branch (zero-setup rule, spec section 10)
Observed in this folder on Oct 30, 2026: four markdown files, no package.json, no next.config, no node_modules, no git repo. Node v26.13.0 is installed. Observed in the team repo (section 2, Git) on Oct 30, 2026: one file, a 39-byte README.md, one commit. Nothing runs in either place, so the spec's rule selects: one HTML page plus plain JS plus CSS, no build step, a tiny Node API server, local scripts, JSDoc-typed plain JS, `node --test`, zero dependencies. Next.js is not introduced.

### Git, team repo (given by Kishore, Oct 30, 2026)
Remote: https://github.com/Partiban98/Dartmouth-AI-70-hackathon, default branch `main`, **public**, created by Partiban98 with an initial commit containing only README.md. Collaborators seen: kishoretheeraj, Partiban98, xinyan0913.
- Implementer: `git init` in this folder, add that remote, fetch and merge `main` (it only brings README.md; keep the repo's README.md and put the core's run notes into it rather than replacing it blindly). No commit, no push, until Kishore says so.
- Because the repo is public: `local/`, `.env*`, and `*.eval.json` outputs never leave the machine; the key never appears in any tracked file; the synthetic-only rule is load-bearing, not cosmetic. Add a pre-commit check in the test suite (T22b): no tracked file contains `sk-`, `example.org` outside `data/`, or anything under `local/`.

**Core choice:** all shared logic lives in ES modules under `lib/` that import nothing from Node or the browser, so the same file runs in the page (`<script type="module">`) and in `node --test`. Only `server/` and `scripts/` touch Node APIs.

### Spine, four stages in order, on screen
1. Privacy Gate, local, in the browser, before any cloud call. Alias map stays in browser memory.
2. Model proposes, via `POST /propose` on the local server, which re-runs assertClean and then calls the Claude API adapter. Output limited to allowlist code, quoted step, confidence.
3. Deterministic Rules Engine validates and computes, in the browser, from the engine module.
4. Human confirms, edits, or overrides. Decision is logged to a named person via `POST /log`. Counts on screen come from `GET /counts`, computed from logs only.

### Pipeline
`runPipeline(ideaConfig, input, ui)` in `lib/pipeline.js`. `ui` is an object of async hooks the page implements with the shared components and tests implement with scripted answers: `approveGate(report)`, `resolveFlags(flags)`, `review(card)`, `decide(bar)`. The pipeline awaits each; nothing proceeds without the hook resolving. Returns `{ receipt, counts }`.

`ideaConfig` per persona (`lib/ideas.js`): `id`, `allowlistFields`, `standardsFile`, `promptName`, `allowedCodes` (derived from standards), `ruleCandidates` (which engine rules run before review), `receiptText`, `verifyAgainst` (which payload field quotes must match).

### Shared components (frozen first), plain DOM functions in `public/components.js`
GatePanel (PG-01), ReviewCard (C-01), QueueList (C-03), DecisionBar, ReceiptPanel, DecisionLog (C-02). No framework. Each returns an element and takes callbacks. Status is always conveyed by text, never colour alone.

### Data and logs
- JSON seeds in `data/`. `*.eval.json` files are read by tests only; the server refuses to serve them (T21).
- Append-only JSONL logs in `local/` (gitignored): `gate.jsonl`, `proposals.jsonl`, `decisions.jsonl`, `blocked.jsonl`, plus `local/cache/<sha256>.json`, `local/calls.json`, `local/smoke.json`. Logs hold types and counts, codes, booleans, ids, names of deciding humans, and reasons. Never a stripped value, never the alias map.

### Key handling
Provider key is read by `server/` from an environment variable on the controlled machine. Never in `public/`, never in the repo, never logged. **Core choice** of env var names: `ANTHROPIC_API_KEY`, `MODEL_DEMO`, `MODEL_DEV`, `GEMINI_API_KEY`, `GEMINI_TIER` (spec names this one), `REPLAY_MODE` (spec names this one). Values are set by the key holder (section 8), not written anywhere by the implementer.

---

## 3. File layout, in dependency order

Create exactly these. One line each. No persona journey files.

```
.gitignore                      local/, .env, .env.*, node_modules/
package.json                    "type":"module"; scripts only: test, dev, smoke; "dependencies": {} (zero)
README.md                       how to run, env vars to set, honest limit text, the three "do not claim" lines
data/course.json                DEMO-STATS 101 meta, synthetic roster with aliases, name dictionary (staff), glossary, course AI rules
data/grade-q5.v1.0.json         standards table: codes, deductions, max 10, methods with M1 regex signature, M2 absent on purpose
data/grade-q5.submissions.json  S-01..S-25: header fields (name, netid, email, timestamp, filename) + steps[] + finalAnswer; no labels
data/grade-q5.submissions.eval.json  planted labels per S-nn; tests only; never served
data/companion-ch3.json         Ch. 3 source paragraphs, Q2 key points KP-1..3 with teaching lines, demo wrong answer, retest Q3 spec
data/upskill-email.v1.0.json    standards: tips P-*, checks C-*
data/upskill-dana-task.json     seeded pasted email text (with headers and identifiers) + facts fields
lib/text.js                     normalize(): collapse whitespace, curly to straight quotes, trim
lib/schema.js                   validateProposal(obj, ideaConfig): hand-written validator for the model output shape (see 4.3)
lib/gate.js                     A-01, R-01..R-13, runGate(), assertClean(), buildReport()
lib/engine.js                   validateStandards, validateCodes, verifyQuote, score, methodSignatures, answerCheck, factsCheck, retest, keyPoints, analytics, counters
lib/ideas.js                    three ideaConfigs: grade, companion, upskill
lib/prompts.js                  shared system prompt + grade-propose, companion-gap, upskill-coach
lib/pipeline.js                 runPipeline(ideaConfig, input, ui)
lib/logshape.js                 pure functions that build log records and assert they contain no raw values (used by server and tests)
server/adapter.js               callProvider(): ladder, retry once per rung, call cap 150, SHA-256 cache, labels from API-returned id, structured-output or tool-use mode
server/log.js                   appendJsonl(), readJsonl(); refuses records that fail logshape
server/server.js                node:http: static files from public/ and data/ (never *.eval.json), POST /propose, POST /log, GET /counts
scripts/smoke-g0.js             G0: one schema-valid call on the exact model, writes local/smoke.json, prints model id and usage
public/index.html               shell: three tabs (Student, Academic Staff, Teacher and TA), spine card, honest limit, model label line
public/styles.css               large readable text, visible focus rings, no colour-only status
public/components.js            GatePanel, ReviewCard, QueueList, DecisionBar, ReceiptPanel, DecisionLog
public/app.js                   mounts the core loop: grade idea, QueueList over S-01..S-25, runPipeline with the components as ui hooks
tests/seeds.test.js             T30, dictionary QA
tests/gate.test.js              T01..T09, T06, T11, T12
tests/engine.test.js            T10, T13..T20, T23
tests/schema.test.js            proposal validator accepts/rejects
tests/pipeline.test.js          G1 headless loop with fake fetch and scripted ui hooks
tests/adapter.test.js           T28, T29 with injected fetch
tests/server.test.js            T21 eval never served, T22 no-submit path, 422 on unclean payload
tests/a11y.md                   T24..T26 manual checklist, see section 5
```

---

## 4. Module tasks, in dependency order

### 4.1 Seeds (`data/`)

Inputs: spec section 8. Outputs: the JSON files above. All synthetic. Conventions: emails `@example.org`, phones `555-01xx`, student IDs 9 digits starting `9001`, NetIDs `demo-xxxxxx`. QA: no roster or dictionary name may match Kishore, Rineetha, Partiban, Xinyan, or any part of their names (test).

**course.json**
- `course`: DEMO-STATS 101, Intro Statistics, Fall 2026.
- `roster`: 25 entries `{ alias: "S-01".."S-25", name, netid, email, studentId }`. **Core choice:** roster index n is the alias S-nn and is the author of submission S-nn, so the alias the TA sees is the queue id.
- `dictionary`: non-student known names with fixed aliases, e.g. `{ name: "Dana Whitcombe", alias: "PERSON-1" }`. R-09 replaces from roster and dictionary.
- `glossary`: capitalised multi-token terms that are not names: "Standard Deviation", "Sample Standard Deviation", "Intro Statistics", "Fall 2026", "DEMO-STATS 101", "Quiz 5", "Problem Set 3", "Practice Q2", "Ch. 3 Notes", month and weekday names, "PM", "AM". R-11 skips these.
- `aiRules`: `[{ item: "Practice Q2", rule: "Check my answer allowed" }, { item: "Problem Set 3", rule: "Locked by course AI rule" }]`.

**grade-q5.v1.0.json**
```json
{ "id": "grade-q5", "version": "1.0", "owner": "instructor", "status": "approved", "max": 10,
  "question": "Quiz scores: 4, 6, 8, 10, 12. Find the sample standard deviation. Show your work.",
  "correctAnswer": 3.162, "tolerance": 0.01,
  "codes": [ {"code":"E-VAR-SD","deduction":-3,"label":"Reported variance as SD"},
             {"code":"E-N-DENOM","deduction":-2,"label":"Divided by n instead of n-1"},
             {"code":"E-MEAN","deduction":-2,"label":"Mean wrong"},
             {"code":"E-ARITH","deduction":-1,"label":"Arithmetic slip"},
             {"code":"M-UNLISTED","deduction":-2,"label":"Correct, method not in table"},
             {"code":"OK","deduction":0,"label":"No error"},
             {"code":"UNSURE","deduction":0,"label":"Needs instructor"} ],
  "methods": [ {"id":"M1","label":"Definitional formula","signature":"<regex matching squared deviations from the mean, e.g. \\(\\s*\\d+\\s*-\\s*8\\s*\\)\\s*\\^?\\s*2 or 'deviation'>" } ] }
```
M2 (computational formula, sum of x squared minus (sum of x) squared over n) is deliberately absent from v1.0. Do not add it.

**grade-q5.submissions.json**, 25 items, distribution exactly: E-VAR-SD (final answer 10) x10, E-N-DENOM (about 2.83) x4, E-ARITH x2, valid M2 correct x3 including S-07, correct M1 x6. Correct worked values that must appear in correct papers: sum 40, mean 8, sum of squared deviations 40, sample variance 10, SD sqrt(10) about 3.162. M2 papers show 360, 320, (360-320)/4 = 10, sqrt(10). The values 288, 9, and 3 must not appear anywhere. S-12: one step contains a roster name verbatim (the gate probe), e.g. a step reading "Checked with <roster name of S-04>, mean is 8." Each item has `header: { name, netid, email, timestamp, filename }` so A-01 has fields to drop.

**grade-q5.submissions.eval.json**: `{ "S-01": { "planted": "E-VAR-SD" }, ..., "S-07": { "planted": "OK", "method": "M2" }, "S-12": { "planted": "...", "gateProbe": true } }`. Tests only.

**companion-ch3.json**: `source` paragraphs (variance is the average squared distance from the mean, in squared units; SD is the square root of variance; SD is easier to interpret because it is in original units; filler on range and IQR). `q2`: prompt "Explain variance vs SD and why we usually report one." `keyPoints`: KP-1 square-root relation, KP-2 squared vs original units, KP-3 easier to interpret, each with `sourceLine` that is an exact substring of `source`. `demoWrongAnswer`: a "spread and easier to use" answer that lacks KP-1 and KP-2. `retestQ3`: `{ prompt: "Variance is 16 cm squared. What is the SD?", expected: 4, tolerance: 0.01, requiredUnit: "cm", forbiddenUnits: ["cm squared","cm^2","cm²"], forbiddenValues: [16] }`.

**upskill-dana-task.json**: `text` is a pasted email that must contain exactly: 2 header lines starting `From:` and `Sent:` (Sent: Thu, Oct 29), 3 names (Dana Whitcombe from the dictionary, one roster student name, one honorific name such as "Prof. <Capitalised Surname>"), 1 email at example.org, 1 student ID 9001xxxxx, 1 phone 555-01xx, 1 internal ID. **Core choice** for the internal ID seed format: `REQ-` followed by 5 digits; R-06 matches that pattern. `facts`: `{ day: "Wed", date: "Nov 4", time: "6:00 to 7:00 PM", room: "B-101", topic: "Variance vs standard deviation" }`. Gate test asserts the counts above; the demo narrates whatever the code shows.

**upskill-email.v1.0.json**: `{ id: "upskill-email", version: "1.0", owner: "staff lead", status: "approved", max: 0, codes: [P-GOAL, P-AUDIENCE, P-FACTS, P-FORMAT, P-SENSITIVE, P-CHECK, C-DATE-TIME, C-ROOM, C-NO-PRIVATE-INFO, C-TONE, C-NO-NEW-CLAIMS] }`, all deduction 0, labels in plain words.

Example: `JSON.parse(read("data/grade-q5.submissions.json")).find(s => s.id === "S-07").finalAnswer` is `3.162` and its steps contain `360` and `320` and no `(` `- 8` `)^2` pattern, so M1's signature does not match.

### 4.2 Local Privacy Gate (`lib/gate.js`)

Inputs: `input` (one seed item), `ideaConfig.allowlistFields`, `course.roster`, `course.dictionary`, `course.glossary`, optional `humanPicks` (R-11 answers). Outputs: `{ payload, aliasMap, report, flags, blocked }`.
- `payload`: only allowlisted fields, with identifiers replaced by alias tokens. This is the only thing that may leave the machine.
- `aliasMap`: `{ "S-04": "<original>", "EMAIL-1": "<original>" }`. Returned to the caller, held in browser memory, never passed to `fetch`, never logged. Responses are re-mapped locally with it before display.
- `report`: `{ droppedFields: n, counts: { EMAIL: 1, PHONE: 1, STUDENT_ID: 1, NETID: 0, EMPLOYEE_ID: 0, INTERNAL_ID: 1, ADDRESS: 0, URL: 0, NAME: 3, HEADER_LINE: 2 }, blockedRules: ["R-11"] }`. Types and counts only.
- `flags`: R-11 candidates `[{ token: "Elena Marsh", rule: "R-11" }]`. Values appear here only, for the local GatePanel, never in payload or logs.
- `blocked`: true if any R-11 flag is unresolved or any R-12 hit.

Rules, applied in this order on each allowlisted string field:
- A-01 field allowlist: copy only `ideaConfig.allowlistFields` (grade: `steps`, `finalAnswer`; companion: `answer`; upskill: `text`, `facts`, `draft`). Everything else, including `header`, is dropped and counted in `droppedFields`.
- R-13 HEADER_LINE: drop any line whose first token is `From:`, `To:`, `Cc:`, `Sent:`, `Subject:`. Count.
- R-01 EMAIL: `\b[\w.+-]+@[\w-]+\.[\w.-]+\b` → `EMAIL-n`.
- R-02 PHONE: `\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b` and `\(\d{3}\)\s?\d{3}-\d{4}` → `PHONE-n`.
- R-03 STUDENT_ID: `\b9001\d{5}\b` (seed convention) → `SID-n`.
- R-04 NETID: `\bdemo-[a-z0-9]{6}\b` → `NETID-n`.
- R-05 EMPLOYEE_ID: **core choice** `\bEMP-\d{5}\b` → `EMPID-n`.
- R-06 INTERNAL_ID: **core choice** `\bREQ-\d{5}\b` → `INTID-n`.
- R-07 ADDRESS: `\b\d{1,5}\s+[A-Z][a-z]+(\s[A-Z][a-z]+)*\s(St|Street|Ave|Avenue|Rd|Road|Dr|Drive|Ln|Lane|Blvd)\b\.?` → `ADDR-n`.
- R-08 URL: `\bhttps?://\S+|\bwww\.\S+` → `URL-n`.
- R-09 NAME from roster and dictionary: exact, case-sensitive full-name match → that entry's alias (`S-nn` or `PERSON-n`).
- R-10 NAME, honorific plus capitalised name: `\b(Dr|Prof|Professor|Mr|Mrs|Ms|Mx)\.?\s+[A-Z][a-z]+(\s+[A-Z][a-z]+)?` → `PERSON-n`, numbering continues after dictionary aliases.
- R-11 possible NAME: two or more consecutive `[A-Z][a-z]+` tokens, not in glossary, not already aliased. BLOCK: added to `flags`; `blocked = true` until `humanPicks[token]` is `"name"` (then → `PERSON-n`) or `"not-name"` (then left as is). The flagged token is shown in the GatePanel only. Never in payload while pending, never in any log.
- R-12 DOB: `\b(0?[1-9]|1[0-2])/(0?[1-9]|[12]\d|3[01])/(19|20)\d{2}\b` and `\b(19|20)\d{2}-\d{2}-\d{2}\b` → BLOCK, no human override in the core.
- Alias numbering is per type, per gate run, in order of first appearance.

`assertClean(payload)`: re-runs R-01 to R-12 (R-09 and R-11 included, using roster and dictionary loaded server-side from `data/course.json`) over every string in the payload. Any hit → throws `{ status: 422, code: "BLOCKED", rule, count }`. The server returns 422 with that body minus any value, sends nothing to the provider, and appends to `blocked.jsonl`.

Honest limit, as a constant string exported from `gate.js` and shown in GatePanel and README: "Deterministic rules cannot guarantee 100 percent removal of an unknown name hidden in arbitrary free text. Inputs are structured and seeded, fields are allowlisted, known patterns are replaced, and you review the before and after payload before any send. On any uncertainty the send is blocked."

Example: the S-12 step `"Checked with Priya Raman, mean is 8."` (name taken from roster S-04) → payload step `"Checked with S-04, mean is 8."`, `aliasMap["S-04"] = "Priya Raman"`, `report.counts.NAME = 1`, `report.droppedFields = 5` (name, netid, email, timestamp, filename). Running the Dana task yields `HEADER_LINE 2, NAME 3, EMAIL 1, STUDENT_ID 1, PHONE 1, INTERNAL_ID 1` with the honorific name landing on R-10 and the other two on R-09.

### 4.3 Proposal schema (`lib/schema.js`)

**Core choice** given the Zod conflict (section 8, item 6): a hand-written validator, so the no-build branch stays at zero dependencies. If Kishore approves Zod instead, this file becomes a thin wrapper and the tests stay the same.

Shape the model must return, and the only shape that counts:
```json
{ "proposals": [ { "code": "E-VAR-SD", "quote": "SD = 10", "confidence": 0.82 } ] }
```
- `proposals`: array, 0 to 6 items.
- `code`: string in `ideaConfig.allowedCodes`.
- `quote`: non-empty string, at most 300 characters.
- `confidence`: number, 0 to 1 inclusive.
- Upskill only, **core choice**: optional `suggestion` string, at most 300 characters, display-only text for one edit the staff member may accept or ignore. It never feeds a number or a decision.
- Any other key, any number elsewhere, any grade, total, or final answer: reject the whole response as `SCHEMA_INVALID`.

Example: `validateProposal({ proposals: [{ code: "E-TYPO", quote: "x", confidence: 0.5 }] }, grade)` → `{ ok: false, errors: ["proposals[0].code E-TYPO not in allowlist"] }`.

### 4.4 Deterministic Rules Engine (`lib/engine.js`)

All pure functions. The model never redacts, computes, grades, writes a final answer, or validates a method. Every rule-originated candidate carries `source: "Rule"`; every model candidate carries `source: "AI"`.

- `validateStandards(table)` → `{ ok, errors }`. Requires: `id`, `version`, `owner`, `status === "approved"`, numeric `max >= 0`, unique codes, every deduction a number `<= 0`, `OK` and `UNSURE` present with deduction 0, every method has `id`, `label`, and a compilable `signature`. Called before any use of a table; the pipeline refuses to start on `ok: false`. Example: a table missing `UNSURE` → `{ ok: false, errors: ["code UNSURE missing"] }`.
- `validateCodes(codes, table)` → `{ accepted: [], rejected: [] }`. Example: `["E-VAR-SD", "E-TYPO"]` → accepted `["E-VAR-SD"]`, rejected `["E-TYPO"]`.
- `verifyQuote(quote, sourceText)` → `{ found: boolean, index }`. Both sides pass through `normalize()` (collapse whitespace, curly quotes to straight, trim). Then exact `indexOf`. Not found → the card shows "not found in source" and the item is `unverified`, never trusted. Example: quote `"SD = 10"` vs step `"SD  = 10"` → found; quote `"variance = 9"` vs any seed step → not found.
- `score(confirmedCodes, table)` → `clamp(max + sum(deduction of each confirmed code), 0, max)`. Input is the human-confirmed list only; proposals never reach this function. Example: `["E-VAR-SD"]` → 7; `["E-VAR-SD","E-N-DENOM","E-MEAN","E-ARITH","M-UNLISTED"]` → 0 (clamped from 0, no negative).
- `methodSignatures(steps, finalAnswer, table)` → R-M1: if `|finalAnswer - correctAnswer| <= tolerance` and no `methods[].signature` matches the joined steps, return `[{ code: "M-UNLISTED", quote: <first step>, confidence: 1, source: "Rule" }]`, else `[]`. Example: S-07 → one M-UNLISTED candidate; a correct M1 paper → `[]`. This guarantees the S-07 correction moment without any model mistake.
- `answerCheck(finalAnswer, table)` → candidates with `source: "Rule"`: `|x - 10| <= 0.05` → E-VAR-SD; `|x - 2.83| <= 0.01` → E-N-DENOM (sqrt(40/5) = 2.828). Example: `10` → E-VAR-SD; `3.162` → `[]`.
- `factsCheck(draftText, facts)` → list of `{ detail, message: "Detail not in your facts" }` for every time (`\d{1,2}(:\d{2})?\s?(AM|PM)`), date (`(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\w*,?\s+\w+\s+\d{1,2}` or `\b(Jan|Feb|...|Dec)\w*\s+\d{1,2}\b`), room (`\b[A-Z]-?\d{3}\b`), and standalone number in the draft that does not appear in the joined facts values after `normalize()`. Example: draft "Thursday, Nov 5 at 7:30 PM in B-102" vs the seeded facts → three details flagged; "Wed, Nov 4, 6:00 to 7:00 PM, B-101" → none.
- `retest(answerText, retestSpec)` → `{ pass, reasons }`. Parse the first number; fail if absent, if `|n - expected| > tolerance`, if any `forbiddenUnits` substring appears (case-insensitive), if any `forbiddenValues` appears as a standalone number, or if `requiredUnit` is missing. Example: `"4 cm"` → pass; `"16 cm"` → fail (value 16 forbidden, not within tolerance); `"4 cm squared"` → fail (forbidden unit).
- `keyPoints(proposals, companionSeed)` → R-KP: for each proposal with code KP-n, run `verifyQuote(quote, source)`. Verified → `{ code, status: "missing", sourceLine: quote, verified: true }`. Not verified → `{ code, status: "missing", sourceLine: null, verified: false, message: "Not found in source: I will not guess" }`. Only missing points are ever shown; no final answer text is produced. Example: a KP-1 proposal quoting the exact SD-is-the-square-root sentence → verified; quoting an invented sentence → "Not found in source: I will not guess".
- `analytics(decisions)` → per code `{ proposed, confirmed, overridden }` from `decisions.jsonl` records only. Example: 3 decisions where E-VAR-SD was proposed 3 times and confirmed twice → `{ "E-VAR-SD": { proposed: 3, confirmed: 2, overridden: 1 } }`.
- `counters(logs)` → `{ proposed, confirmed, overridden, quotesVerified, quotesNotFound, piiStripped: { EMAIL: n, ... }, decisionsByHuman: n }` from `proposals.jsonl`, `decisions.jsonl`, `gate.jsonl`. Every on-screen number calls this; no literal numbers in `public/`.

### 4.5 Ideas and prompts (`lib/ideas.js`, `lib/prompts.js`)

Three ideaConfigs:
- `grade`: allowlist `steps, finalAnswer`; standards `grade-q5.v1.0.json`; prompt `grade-propose`; rule candidates `methodSignatures, answerCheck`; verify quotes against the joined redacted `steps`; receipt "Assigned by you (TA)"; `requiresGradeInput: true`.
- `companion`: allowlist `answer`; standards: codes KP-1, KP-2, KP-3 built from `companion-ch3.json` (max 0); prompt `companion-gap`; rule `keyPoints`; verify quotes against `source`; receipt "Fixed by you"; `lockRule`: refuse to run when the item's course AI rule is "Locked by course AI rule" (T23, enforced in `runPipeline` before stage 1).
- `upskill`: allowlist `text, facts, draft`; standards `upskill-email.v1.0.json`; prompt `upskill-coach`; rule `factsCheck`; verify quotes against `draft`; receipt "Approved by you"; `requiresReviewedAllCheckbox: true`.

Prompts: one shared system prompt stating in plain words: respond only in the JSON shape of 4.3; use only the listed codes; `quote` must be copied exactly from the provided text; never compute, never total, never assign points or grades, never write an answer, never redact; input text contains alias tokens like S-04 and EMAIL-1, leave them as they are. Three short task prompts add the code list with labels and the text fields. Prompts contain no numbers from the standards table except the code labels.

### 4.6 Provider adapter (`server/adapter.js`)

Inputs: `{ idea, payload, promptName }` after `assertClean`, plus env, plus `fetchImpl` (injectable for tests). Output: `{ ok, proposals, label, modelId, rung, cacheHit, usage }` or `{ ok: false, error, rung, attempts }`.

Behaviour, in order:
1. Refuse if `local/smoke.json` is absent or `smoke.json.ok !== true`, with error `"Run scripts/smoke-g0.js first (gate G0)"`. Exception: `REPLAY_MODE=1` goes straight to rung 4.
2. Call cap: read `local/calls.json` `{ count }`; if `count >= 150`, refuse with error `"Call cap 150 reached; verify spend before raising"`. Increment on every real network attempt, before the attempt.
3. Cache: key `sha256(JSON.stringify({ modelId, systemPrompt, promptName, payload }))`; hit → return cached with `cacheHit: true` and the cached label. Cache is in `local/cache/`.
4. Ladder, in order, each rung tried at most twice (one retry), never silently substituted; every rung change is written into the returned `rung` and `label`:
   1. `MODEL_DEMO` (the Sonnet 5.5 id as verified at G0) when `NODE_ENV !== "development"`; `MODEL_DEV` (Haiku 5.5 id) in dev loops. The spec names these tiers; the ids come from env, never from a literal in code.
   2. `MODEL_DEV` on the same adapter and key. Caveat printed in the label detail: "same key, account, and billing as rung 1; covers model failure only".
   3. Gemini 2.5 Flash paid tier only if `GEMINI_API_KEY` is set and `GEMINI_TIER === "paid"`. Otherwise this rung is skipped and recorded as `"rung 3 not configured"`. Never free tier.
   4. Replay: look up the cache by key; hit → return with `label: "CACHED REHEARSAL: NOT LIVE MODEL OUTPUT"`; miss → `ok: false`.
5. Request mode from `smoke.json.mode`: `"structured"` (JSON schema output) or `"tool"` (a single tool named `propose` whose input schema is 4.3). Response is parsed then passed through `validateProposal` either way; invalid → counts as a failed attempt on that rung.
6. Label: `"LIVE API: " + response.model` using the model id string returned by the API, never the env value. The page shows this label verbatim.
7. Request wire format (endpoint, headers, body) is taken from the official Anthropic docs at implementation time, not from this file. See section 8, item 10.
8. Usage from the response (`input_tokens`, `output_tokens` if present) is appended to `proposals.jsonl` for the price check.

Example: two identical `/propose` requests for S-01 → first returns `cacheHit: false, label: "LIVE API: <id from response>"` and increments `calls.json` to 1; second returns `cacheHit: true`, same label, `calls.json` stays 1.

### 4.7 Smoke gate G0 (`scripts/smoke-g0.js`)

Inputs: env `ANTHROPIC_API_KEY`, `MODEL_DEMO`; `data/grade-q5.submissions.json` S-01 passed through `runGate` then `assertClean`. Steps: try structured-output mode once; on schema-valid result write `local/smoke.json = { ok: true, mode: "structured", modelId: response.model, usage, at }`; else try tool mode once and write `mode: "tool"`; else write `ok: false` with the error class and exit 1. Print: model id returned, mode, usage tokens, and the sentence "Billing check: open the provider console and confirm spend before rehearsal (team item)". Never prints the key. Counts against the call cap.

Example output on success:
```
G0 PASS  model=<returned id>  mode=structured  in=<n> out=<n>
Billing check: open the provider console and confirm spend before rehearsal (team item)
```

### 4.8 Server (`server/server.js`, `server/log.js`)

Routes, and only these:
- `GET /*`: static from `public/` and `data/`; any path ending `.eval.json` → 404, always.
- `POST /propose` body `{ idea, payload, promptName }`: `assertClean` → 422 `{ code: "BLOCKED", rule, count }` and append `blocked.jsonl`; else adapter → 200 `{ proposals, label, modelId, rung, cacheHit }` and append `proposals.jsonl` with `{ ts, idea, itemId, label, modelId, rung, cacheHit, proposals: [{ code, confidence }], usage }` (no quotes stored).
- `POST /log` body one record for `gate.jsonl` or `decisions.jsonl`: validated by `lib/logshape.js` (allowed keys only; rejects any key named `aliasMap`, any string that matches R-01 to R-08, any key from `header`); append.
- `GET /counts`: `counters(readAll())`.

No other outbound network call exists in the server except the adapter's provider call. No route named or behaving like submit, export to LMS, or write-back.

### 4.9 Pipeline (`lib/pipeline.js`)

`runPipeline(ideaConfig, input, ui, deps)`; `deps = { fetchImpl, now }` for tests.
1. If `ideaConfig.lockRule` applies to `input` → return `{ locked: true, message: "Locked by course AI rule" }`, nothing else runs.
2. `validateStandards` → refuse on error.
3. `runGate` → `await ui.approveGate(report, flags)`; while `blocked`, `await ui.resolveFlags(flags)` and re-run; approval returns `true` to continue, `false` to stop with `{ stopped: "gate" }`. Append `gate.jsonl` via `POST /log` (report only).
4. `POST /propose` with `payload` only. 422 → `{ stopped: "blocked" }` and show in GatePanel.
5. Engine: `validateCodes` on model codes; `verifyQuote` of each quote against `payload[verifyAgainst]`; add rule candidates; re-map alias tokens to originals for display using `aliasMap` in memory; build `card = { items: [{ code, quote, confidence, source: "AI"|"Rule", verified }], label }`.
6. `await ui.review(card)` → `{ confirmed: [codes], overrides: [{ from, to, reason }] }`; every item must be confirmed, changed, or overridden; an override with empty `reason` is rejected by the pipeline.
7. `await ui.decide({ computedScore, requiresGradeInput, requiresReviewedAllCheckbox })` → `{ decidedBy, grade?, reviewedAll? }`; `decidedBy` non-empty required.
8. Append `decisions.jsonl` `{ ts, idea, itemId, decidedBy, confirmed, overrides, computedScore, grade, receipt }`. Return `{ receipt: ideaConfig.receiptText, decidedBy, counts: await GET /counts }`.

Example (headless test): grade S-07, fake fetch returns `{ proposals: [{ code: "E-ARITH", quote: "<first step>", confidence: 0.4 }] }`; card holds that AI item plus the Rule item M-UNLISTED; scripted review overrides both to OK with reason "Valid computational formula, M2 not yet in v1.0"; decide `{ decidedBy: "Test TA", grade: 10 }`; result receipt "Assigned by you (TA)", `computedScore` 10, decisions log has one record with two overrides.

### 4.10 Shared components and shell (`public/`)

- `GatePanel(report, flags, { onPick, onApprove, onCancel })`: table of types and counts before and after, dropped-field count, the honest limit text, one row per R-11 flag with buttons "Mark as name" and "Not a name", Approve button disabled while `blocked`, text "Approve and send alias-only payload".
- `ReviewCard(card, { onChange })`: one row per item: code and label, quote, confidence as text, source "AI" or "Rule", status text "verified" or "not found in source", controls: Confirm, Change type (select of allowlist codes), Override to no error, Reason textbox (required on change or override).
- `QueueList(items, { onSelect })`: one button per item with id and status (pending or decided); no select-all, no bulk action.
- `DecisionBar({ computedScore, requiresGradeInput, requiresReviewedAllCheckbox }, { onDecide })`: name input "Decided by", grade input when required, checkbox "I reviewed every change" when required, Confirm disabled until required fields are filled.
- `ReceiptPanel({ receipt, decidedBy, label })`: receipt text, decided-by name, the model label line verbatim.
- `DecisionLog(entries)`: list of decision records (id, decidedBy, confirmed codes, overrides count), from `GET /counts` data.
- `index.html`: spine card with the four stages in plain words; tabs Student, Academic Staff, Teacher and TA, each a landmark with a mount point and the text "Journey built on this core by <owner from work split>"; the Teacher and TA tab mounts the core loop (`app.js`) as the G1 proof: QueueList of S-01..S-25, then GatePanel, ReviewCard, DecisionBar, ReceiptPanel, DecisionLog in order. The model label line is always visible.
- All interactive elements reachable by Tab in reading order; status never by colour alone; base font at least 18px.

---

## 5. Tests, with expected results

Runner: `node --test tests/` via `npm test`. No runner exists in the folder today; this handoff creates it. Each test lists its spec id. Adapter and pipeline tests inject a fake `fetchImpl`; no test makes a network call; no test depends on the model making a mistake.

| Id | File | Assertion | Expected |
|---|---|---|---|
| T01-T08 | gate.test.js | each pattern R-01..R-08 on a one-line probe | one alias token, count 1 for that type, original absent from payload |
| T09 | gate.test.js | A-01 on S-01 | payload keys exactly `steps, finalAnswer`; `droppedFields` 5 |
| T06 | gate.test.js | known limit: `"i asked maya for help"` | payload unchanged, NAME count 0; test title says "documented limit" |
| T11 | gate.test.js | S-12 and the Dana task: planted roster name and email | neither string appears in payload, in `report`, or in any JSONL record built by `logshape`; counts show types only |
| T12 | gate.test.js | approve vs block | approve: payload sent equals gate payload; block (unresolved R-11 or R-12): `fetchImpl` called 0 times, `blocked.jsonl` record built |
| T-gate-dana | gate.test.js | Dana task counts | HEADER_LINE 2, NAME 3, EMAIL 1, STUDENT_ID 1, PHONE 1, INTERNAL_ID 1 |
| T10 | engine.test.js | validateCodes | `E-TYPO` rejected, `E-VAR-SD` accepted |
| T13 | engine.test.js | verifyQuote fake line | `found: false`; curly quotes and double spaces still match |
| T14 | engine.test.js | score | `[E-VAR-SD]` → 7; all five deductions → 0; proposals-only input is not a parameter |
| T15 | engine.test.js | methodSignatures R-M1 | S-07 → M-UNLISTED with source "Rule"; a correct M1 paper → `[]` |
| T16 | engine.test.js | answerCheck | 10 → E-VAR-SD; 2.83 → E-N-DENOM; 3.162 → `[]` |
| T17 | engine.test.js | keyPoints R-KP | verified KP-1 shown with its source line; invented quote → "Not found in source: I will not guess" |
| T18 | engine.test.js | retest | "4 cm" pass; "16 cm" fail; "4 cm squared" fail |
| T19 | engine.test.js | factsCheck | "7:30 PM" and "B-102" flagged; seeded facts → none |
| T20 | engine.test.js | validateStandards | v1.0 ok; table missing UNSURE fails; deduction +1 fails |
| T21 | server.test.js | eval never served | `GET /data/grade-q5.submissions.eval.json` → 404; `public/` contains no string `eval.json` |
| T22b | server.test.js | public-repo hygiene | `git ls-files` contains nothing under `local/`, no `.env*`, and no file whose content matches `sk-[A-Za-z0-9]` |
| T22 | server.test.js | no-submission path | every `fetch(` literal in `public/` and `lib/` targets `/propose`, `/log`, or `/counts`; no source file contains `canvas` (case-insensitive) or `gradebook`; server route list is exactly the four in 4.8 |
| T23 | engine.test.js | course lock | companion item "Problem Set 3" → `{ locked: true }` before gate runs; "Practice Q2" runs |
| T28 | adapter.test.js | model honesty | fake response `model: "fake-model-x"` → label `"LIVE API: fake-model-x"` regardless of env; replay → `"CACHED REHEARSAL: NOT LIVE MODEL OUTPUT"` |
| T29 | adapter.test.js | spend guard | `calls.json` at 150 → refused, `fetchImpl` not called; same payload twice → one fetch; missing `smoke.json` → refused |
| T30 | seeds.test.js | seeds sanity | S-07 and every correct paper: 320, 10, 3.162 present; no 288, 9-as-variance, or 3-as-SD; distribution 10/4/2/3/6 from eval file; S-07 method M2; S-12 `gateProbe` and contains a roster name; no roster or dictionary name matches a teammate name |
| G1 | pipeline.test.js | headless full loop (4.9 example) | receipt "Assigned by you (TA)", one decisions record, two overrides each with a reason, `counters().overridden === 2` |
| schema | schema.test.js | validator | extra key rejected; confidence 1.2 rejected; code not in allowlist rejected; valid shape accepted |

Manual checks, recorded in `tests/a11y.md` and in the final report as done or not done, with what was observed:
- T24 keyboard-only: Tab through QueueList → GatePanel → ReviewCard → DecisionBar → ReceiptPanel in order; every control operable with Enter or Space.
- T25 grayscale: with macOS grayscale filter on, "verified" vs "not found in source" and "AI" vs "Rule" are readable as text.
- T26 read-aloud order: VoiceOver reads the four spine stages, then the queue, then the card, in that order.

Commands:
```
npm test                       # all node --test suites
node --test tests/gate.test.js # one suite
node scripts/smoke-g0.js       # G0, needs env set by the key holder; counts as 1 call
npm run dev                    # node server/server.js, then open the printed local URL
```

---

## 6. Acceptance criteria, measurable

1. `npm test` exits 0 and the output lists every test id in section 5 as passing. Paste the output.
2. `npm run dev`, open the page, pick S-07 in the queue, approve the gate, review, override M-UNLISTED to OK with a reason, enter a grade, decide as a named person: ReceiptPanel shows "Assigned by you (TA)" and the name; DecisionLog shows 1 record; `local/decisions.jsonl` has 1 line with that reason. If G0 has not passed, run with `REPLAY_MODE=1` and a seeded cache file, and the label line must read "CACHED REHEARSAL: NOT LIVE MODEL OUTPUT".
3. `POST /propose` with a payload containing `test@example.org` returns 422 `{ code: "BLOCKED" }`, `fetchImpl` is not called, `local/blocked.jsonl` gains one line, and no line in `local/` contains `example.org`.
4. A model quote not present in the redacted text renders the text "not found in source" on the card and is excluded from `confirmed` unless the human picks it explicitly.
5. `score` is called only from the pipeline's step 8 with the human-confirmed list; grep shows no other caller.
6. T22 passes: no submit, Canvas, or gradebook path exists.
7. Repo has `.gitignore` covering `local/` and `.env*`; `git status` shows no file under `local/`; no key string in any tracked file; remote `origin` points at the team repo in section 2 and `main` from it is merged in.
8. Zero entries in `package.json` dependencies and devDependencies.

---

## 7. What NOT to do

- No Student, Staff, or Teacher/TA journey in full. The Teacher and TA tab hosts only the core loop as the G1 proof; GR-01 rubric UI, GR-04 insights, ST-01..ST-04, PR-00..PR-04 belong to their owners.
- No demo video, captions, public link, or submission.
- No scope-out items: multi-course, analytics exports, notifications, gradebook write-back, Canvas auto-ingest, Canvas auto-submit, photo or OCR, local LLM claims, Aid, Hearing Ledger, advanced RAG, background observation, any feature without an on-screen number or decision, any feature needing real data.
- No real student, employee, or company personal data. No roster name that matches a teammate.
- No illustrative number anywhere in `public/`; every count comes from `counters()`.
- No invented price, key, model id literal, repo URL, or team decision. Model ids come from env; the on-screen label comes from the API response.
- No Zod or any other dependency unless Kishore decides item 6 in section 8 the other way.
- No change to the standards table deductions, to M2's absence in v1.0, to the Q5 values, or to any gate or engine rule.
- No "local" claim for cloud output, no "no training on your data" claim, no sponsorship wording, anywhere in README or UI.
- No commit, no push, until Kishore says so in the implementing session.

---

## 8. Open items for Kishore and the team, not for the implementer to invent

1. **Key holder.** Who holds the working Claude API key, and where it is set as `ANTHROPIC_API_KEY` on the demo machine. Unconfirmed at spec time. G0 cannot run without it.
2. **Exact model ids.** Spec expectation is `claude-sonnet-5-5` and `claude-haiku-5-5`, explicitly unverified. Verify against the official Anthropic docs and a live G0 call, then set `MODEL_DEMO` and `MODEL_DEV`. The code never hardcodes them.
3. **Price check vs the ~$10 budget**, after G0, from `local/smoke.json` usage and `proposals.jsonl` usage times the spec's sourced prices (Sonnet 5.5 $2 in / $10 out per million tokens; Haiku 5.5 $0.10 / $0.50). The rehearsal cost figures in the spec are labelled unsourced estimates. The provider console check is a human step.
4. **Optional Gemini key** for rung 3, with `GEMINI_TIER=paid`. Without it, rung 3 is recorded as not configured and rung 4 is the only real backup.
5. **Stack confirmation.** Zero-setup rule applied to this folder selects the no-build branch (nothing runs here; Node 26 present). Say so if the team already has a Next.js app running elsewhere tonight, because that would flip the branch.
6. **Spec conflict to resolve:** section 9 says "Zod validation either way"; section 10 says the no-build branch is "zero dependencies" with "no new toolchain tonight". This handoff proposes a hand-written validator with identical checks (4.3). Approve that, or approve Zod as the single dependency.
7. **Final product name.** Working title GuruAI stays in code and docs until the team decides.
8. **Team opening sentence** for the video. Not part of the core; listed so it is not forgotten.
9. **Clock times, sleep shifts, pivot times** for phases and gates.
10. **Anthropic API wire format** (endpoint, headers, structured output or tool use request shape) must come from the official docs at implementation time. This handoff does not restate it, by constraint. If the docs and the spec's expected ids disagree, record it, do not guess.
11. **GitHub repo, resolved:** https://github.com/Partiban98/Dartmouth-AI-70-hackathon (given by Kishore, Oct 30, 2026). Two discrepancies to settle, not decided here: (a) the work split says Kishore creates the repo and reviews and merges everything, but Partiban98 owns this one, so the "no direct core changes without Kishore" rule needs either branch protection on `main` set by the owner or an explicit team agreement; (b) only three collaborators were visible (kishoretheeraj, Partiban98, xinyan0913), so Rineetha needs to be added by the owner before she can pull and branch. Her GitHub handle is not known here.
12. **Seed conventions chosen by core, adjustable, not blocking:** employee id `EMP-nnnnn`, internal id `REQ-nnnnn`, alias token spellings in 4.2, env var names in section 2, roster alias S-nn doubling as submission id, upskill `suggestion` field in 4.3.

---

## 9. Risks

- **Shared key and billing.** Rungs 1 and 2 share one key, account, and billing. Rung 2 covers a model-specific failure only; an account or billing failure skips straight to rung 3 (if configured) or rung 4 replay.
- **Structured output at G0.** If structured output is not available or not schema-valid on the exact model, G0 falls back to tool use. Both paths go through `validateProposal`. If both fail, G0 writes `ok: false`, the adapter refuses live calls, and the team runs the labelled replay ladder, never a silent substitution.
- **Known gate limit.** A lowercase non-roster name, or any unknown name not matching R-09 to R-11, is not caught (T06). Stated on screen and in README. Mitigations are structural: allowlisted fields, seeded structured inputs, before and after human approval, fail-closed on R-11 and R-12.
- **Data-use terms unchecked.** The video and README must not claim "no training on your data". The Privacy Gate is the primary protection.
- **G0 dependency.** Until items 1 and 2 are closed, the adapter refuses live calls by design, so the full loop is proven headless (G1 test) and via `REPLAY_MODE=1` only. This is the honest state, not a bug.
- **Alias collision.** Roster alias S-nn equals the submission id. If a teammate finds this confusing in the TA card, it is one data change in `course.json`, not a rule change.
- **Call cap.** 150 is shared across dev loops, G0, and rehearsals. Raise it only after the price check (item 3), by editing `local/calls.json`, never by changing the constant without a team decision.
