#!/usr/bin/env bash
# One command to get all four packages installed and ready to run.
# FLOW: check node -> install engine, control-panel, parent-portal, eval -> write engine/.env
# Safe to run twice: it never overwrites an existing .env, and npm install is idempotent.

set -euo pipefail

cd "$(dirname "$0")"

PACKAGES=(engine control-panel parent-portal eval)
REQUIRED_NODE=20

# ─── Node check ───

if ! command -v node > /dev/null 2>&1; then
  echo "Node is not installed. This needs Node ${REQUIRED_NODE} or newer: https://nodejs.org"
  exit 1
fi

NODE_MAJOR=$(node -p "process.versions.node.split('.')[0]")
if [ "$NODE_MAJOR" -lt "$REQUIRED_NODE" ]; then
  echo "Node ${NODE_MAJOR} found, but this needs ${REQUIRED_NODE} or newer."
  exit 1
fi

echo "Node $(node -v)"
echo

# ─── Install ───

for package in "${PACKAGES[@]}"; do
  if [ ! -d "$package" ]; then
    echo "  skip $package (not in this copy)"
    continue
  fi
  echo "Installing $package..."
  (cd "$package" && npm install --silent)
done

echo

# ─── The key ───

# Never clobber a key that is already there: running setup twice should cost nothing.
if [ -f engine/.env ]; then
  echo "engine/.env already exists, leaving it alone."
else
  cp engine/.env.example engine/.env
  echo "Wrote engine/.env from the example."
fi

echo
echo "Done. One thing left:"
echo
echo "  1. Put a Gemini key in engine/.env    https://aistudio.google.com/apikey"
echo "  2. cd engine         && npm run serve   # API            :8787"
echo "  3. cd control-panel  && npm run dev     # operator view  :8080"
echo "  4. cd parent-portal  && npm run dev     # parent chat    :8082"
echo
echo "Checks:  cd engine && npm test     (242 unit tests)"
echo "         cd eval   && npm run eval (54 cases)"
