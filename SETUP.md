# Remain: teammate setup (5 minutes)

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

## Grade a folder of real papers

```
node scripts/ingest.js ~/Desktop/quiz5-papers --set quiz5-section-a --propose
```

Reads `.pdf` (text layer), `.txt`, `.md`. Names and header lines never leave your laptop: the paper-to-student map is in `local/ingest/<set>/map.json`, the model sees paper ids and alias tokens only. The set appears in the app's Question set list. "Export CSV" at the top of the page re-attaches names from the local map for your spreadsheet.

## Working on a feature

```
git checkout -b <yourname>/<feature>
# build, then
npm test
git push -u origin <yourname>/<feature>
```

Open a pull request; Kishore reviews and merges. Do not change `lib/gate.js`, `lib/engine.js`, or `lib/pipeline.js` without asking, and never commit `.env` or `local/`.

## If something fails

- `npm run smoke` says the key is missing: check `.env` has `ANTHROPIC_API_KEY=...` with no quotes or spaces.
- Port 3000 busy: `PORT=3001 npm run dev`.
- Old no-build page as a fallback: `npm run legacy`, then http://localhost:8787.
