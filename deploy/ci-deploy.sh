#!/usr/bin/env bash
# Запускается на GitHub-hosted runner. Секреты в лог не пишет.
set -euo pipefail

require() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "Пустой обязательный секрет $name" >&2
    exit 1
  fi
  if [[ "${!name}" == *$'\n'* && "$name" != "DEPLOY_SSH_KEY" ]]; then
    echo "Секрет $name содержит перевод строки" >&2
    exit 1
  fi
}

require DEPLOY_HOST
require DEPLOY_USER
require POSTGRES_PASSWORD
require ADMIN_TELEGRAM_IDS
require ADMIN_API_TOKEN
require RESEARCH_INGEST_TOKEN
require RESEARCH_TRIGGER_SECRET
require TELEGRAM_BOT_TOKEN
require FINDER_SHA

if [[ -z "${DEPLOY_SSH_KEY:-}" && -z "${DEPLOY_PASSWORD:-}" ]]; then
  echo "Нужен DEPLOY_SSH_KEY (рекомендуется) или DEPLOY_PASSWORD" >&2
  exit 1
fi

if [[ ! "$DEPLOY_HOST" =~ ^[A-Za-z0-9._-]+$ ]]; then
  echo "DEPLOY_HOST содержит недопустимые символы" >&2
  exit 1
fi

if [[ ! "$DEPLOY_USER" =~ ^[a-z_][a-z0-9_-]*$ ]]; then
  echo "DEPLOY_USER содержит недопустимые символы" >&2
  exit 1
fi

DEPLOY_PORT="${DEPLOY_PORT:-22}"
if [[ ! "$DEPLOY_PORT" =~ ^[0-9]+$ ]]; then
  echo "DEPLOY_PORT должен быть числом" >&2
  exit 1
fi

if [[ ! "$FINDER_SHA" =~ ^[0-9a-fA-F]{7,40}$ ]]; then
  echo "FINDER_SHA должен быть git SHA" >&2
  exit 1
fi

KEY_FILE=""
SSH_BASE=(-o StrictHostKeyChecking=accept-new -o ConnectTimeout=20 -p "$DEPLOY_PORT")

if [[ -n "${DEPLOY_SSH_KEY:-}" ]]; then
  KEY_FILE="${RUNNER_TEMP:-/tmp}/finder_deploy_key"
  umask 077
  if [[ "$DEPLOY_SSH_KEY" == *$'\n'* ]]; then
    printf '%s\n' "$DEPLOY_SSH_KEY" > "$KEY_FILE"
  else
    printf '%b\n' "$DEPLOY_SSH_KEY" > "$KEY_FILE"
  fi
  chmod 600 "$KEY_FILE"
  SSH_BASE+=(-i "$KEY_FILE" -o IdentitiesOnly=yes)
fi

TARGET="$DEPLOY_USER@$DEPLOY_HOST"

if [[ -z "$KEY_FILE" ]]; then
  echo "→ Ключа нет, использую DEPLOY_PASSWORD через sshpass. Рекомендуется DEPLOY_SSH_KEY."
  sudo apt-get update
  sudo apt-get install -y sshpass
fi

run_ssh() {
  if [[ -n "$KEY_FILE" ]]; then
    ssh "${SSH_BASE[@]}" "$TARGET" "$@"
  else
    SSHPASS="$DEPLOY_PASSWORD" sshpass -e ssh "${SSH_BASE[@]}" "$TARGET" "$@"
  fi
}

run_scp() {
  local source="$1"
  local dest="$2"
  local scp_opts=(-o StrictHostKeyChecking=accept-new -o ConnectTimeout=20 -P "$DEPLOY_PORT")
  if [[ -n "$KEY_FILE" ]]; then
    scp "${scp_opts[@]}" -i "$KEY_FILE" -o IdentitiesOnly=yes "$source" "$dest"
  else
    SSHPASS="$DEPLOY_PASSWORD" sshpass -e scp "${scp_opts[@]}" "$source" "$dest"
  fi
}

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "→ Синхронизирую /opt/finder на $DEPLOY_HOST"
FINDER_SHA="$FINDER_SHA" run_ssh "FINDER_SHA='$FINDER_SHA' bash -s sync" < "$ROOT_DIR/deploy/deploy.sh"

