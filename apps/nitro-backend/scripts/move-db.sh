#!/usr/bin/env bash
# Copies the whole Apexly database from the old Postgres (Render) to a new EMPTY one (Neon).
# Needs the Postgres tools (Termux: pkg install postgresql). Run:  bash move-db.sh
# It asks for both connection strings with hidden typing, so nothing secret is shown or saved.
# It only READS the old database. The dump file holds emails and password hashes: it is kept private and deleted at the end.
set -uo pipefail
for t in pg_dump pg_restore psql; do command -v "$t" >/dev/null || { echo "Please install the Postgres tools first:  pkg install postgresql"; exit 1; }; done

printf "OLD database address (Render, the EXTERNAL one; typing is hidden): "; read -rs OLD; echo
printf "NEW database address (Neon, the DIRECT one, host has no \"-pooler\"; typing is hidden): "; read -rs NEW; echo
[ -n "$OLD" ] && [ -n "$NEW" ] || { echo "Both addresses are needed."; exit 1; }
[ "$OLD" != "$NEW" ] || { echo "The two addresses are the same. Stopping so nothing gets overwritten."; exit 1; }
case "$NEW" in *-pooler*) echo "The NEW address is a pooled one (contains -pooler). In Neon's Connect box, switch Connection pooling OFF and copy again."; exit 1;; esac

q() { psql "$1" -X -A -t -q -v ON_ERROR_STOP=1 -c "$2" 2>/dev/null; }
echo "Checking both databases..."
[ "$(q "$OLD" 'select 1')" = "1" ] || { echo "Cannot connect to the OLD database. Check the address (Render > your database > External Database URL)."; exit 1; }
[ "$(q "$NEW" 'select 1')" = "1" ] || { echo "Cannot connect to the NEW database. Check the address."; exit 1; }

TABLES="players ledger_entries markets outcomes wagers audit_log player_wallets wallet_challenges schema_migrations"
counts() { for t in $TABLES; do printf "%s=%s " "$t" "$(q "$1" "select count(*) from $t" || echo missing)"; done; echo; }

NEW_TABLES=$(q "$NEW" "select count(*) from information_schema.tables where table_schema='public'")
if [ "${NEW_TABLES:-0}" != "0" ]; then
  echo "The NEW database already has $NEW_TABLES tables. This tool wants an empty one (it would replace what is there)."
  printf "Replace them with a copy of the old data? Type yes to continue: "; read -r a; [ "$a" = "yes" ] || { echo "Cancelled."; exit 0; }
fi

echo; echo "OLD: $(counts "$OLD")"
FILE=$(mktemp); chmod 600 "$FILE"; trap 'rm -f "$FILE"' EXIT
echo "Copying out of the old database..."
pg_dump --format=custom --no-owner --no-privileges --file="$FILE" "$OLD" || { echo "pg_dump failed. If it says 'server version mismatch', update with: pkg upgrade postgresql"; exit 1; }
echo "Copying into the new database (all or nothing)..."
pg_restore --no-owner --no-privileges --clean --if-exists --single-transaction --exit-on-error --dbname="$NEW" "$FILE" || { echo "Restore failed. Nothing was half-copied (it is one transaction). Tell me the message above."; exit 1; }

echo; echo "NEW: $(counts "$NEW")"
if [ "$(counts "$OLD")" = "$(counts "$NEW")" ]; then
  echo; echo "MATCH: every table has the same number of rows. Now do step 4 of the guide (change DATABASE_URL in Render)."
else
  echo; echo "MISMATCH: the numbers differ. If people played while this ran, run it again. Do NOT switch Render yet."; exit 2
fi
