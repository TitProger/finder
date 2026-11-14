OpenAPI-контракт API Finder (**Contract First**).

Единственный источник правды по HTTP API — этот каталог в репозитории.

## Связанные части

| Часть | Роль |
| --- | --- |
| **api-contract** | OpenAPI, версия в `openapi.yaml` |
| **backend** | `npm run contract:sync` берёт текущее дерево, без checkout |

## Структура

```
.
├── openapi.yaml
├── paths/
│   └── common/health.yaml
├── components/
│   ├── schemas/common.yaml
│   └── responses/errors.yaml
├── CHANGELOG.md
└── README.md
```

Новая область = новый файл в `paths/` + схемы в `components/schemas/` + `$ref` в корневом `openapi.yaml`.

## Версионирование

Версия лежит в `info.version` файла `openapi.yaml`. Кратко описать изменения в `CHANGELOG.md` (ломающие — явно).

Семантика:

- **patch** — правки описаний, примеры
- **minor** — новые эндпоинты / опциональные поля
- **major** — ломающие изменения (удаление или переименование полей, смена enum)

## Как подключить на бэке

В `.env` backend:

```env
CONTRACT_REPO=../api-contract
```

Затем:

```bash
npm run contract:sync
```

Скрипт склеивает бандл в `api/openapi.*` и генерирует типы в `src/interfaces/http/generated`. Эти файлы руками не правят.

## Локальная проверка бандла

```bash
npx @redocly/cli bundle openapi.yaml -o /tmp/openapi.bundled.yaml
```

## Текущая версия

См. `openapi.yaml` и `CHANGELOG.md`.
