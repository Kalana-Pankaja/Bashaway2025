#!/bin/bash

mkdir -p out

curl -L -o yq "https://github.com/mikefarah/yq/releases/download/v4.35.2/yq_linux_amd64"
chmod +x yq

./yq -p xml -o json '.' src/data.xml > out/output.json

rm yq