ENV_FILE="${RUNNER_TEMP:-/tmp}/finder.env"
umask 077
PUBLIC_BASE_URL="${PUBLIC_BASE_URL:-http://$DEPLOY_HOST:8080}"
{
  printf '%s\n' "NODE_ENV=production"
  printf '%s\n' "APP_HOST=0.0.0.0"
  printf '%s\n' "APP_PORT=8080"
  printf '%s\n' "PG_ENABLED=true"
  printf '%s\n' "PG_HOST=postgres"
  printf '%s\n' "PG_PORT=5432"
  printf '%s\n' "PG_DATABASE=finder"
  printf '%s\n' "PG_USERNAME=finder"
  printf 'PG_PASSWORD=%s\n' "$POSTGRES_PASSWORD"
  printf '%s\n' "PG_MIGRATIONS_RUN=true"
  printf '%s\n' "PG_LOGGING=false"
  printf '%s\n' "SWAGGER_ENABLED=false"
  printf 'ADMIN_API_TOKEN=%s\n' "$ADMIN_API_TOKEN"
  printf 'ADMIN_TELEGRAM_IDS=%s\n' "$ADMIN_TELEGRAM_IDS"
  printf 'TELEGRAM_BOT_TOKEN=%s\n' "$TELEGRAM_BOT_TOKEN"
  printf '%s\n' "TELEGRAM_WEBHOOK_URL="
  printf '%s\n' "FREE_PLAN_DAILY_LIMIT=${FREE_PLAN_DAILY_LIMIT:-3}"
  printf 'RESEARCH_INGEST_TOKEN=%s\n' "$RESEARCH_INGEST_TOKEN"
  printf 'RESEARCH_TRIGGER_URL=%s\n' "${RESEARCH_TRIGGER_URL:-}"
  printf 'RESEARCH_TRIGGER_SECRET=%s\n' "$RESEARCH_TRIGGER_SECRET"
  printf 'PUBLIC_BASE_URL=%s\n' "$PUBLIC_BASE_URL"
  printf '%s\n' "RESEARCH_TRIGGER_MAX_ATTEMPTS=3"
  printf '%s\n' "RESEARCH_TRIGGER_RETRY_DELAY_MS=250"
  printf '%s\n' "RESEARCH_STALE_AFTER_MIN=60"
  printf '%s\n' "RESEARCH_STALE_CHECK_MIN=5"
  printf '%s\n' "MANAGER_NOTIFY_MAX_ATTEMPTS=3"
  printf '%s\n' "MANAGER_NOTIFY_RETRY_DELAY_MS=200"
  printf '%s\n' "FX_FALLBACK_CNY_RUB=${FX_FALLBACK_CNY_RUB:-12.3}"
  printf '%s\n' "FX_FALLBACK_USD_RUB=${FX_FALLBACK_USD_RUB:-90}"
  printf '%s\n' "LLM_API_BASE_URL=${LLM_API_BASE_URL:-https://api.openai.com/v1/chat/completions}"
  printf 'LLM_API_KEY=%s\n' "${LLM_API_KEY:-}"
  printf '%s\n' "LLM_MODEL=${LLM_MODEL:-gpt-4o-mini}"
  printf '%s\n' "LLM_CONFIDENCE_THRESHOLD=${LLM_CONFIDENCE_THRESHOLD:-0.7}"
} > "$ENV_FILE"
chmod 600 "$ENV_FILE"

echo "→ Записываю /opt/finder/backend/.env"
run_scp "$ENV_FILE" "$TARGET:/opt/finder/backend/.env"
rm -f "$ENV_FILE"
run_ssh "chmod 600 /opt/finder/backend/.env"

echo "→ Запускаю deploy.sh"
run_ssh "bash -s up" < "$ROOT_DIR/deploy/deploy.sh"
echo "✓ Выкладка завершена"
