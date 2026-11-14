# Project Finder

Telegram-бот для поиска поставщиков и товаров. Клиент пишет запрос, бот классифицирует его, задаёт уточняющие вопросы и либо выдаёт сохранённую оптимальную карточку, либо запускает ресерч.

## Стек

- **Backend**: NestJS 11, Fastify 5, MikroORM 6.5, PostgreSQL 17 + pgvector
- **Runtime**: Node.js 24
- **CI**: GitHub Actions

## Структура проекта

```
.
├── api-contract/          # OpenAPI спецификация (контракт API)
├── backend/               # NestJS приложение
│   ├── src/
│   │   ├── domain/        # Сущности, enum'ы, репозитории
│   │   ├── application/   # Бизнес-логика, сервисы
│   │   ├── infrastructure/# Реализации репозиториев, сидеры
│   │   ├── interfaces/    # HTTP контроллеры, Telegram бот
│   │   └── migrations/    # Миграции БД
│   ├── Dockerfile
│   └── docker-compose.yml
└── docs/plans/            # Документация и планы проекта
```

## Быстрый старт

### Требования

- Node.js 24+
- PostgreSQL 17 или Docker

### Установка зависимостей

```bash
cd backend
npm ci
```

### Настройка окружения

Скопируйте `.env.example` в `.env` и настройте переменные:

```bash
cp .env.example .env
```

**Обязательные переменные для production:**

- `ADMIN_API_TOKEN` — статический токен для доступа к HTTP API админки
- `ADMIN_TELEGRAM_IDS` — список Telegram ID админов через запятую (например: `871909427,123456789`)
- `JWT_SECRET` — секрет для JWT (если используете JWT вместо статического токена)
- `ADMIN_SEED_PASSWORD` — пароль для seed-админа

**Telegram бот:**

- `TELEGRAM_BOT_TOKEN` — токен бота от @BotFather

**База данных:**

- `PG_HOST`, `PG_PORT`, `PG_DATABASE`, `PG_USERNAME`, `PG_PASSWORD`

**Тарифы:**

- `FREE_PLAN_DAILY_LIMIT` — лимит запросов в день для бесплатного тарифа (по умолчанию 3)

### Запуск с Docker Compose

```bash
cd backend
docker compose up
```

Приложение будет доступно на `http://localhost:8080`.

### Локальная разработка

1. Запустите PostgreSQL (или используйте `docker compose up postgres`)
2. Выполните миграции:
   ```bash
   npm run migration:up
   ```
3. Запустите приложение:
   ```bash
   npm run start:dev
   ```

### Проверка работы

```bash
# Health check
curl http://localhost:8080/health

# Swagger UI (если включен)
open http://localhost:8080/docs
```

## Разработка

### Команды

```bash
# Линтинг
npm run lint
npm run lint:fix

# Проверка типов
npm run typecheck

# Сборка
npm run build

# Тесты
npm test
npm run test:watch
npm run test:cov

# Миграции
npm run migration:create -- --name MigrationName
npm run migration:up
npm run migration:down
```

### CI/CD

GitHub Actions CI автоматически запускается на push и PR:
- Проверка lint
- Проверка типов
- Сборка
- Запуск тестов

## Аутентификация и авторизация

### HTTP API

Для доступа к защищённым эндпоинтам используйте Bearer токен:

```bash
curl -H "Authorization: Bearer YOUR_ADMIN_API_TOKEN" \
  http://localhost:8080/admin/categories
```

Поддерживается два способа аутентификации:
1. **Статический токен** (`ADMIN_API_TOKEN`) — рекомендуется
2. **JWT** — для обратной совместимости (через `POST /admin/login`)

### Telegram бот

Администраторы определяются по Telegram ID из `ADMIN_TELEGRAM_IDS`. При первом взаимодействии админа с ботом автоматически создаётся учётная запись с ролью ADMIN и безлимитным тарифом.

## Тарифы и лимиты

### Тарифные планы

- **free** — бесплатный тариф с дневным лимитом запросов на ресерч (по умолчанию 3/день)
- **unlimited** — безлимитный тариф (для админов)

### Дневные лимиты

- Лимиты считаются по московскому времени (Europe/Moscow)
- Сброс счётчика происходит в полночь по Москве
- **Важно**: возврат сохранённой оптимальной карточки НЕ расходует дневной лимит
- Админы из `ADMIN_TELEGRAM_IDS` всегда имеют безлимитный доступ

При исчерпании лимита клиент получает вежливое сообщение на русском языке.

## Безопасность

- Эндпоинты `/inquiries` защищены — требуют аутентификации
- В production приложение не стартует без установленных секретов
- Значения по умолчанию (`admin/admin`, dev JWT secret) запрещены в production
- Цены НИКОГДА не отправляются клиенту — только менеджеру/админу

## Архитектура

### Слои

1. **Domain** — чистая бизнес-логика, сущности, интерфейсы репозиториев
2. **Application** — сценарии использования, сервисы, порты
3. **Infrastructure** — реализации репозиториев, внешние зависимости
4. **Interfaces** — HTTP контроллеры, Telegram бот

### Telegram диалог

1. Клиент пишет текст → создаётся заявка
2. Классификация по фразам категорий
3. Уверенная категория → вопросы по одному
4. Пауза (неуверенность) → карточка админу с кнопками
5. После всех ответов:
   - Ищется сохранённая оптимальная карточка
   - Если нет → проверка дневного лимита
   - Лимит исчерпан → вежливое сообщение клиенту
   - Лимит не исчерпан → запуск ресерча (TODO: этап 5)

### База данных

16 таблиц:
- Пользователи и роли: `app_user`
- Категории и вопросы: `category`, `category_phrase`, `question_pack`, `category_question`, `category_site`
- Заявки: `inquiry`, `inquiry_answer`
- Каталог: `canonical_product`, `company`, `storefront`, `offer`
- Рынок: `market_snapshot`, `optimal_card`, `manual_economics`, `research_run`
- Тарифы: `plan`, `daily_usage`

## Следующие этапы

См. `docs/plans/` для полного плана разработки. Текущие этапы (0 и 1) завершены:

- ✅ Этап 0: Гигиена (lint, CI, Docker, безопасность)
- ✅ Этап 1: Админ по Telegram ID, дневные лимиты
- 🔲 Этап 2: Семь категорий из YAML
- 🔲 Этап 3: Нормальная классификация
- 🔲 Этап 4: Приём досье `/research/ingest`
- 🔲 Этап 5: Запуск ресерча через webhook
- 🔲 Этап 6: Передача менеджеру в Telegram
- 🔲 Этап 7: Три цены и ручная экономика

## Лицензия

UNLICENSED (частный проект)
