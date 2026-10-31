# Screen Recorder Handover: GuruAI demo video ✏️ CHANGED (was "Remain")

Goal: 12 short silent clips, handed to the editor in about 25 minutes. No talking while recording; narration is recorded separately and laid over. ✏️ CHANGED (was 8 clips, 20 minutes)

> **What changed in this version, and why (read first)**
> 1. The product is now called **GuruAI** everywhere on screen.
> 2. The footer no longer says "by Claude". It now reads **"Suggestions: LIVE API: claude-sonnet-5-5"**. Every check below uses the new text.
> 3. The story now leads with how GuruAI works for a real grading team:
>    - It's **open source and runs on each TA's own laptop, with no hosting**.
>    - The head TA shares a **Quiz/Assignment code**. Every TA joins with it and grades **their own papers** under the same scheme.
>    - Each TA downloads **their own marks file**.
> 4. The story also leads with **privacy by code**:
>    - Papers and names never leave the laptop.
>    - The cloud model only ever sees the maths, after code has stripped names, emails, IDs and headers.
>    - That code already knows every student on the laptop, so a known name cannot be sent.
> 5. **New clips 09 to 12** show the Quiz/Assignment code, a second laptop joining, a TA's own papers with the student name and the original file, and the two downloads. Clip 07 (student page) is now optional to stay under 2:30.
> 6. **New narration section (6)** with the exact lines, so the narrator never claims more than the app does.
>
> **Dependency:** clips 11 and 12 and the GuruAI name need two code changes, pull requests **#21** and **#22**. Kishore will confirm they are merged and the demo laptop has pulled main. If they are not in by recording time, skip clips 11 and 12 and keep the old name. Everything else still works.

## 1. Setup (5 minutes, before pressing record)

1. Use the **demo laptop** (the one where the smoke test passed with the live key).
2. ➕ NEW: Pull the latest main first (`git pull`), then start the app. Open the grading page (`/grade`) in Chrome. The header must say **GuruAI**.
3. Clean the screen:
   - close every other tab and app
   - hide the bookmarks bar (Ctrl+Shift+B, or Cmd+Shift+B on Mac)
   - set browser zoom to 110% to 125% (Ctrl/Cmd and +), so text is readable on a phone
   - turn on Do Not Disturb so no notifications pop up
   - full screen the browser (F11 on Windows, Ctrl+Cmd+F on Mac)
4. Never show a terminal, a .env file, a key, or another tab.
5. Recording tool: Mac Cmd+Shift+5 (record entire screen). Windows: Snipping Tool, record mode, or Win+Alt+R. Record full screen; the editor will crop out the small "N" badge in the bottom left.
6. Prepare these lines in a notes app to paste, so you never type on camera with typos:
   - S-07 AI card reason: `Sum of x = 40 is correct. No slip.`
   - S-07 scheme card reason: `Valid computational formula (M2). Not yet in v1.0.`
   - Student regrade text: `I used the shortcut formula. Please check it is the same result.`
   - Grader name: `Partiban`
   - ➕ NEW: Quiz/Assignment course: `DEMO-STATS 101` and name: `Quiz 5, Section B`
