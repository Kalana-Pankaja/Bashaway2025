#!/bin/bash
mkdir -p out
cd src
find . -type f -exec md5sum {} \; | sed 's|^\([^ ]*\)  \./|\1 |' > ../out/checksums.txt
