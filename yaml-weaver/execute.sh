#!/bin/bash
mkdir -p out
jq -S '.' src/data.json | yq -P > out/transformed.yaml
