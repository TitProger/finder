OpenAPI-контракт API Finder (**Contract First**).

Единственный источник правды по HTTP API.  
Реализации пинятся на **git tag**, не на «последний main».

## Связанные репозитории

| Репозиторий            | Роль                                         |
| ---------------------- | -------------------------------------------- |
| **api-contract** (этот)| OpenAPI, версии (tags)                       |
| **backend**            | `CONTRACT_VERSION` + `npm run contract:sync` |

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

1. Изменение контракта попадает в `main`
2. Tag:

```bash
git tag v0.0.1
git push origin v0.0.1
```

3. Кратко описать изменения в `CHANGELOG.md` (ломающие — явно)

Семантика:

- **patch** — правки описаний, примеры
- **minor** — новые эндпоинты / опциональные поля
- **major** — ломающие изменения (удаление или переименование полей, смена enum)

## Как подключить на бэке

В `.env` backend:

```env
CONTRACT_REPO=../api-contract
```

В корне бэка файл `CONTRACT_VERSION`:

```text
v0.0.1
```

Затем:

```bash
npm run contract:sync
```

Скрипт возьмёт контракт по тегу, склеит бандл в `api/openapi.*` и сгенерирует типы в `src/interfaces/http/generated`. Эти файлы руками не правят.

## Локальная проверка бандла

```bash
npx @redocly/cli bundle openapi.yaml -o /tmp/openapi.bundled.yaml
```

## Текущая версия

См. последний tag и `CHANGELOG.md`. Текущая по журналу: **v0.4.0**.
