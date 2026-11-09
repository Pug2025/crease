#!/bin/sh
# Crease deploy: test, stamp the build, commit, push. GitHub Pages serves the repo root.
# Usage: ./deploy.sh "what changed"
set -e
cd "$(dirname "$0")"
node tools/make-voice.mjs
node tests.mjs > /dev/null || { node tests.mjs | grep FAIL; echo "Tests failed. Nothing deployed."; exit 1; }
BUILD=$(date +%Y%m%d-%H%M%S)
node tools/stamp.mjs "$BUILD"
git add -A
git commit -q -m "${1:-build $BUILD}"
git push -q
echo "$BUILD"
