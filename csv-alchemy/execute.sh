#!/bin/bash
mkdir -p out;cat src/*|awk -F, 'NR>1{a[$1]+=$2}END{print"category,total_amount";for(i in a)print i","a[i]}'>out/result.csv
