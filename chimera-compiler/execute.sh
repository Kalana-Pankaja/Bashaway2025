#!/bin/bash
H=$(jq -r '.handshake' src/chimera/manifest.json | tr a-z A-Z)
F=$(jq -r '.focus' src/chimera/manifest.json)
S=$(jq -r ".targets[] | select(.name==\"$F\") | .status" src/chimera/manifest.json | tr a-z A-Z)
FL=$(echo $F | sed 's/[0-9]*$//' | tr a-z A-Z)
echo "HANDSHAKE:$H|$FL:$S"
