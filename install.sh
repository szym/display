#!/usr/bin/env bash

set -e

DEST=~/.gfx.js

echo '==> Overwriting existing gfx.js installation'
cp package.json server.js lib.js  ${DEST}
cp static/wm.js static/index.html ${DEST}/static

echo '==> Installing package'
cd ${DEST}
npm install

