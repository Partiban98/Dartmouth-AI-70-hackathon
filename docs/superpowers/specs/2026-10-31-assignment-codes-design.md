# Assignment codes: one head TA sets the scheme, every TA grades under it

Status: design and plan, written Oct 31, 2026 ~04:50 ET for a fresh session. Not built. Core (`lib/`) unchanged.

## Why

Grading is a team job. Today each laptop has its own scheme and sets. Kishore's idea: like a join code, one TA creates the assignment (question, marking scheme), shares a code, and every TA grades their own stack under the same scheme on their own laptop. Every mark lands under the assignment without a student name; laptop ids link papers to the laptop that added them, and only that laptop can put names back.

Real-world anchors (checked Oct 31): Gradescope joins staff to a course with a randomly generated entry code and lets TAs edit the rubric only when the instructor allows it; grading teams norm by scoring the same few sample papers independently, then comparing and refining the rubric ([Gradescope roles](https://guides.gradescope.com/hc/en-us/articles/21588723288589-Accounts-Enrollments-and-Role-Provisioning), [USC norming](https://cet.usc.edu/teaching-resources/facilitating-a-rubric-norming-session-for-tas/), [Crowdmark](https://www.crowdmark.com/blog/grading-large-classes-without-losing-consistency/)).

## Decisions (the Opus proxy answered as Kishore; confirm or change before building)

1. **Name:** "assignment", so "assignment code". Kishore said "quiz"; the proxy changed it because a quiz code sounds like something students join.
2. **Doors on the start screen, in order:** if this laptop has work, a big "Continue grading: DEMO-STATS 101 · Quiz 5" first. Then "Start a new assignment" (subtext: "You're the head TA. Set the question and marking scheme, then share the code.") and "Join with an assignment code" (subtext: "Your head TA sent you a code. Paste it to grade your stack."). A first-time TA sees only the last two.
3. **Scheme ownership:** joiners cannot edit the scheme. They propose "decisions to review"; the head TA approves and shares a new pack, which bumps the version. On a joined laptop the scheme is read-only with "Set by <head TA>. Propose a change."
4. **What comes back to the head TA:** every paper's final mark, who confirmed or overrode, under which scheme version, plus that laptop's proposed decisions. Form: the per-laptop CSV with added columns assignment code, scheme version, laptop id. No names in the shared CSV by default; names re-attach only on the laptop that owns the map.
5. **Code format:** opaque, 6 characters in two groups like `7K3-Q2M`, uppercase letters and digits without 0, O, 1, I, L. Course and assignment name are shown next to the code, never inside it.
6. **Tonight there is no server.** The code cannot be looked up alone. The shareable thing is a pack: one token starting with `REMAIN1:` that carries code, course, title, question, scheme, max. The join field is labelled "Paste the assignment pack". When hosted later, the same field takes the short code and fetches the pack.
7. **Demo video:** stay on grading; one line over a 3-second shot of the code card: "Each TA joins with the head TA's code. The scheme is shared; the names never leave their laptop."

## Would make Kishore wince

- A name, email, id, or the id-to-name map in a pack or in the shared CSV.
- Pasting a pack silently overwriting a scheme or marks already on the laptop. Ask, or keep as a new version.
- Marks not tagged with a scheme version.
- Two laptops with the same laptop id.
- A joined laptop skipping the privacy check.
- The UI implying the short code works alone tonight.
- Breaking the single-laptop flow that already works and is in the video.

## Model

- **Assignment** `{ code, course, title, question, standards (the validated table), createdBy (laptop id), createdAt, version }` saved at `local/assignments/<code>.json`. The two sample sets become built-in assignments seeded on first load with fixed codes (proxy's call: fixed codes so the video is stable).
- **Set id = assignment code.** Papers uploaded under it go to `local/ingest/<code>/` exactly as today; paper ids already carry the laptop id.
- **Pack** = `"REMAIN1:" + base64url(JSON of the assignment without papers or maps)`. Decoding rejects other versions.
- **Decisions** already record `rubricVersion`; add `assignment: code` and `laptop: uploaderId` to the decision record (`lib/logshape.js` decisionRecord, `lib/pipeline.js` passes them). Core change, so Kishore approves it.

## Plan, in order, each step test-first

1. `server/assignment.js`: `createAssignment(draft, {localDir, createdBy})` (validateStandards from `lib/engine.js`, code generator, save), `encodePack`, `decodePack`, `joinAssignment(pack, {localDir})` (refuse to overwrite a different scheme under the same code unless `force`), `listAssignments`, `loadAssignment`. Test below, renamed from quiz to assignment.
2. `app/api/assignment/route.ts`: GET list, GET ?code=, POST create, PUT join (pack). `app/api/rubric/route.ts` reads the standards from the assignment file for any set id, and falls back to the two seeds.
3. `server/context.js`: `ideas()` builds a grading idea per assignment (`makeIdeas` with `gradingSets`), so `/propose` works for any code.
4. `components/grading/Start.tsx`: step 1 becomes the three doors. "Start a new assignment": form (course, title, question, max marks, mistakes with points off, accepted ways to solve it) built on `SchemeDrawer`'s pieces; on save show the code card with "Copy pack" and a WhatsApp-ready line. "Join": paste field, preview course, title, question, scheme summary, Join. "Continue": existing assignments with counts.
5. `components/grading/SchemeDrawer.tsx`: read-only mode when `assignment.createdBy !== uploader`; "Propose a change" keeps the existing pending-precedents path.
6. `app/api/export/route.ts` and `server/ingest.js` `exportCsv`: add columns assignment, scheme_version, laptop; a `?names=1` switch for the owner laptop, default off.
7. `tests/copy.test.js` keeps banning jargon; add "pack" wording check that the join field says "Paste the assignment pack".
8. Browser walkthrough: create on window A, copy pack, join on window B (second Chrome profile gives a second laptop id by using a different `local/` via `REMAIN_LOCAL_DIR` env, small change in `server/context.js`), grade one paper on each, export both CSVs, stack them.
9. Update `SETUP.md`, `WIN-PLAN-2026-10-31.md` (one line), `CLAUDE.md` only if a rule changes.

Estimated 90 minutes. Do not start before the TA pass and the recording unless there is slack.

## Step 1 test, verbatim (rename quiz → assignment when creating the file)

```js
// A quiz is the unit of sharing: one TA creates it, gets a code, others join. The pack carries the quiz until a server exists.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createQuiz, encodePack, decodePack, joinQuiz, listQuizzes, loadQuiz } from "../server/quiz.js";
import { gradeStandards } from "./helpers.js";

const draft = { course: "DEMO-STATS 101", title: "Quiz 5", question: gradeStandards.question, max: 10, codes: gradeStandards.codes, methods: gradeStandards.methods, answerRules: gradeStandards.answerRules, correctAnswer: gradeStandards.correctAnswer, tolerance: gradeStandards.tolerance };

test("createQuiz validates the scheme, assigns a short shareable code, and saves it on this laptop", () => {
  const localDir = mkdtempSync(join(tmpdir(), "quiz-"));
  const q = createQuiz({ ...draft }, { localDir, createdBy: "U0BA7" });
  assert.match(q.code, /^[A-Z0-9]{4,8}(-[A-Z0-9]{2,8})?$/, "short, typeable, no ambiguous letters");
  assert.ok(!/[O0I1]/.test(q.code.replace(/-/g, "")), "no O, 0, I, 1 in codes");
  assert.equal(q.standards.max, 10); assert.equal(q.standards.status, "approved"); assert.equal(q.createdBy, "U0BA7");
  assert.equal(loadQuiz(localDir, q.code).code, q.code);
  assert.throws(() => createQuiz({ ...draft, codes: draft.codes.map((c) => c.code === "E-MEAN" ? { ...c, deduction: 2 } : c) }, { localDir, createdBy: "U0BA7" }), /deduction/);
});

test("a pack round-trips the whole quiz and joinQuiz saves it unchanged under the same code", () => {
  const a = mkdtempSync(join(tmpdir(), "quiz-a-")), b = mkdtempSync(join(tmpdir(), "quiz-b-"));
  const q = createQuiz({ ...draft }, { localDir: a, createdBy: "U0BA7" });
  const pack = encodePack(q);
  assert.ok(pack.startsWith("REMAIN1:"));
  assert.ok(!pack.includes(" "), "one token, safe to paste into chat");
  assert.deepEqual(decodePack(pack), q);
  const joined = joinQuiz(pack, { localDir: b });
  assert.equal(joined.code, q.code); assert.deepEqual(loadQuiz(b, q.code).standards, q.standards);
  assert.deepEqual(listQuizzes(b).map((x) => x.code), [q.code]);
  assert.throws(() => joinQuiz("REMAIN1:notbase64!!", { localDir: b }), /pack/i);
  assert.throws(() => decodePack(pack.replace("REMAIN1:", "REMAIN9:")), /version/i);
});

test("the quiz code is safe as a set id and the pack never carries papers or names", () => {
  const localDir = mkdtempSync(join(tmpdir(), "quiz-"));
  const q = createQuiz({ ...draft }, { localDir, createdBy: "U0BA7" });
  const pack = decodePack(encodePack(q));
  assert.ok(!("papers" in pack) && !("map" in pack));
  assert.doesNotThrow(() => { for (const [k] of [["x"]]) k; });
});
```
