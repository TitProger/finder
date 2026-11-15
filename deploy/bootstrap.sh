#!/usr/bin/env bash
# Первый ручной запуск на чистой Ubuntu. Идемпотентно.
# Запускать от root: bash deploy/bootstrap.sh [файл-с-публичным-ключом]
set -euo pipefail

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Запустите bootstrap от root" >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
DEPLOY_USER="${DEPLOY_USER:-deploy}"
PUBKEY="${1:-}"

apt-get update
apt-get install -y ca-certificates curl ufw

if ! id "$DEPLOY_USER" >/dev/null 2>&1; then
  useradd --create-home --shell /bin/bash "$DEPLOY_USER"
fi

usermod -aG sudo "$DEPLOY_USER"
install -d -m 755 /etc/sudoers.d
printf '%s\n' "$DEPLOY_USER ALL=(ALL) NOPASSWD:ALL" > "/etc/sudoers.d/$DEPLOY_USER"
chmod 440 "/etc/sudoers.d/$DEPLOY_USER"

install -d -m 700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh"
touch "/home/$DEPLOY_USER/.ssh/authorized_keys"
chmod 600 "/home/$DEPLOY_USER/.ssh/authorized_keys"
chown "$DEPLOY_USER:$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh/authorized_keys"

if [[ -n "$PUBKEY" ]]; then
  if [[ ! -f "$PUBKEY" ]]; then
    echo "Нет файла ключа $PUBKEY" >&2
    exit 1
  fi
  cat "$PUBKEY" >> "/home/$DEPLOY_USER/.ssh/authorized_keys"
  sort -u "/home/$DEPLOY_USER/.ssh/authorized_keys" -o "/home/$DEPLOY_USER/.ssh/authorized_keys"
  chmod 600 "/home/$DEPLOY_USER/.ssh/authorized_keys"
  chown "$DEPLOY_USER:$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh/authorized_keys"
fi

install -d -m 755 -o "$DEPLOY_USER" -g "$DEPLOY_USER" /opt/finder

ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw delete allow 8080/tcp >/dev/null 2>&1 || true
ufw --force enable

echo "✓ Пользователь $DEPLOY_USER готов. Открыты порты 22, 80 и 443."
echo "Приложение слушает только 127.0.0.1:8080, снаружи его отдаёт Nginx."
echo "Дальше: публичный ключ в /home/$DEPLOY_USER/.ssh/authorized_keys и секреты GitHub Actions."
