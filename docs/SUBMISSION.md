# GuruAI — submission copy

Project name: GuruAI
Track: Education
Team name: [Confirm the registered team name; project name is GuruAI.]
Members (from the repository team split): Kishore Theeraj Vasudevan Jaya; Rineetha Gunasekaran; Partiban Anathurai; Xinyan Huang.

One-sentence description:
GuruAI helps teaching assistants review free-response work under a shared marking scheme: a cloud model proposes mistake codes with quoted evidence, code checks the evidence, and a named person confirms or overrides each suggestion and assigns the final grade.

Code: https://github.com/Partiban98/Dartmouth-AI-70-hackathon
Video: https://drive.google.com/open?id=1ESIL8Ym-SfHK6u2B2q31dGKWllH30u9N (public, anyone with the link; 2:06, verified by anonymous download)

## If the form allows a longer description

In GuruAI, a person always assigns the grade. Grading teams can disagree when a valid method is missing from a rubric or a model interprets a student's work incorrectly. GuruAI makes those judgments inspectable: each proposed mistake points to the work, the TA accepts, changes or rejects it, and the saved decision records the human, scheme version and reason. A TA can propose a scheme change; the instructor retains control.

Each TA runs the app on their own laptop and shares the instructor's question and scheme through a code-and-pack message. Original files and the student map remain on that laptop. Before cloud inference, code removes headers and detected identifiers and checks outbound content against known local identities. The grader can inspect the original file and mark by hand when suggestions are unavailable or a scan has no readable text.

The demo uses synthetic student data. This is a working prototype of accountable review, not evidence of improved fairness or grading accuracy. Quote matching establishes source provenance; the human still decides whether the criterion applies. Arbitrary-text de-identification and automation bias remain limitations.

## Final submission checks

- Confirm registered team name and spelling/order of members.
- Insert the public video link; check playback while logged out, audio and captions, and duration under the form's limit (aim under 2:30).
- Verify the actual model label is visible; do not label cached output as a new live call.
- Keep claims tied to captured behavior; no invented score, time-saving or evaluation results.
