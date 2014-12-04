#!/usr/bin/env bash

set -e

DEST=${1:-"$HOME/.display"}

mkdir -p ${DEST}
cp -r README.md package.json run.js server.js static ${DEST}/

echo '==> Installing package'
cd ${DEST}
npm install

echo "Start display by running ${DEST}/run.js"
