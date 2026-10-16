#!/usr/bin/env bash
# Checks the points-pool chart on the live API. Needs curl and jq (Termux: pkg install jq).
BASE="${BASE:-https://nitro-bet-the-express-way.onrender.com}"
M=$(curl -s "$BASE/api/markets")
echo "$M" | jq -r '.markets[] | "market: \(.title)  model=\(.model)  pool=\(.poolTotalMinor // "n/a")"'
MID=$(echo "$M" | jq -r '.markets[0].id // empty')
[ -z "$MID" ] && { echo "No open market. Create one first (see README)."; exit 1; }
for I in 15m 1h; do
  echo "== chart $I"
  curl -s "$BASE/api/markets/$MID/chart?interval=$I" | jq -c '{model, total, outcomes: [.outcomes[] | {label, priceBp, candles: (.candles | length)}]}'
done