7. ➕ NEW: Have the four synthetic papers from the repo's `demo-papers` folder ready to pick in the file chooser (all names in them are made up).
8. ➕ NEW (only for clip 10): a **second laptop** with GuruAI running (a teammate's). If there is none, skip clip 10.

## 2. Warm-up, not recorded (5 minutes)

1. On the start screen, click **"or try the sample papers"**.
2. Step 1: pick **DEMO-STATS 101 · Quiz 5**. Next.
3. Step 2: **Use the sample papers**. Next.
4. Step 3: type `Partiban`. Next.
5. Step 4: make sure **Call it first is OFF**. Start grading.
6. Mark **S-01, S-02 and S-03** normally (Check, answer each card, save). Dismiss every first-time tip with "Got it" as it appears, so no tips show on camera.
7. ✏️ CHANGED: After the first Check, look at the footer. It must read **"Suggestions: LIVE API: claude-sonnet-5-5"**. If it says CACHED REHEARSAL, stop and tell the team before recording anything.
8. Do NOT mark S-04, S-07 or S-12.

## 3. The clips, in recording order

General rules for every clip: move the mouse slowly, pause 3 seconds on any text the narrator talks about, start each clip with 1 second of stillness and end with 2 seconds of stillness.

### Clip 01: wizard, "How a paper goes" (needed: about 12 s of usable footage) ✏️ CHANGED (was 18 s)
1. ✏️ CHANGED: Click the **GuruAI** header or open `/grade` to return to the start screen.
2. Record: click "or try the sample papers", click Next through steps 1, 2, 3 at a steady pace (Quiz 5, sample papers, name Partiban).
3. On **Step 4, "How a paper goes"**: hold 6 seconds. Hover over each of the four steps in turn.
4. Click **Start grading**. Stop recording.

### Clip 02: S-01 suggestions, problem beat (about 15 s) ✏️ CHANGED (was 17 s)
1. Use **Previous** to open **Paper S-01** (already marked; if it does not show suggestions, use Paper S-05 instead and mark it after the clip).
2. Record: hold on the paper with the suggestion cards. Slowly hover each card so its line lights up in the paper. Hold 3 seconds on a card that says "Line n" and, if present, one that says "Not in this paper."
3. Stop recording. (Finish marking the paper off camera if needed.)

### Clip 03: S-12 privacy (about 18 s)
1. Navigate to **Paper 12** with Next/Previous. Start recording on the privacy check.
2. Hold 5 seconds on: "1 name hidden. Header removed. Only the maths will be checked." and the "Removed before sending" line.
   ➕ NEW: This is the key privacy moment. The paper's text mentions a student by name. The code already knows that name from this laptop's class list, so it was replaced before anything could leave. No AI was involved in that.
3. Click **Check this paper**. Answer the cards normally (whatever is correct), continue, save.
4. When "Saved." appears, hold on the **"What left this computer"** box for as long as it shows. Stop recording.
   ➕ NEW: Make sure the box is readable. It lists what was removed as counts, the time of checking and sending, the model that answered, and a fingerprint of exactly what was sent. No names appear in it.

### Clip 04: S-07 hero beat (about 35 s, the most important clip, do 2 takes) ✏️ CHANGED (was 45 s)
1. Navigate to **Paper 7**. Start recording on its privacy check. Hold 2 seconds.
2. Click **Check this paper**. When suggestions load, hold 4 seconds. Hover the scheme card "Correct, method not in table · M-UNLISTED · -2 points" so its line lights.
3. On the AI card: click **No mistake here**, paste the AI-card reason.
4. On the scheme card: click **No mistake here**, paste the scheme-card reason, tick **Remember this for next time**. Hold 2 seconds.
5. Click **Continue to the mark**. Hold 4 seconds on **"Mark from your choices 10 / 10"**.
6. Click **Save and next paper**. The receipt "Marked by you, Partiban: 10 / 10 · Assigned by you (TA)" shows for only about 1.4 seconds before moving on. That is fine: the editor will freeze that frame or use screenshot 14.
7. Stop recording.
8. **Write down exactly what cards appeared on S-07** (for example "AI: Arithmetic slip, AI is unsure; Scheme: M-UNLISTED"). Send it to the narrator immediately; the script line depends on it.

### Clip 05: S-04 Call it first (about 12 s) ✏️ CHANGED (was 15 s)
1. Return to the start screen, go through the wizard again (sample papers, Partiban), and on Step 4 **tick Call it first**. Start grading.
2. Navigate to **Paper 4**. Start recording. Click **Check this paper**.
3. Hold 3 seconds on **"Make your call first"** (no AI visible).
4. Choose **Divided by n instead of n-1**, click **Lock my call and show the AI**.
5. Hold 3 seconds on the chip "Your call: ... · AI: ... · match" and the "Blind agreement this session" badge.
6. Answer the card(s), continue. Hold 2 seconds on the **empty Final mark box**, type `8`, save. Stop recording.
7. Write down whether the chip said "match" or "differs" and send it to the narrator.

### Clip 06: Finish screen (about 8 s) ✏️ CHANGED (was 10 s)
1. Click **Finish** in the top bar. Start recording.
2. Hold 3 seconds on the four tiles, then scroll slowly to **"What the class got wrong"** (hold 3 s) and **"You and the AI"** table (hold 3 s). Stop recording.
3. Write down the numbers on the tiles and send them to the narrator (for example "6 marked, 3 changed"). The narrator must only say these numbers.

### Clip 08: Model label close-up (about 4 s) ✏️ CHANGED (moved before the new clips)
1. ✏️ CHANGED: On the grading screen after a check, record 4 seconds of the footer: **"Suggestions: LIVE API: claude-sonnet-5-5"**. Zoom the browser in if needed so it is readable.

### ➕ NEW Clip 09: The head TA creates a Quiz/Assignment code (about 10 s)
1. Return to the start screen (click **GuruAI**). Turn **Call it first** off again if you can see it.
2. Record: click **Start grading a Quiz/Assignment**. Click **Fill in from the sample scheme**. Paste the course `DEMO-STATS 101` and the name `Quiz 5, Section B`.
3. Click **Create the code**. Hold 4 seconds on the big code card, for example `7K3-Q2M`, and on the message under it.
4. Click **Copy the message for your TAs**. Stop recording. Do not click "Add your papers" yet.
5. Send the copied message to the teammate with the second laptop, for example on WhatsApp. The message contains no student data, only the question and marking scheme.

### ➕ NEW Clip 10: A second TA joins on their own laptop (about 8 s; skip if there is no second laptop)
1. On the **second laptop**, open GuruAI and record its screen.
2. Click **Join with a Quiz/Assignment code**. Paste the whole message.
3. Hold 3 seconds on the preview: "You are joining DEMO-STATS 101 · Quiz 5, Section B", the question, and "Scheme set by the head TA's laptop …".
4. Click **Join and add my papers**. Hold 2 seconds on step 1 showing the same question. Stop recording.

### ➕ NEW Clip 11: My own papers, the student's name, and the original paper (about 12 s; needs #21)
1. Back on the demo laptop, on the code card, click **Add your papers**.
2. Off camera: **Choose files**, pick the four files in `demo-papers`, click **Read these papers**. You should see "4 papers ready to grade". Next, type `Partiban`, Next, **Start grading**.
3. Record: hold 3 seconds on the top bar chip **"Student: …"** next to the paper number. The name comes from the paper on this laptop.
4. Click **Original file** above the paper. Hold 3 seconds on the original page, then click **Text read** to go back.
5. Hold 2 seconds on the line under the paper: "The student's name is shown only on this laptop. It is removed before anything is sent."
6. Click **Check this paper**. Hold 2 seconds on "Header removed. Only the maths will be checked." Answer the cards and save normally. Stop recording.
7. Off camera: mark one more paper so the files have content.

### ➕ NEW Clip 12: Each TA downloads their own marks (about 8 s; needs #21)
1. Click **Finish**. Start recording.
2. Hold 3 seconds on the two buttons:
   - **"Download marks for the head TA (no names)"**
   - **"Download with student names (keep it on this laptop)"**
3. Click the first one. Open the downloaded file in Excel or Numbers and hold 3 seconds. The student and file columns are empty. The paper ID, mark, who marked it, the scheme version, the code and the laptop are filled. Stop recording.
4. Optional, 2 seconds: open the second file to show the same rows with the student names filled in. Close it straight away.

### Clip 07: Student page (about 8 s) ✏️ CHANGED: now OPTIONAL, record only if time allows
1. Open `/student`. Start recording.
2. Choose **S-07** (or another marked student) in the dropdown. Hold on the total and one deduction card, or the full-marks result.
3. Scroll to **Ask for a regrade**, paste the regrade text, click **Submit**, hold 2 seconds on "Saved for your TA to review. A person will decide." Stop recording.

## 4. Handoff to the editor

1. ✏️ CHANGED: Name files exactly: `01-wizard.mov`, `02-s01.mov`, `03-s12.mov`, `04-s07.mov`, `05-s04.mov`, `06-finish.mov`, `08-label.mov`, `09-code.mov`, `10-join.mov`, `11-own-papers.mov`, `12-downloads.mov`, and optional `07-student.mov` (any video extension is fine).
2. Upload each clip to the shared Google Drive folder **as soon as it is recorded**, not all at the end.
3. Also put the screenshots zip in the folder as a fallback.
4. Send the narrator three notes: what appeared on S-07, the S-04 match or differs result, and the Finish tile numbers.

## 5. If something breaks

- A clip fails twice: skip it and tell the editor to use the matching screenshot (S-12: 18 and 19; S-07: 11 to 14; S-04: 24 to 26; Finish: 21; Student: 22 and 23).
- ✏️ CHANGED: Suggestions do not load: click Try again once. If still nothing, click **Mark it myself** (needs #21). That shows that the TA can always finish the paper, which is fine to keep on camera. Otherwise use the screenshots for that beat.
- Footer shows CACHED REHEARSAL: stop and tell the team; the video must not claim live.
- ➕ NEW: The sample papers may be answered from this laptop's saved copy of an earlier real call. The receipt then says "answered from this laptop's cache, no new call". That is honest and fine, but the narrator must not say "just now" about a sample paper's suggestion.
- ➕ NEW: The header still says Remain, or there is no "Student:" chip or "Original file" tab: the laptop hasn't pulled the merged code. Pull main and restart, or skip clips 11 and 12.

## 6. ➕ NEW Narration, line by line (the narrator reads only these)

Rules:
- Say "the cloud model" for the AI.
- Never say the AI runs locally, never say "no training on your data", and never say a number that is not on screen.

| Beat | Line |
|---|---|
| Open | "In GuruAI, a person always makes the final call." |
| Problem (02) | "A grading team splits one stack of papers across many TAs. The same mistake should cost the same mark, whoever grades it, and a person should still decide every mark." |
| How a paper goes (01) | "The AI can only point. It names a possible mistake and shows the exact line. The TA confirms it, changes it, or rules it out, and types every mark." |
| Privacy (03) | "Before anything leaves the laptop, plain code, not AI, removes names, emails, IDs and header lines. It already knows every student on this laptop, so a known name can't slip through. The cloud model only ever sees the maths. The receipt shows exactly what left, as counts and a fingerprint." |
| Human judgment (04) | "Here the machine is wrong. The student used a valid method the scheme didn't list. The TA rules both suggestions out, says why in one line, and asks to remember it. The mark is ten out of ten, and it's the TA's." |
| Rubber-stamping (05) | "With Call it first, the TA decides before seeing the AI, and the mark box starts empty. Agreement is earned, not copied." |
| Insights (06) | "At the end, the class's mistakes are counted from the TA's own decisions, and so is how often people kept or overruled the AI." *(say only the tile numbers on screen)* |
| No hosting, one scheme (09, 10) | "GuruAI is open source and runs on each TA's own laptop, with no server to host. The head TA sets the question and the marking scheme once and shares a code. Every TA joins with it and grades their own papers under exactly the same scheme." |
| Own papers (11) | "Each TA uploads their own papers. The student's name and the original page show only on that laptop, so the TA can always check what the text reading missed. Neither one is ever sent." |
| Own marks (12) | "Each TA downloads their own marks: a file with names that stays on their laptop, and one without names for the head TA, matching paper by paper." |
| Close (08) | "Suggestions come from a cloud model, labelled on screen by the model that answered. It never sees a student's name, never computes a mark, and never decides. GuruAI." |

## Where each clip lands in the video ✏️ CHANGED (new clips added, other beats shortened to stay under 2:30)

| Clip | Video time | Narration beat |
|---|---|---|
| Title card "GuruAI" (editor makes it) | 0:00 to 0:04 | Opening sentence |
| 02 S-01 | 0:04 to 0:17 | Problem and who it is for |
| 01 Wizard step 4 | 0:17 to 0:28 | The AI can only point |
| 03 S-12 | 0:28 to 0:46 | Privacy by code |
| 04 S-07 | 0:46 to 1:18 | The machine being wrong, human judgment |
| 05 S-04 | 1:18 to 1:29 | Rubber-stamping |
| 09 Code, 10 Join | 1:29 to 1:47 | No hosting, one shared scheme |
| 11 Own papers | 1:47 to 1:59 | Names and originals stay on the laptop |
| 12 Downloads | 1:59 to 2:07 | Each TA's own marks |
| 06 Finish | 2:07 to 2:15 | Insights |
| 08 Label, end card | 2:15 to 2:28 | Limits, model disclosure, close |
| 07 Student (optional) | only if time | Student view |
