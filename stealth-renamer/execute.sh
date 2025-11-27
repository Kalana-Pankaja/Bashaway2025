#!/bin/bash
cd src;for f in *;do [[ $f =~ $1 ]]&&mv "$f" "${f%.*}_renamed.${f##*.}" 2>/dev/null||true;done
