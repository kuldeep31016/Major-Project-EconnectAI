#!/usr/bin/env bash
# Local PostgreSQL for development (production uses a managed PostgreSQL such as Neon - see docs/DEPLOYMENT.md).
# Data lives in data/postgres (gitignored). TCP only on 127.0.0.1:${PGPORT:-5433}, trust auth for localhost only.
#   scripts/local_postgres.sh init|start|stop|status|url
set -euo pipefail
cd "$(dirname "$0")/.."
DIR="data/postgres"; PORT="${PGPORT:-5433}"; DB="ecoconnect"; USER_="eco"
BIN="$(dirname "$(command -v pg_ctl)")"
export LC_ALL=C
case "${1:-status}" in
  init)
    [ -d "$DIR" ] && { echo "already initialised: $DIR"; exit 0; }
    "$BIN/initdb" -D "$DIR" -U "$USER_" -A trust -E UTF8 --locale=C >/dev/null
    printf "listen_addresses = '127.0.0.1'\nport = %s\nunix_socket_directories = ''\n" "$PORT" >> "$DIR/postgresql.conf"
    "$BIN/pg_ctl" -D "$DIR" -l "$DIR/server.log" start >/dev/null && sleep 2
    "$BIN/createdb" -h 127.0.0.1 -p "$PORT" -U "$USER_" "$DB"
    echo "created database $DB on 127.0.0.1:$PORT" ;;
  start)  "$BIN/pg_ctl" -D "$DIR" -l "$DIR/server.log" status >/dev/null 2>&1 || "$BIN/pg_ctl" -D "$DIR" -l "$DIR/server.log" start >/dev/null; echo "running on 127.0.0.1:$PORT" ;;
  stop)   "$BIN/pg_ctl" -D "$DIR" stop -m fast ;;
  status) "$BIN/pg_ctl" -D "$DIR" status ;;
  url)    echo "postgresql+psycopg://$USER_@127.0.0.1:$PORT/$DB" ;;
  *) echo "usage: $0 init|start|stop|status|url"; exit 2 ;;
esac
