#!/bin/sh
# One-time setup for a teammate's laptop. Run from the repo folder:  sh scripts/setup.sh
set -e
cd "$(dirname "$0")/.."
echo "== Remain setup =="
command -v node >/dev/null 2>&1 || { echo "Node is not installed. Install Node 22 or newer from https://nodejs.org and run this again."; exit 1; }
MAJOR=$(node -p 'process.versions.node.split(".")[0]')
[ "$MAJOR" -ge 22 ] || { echo "Node $(node -v) is too old. Install Node 22 or newer."; exit 1; }
echo "Node $(node -v) ok"
echo "Installing dependencies (Next.js, React, Tailwind, pdfjs)..."
npm install --no-audit --no-fund
if [ -f .env ] && grep -q '^ANTHROPIC_API_KEY=.' .env; then
  echo ".env already has ANTHROPIC_API_KEY, keeping it."
else
  echo "Now paste the Anthropic API key when asked. It is written only to .env (gitignored, mode 600)."
  sh scripts/set-env.sh
fi
echo "Running the test suite..."
npm test >/dev/null 2>&1 && echo "tests: pass" || { echo "tests: FAIL, run 'npm test' to see why"; exit 1; }
echo "Smoke test: one call on the exact demo model, writes local/smoke.json..."
npm run -s smoke || { echo "Smoke failed. Check the key in .env, then run: npm run smoke"; exit 1; }
cat <<MSG

== Ready ==
Start the app:      npm run dev        then open http://localhost:3000/grade
Grade a folder:     node scripts/ingest.js <folder-of-pdfs-or-txt> --set my-quiz --propose
Your own branch:    git checkout -b <yourname>/<feature>
Never commit .env or local/. They are gitignored.
MSG
