#!/bin/bash
response=$(curl -s "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd")
price=$(echo "$response" | grep -o '"usd":[0-9.]*' | grep -o '[0-9.]*')
echo "$price"
