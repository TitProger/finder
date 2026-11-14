# Выкладка Finder на VPS

Сервер: Ubuntu, `130.17.14.150`. Домена пока нет. Бот ходит в Telegram через long polling и работает без HTTPS. HTTP API слушает порт **8080**. Postgres наружу не публикуется.

После вливания в `main` зелёный CI сам запускает workflow **Deploy**. Повторно выкладки не наезжают друг на друга.

## 1. Ключ SSH

Рекомендуется ключ, не пароль. Пароль (`DEPLOY_PASSWORD`) оставлен запасным путём и в логе помечается как нежелательный.

Windows, в PowerShell:

```powershell
ssh-keygen -t ed25519 -f $env:USERPROFILE\.ssh\finder_deploy -C finder-deploy
```

macOS и Linux:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/finder_deploy -C finder-deploy
```

На вопрос passphrase можно нажать Enter. Появятся два файла:

- `finder_deploy` — закрытый ключ. Его целиком, вместе со строками `BEGIN` и `END`, кладут в секрет `DEPLOY_SSH_KEY`. Никуда больше не отправлять.
- `finder_deploy.pub` — открытый ключ. Его одна строка попадёт на сервер в `authorized_keys`.

## 2. Первый вход на чистый сервер

Провайдер даёт root и пароль. Сначала войти им:

```bash
ssh root@130.17.14.150
```

На сервере, уже после того как этот репозиторий есть в `main`:

```bash
apt-get update
apt-get install -y git
git clone https://github.com/TitProger/finder.git /opt/finder
nano /root/finder_deploy.pub
```

Вставить в файл одну строку из `finder_deploy.pub`, сохранить и выполнить:

```bash
bash /opt/finder/deploy/bootstrap.sh /root/finder_deploy.pub
rm -f /root/finder_deploy.pub
```

`bootstrap.sh` идемпотентный: создаёт пользователя `deploy` с sudo без пароля, каталог ключей и включает firewall. Открыты только **22** и **8080**.

Проверка с вашего компьютера:

```bash
ssh -i ~/.ssh/finder_deploy deploy@130.17.14.150
```

На Windows путь к ключу: `%USERPROFILE%\.ssh\finder_deploy`.

## 3. Секреты GitHub

Репозиторий на GitHub → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**.

Каждый секрет — отдельная запись. В поле Name имя из таблицы, в поле Secret значение. Не вставлять кавычки.

Случайные токены на своём компьютере:

```bash
openssl rand -hex 32
```

Каждый токен генерировать заново. Один и тот же hex не класть в два секрета.

| Секрет | Куда вставлять | Обязателен |
| --- | --- | --- |
| `DEPLOY_HOST` | `130.17.14.150` | да |
| `DEPLOY_USER` | `deploy` | да |
| `DEPLOY_SSH_KEY` | весь файл `finder_deploy`, включая `BEGIN`/`END` | да, если нет пароля |
| `DEPLOY_PORT` | `22`. Если секрет не создавать, тоже 22 | нет |
| `DEPLOY_PASSWORD` | пароль SSH пользователя `deploy`. Только если ключа нет | нет |
| `TELEGRAM_BOT_TOKEN` | токен от @BotFather | да |
| `POSTGRES_PASSWORD` | `openssl rand -hex 32`. Это пароль базы, в приложении он станет `PG_PASSWORD` | да |
| `ADMIN_TELEGRAM_IDS` | Telegram id админов через запятую, например `871909427` | да |
| `ADMIN_API_TOKEN` | `openssl rand -hex 32`. Bearer для админского HTTP | да |
| `RESEARCH_INGEST_TOKEN` | `openssl rand -hex 32`. Отдельный секрет приёма досье | да |
| `RESEARCH_TRIGGER_SECRET` | `openssl rand -hex 32`. Заголовок запуска ресерча | да |
| `RESEARCH_TRIGGER_URL` | URL webhook ресерча. Пусто, если ресерч ещё некуда слать | нет |
| `LLM_API_KEY` | ключ LLM. Пусто — классификатор без модели ставит паузу | нет |
| `PUBLIC_BASE_URL` | куда рутина вернёт досье. Если секрета нет, берётся `http://130.17.14.150:8080` | нет |

Workflow пишет их в `/opt/finder/backend/.env` и ставит права `600`. В лог Actions значения не печатаются.

## 4. Первая выкладка

1. Влить этот PR в `main`, либо, если он уже влит, ничего не пушить.
2. Открыть вкладку **Actions**.
3. Слева выбрать **Deploy**.
4. Справа **Run workflow**, ветка `main`, **Run workflow**.

Дальше каждый push в `main` ждёт зелёный CI и выкладывается сам. Ручной запуск тоже доступен.

На сервере скрипт `deploy/deploy.sh`:

- ставит Docker и плагин Compose, если их ещё нет;
- собирает образ и поднимает `deploy/docker-compose.prod.yml`;
- применяет миграции и `npm run seed` внутри контейнера приложения;
- удаляет старые образы, том базы не трогает;
- запрашивает `GET /health` и роняет job, если ответа нет. Тогда в логе job последние логи контейнеров.

## 5. Логи на сервере

```bash
ssh -i ~/.ssh/finder_deploy deploy@130.17.14.150
cd /opt/finder
sudo docker compose --env-file backend/.env -f deploy/docker-compose.prod.yml logs -f --tail 200 app
```

Только база:

```bash
sudo docker compose --env-file backend/.env -f deploy/docker-compose.prod.yml logs --tail 200 postgres
```

Проверка с сервера:

```bash
curl -fsS http://127.0.0.1:8080/health
```

Ответ с `"ok"` значит, что процесс жив. Админский API с вашего компьютера:

```bash
curl -H "Authorization: Bearer ВАШ_ADMIN_API_TOKEN" http://130.17.14.150:8080/admin/categories
```

Файл с секретами смотреть так, чтобы он не попал в чужой терминал и в скриншот:

```bash
sudo ls -l /opt/finder/backend/.env
```

Права должны быть `-rw-------`.

## 6. Бот без домена

Пока `TELEGRAM_WEBHOOK_URL` пустой, процесс сам снимает webhook у Telegram и слушает обновления long polling. Порт для Telegram открывать не нужно: сервер сам ходит на `api.telegram.org`.

Напишите боту в Telegram с id из `ADMIN_TELEGRAM_IDS`. Этот id безлимитный и получает роль ADMIN при первом сообщении.

## 7. Позже: домен и HTTPS через Caddy

Когда появится домен, запись A должна указывать на `130.17.14.150`.

На сервере:

```bash
sudo apt-get install -y caddy
sudo tee /etc/caddy/Caddyfile >/dev/null <<'EOF'
example.com {
  reverse_proxy 127.0.0.1:8080
}
EOF
sudo systemctl reload caddy
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

Чтобы 8080 не торчал в интернет, в `deploy/docker-compose.prod.yml` заменить публикацию порта на `127.0.0.1:8080:8080`, затем:

```bash
sudo ufw delete allow 8080/tcp
cd /opt/finder
sudo docker compose --env-file backend/.env -f deploy/docker-compose.prod.yml up -d
```

В секрете `PUBLIC_BASE_URL` поставить `https://example.com` и перезапустить **Deploy**. `TELEGRAM_WEBHOOK_URL` оставить пустым: бот по-прежнему на long polling. Webhook бота имеет смысл только когда этот URL задан явно, и тогда polling не стартует.
