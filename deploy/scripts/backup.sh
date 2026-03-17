#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
ROOT_DIR=$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)
ENV_FILE="${ENV_FILE:-$ROOT_DIR/deploy/.env.production}"

if [ ! -f "$ENV_FILE" ]; then
  echo "Fichier d'environnement introuvable: $ENV_FILE" >&2
  exit 1
fi

set -a
. "$ENV_FILE"
set +a

: "${PGUSER:?PGUSER requis}"
: "${PGPASSWORD:?PGPASSWORD requis}"
: "${PGDATABASE:?PGDATABASE requis}"

BACKUP_DIR="${BACKUP_HOST_PATH:-$ROOT_DIR/backups}"
STORAGE_DIR="${STORAGE_HOST_PATH:-$ROOT_DIR/storage}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

mkdir -p "$BACKUP_DIR"

echo "Sauvegarde PostgreSQL..."
docker compose -f "$ROOT_DIR/docker-compose.yml" --env-file "$ENV_FILE" exec -T -e PGPASSWORD="$PGPASSWORD" postgres \
  pg_dump -U "$PGUSER" -d "$PGDATABASE" -Fc > "$BACKUP_DIR/postgres_${TIMESTAMP}.dump"

if [ -d "$STORAGE_DIR" ]; then
  echo "Archive du stockage medias..."
  tar -czf "$BACKUP_DIR/storage_${TIMESTAMP}.tar.gz" -C "$STORAGE_DIR" .
fi

echo "Sauvegarde terminee dans $BACKUP_DIR"
