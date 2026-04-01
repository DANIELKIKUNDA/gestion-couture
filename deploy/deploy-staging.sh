#!/usr/bin/env bash
set -Eeuo pipefail

log() {
  printf '[deploy-staging] %s\n' "$*"
}

SCRIPT_SOURCE="${BASH_SOURCE[0]:-$0}"
if [[ -n "${APP_DIR:-}" ]]; then
  APP_DIR="$(cd "${APP_DIR}" && pwd)"
else
  SCRIPT_DIR="$(cd "$(dirname "${SCRIPT_SOURCE}")" && pwd)"
  APP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
fi

COMPOSE_FILE="${COMPOSE_FILE:-${APP_DIR}/docker-compose.staging.yml}"
ENV_FILE="${ENV_FILE:-${APP_DIR}/deploy/.env.staging}"
PROJECT_NAME="${COMPOSE_PROJECT_NAME:-atelier-staging}"
DEPLOY_REF="${DEPLOY_REF:-staging}"
HEALTH_RETRIES="${HEALTH_RETRIES:-12}"
HEALTH_SLEEP_SECONDS="${HEALTH_SLEEP_SECONDS:-5}"

if [[ ! -f "${COMPOSE_FILE}" ]]; then
  log "ERREUR: compose staging introuvable: ${COMPOSE_FILE}"
  exit 1
fi

if [[ ! -f "${ENV_FILE}" ]]; then
  log "ERREUR: env staging introuvable: ${ENV_FILE}"
  exit 1
fi

cd "${APP_DIR}"

set -a
. "${ENV_FILE}"
set +a

BACKEND_PORT="${BACKEND_HOST_PORT:-3100}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:${BACKEND_PORT}/health}"
PREVIOUS_COMMIT="$(git rev-parse HEAD)"
ROLLBACK_EXECUTED=0
DEPLOY_STARTED=0
DEPLOY_SUCCEEDED=0

compose() {
  docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" -p "${PROJECT_NAME}" "$@"
}

health_check() {
  curl -fsS "${HEALTH_URL}" >/dev/null
}

wait_for_health() {
  local attempt
  for attempt in $(seq 1 "${HEALTH_RETRIES}"); do
    if health_check; then
      log "Health check backend OK: ${HEALTH_URL}"
      return 0
    fi
    log "Health check en attente (${attempt}/${HEALTH_RETRIES})..."
    sleep "${HEALTH_SLEEP_SECONDS}"
  done
  return 1
}

rollback() {
  if [[ "${ROLLBACK_EXECUTED}" -eq 1 || "${DEPLOY_SUCCEEDED}" -eq 1 ]]; then
    return
  fi
  ROLLBACK_EXECUTED=1

  log "Rollback vers ${PREVIOUS_COMMIT}"
  git checkout "${PREVIOUS_COMMIT}"
  compose build backend nginx
  compose up -d

  if wait_for_health; then
    log "Rollback termine avec succes."
  else
    log "ECHEC: rollback deploye mais health check KO."
  fi
}

on_error() {
  local exit_code="$1"
  local line="$2"
  local command="${3:-commande inconnue}"
  log "ERREUR a la ligne ${line} (code=${exit_code}) pendant: ${command}"
  if [[ "${DEPLOY_SUCCEEDED}" -eq 1 ]]; then
    log "Health check deja valide. Rollback ignore et sortie succes."
    exit 0
  fi
  if [[ "${DEPLOY_STARTED}" -eq 1 ]]; then
    rollback
  else
    log "Aucun rollback necessaire: deploy non commence."
  fi
  exit "${exit_code}"
}

trap 'on_error $? $LINENO "$BASH_COMMAND"' ERR

log "Validation compose"
compose config -q

log "Commit courant: ${PREVIOUS_COMMIT}"
log "Recuperation du code ${DEPLOY_REF}"
DEPLOY_STARTED=1
git fetch origin "${DEPLOY_REF}"
git checkout "${DEPLOY_REF}"
git pull --ff-only origin "${DEPLOY_REF}"
log "Commit deployee: $(git rev-parse HEAD)"

log "Build images staging"
compose build backend nginx

log "Execution migrations"
compose run --rm backend sh /app/deploy/scripts/migrate.sh

log "Redemarrage staging"
compose up -d
if ! compose ps; then
  log "Avertissement: impossible de lister l'etat compose, poursuite avec health check."
fi

log "Verification health check"
wait_for_health
DEPLOY_SUCCEEDED=1

trap - ERR
log "Deploy staging termine avec succes."
exit 0
