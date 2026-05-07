#!/usr/bin/env bash

set -euo pipefail

if [ "${EUID}" -ne 0 ]; then
  echo "Run this script with sudo."
  exit 1
fi

DEPLOY_USER="${SUDO_USER:-${DEPLOY_USER:-ubuntu}}"
APP_ROOT="${APP_ROOT:-/opt/rps}"
NODE_MAJOR="${NODE_MAJOR:-24}"
DOMAIN_NAME="${DOMAIN_NAME:-}"
PUBLIC_EMAIL="${PUBLIC_EMAIL:-}"

if ! id "$DEPLOY_USER" >/dev/null 2>&1; then
  echo "User '$DEPLOY_USER' does not exist."
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive

apt-get update
apt-get install -y \
  apt-transport-https \
  ca-certificates \
  certbot \
  curl \
  git \
  gnupg \
  nginx \
  postgresql \
  postgresql-contrib \
  python3-certbot-nginx \
  software-properties-common \
  ufw

install -m 0755 -d /etc/apt/keyrings
if [ ! -f /etc/apt/keyrings/docker.asc ]; then
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
fi

. /etc/os-release
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" \
  > /etc/apt/sources.list.d/docker.list

apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

usermod -aG docker "$DEPLOY_USER"

sudo -u "$DEPLOY_USER" mkdir -p "$APP_ROOT"
sudo -u "$DEPLOY_USER" mkdir -p "$APP_ROOT/shared"
sudo -u "$DEPLOY_USER" mkdir -p "$APP_ROOT/releases"
sudo -u "$DEPLOY_USER" mkdir -p "$APP_ROOT/n8n"

if [ ! -d "/home/$DEPLOY_USER/.nvm" ]; then
  sudo -u "$DEPLOY_USER" bash -lc "curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash"
fi

sudo -u "$DEPLOY_USER" bash -lc "
  export NVM_DIR=\"\$HOME/.nvm\"
  . \"\$NVM_DIR/nvm.sh\"
  nvm install ${NODE_MAJOR}
  nvm alias default ${NODE_MAJOR}
  nvm use ${NODE_MAJOR}
  npm install -g pm2 n8n
"

systemctl enable docker
systemctl enable nginx
systemctl enable postgresql
systemctl start docker
systemctl start nginx
systemctl start postgresql

ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

if [ -n "$DOMAIN_NAME" ] && [ -n "$PUBLIC_EMAIL" ]; then
  certbot --nginx --non-interactive --agree-tos -m "$PUBLIC_EMAIL" -d "$DOMAIN_NAME"
fi

echo "Bootstrap complete for user: $DEPLOY_USER"
echo "Application root: $APP_ROOT"
echo "Node major: $NODE_MAJOR"
echo "Docker, PM2, PostgreSQL, Nginx, Certbot, UFW and n8n are installed."
