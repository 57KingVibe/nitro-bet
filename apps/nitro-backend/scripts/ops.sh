#!/usr/bin/env bash
# Apexly operator tool. Needs curl and jq (Termux: pkg install curl jq).
#   bash ops.sh stats                      how many people signed up and how active they are
#   bash ops.sh markets                    all markets with their ids and status
#   bash ops.sh create ["Title"]           open a new race-winner market (settles itself after the race)
#   bash ops.sh close [id]                 stop new predictions (newest open market, or the id from 'markets')
#   bash ops.sh settle "Max Verstappen" [id]   settle by hand (newest open market, or the id)
#   bash ops.sh void [id]                  cancel the market and refund everyone
#   bash ops.sh winners [week|all] [weeksAgo] [limit]   who to pay (PRIVATE: shows emails)
BASE="${BASE:-https://nitro-bet-the-express-way.onrender.com}"
for t in curl jq; do command -v "$t" >/dev/null || { echo "Please install $t first:  pkg install $t"; exit 1; }; done
cmd="${1:-help}"; [ $# -gt 0 ] && shift

if [ "$cmd" = "help" ] || [ "$cmd" = "-h" ] || [ "$cmd" = "--help" ]; then sed -n '2,10p' "$0"; exit 0; fi
if [ -z "${ADMIN_API_KEY:-}" ]; then printf "Admin key (typing is hidden): "; read -rs ADMIN_API_KEY; echo; export ADMIN_API_KEY; fi

api() { local m="$1" p="$2"; shift 2; curl -s --max-time 90 -X "$m" "$BASE$p" -H "X-Admin-Key: $ADMIN_API_KEY" -H 'Content-Type: application/json' "$@"; }
target() { api GET /api/admin/markets | jq -c --arg id "${WANT_ID:-}" '[.markets[] | select((.status == "open" or .status == "closed") and ($id == "" or .id == $id))][0] // empty'; }
need_target() { T=$(target); [ -z "$T" ] && { echo "No open or closed market found."; exit 1; }; MID=$(echo "$T" | jq -r .id); TITLE=$(echo "$T" | jq -r .title); }
ask() { printf "%s Type yes to continue: " "$1"; read -r a; [ "$a" = "yes" ] || { echo "Cancelled."; exit 0; }; }

case "$cmd" in
  stats)
    api GET /api/admin/stats | jq -r '
      "PLAYERS     total \(.players.total) | new in 24h \(.players.last24h) | new in 7 days \(.players.last7d)",
      "SIGN-UP     Google \(.players.withGoogle) | wallet linked \(.players.withWallet) | ghost mode \(.players.ghostMode)",
      "ACTIVITY    predicted at least once \(.activity.playersWhoPredicted) | active last 7 days \(.activity.activePredictors7d) | predictions \(.activity.predictionsTotal)",
      "MARKETS     open \(.markets.open) | settled \(.markets.settled)",
      "REFERRALS   referred players \(.referrals.referredPlayers) | rewarded \(.referrals.rewarded)",
      "",
      "SIGN-UPS PER DAY (latest first)",
      (.signupsByDay[] | "  \(.day)  \(.signups)"),
      "",
      "COUNTRIES (from the visitor network, may be unknown)",
      (.playersByCountry[] | "  \(.country)  \(.players)")' ;;
  markets)
    api GET /api/admin/markets | jq -r '.markets[] | "\(.status | ascii_upcase)  \(.title)  [\(.model)\(if .autoSettle then ", auto-settles" else ", manual" end)]  \(.predictions) predictions\n   id \(.id)"' ;;
  create)
    if [ $# -lt 3 ]; then set -- "${1:-Next F1 Race: Winner}" "Max Verstappen:1.59" "Lando Norris:3.56" "Charles Leclerc:5.62" "Oscar Piastri:8.08" "Lewis Hamilton:12.25"; fi
    title="$1"; shift
    outs=$(for o in "$@"; do jq -n --arg l "${o%:*}" --arg d "${o##*:}" '{label: $l, odds: $d}'; done | jq -s .)
    api POST /api/admin/markets -d "$(jq -n --arg t "$title" --argjson o "$outs" '{title: $t, outcomes: $o, autoSettle: "f1_race_winner"}')" | jq . ;;
  close)
    WANT_ID="${1:-}"; need_target; ask "Close '$TITLE' (no more predictions)?"; api POST "/api/admin/markets/$MID/close" | jq . ;;
  void)
    WANT_ID="${1:-}"; need_target; ask "Cancel '$TITLE' and refund every prediction?"; api POST "/api/admin/markets/$MID/void" | jq . ;;
  settle)
    label="${1:-}"; WANT_ID="${2:-}"; need_target
    OID=$(echo "$T" | jq -r --arg l "$label" '.outcomes[] | select((.label | ascii_downcase) == ($l | ascii_downcase)) | .id')
    if [ -z "$label" ] || [ -z "$OID" ]; then echo "Say who won, exactly as written. Choices:"; echo "$T" | jq -r '.outcomes[] | "  " + .label'; exit 1; fi
    ask "Settle '$TITLE' with '$label' as the winner? This pays everyone and cannot be undone."
    api POST "/api/admin/markets/$MID/settle" -d "$(jq -n --arg o "$OID" '{winningOutcomeId: $o}')" | jq . ;;
  winners)
    api GET "/api/admin/winners?period=${1:-week}&weeksAgo=${2:-0}&limit=${3:-10}" | jq -r '
      "From \(.from) to \(.to)",
      (.entries[] | "\(.rank). \(.displayName) | net \(.net) | \(.predictions) predictions | \(.email) | wallet: \(.wallet // "not linked")")' ;;
  *) echo "Unknown command: $cmd"; sed -n '2,10p' "$0"; exit 1 ;;
esac
