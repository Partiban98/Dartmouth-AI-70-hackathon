# T24 to T26 results: Privacy Gate panel in the grading flow

Scope: the gate part of the grading beat only (`GatePanel`, `CountsTable`, `FlagsPanel` in `components/grading/GradingWorkspace.tsx`). The rest of `tests/a11y.md` is not covered here.

## 2026-10-31, Xinyan Huang (run by a Cloud Agent for Xinyan), branch xinyan/grading-gate-view

Setup: `REPLAY_MODE=1 npm run dev`, http://localhost:3000/grade, headless Google Chrome driven by Playwright (installed outside the repo). No API key set. Two clearly fake replay fixtures (S-07, S-12) in `local/cache`, deleted afterwards with all logs.

Method limits, stated plainly:
- Grayscale was emulated with a CSS `filter: grayscale(1)` on the page, not macOS Color Filters.
- Read-aloud order was taken from Chrome's accessibility tree (Playwright `ariaSnapshot`), not VoiceOver. A VoiceOver pass on a Mac is still needed before recording.

### T24 keyboard only

| Check | Result | Observed |
| --- | --- | --- |
| Reach a paper from page top | Pass | 19 Tab presses from page load to queue button S-12; Enter opens the gate panel. |
| Approve and Stop work from the keyboard | Pass | Both are native buttons. Enter on "Stop, send nothing" and Space on it both end at "Stopped at gate"; nothing sent. |
| Focus ring visible | Pass | 3px solid outline on the queue button, "Approve and send alias-only payload", "Mark as name", and "Continue". |
| R-11 picks from the keyboard | Pass | "Mark as name" / "Not a name" are buttons with `aria-pressed`; Enter sets `aria-pressed="true"`; "Continue" enables only after every token has a pick. |
| Focus moves to the gate when it opens | Fail | Focus stays on the queue button. 16 more Tab presses (S-13..S-25, "+ Paste a paper", "Export CSV") before "Approve". |
| Focus after the paste dialog | Fail | Dialog closes, focus falls back to the page body; 38 Tab presses to reach "Mark as name". |

### T25 grayscale, meaning not by colour alone

| Check | Result | Observed |
| --- | --- | --- |
| Gate counts readable | Pass | Types and counts are text in a table (`NAME 1`, `DOB 1`), plus "Fields dropped by allowlist: n". |
| Local block (R-12) | Pass | Text "BLOCKED by R-12. Nothing will be sent." Approve is disabled (attribute exposed to assistive tech); visually only 40% opacity, but the BLOCKED text sits directly above it. |
| Server 422 block | Partial | Panel title is "Stopped", body "Blocked by the server's assertClean (R-11). Nothing was sent. Logged as a blocked event." Readable in grayscale, but it does not say BLOCKED or 422, and looks like any other stop. |
| Current stage in the stepper | Fail | Current stage is shown by fill colour only; no `aria-current`, no text. After a stop, no stage is marked. |

### T26 read-aloud order

| Check | Result | Observed |
| --- | --- | --- |
| Order | Pass | Question set, rubric, queue, page title, Export CSV, model label, the four stages, student work, gate heading, fields dropped, counts table, counts-only note, Approve, Stop, insights, decision log, honest limit. |
| Model label announced on change | Pass | `aria-live="polite"` on the label. |
| Gate appearance announced | Fail | No live region and no focus move, so a screen reader user is not told the gate opened. |
| Honest limit near the gate | Partial | Text is on screen ("cannot guarantee 100 percent removal..."), but read last on the page, after the decision log, not with the gate. |

### Not run here

- VoiceOver on macOS and macOS Color Filters (see method limits).
- 5-second muted test, which needs the full recorded beat.

### Who to ask

Every failing item above is in `components/grading/GradingWorkspace.tsx`, the grading tab file. Not changed on this branch. Ask Partiban (grading tab owner) with Kishore's review.
