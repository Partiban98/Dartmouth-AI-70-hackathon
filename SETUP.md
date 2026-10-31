# GuruAI: teammate setup (5 minutes)

You need: Node 22 or newer (https://nodejs.org), git, and the team's Anthropic API key from Kishore.

```
git clone https://github.com/Partiban98/Dartmouth-AI-70-hackathon.git
cd Dartmouth-AI-70-hackathon
sh scripts/setup.sh
```

The script installs dependencies, asks for the API key at a hidden prompt and writes it to `.env` (gitignored), runs the tests, and makes one smoke call on the demo model so you know the key works.

Then:

```
npm run dev
```

Open http://localhost:3000/grade. Pick a paper, approve the gate, review the proposals, enter the grade. Keys: 1 confirm, 2 change, 3 override, Enter to continue.

## Grade your own papers

On the Start screen, "Your papers" → Choose files → Read these papers. PDFs with selectable text, .txt, or .md. The files are saved under `local/uploads/` on your laptop and names are hidden before any checking. Or from Terminal:

```
node scripts/ingest.js ~/Desktop/quiz5-papers --set quiz5-section-a --propose
```

Reads `.pdf` (text layer), `.txt`, `.md`. Names and header lines never leave your laptop: the paper-to-student map is in `local/ingest/<set>/map.json`, the model sees paper ids and alias tokens only. The set appears in the app's Question set list. "Export CSV" at the top of the page re-attaches names from the local map for your spreadsheet.

## Grade as a team: Quiz/Assignment codes

The head TA opens the app and picks "Start grading a Quiz/Assignment": course, Quiz/Assignment name, question, full marks, and the mistakes with points off ("Fill in from the sample scheme" is a quick start). GuruAI gives a 6-character code and a message to paste into the team chat. There is no shared server yet, so the message carries a pack, one long line starting `REMAIN1:`. The code alone is not enough.

Every other TA picks "Join with a Quiz/Assignment code", pastes the whole message, checks the preview, and adds their own papers. Their marking scheme is read-only. When they disagree with a suggestion and tick "Remember this for next time", the reason goes into their marks file as a proposed change. The head TA edits the scheme, which saves a new version, and shares the pack again. Pasting a newer pack asks before replacing and keeps the TA's own proposed changes.

At the end, each TA downloads "marks for the head TA (no names)". The head TA stacks the files: every row has the paper id, the mark, who decided it, the scheme version, the Quiz/Assignment code, the laptop, and any proposed change. Names stay on the laptop that added the papers and come back only with "Download with student names" on that laptop.

To try two laptops on one machine, run a second server with its own folder:

```bash
npm run build
REMAIN_LOCAL_DIR=/tmp/remain-laptop-b npx next start -p 3002
cp local/smoke.json /tmp/remain-laptop-b/   # the model check passed once on this machine
```

## Working on a feature

```
git checkout -b <yourname>/<feature>
# build, then
npm test
git push -u origin <yourname>/<feature>
```

Open a pull request; Kishore reviews and merges. A pre-push hook (installed by setup.sh) refuses direct pushes to `main` from anyone else. Do not change `lib/gate.js`, `lib/engine.js`, or `lib/pipeline.js` without asking, and never commit `.env` or `local/`.

## If something fails

- `npm run smoke` says the key is missing: check `.env` has `ANTHROPIC_API_KEY=...` with no quotes or spaces.
- Port 3000 busy: `PORT=3001 npm run dev`.
- Old no-build page as a fallback: `npm run legacy`, then http://localhost:8787.
