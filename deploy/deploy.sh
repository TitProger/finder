#!/usr/bin/env bash
# Идемпотентная выкладка на VPS. Секреты не печатает.
# Фазы: sync, up, all (по умолчанию).
set -euo pipefail

export DEBIAN_FRONTEND=noninteractive

ROOT="${FINDER_ROOT:-/opt/finder}"
REPO_URL="${FINDER_REPO_URL:-https://github.com/TitProger/finder.git}"
PHASE="${1:-all}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:8080/health}"

if [[ "$(id -u)" -eq 0 ]]; then
  SUDO=()
  DOCKER=(docker)
else
  SUDO=(sudo)
  DOCKER=(sudo docker)
fi

log() {
  printf '%s\n' "$*"
}

compose() {
  "${DOCKER[@]}" compose --env-file "$ROOT/backend/.env" -f "$ROOT/deploy/docker-compose.prod.yml" "$@"
}

show_logs() {
  compose logs --tail 200 || true
}

install_packages() {
  "${SUDO[@]}" apt-get update
  "${SUDO[@]}" apt-get install -y ca-certificates curl git
}

install_docker() {
  if "${DOCKER[@]}" compose version >/dev/null 2>&1; then
    return 0
  fi

  log "→ Устанавливаю Docker"
  "${SUDO[@]}" install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | "${SUDO[@]}" tee /etc/apt/keyrings/docker.asc >/dev/null
  "${SUDO[@]}" chmod a+r /etc/apt/keyrings/docker.asc
  local codename
  codename="$(. /etc/os-release && printf '%s' "$VERSION_CODENAME")"
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${codename} stable" |
    "${SUDO[@]}" tee /etc/apt/sources.list.d/docker.list >/dev/null
  "${SUDO[@]}" apt-get update
  "${SUDO[@]}" apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  "${SUDO[@]}" systemctl enable --now docker
}

ensure_writable() {
  if [[ -d "$ROOT" && ! -w "$ROOT" ]]; then
    "${SUDO[@]}" chown -R "$(id -un):$(id -gn)" "$ROOT"
  fi
}

sync_repo() {
  local sha="${FINDER_SHA:-}"

  if [[ -z "$sha" ]]; then
    log "FINDER_SHA пустой, каталог $ROOT не обновляю"
    return 0
  fi

  if [[ ! "$sha" =~ ^[0-9a-fA-F]{7,40}$ ]]; then
    log "FINDER_SHA должен быть git SHA"
    exit 1
  fi

  install_packages
  if [[ ! -d "$ROOT" ]]; then
    "${SUDO[@]}" install -d -m 755 "$ROOT"
    if [[ "$(id -u)" -ne 0 ]]; then
      "${SUDO[@]}" chown "$(id -un):$(id -gn)" "$ROOT"
    fi
  fi
  ensure_writable

  if [[ ! -d "$ROOT/.git" ]]; then
    if [[ -d "$ROOT" ]] && [[ -n "$(ls -A "$ROOT" 2>/dev/null || true)" ]]; then
      log "Каталог $ROOT не пустой и это не git-репозиторий"
      exit 1
    fi
    log "→ Клонирую $REPO_URL"
    GIT_TERMINAL_PROMPT=0 git clone --depth 1 "$REPO_URL" "$ROOT"
  fi

  log "→ Обновляю $ROOT до $sha"
  git -C "$ROOT" remote set-url origin "$REPO_URL"
  GIT_TERMINAL_PROMPT=0 git -C "$ROOT" fetch --depth 1 origin "$sha"
  git -C "$ROOT" checkout --force --detach "$sha"
}

require_env_file() {
  if [[ ! -f "$ROOT/backend/.env" ]]; then
    log "Нет $ROOT/backend/.env"
    exit 1
  fi

  "${SUDO[@]}" chmod 600 "$ROOT/backend/.env"
}

deploy_app() {
  install_packages
  install_docker
  require_env_file

  log "→ Собираю и поднимаю контейнеры"
  if ! compose up -d --build --wait --wait-timeout 180; then
    show_logs
    exit 1
  fi

  log "→ Миграции"
  if ! compose exec -T -e TELEGRAM_POLLING=false app node dist/src/infrastructure/database/migrate.command.js; then
    show_logs
    exit 1
  fi

  log "→ Справочник категорий"
  if ! compose exec -T -e TELEGRAM_POLLING=false app npm run seed; then
    show_logs
    exit 1
  fi

  log "→ Удаляю старые образы"
  "${DOCKER[@]}" image prune -f >/dev/null

  log "→ Проверяю $HEALTH_URL"
  local ok=0
  local attempt
  for attempt in 1 2 3 4 5 6; do
    if curl -fsS "$HEALTH_URL" >/dev/null; then
      ok=1
      break
    fi
    sleep 5
  done

  if [[ "$ok" -ne 1 ]]; then
    log "Healthcheck не прошёл"
    show_logs
    exit 1
  fi

  log "✓ Finder отвечает на /health"
}

case "$PHASE" in
  sync)
    sync_repo
    ;;
  up)
    deploy_app
    ;;
  all)
    sync_repo
    deploy_app
    ;;
  *)
    log "Фаза должна быть sync, up или all"
    exit 1
    ;;
esac
