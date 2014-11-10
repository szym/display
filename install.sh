#!/usr/bin/env bash

set -e

DEST=~/.litegfx.js

mkdir -p ${DEST}
cp README.md package.json run.js lib.js ${DEST}
cp -r static templates  ${DEST}/
mkdir -p ${DEST}/static/data

echo '==> Installing package'
cd ${DEST}
npm install

