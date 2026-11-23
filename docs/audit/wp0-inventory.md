# Инвентаризация WP0

Дата: 21 ноября 2026 (Europe/Moscow).

Дальнейший порядок работ после переноса папки — редакция 1.3: `docs/plans/web-rework-1.3.md`. Этот файл остаётся снимком WP0 и сам по себе пакеты не меняет. Пути ниже к `Finder-materials` записаны до переноса; сейчас материалы лежат в `Finder-backend/Finder-materials/`.

## Источник дальнейшей работы

Источник дальнейшей работы — план редакции 1.2, прочитанный целиком, включая паспорт аудита в разделе 0 и пакет WP0 в разделе 9:

`/Users/fs/May Progect/Finder/Finder-materials/Finder — план переработки в веб-сервис поиска товаров и поставщиков — 21.11.2026 — редакция 1.2.docx`

Раздел 14 и исторический промпт для Google Stitch в этом этапе не применялись: первая страница из него не генерировалась, дизайн не менялся.

Файлы ниже в этом этапе оставлены как есть. Их пометка как устаревших относится к WP1:

- `docs/plans/product-plan.md`
- `docs/plans/tech-plan.md`
- старое описание Telegram-бота в `README.md`

## Обновление main

- SHA до обновления, локальный HEAD: `c9fb7e4f6ab05db3936eb183748c4a5a773fc554`
- SHA после `git fetch origin` и fast-forward, локальный HEAD и `origin/main`: `4a481c7892a0444a4e2886f83650e1a018bd9d82`
- Снимок плана, раздел 0: `4a481c7892a0444a4e2886f83650e1a018bd9d82`

Совпадение со снимком плана подтверждено. После `git fetch origin` вершина `origin/main` равна `4a481c7892a0444a4e2886f83650e1a018bd9d82` (Merge pull request #15, cursor[bot], 2026-11-16T04:31:20Z). Локальный `main` был строго позади на 41 коммит. Рабочее дерево отличалось от HEAD только незакоммиченной папкой `Finder-materials`. Выполнен обычный fast-forward: `git merge --ff-only origin/main`. Force-push, `reset --hard` и пропуск хуков не применялись. Пуш не выполнялся.

## Заявление владельца о данных

Владелец заявил: проект нигде не запускался; в базах нет нужных данных; боевой дамп, SSH на сервер и проверка production не нужны. Дамп базы в этом этапе не делался. Миграции ни к какой базе не применялись.

## Верхние папки репозитория

В снимке `4a481c7892a0444a4e2886f83650e1a018bd9d82` на верхнем уровне:

- `.github`
- `api-contract`
- `backend`
- `deploy`
- `docs`

Рядом на диске, вне этого коммита и без изменений в этом этапе:

- `Finder-materials` — незакоммиченные исходные материалы
- `_nested_git_backup` — каталог из `.gitignore`; не открывался и не менялся

## Telegram-код

Код Telegram на месте и в этом этапе не удалялся:

- `backend/src/application/telegram/` (`acting-admin.ts`, `admin-telegram-ids.ts`)
- `backend/src/infrastructure/telegram/` (`telegram-manager-notify.ts`, `telegram-manager-notify.spec.ts`, `telegram-text.ts`)
- `backend/src/interfaces/telegram/` (`telegram-api.ts`, `telegram-callback.ts`, `telegram-dialog.ts`, `telegram-dialog.spec.ts`, `telegram-intake.ts`, `telegram-intake.spec.ts`, `telegram-poller.ts`, `telegram-update.ts`, `telegram.types.ts`)

Дизайн, таксономия, заявки, Telegram и API в этом этапе не менялись. Файлы репозитория не удалялись.

## Пути к плану и материалам

План:

- `/Users/fs/May Progect/Finder/Finder-materials/Finder — план переработки в веб-сервис поиска товаров и поставщиков — 21.11.2026 — редакция 1.2.docx`

Материалы оставлены на месте и в коммит не входят:

- исследование: `/Users/fs/May Progect/Finder/Finder-materials/Finder — Wikkeo и Aidentika_ структура, UX и логика — 21.11.2026.docx`
- таксономия: `/Users/fs/May Progect/Finder/Finder-materials/wikkeo-categories.csv`
- таксономия: `/Users/fs/May Progect/Finder/Finder-materials/wikkeo-categories.json`
- утверждённый дизайн: `/Users/fs/May Progect/Finder/Finder-materials/Finder-дизайн-первой-страницы-утверждён-21.11.2026.zip`
- эталон вида: `/Users/fs/May Progect/Finder/Finder-materials/design/screen.png`
- исходник UI: `/Users/fs/May Progect/Finder/Finder-materials/design/code.html`

## Следующий этап

Следующий этап — только WP1. WP2 и последующие пакеты не начаты.
