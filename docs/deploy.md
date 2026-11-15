# Выкладка Finder на VPS

Сервер: Ubuntu, `130.17.14.150`, одно ядро и мало свободной памяти, рядом работают другие приложения. Образ **собирается в GitHub Actions** и публикуется в `ghcr.io/titproger/finder` с тегами SHA коммита и `latest`. На VPS сборки нет: сервер только скачивает образ и запускает контейнеры.

Postgres наружу не публикуется. Приложение слушает **127.0.0.1:8080**. Nginx уже проксирует `https://bot.passimx.com` на этот адрес. Бот ходит в Telegram через long polling, отдельный домен для Telegram не нужен.

После вливания в `main` зелёный CI сам запускает workflow **Deploy**. Две выкладки одновременно не идут.

Вход на сервер сейчас: `DEPLOY_USER=root` и `DEPLOY_PASSWORD`. Ключ `DEPLOY_SSH_KEY` тоже поддерживается: если секрет ключа не пустой, workflow входит по ключу, а не по паролю.

## 1. Файл подкачки 4 ГБ

На маленьком сервере без swap машина замирает, когда памяти не хватает. Сборка на VPS больше не запускается, но два контейнера по 512 МБ и остальные приложения всё равно лучше подстраховать. Один раз от root:

```bash
ssh root@130.17.14.150
fallocate -l 4G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
swapon --show
```

Повторный запуск `mkswap` по живому файлу не нужен. Проверка: в `swapon --show` есть `/swapfile`.

## 2. Вход по паролю или по ключу

Сейчас достаточно пароля root в секрете `DEPLOY_PASSWORD`. Отдельный пользователь не обязателен.

Ключ, если захотите перейти на него позже.

Windows, PowerShell:

```powershell
ssh-keygen -t ed25519 -f $env:USERPROFILE\.ssh\finder_deploy -C finder-deploy
```

macOS и Linux:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/finder_deploy -C finder-deploy
```

- `finder_deploy` целиком, со строками `BEGIN` и `END`, кладётся в `DEPLOY_SSH_KEY`.
- `finder_deploy.pub` одной строкой добавляется в `/root/.ssh/authorized_keys`.

Пока пользуетесь паролем, секрет `DEPLOY_SSH_KEY` не создавайте. Если он уже есть и ключ не тот, удалите секрет, иначе workflow не возьмёт пароль.

`deploy/bootstrap.sh` по-прежнему умеет завести пользователя `deploy`, открыть 22, 80 и 443 и не открывать 8080. На уже настроенном сервере с Nginx он не нужен.

## 3. Секреты GitHub

Репозиторий → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**.

Имя секрета без кавычек. Случайный токен:

```bash
openssl rand -hex 32
```

Каждый токен генерировать заново.

| Секрет | Куда вставлять | Обязателен |
| --- | --- | --- |
| `DEPLOY_HOST` | `130.17.14.150` | да |
| `DEPLOY_USER` | `root` | да |
| `DEPLOY_PASSWORD` | пароль SSH этого пользователя | да, если нет ключа |
| `DEPLOY_SSH_KEY` | весь закрытый ключ, включая `BEGIN`/`END` | нет, пока вход по паролю |
| `DEPLOY_PORT` | `22`. Если секрета нет, тоже 22 | нет |
| `TELEGRAM_BOT_TOKEN` | токен от @BotFather | да |
| `POSTGRES_PASSWORD` | `openssl rand -hex 32`. В приложении это `PG_PASSWORD` | да |
| `ADMIN_TELEGRAM_IDS` | Telegram id админов через запятую, например `871909427` | да |
| `ADMIN_API_TOKEN` | `openssl rand -hex 32`. Bearer для админского HTTP | да |
| `RESEARCH_INGEST_TOKEN` | `openssl rand -hex 32`. Секрет приёма досье | да |
| `RESEARCH_TRIGGER_SECRET` | `openssl rand -hex 32`. Заголовок запуска ресерча | да |
| `RESEARCH_TRIGGER_URL` | URL webhook ресерча. Пусто, если слать некуда | нет |
| `LLM_API_KEY` | ключ LLM. Пусто — классификатор без модели ставит паузу | нет |
| `PUBLIC_BASE_URL` | куда рутина вернёт досье. Если секрета нет, берётся `https://bot.passimx.com` | нет |

