#!/bin/bash

# Using openssl and curl send the image file to the display server.
# This is a bit roundabout but this way we don't need to put the file in a place
# from where the server could serve it as static.

set -e
shopt -s nocasematch

TITLE=''
WIN='null'


function usage() {
  cat >&2 <<EOF
Usage: [-t title] [-w id] imagefile
EOF
}

if [ "$#" -eq 0 ]; then
  usage
  exit 2
fi


while getopts "t:w:h" opt; do
  case $opt in
    t) TITLE=$OPTARG;;
    w) WIN="\"win\": \"$OPTARG\",";;
    h) usage; exit 2;;
  esac
done

IMGFILE=${@:$OPTIND:1}


EXT=${IMGFILE##*.}
case $EXT in
  jpg) EXT="jpeg"
    ;;
  png|gif|bmp|webp|pdf)
    ;;
  *)
    echo >&2 "Warning: unrecognized image format: $EXT"
    ;;
esac

function compose() { 
  cat <<EOF
  { "command": "image", "title":"$TITLE", "src":"data:image/${EXT};base64,
EOF
  openssl enc -base64 -in $IMGFILE
  echo '"}'
}

compose | curl -X POST -d @- http://localhost:8000/events
