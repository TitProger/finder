# Changelog api-contract

## v0.8.0

Убраны вход по логину и обновление сессии. Админские ручки принимают только статический Bearer-токен.

- Удалены `POST /admin/login` и `POST /admin/refresh`
- `POST /inquiries` и `GET /inquiries/{id}` тоже принимают только статический Bearer-токен
- Исход классификации: `no_match` вместо прежней заглушки. Совпадение по похожести больше не описывается

## v0.4.0

Оптимальная карточка.

- `POST /admin/optimal-cards`, `GET|PATCH /admin/optimal-cards/{id}` — вручную или из оффера
- Одна живая строка на товар и диапазон количества. Повторная живая снимает флаг, строка остаётся
- В заявке `optimalCardId` и `optimalCard`. Совпадение обязательных ответов и объёма отдаёт карточку, `research_run` не создаётся

## v0.3.1

Поле `photoUrls` заявки хранит Telegram file_id. Его пишет бот. `POST /inquiries` фото по-прежнему не принимает.

## v0.3.0

Заявка: текст клиента, чтение, назначение категории админом.

- `POST /inquiries`, `GET /inquiries/{id}` — без токена админа, клиент по telegram user id
- `POST /admin/inquiries/{id}/assign-category`
- `POST /admin/inquiries/{id}/assign-new-category` — новая категория и фраза клиента в `category_phrase`
- Назначение снимает паузу. Коммерческое предложение и ресерч в контракт не входят

## v0.2.0

Вход админа и Bearer-токен.

- `POST /admin/login`, `POST /admin/refresh`
- `bearerAuth` на ручках `/admin/categories…`
- Публичные: `/health`, `/admin/login`, `/admin/refresh`

## v0.1.0

CRUD справочника категорий для админа.

- `POST /admin/categories`, `GET|PATCH /admin/categories/{id}`
- Фразы, пакеты вопросов, вопросы, площадки под `/admin/categories/{categoryId}/…`
- `GET` категории отдаёт вложенный `CategoryDetail`

## v0.0.1

Каркас контракта.

- `GET /health` — проверка сервиса. Ответ в конверте `ApiResponse`, в `data` только `status`.
