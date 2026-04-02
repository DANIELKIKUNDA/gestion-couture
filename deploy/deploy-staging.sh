#!/usr/bin/env bash
set -uo pipefail

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

fail_deploy() {
  local exit_code="$1"
  local step_name="$2"
  log "ERREUR pendant l'etape: ${step_name} (code=${exit_code})"
  if [[ "${DEPLOY_STARTED}" -eq 1 && "${DEPLOY_SUCCEEDED}" -eq 0 ]]; then
    rollback
  else
    log "Aucun rollback necessaire."
  fi
  exit "${exit_code}"
}

run_step() {
  local step_name="$1"
  shift
  log "${step_name}"
  if "$@"; then
    return 0
  fi
  local exit_code=$?
  fail_deploy "${exit_code}" "${step_name}"
}

run_step "Validation compose" compose config -q

log "Commit courant: ${PREVIOUS_COMMIT}"
DEPLOY_STARTED=1
run_step "Recuperation du code ${DEPLOY_REF}" git fetch origin "${DEPLOY_REF}"
run_step "Selection de la branche ${DEPLOY_REF}" git checkout "${DEPLOY_REF}"
run_step "Mise a jour fast-forward ${DEPLOY_REF}" git pull --ff-only origin "${DEPLOY_REF}"
log "Commit deployee: $(git rev-parse HEAD)"

run_step "Build images staging" compose build backend nginx

run_step "Execution migrations" compose run --rm backend sh /app/deploy/scripts/migrate.sh

run_step "Redemarrage staging" compose up -d
if ! compose ps; then
  log "Avertissement: impossible de lister l'etat compose, poursuite avec health check."
fi

log "Verification health check"
if ! wait_for_health; then
  fail_deploy 1 "Verification health check"
fi
DEPLOY_SUCCEEDED=1

log "Deploy staging termine avec succes."
exit 0
