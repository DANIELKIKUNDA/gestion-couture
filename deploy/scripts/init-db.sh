#!/bin/sh
set -eu

APP_DIR="${APP_DIR:-$(pwd)}"

: "${PGHOST:?PGHOST requis}"
: "${PGPORT:?PGPORT requis}"
: "${PGUSER:?PGUSER requis}"
: "${PGPASSWORD:?PGPASSWORD requis}"
: "${PGDATABASE:?PGDATABASE requis}"

echo "Attente de PostgreSQL sur ${PGHOST}:${PGPORT}..."
until pg_isready -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" >/dev/null 2>&1; do
  sleep 2
done

export PGPASSWORD="$PGPASSWORD"

cd "$APP_DIR"
psql -v ON_ERROR_STOP=1 -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -f schema_all.sql

echo "Base initialisee avec succes."
