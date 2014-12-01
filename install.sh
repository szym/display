#!/usr/bin/env bash

set -e

DEST=${1:-"$HOME/.litegfx.js"}

mkdir -p ${DEST}
cp README.md package.json run.js server.js ${DEST}
cp -r static templates ${DEST}/
mkdir -p ${DEST}/static/data

echo '==> Installing package'
cd ${DEST}
npm install

echo "Start litegfx.js by running ${DEST}/run.js"
