# Архитектура Finder-backend

NestJS, Fastify, MikroORM, Postgres. Направление зависимостей:

`interfaces → application → domain ← infrastructure`

Типы из `backend/src/interfaces/http/generated` используются только в `interfaces`. Каталог `generated` руками не правят.

## Контракт

Единственный источник HTTP — соседний каталог `Finder-api-contract`, версия git-тегом.

В `backend/CONTRACT_VERSION` записан тег. `CONTRACT_REPO` по умолчанию `../../Finder-api-contract` (из каталога `backend`). Если каталог — git, `npm run contract:sync` делает checkout этого тега, кладёт бандл в `backend/api/openapi.*` и генерирует типы.

## CRUD-база

Общий каркас списка и карточки уже есть, запись тоже: `CrudServiceImpl` → `CrudHttpServiceImpl` → `CrudControllerImpl`. Удаление в этой базе — soft-delete (`deletedAt` на `CrudEntity`, фильтр `softDelete`).

Текущие ручки Finder на эти классы не переведены. Их сущности остаются на `BaseEntity` без soft-delete. Служебный вход админских ручек — `AdminTokenGuard`.
