# GuruAI hackathon close-out (Oct 31, 2026, 10:10 ET)

## State
- main 3cd8538: 236 tests, TypeScript and production build green; 24 build-trace manifests hold no private files.
- Every pull request is merged (#1 to #25; #8 and #9 were superseded). Codex's 26-finding audit is fully repaired except the three items below that need a human.
- Demo video: `GuruAI-demo.mp4`, 2:06, narrated with the macOS voice (the ElevenLabs account is a free plan and refused API voices). Public link in `SUBMISSION.md`. Made with ultrademo from `~/Documents/ultrademo-workspace/projects/guruai-grading-2026-10-31-1005` on a scratch server; the team's real `local/` holds a verified replay cache for all 25 DEMO-STATS 101 sample papers.
- Submission text: `SUBMISSION.md`. Only the registered team name is left to fill on the form.

## After the hackathon
1. **Rotate the Anthropic and Gemini API keys.** Both were pasted into a chat during the build. They were never committed, but rotate them in the provider consoles and update the gitignored `.env`.
2. **Local OCR for scanned papers.** Run OCR on the laptop for files with no text layer, show the recognised text beside the original, and gate it like typed text. Today a scan is kept in the stack, flagged unreadable, and marked by hand from the original. Out of scope for the hackathon by the repo rules.
3. **One known-identity matcher.** `server/privacy.js` and `server/sidelog.js` both match known students; merge them into one implementation once the behaviours are reconciled.
4. **A real "not a name" option is in** (#23). A hard, time-bounded method-pattern matcher would need a protected engine change; the current grammar is conservative and tested, not a proof.
