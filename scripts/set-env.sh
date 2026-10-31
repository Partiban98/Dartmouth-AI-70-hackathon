#!/bin/sh
# Writes provider settings into .env (gitignored) from a hidden prompt. Run it in your own terminal:
#   sh scripts/set-env.sh
# The key is never echoed, never logged, never passed as an argument.
set -e
cd "$(dirname "$0")/.."
printf 'Anthropic API key (input hidden): '
stty -echo; read -r KEY; stty echo; printf '\n'
[ -n "$KEY" ] || { echo "No key entered, nothing written."; exit 1; }
case "$KEY" in sk-ant-*) ;; *) echo "That does not look like an Anthropic key (expected sk-ant-...). Nothing written."; exit 1;; esac
touch .env
# Drop any previous Claude lines, then append fresh ones.
grep -vE '^(ANTHROPIC_API_KEY|MODEL_DEMO|MODEL_DEV)=' .env > .env.tmp || true
mv .env.tmp .env
printf 'ANTHROPIC_API_KEY=%s\nMODEL_DEMO=claude-sonnet-5-5\nMODEL_DEV=claude-haiku-5-5\n' "$KEY" >> .env
unset KEY
chmod 600 .env
echo "Wrote ANTHROPIC_API_KEY, MODEL_DEMO=claude-sonnet-5-5, MODEL_DEV=claude-haiku-5-5 to .env (mode 600). Now: npm run smoke"
