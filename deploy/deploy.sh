#!/usr/bin/env bash
# На VPS только скачиваем готовый образ и запускаем его. Сборки и git здесь нет.
# Секреты не печатает. Если задан GHCR_USER, пароль реестра читается из stdin и
# после выкладки docker logout его стирает.
set -euo pipefail

export DEBIAN_FRONTEND=noninteractive

ROOT="${FINDER_ROOT:-/opt/finder}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:8080/health}"
IMAGE="${IMAGE:-ghcr.io/titproger/finder}"

if [[ "${1:-up}" != "up" ]]; then
  printf '%s\n' "На сервере больше нет сборки и git. Запускайте без аргументов." >&2
  exit 1
fi

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

if [[ -z "${IMAGE_TAG:-}" ]]; then
  log "IMAGE_TAG пустой"
  exit 1
fi

if [[ ! "$IMAGE_TAG" =~ ^[A-Za-z0-9._-]+$ ]]; then
  log "IMAGE_TAG содержит недопустимые символы"
  exit 1
fi

# Пароль реестра забираем сразу: дальше apt и docker не должны съесть stdin.
registry_password=""
if [[ -n "${GHCR_USER:-}" ]]; then
  registry_password="$(cat)"
fi

compose() {
  "${DOCKER[@]}" compose --env-file "$ROOT/.env" -f "$ROOT/docker-compose.prod.yml" "$@"
}

show_logs() {
  compose logs --tail 200 || true
}

logout_registry() {
  "${DOCKER[@]}" logout ghcr.io >/dev/null 2>&1 || true
}

install_docker() {
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

ensure_runtime() {
  local need_curl=0
  local need_docker=0

  command -v curl >/dev/null 2>&1 || need_curl=1
  "${DOCKER[@]}" compose version >/dev/null 2>&1 || need_docker=1

  if [[ "$need_curl" -eq 0 && "$need_docker" -eq 0 ]]; then
    return 0
  fi

  log "→ Не хватает curl или Docker, ставлю пакеты"
  "${SUDO[@]}" apt-get update
  if [[ "$need_curl" -eq 1 ]]; then
    "${SUDO[@]}" apt-get install -y ca-certificates curl
  fi
  if [[ "$need_docker" -eq 1 ]]; then
    install_docker
  fi
}

require_env_file() {
  if [[ ! -f "$ROOT/.env" ]]; then
    log "Нет $ROOT/.env"
    exit 1
  fi

  chmod 600 "$ROOT/.env" 2>/dev/null || "${SUDO[@]}" chmod 600 "$ROOT/.env"
}

prune_old_images() {
  local ref
  while read -r ref; do
    [[ -z "$ref" || "$ref" == *":<none>" ]] && continue
    case "$ref" in
      "$IMAGE:$IMAGE_TAG" | "$IMAGE:latest") ;;
      "$IMAGE:"*) "${DOCKER[@]}" rmi "$ref" >/dev/null 2>&1 || true ;;
    esac
  done < <("${DOCKER[@]}" images "$IMAGE" --format '{{.Repository}}:{{.Tag}}')
  "${DOCKER[@]}" image prune -f >/dev/null || true
}

ensure_runtime
require_env_file

if [[ -n "${GHCR_USER:-}" ]]; then
  if [[ ! "$GHCR_USER" =~ ^[a-zA-Z0-9_.-]+$ ]]; then
    log "GHCR_USER содержит недопустимые символы"
    exit 1
  fi
  log "→ Вход в ghcr.io на время выкладки"
  printf '%s' "$registry_password" | "${DOCKER[@]}" login ghcr.io -u "$GHCR_USER" --password-stdin >/dev/null
  unset registry_password
  trap logout_registry EXIT
fi

log "→ Скачиваю $IMAGE:$IMAGE_TAG"
if ! compose pull; then
  show_logs
  exit 1
fi

"${DOCKER[@]}" pull "$IMAGE:latest" >/dev/null
prune_old_images

log "→ Запускаю контейнеры без сборки"
if ! compose up -d --no-build --wait --wait-timeout 180; then
  show_logs
  exit 1
fi

log "→ Миграции"
if ! compose exec -T app node dist/src/infrastructure/database/migrate.command.js; then
  show_logs
  exit 1
fi

log "→ Справочник категорий"
if ! compose exec -T app npm run seed; then
  show_logs
  exit 1
fi

log "→ Проверяю $HEALTH_URL"
ok=0
for _attempt in 1 2 3 4 5 6; do
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
