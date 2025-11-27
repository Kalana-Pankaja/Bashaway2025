#!/bin/bash
h=$(printf %x $1)
r=""
for ((i=0;i<${#h};i++)); do
  c=${h:i:1}
  ((i%2==0))&&r+=${c^^}||r+=${c,,}
done
echo $r
