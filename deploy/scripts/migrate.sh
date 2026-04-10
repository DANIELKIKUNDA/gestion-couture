#!/bin/sh
set -eu

APP_DIR="${APP_DIR:-/app}"

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

for file in "$APP_DIR"/scripts/migrations/*.sql; do
  [ -f "$file" ] || continue
  echo "Application de $(basename "$file")"
  psql -v ON_ERROR_STOP=1 -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -f "$file"
done

echo "Migrations appliquees avec succes."
