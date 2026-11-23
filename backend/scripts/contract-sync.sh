#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ -f .env ]]; then
  set -a
  # source ломается на значениях с пробелом.
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line%$'\r'}"
    [[ -z "${line//[[:space:]]/}" || "$line" =~ ^[[:space:]]*# ]] && continue
    if [[ "$line" =~ ^([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]]; then
      key="${BASH_REMATCH[1]}"
      value="${BASH_REMATCH[2]}"
      if [[ "$value" =~ ^\".*\"$ || "$value" =~ ^\'.*\'$ ]]; then
        value="${value:1:${#value}-2}"
      fi
      printf -v "$key" '%s' "$value"
      export "$key"
    fi
  done < .env
  set +a
fi

if [[ ! -f CONTRACT_VERSION ]]; then
  echo "Ошибка: нет файла CONTRACT_VERSION" >&2
  exit 1
fi

VERSION="$(tr -d '[:space:]' < CONTRACT_VERSION)"
CONTRACT_REPO="${CONTRACT_REPO:-../../Finder-api-contract}"
TMP_DIR="$(mktemp -d)"
SOURCE_DIR=""

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

if [[ -z "$VERSION" ]]; then
  echo "Ошибка: CONTRACT_VERSION пуст" >&2
  exit 1
fi

echo "→ Синхронизация контракта ${VERSION}"
echo "→ Источник: ${CONTRACT_REPO}"

if [[ -d "$CONTRACT_REPO" ]]; then
  SOURCE_DIR="$(cd "$CONTRACT_REPO" && pwd)"
  if [[ -d "$SOURCE_DIR/.git" ]]; then
    echo "→ Локальный git-репо: checkout ${VERSION}"
    git -C "$SOURCE_DIR" fetch --tags --depth 1 2>/dev/null || true
    git -C "$SOURCE_DIR" checkout "$VERSION" 2>/dev/null \
      || echo "⚠ Tag/ветка ${VERSION} не найдена локально — используем текущее дерево"
  fi
else
  echo "→ Клонируем ${CONTRACT_REPO} @ ${VERSION}"
  git clone --depth 1 --branch "$VERSION" "$CONTRACT_REPO" "$TMP_DIR/contract"
  SOURCE_DIR="$TMP_DIR/contract"
fi

if [[ ! -f "$SOURCE_DIR/openapi.yaml" ]]; then
  echo "Ошибка: не найден $SOURCE_DIR/openapi.yaml" >&2
  exit 1
fi

mkdir -p api src/interfaces/http/generated

echo "→ Bundle OpenAPI → api/openapi.yaml / api/openapi.json"
npx --yes @redocly/cli@1 bundle "$SOURCE_DIR/openapi.yaml" -o api/openapi.yaml
npx --yes @redocly/cli@1 bundle "$SOURCE_DIR/openapi.yaml" -o api/openapi.json

echo "→ Codegen типов → src/interfaces/http/generated/schema.ts"
npx --yes openapi-typescript@7 api/openapi.yaml -o src/interfaces/http/generated/schema.ts

echo "→ Разбиение типов → common / requests / responses"
node scripts/split-generated-types.mjs

echo "✓ Контракт ${VERSION} синхронизирован"
