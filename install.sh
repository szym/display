#!/usr/bin/env bash

set -e

DEST=${1:-"$HOME/.display"}

FILES="README.md package.json run.js server.js static"

mkdir -p ${DEST}
cp -a ${FILES} ${DEST}/

cd ${DEST}
npm install

echo "Start display by running ${DEST}/run.js"
