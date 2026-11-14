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

CONTRACT_REPO="${CONTRACT_REPO:-../api-contract}"

if [[ ! -d "$CONTRACT_REPO" ]]; then
  echo "Ошибка: CONTRACT_REPO должен быть каталогом с openapi.yaml" >&2
  echo "Пример: CONTRACT_REPO=../api-contract" >&2
  exit 1
fi

SOURCE_DIR="$(cd "$CONTRACT_REPO" && pwd)"

if [[ ! -f "$SOURCE_DIR/openapi.yaml" ]]; then
  echo "Ошибка: не найден $SOURCE_DIR/openapi.yaml" >&2
  exit 1
fi

mkdir -p api src/interfaces/http/generated

echo "→ Источник: ${SOURCE_DIR}"
echo "→ Bundle OpenAPI → api/openapi.yaml / api/openapi.json"
npx --yes @redocly/cli@1 bundle "$SOURCE_DIR/openapi.yaml" -o api/openapi.yaml
npx --yes @redocly/cli@1 bundle "$SOURCE_DIR/openapi.yaml" -o api/openapi.json

echo "→ Codegen типов → src/interfaces/http/generated/schema.ts"
npx --yes openapi-typescript@7 api/openapi.yaml -o src/interfaces/http/generated/schema.ts

echo "→ Разбиение типов → common / requests / responses"
node scripts/split-generated-types.mjs

echo "✓ Контракт синхронизирован из текущего дерева"