`GITHUB_TOKEN` создавать не нужно: Actions выдаёт его сам и им публикует образ. На сервер тот же токен передаётся только в stdin `docker login` на время выкладки. После неё скрипт делает `docker logout ghcr.io`, в файлы на диске токен не кладётся.

Workflow пишет приложение в `/opt/finder/.env` и ставит права `600`. Значения в лог не печатаются. Репозиторий на сервер git больше не клонирует, поэтому ошибка `dubious ownership` в `/opt/finder` больше не возникает. На сервер копируются только `docker-compose.prod.yml`, `deploy.sh` и `.env`.

Пакеты через `apt-get update` ставятся только если на сервере ещё нет Docker или `curl`.

## 4. Первая выкладка

1. Влить PR в `main`.
2. Вкладка **Actions**.
3. Слева **Deploy**.
4. **Run workflow**, ветка `main`.

Дальше каждый push в `main` ждёт зелёный CI. Actions собирает образ, пушит `ghcr.io/titproger/finder:<sha>` и `:latest`, сервер делает `docker pull` и `up --no-build`.

На сервере `deploy.sh`:

- скачивает готовый образ, локально его не собирает;
- ограничивает память приложения и Postgres по 512 МБ;
- пишет файлы логов в том `finder_logs` (`/app/logs`). Если каталог недоступен, процесс не падает и пишет только в консоль;
- применяет миграции и `npm run seed` внутри скачанного образа;
- удаляет старые теги `ghcr.io/titproger/finder`, текущий SHA и `latest` оставляет, том базы не трогает;
- проверяет `GET /health` на `http://127.0.0.1:8080/health`. Если ответа нет, job падает и показывает последние логи контейнеров.

Образ в GHCR может остаться приватным: сервер входит в реестр токеном Actions. Сделать пакет публичным на скачивание можно позже в GitHub → Packages → Package settings → Change visibility. Для выкладки это не требуется.

## 5. Логи на сервере

```bash
ssh root@130.17.14.150
cd /opt/finder
docker compose --env-file .env -f docker-compose.prod.yml logs -f --tail 200 app
docker compose --env-file .env -f docker-compose.prod.yml logs --tail 200 postgres
curl -fsS http://127.0.0.1:8080/health
```

Ответ с `"ok"` значит, что процесс жив. Снаружи тот же адрес через Nginx:

```bash
curl -fsS https://bot.passimx.com/health
curl -H "Authorization: Bearer ВАШ_ADMIN_API_TOKEN" https://bot.passimx.com/admin/categories
```

Порт 8080 в интернет не открыт. Если раньше firewall разрешал его, уберите правило:

```bash
ufw delete allow 8080/tcp
```

Права файла с секретами: `ls -l /opt/finder/.env` должен показать `-rw-------`.

## 6. Бот

`TELEGRAM_WEBHOOK_URL` пустой: процесс снимает webhook и слушает обновления long polling. Порт для Telegram открывать не нужно.

Напишите боту с id из `ADMIN_TELEGRAM_IDS`. Этот id безлимитный и получает роль ADMIN при первом сообщении.

## 7. Nginx

`https://bot.passimx.com` уже проксируется на `127.0.0.1:8080`. Публикация порта в compose поэтому только на loopback: `127.0.0.1:8080:8080`. Менять Nginx для выкладки не нужно. `PUBLIC_BASE_URL` оставляйте `https://bot.passimx.com`, чтобы приём досье шёл на публичный HTTPS, а не на закрытый порт.
