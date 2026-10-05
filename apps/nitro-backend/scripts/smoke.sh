#!/usr/bin/env bash
# End-to-end check against a running API: register -> markets -> bet -> balance -> (optional) settle.
# Usage:  BASE=https://your-api.onrender.com ./scripts/smoke.sh
#         ADMIN_API_KEY=... BASE=... ./scripts/smoke.sh      (also tests settlement + payout)
# Needs only curl. The first request can take ~50s if the free instance is asleep.
BASE="${BASE:-https://nitro-bet-the-express-way.onrender.com}"
EMAIL="smoke$(date +%s)@example.test"
PASS="smoke-test-password-123"
say() { printf '\n== %s\n' "$*"; }
pick() { sed -n "s/.*\"$1\":\"\([^\"]*\)\".*/\1/p" | head -1; }

say "1. config";            curl -sS --max-time 90 "$BASE/api/config"; echo
say "2. register $EMAIL"
REG=$(curl -sS --max-time 90 -X POST "$BASE/api/auth/register" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\",\"displayName\":\"Smoke Test\",\"dateOfBirth\":\"1990-01-01\"}")
echo "$REG" | cut -c1-200
TOKEN=$(echo "$REG" | pick token)
[ -n "$TOKEN" ] || { echo "FAILED: no token returned (is the new backend deployed?)"; exit 1; }

say "3. underage must be refused (expect 403 UNDERAGE)"
curl -sS --max-time 60 -X POST "$BASE/api/auth/register" -H 'Content-Type: application/json' \
  -d "{\"email\":\"kid$(date +%s)@example.test\",\"password\":\"$PASS\",\"displayName\":\"Kid\",\"dateOfBirth\":\"2020-01-01\"}"; echo

say "4. markets"
MK=$(curl -sS --max-time 60 "$BASE/api/markets"); echo "$MK" | cut -c1-300
ids() { grep -o '"id":"[^"]*"' | sed 's/"id":"\(.*\)"/\1/'; }
MARKET_ID=$(echo "$MK" | ids | sed -n '1p')
OUTCOME_ID=$(echo "$MK" | ids | sed -n '2p')
[ -n "$OUTCOME_ID" ] || { echo "FAILED: no market/outcome found"; exit 1; }

say "5. balance before";    curl -sS --max-time 60 "$BASE/api/me" -H "Authorization: Bearer $TOKEN"; echo
say "6. place a 10.00 bet"
KEY="smoke-$(date +%s)-$RANDOM"
curl -sS --max-time 60 -X POST "$BASE/api/wagers" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d "{\"outcomeId\":\"$OUTCOME_ID\",\"stake\":\"10.00\",\"idempotencyKey\":\"$KEY\"}"; echo
say "7. same request again (expect replayed:true and NO second charge)"
curl -sS --max-time 60 -X POST "$BASE/api/wagers" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d "{\"outcomeId\":\"$OUTCOME_ID\",\"stake\":\"10.00\",\"idempotencyKey\":\"$KEY\"}"; echo
say "8. too-big bet (expect 400 STAKE_TOO_HIGH)"
curl -sS --max-time 60 -X POST "$BASE/api/wagers" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d "{\"outcomeId\":\"$OUTCOME_ID\",\"stake\":\"999999.00\"}"; echo
say "9. balance after (expect 990.00 in play-money mode)"
curl -sS --max-time 60 "$BASE/api/me" -H "Authorization: Bearer $TOKEN"; echo

if [ -n "$ADMIN_API_KEY" ]; then
  say "10. settle the market with YOUR outcome as winner (admin)"
  curl -sS --max-time 60 -X POST "$BASE/api/admin/markets/$MARKET_ID/settle" -H "X-Admin-Key: $ADMIN_API_KEY" \
    -H 'Content-Type: application/json' -d "{\"winningOutcomeId\":\"$OUTCOME_ID\"}"; echo
  say "11. balance after payout (stake + winnings returned)"
  curl -sS --max-time 60 "$BASE/api/me" -H "Authorization: Bearer $TOKEN"; echo
  say "12. weekly leaderboard (public; expect your smoke player near the top with a positive net)"
  curl -sS --max-time 60 "$BASE/api/leaderboard?period=week" | cut -c1-400; echo
  say "13. my rank"
  curl -sS --max-time 60 "$BASE/api/leaderboard/me?period=week" -H "Authorization: Bearer $TOKEN"; echo
  say "14. ghost mode on, then the leaderboard must hide the name"
  curl -sS --max-time 60 -X PATCH "$BASE/api/me/settings" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"ghostMode":true}'; echo
  curl -sS --max-time 60 "$BASE/api/leaderboard?period=week" | cut -c1-300; echo
  echo; echo "NOTE: that settled the demo market. Create a fresh one before the next run:"
  echo "  curl -X POST $BASE/api/admin/markets -H \"X-Admin-Key: \$ADMIN_API_KEY\" -H 'Content-Type: application/json' \\"
  echo "    -d '{\"title\":\"Next F1 Race: Winner\",\"outcomes\":[{\"label\":\"Max Verstappen\",\"odds\":1.59},{\"label\":\"Lando Norris\",\"odds\":3.56}]}'"
else
  echo; echo "(Set ADMIN_API_KEY to also test settlement and payouts.)"
fi
