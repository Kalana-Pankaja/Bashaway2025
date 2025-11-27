#!/bin/bash
mkdir -p out
jq -s '.[0] * .[1] * .[2]' src/tertiary.json src/secondary.json src/primary.json > out/merged.json
