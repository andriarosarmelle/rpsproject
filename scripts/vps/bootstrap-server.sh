#!/usr/bin/env bash

set -euo pipefail

if [ "${EUID}" -ne 0 ]; then
  echo "Run this script with sudo."
  exit 1
fi

DEPLOY_USER="${SUDO_USER:-${DEPLOY_USER:-ubuntu}}"
APP_ROOT="${APP_ROOT:-/opt/rps}"
DOMAIN_NAME="${DOMAIN_NAME:-}"
PUBLIC_EMAIL="${PUBLIC_EMAIL:-}"

if ! id "$DEPLOY_USER" >/dev/null 2>&1; then
  echo "User '$DEPLOY_USER' does not exist."
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive

apt-get update
apt-get install -y \
  ca-certificates \
  curl \
  git \
  gnupg \
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

systemctl enable docker
systemctl start docker

if systemctl is-enabled nginx >/dev/null 2>&1; then
  systemctl stop nginx || true
  systemctl disable nginx || true
fi

ufw allow OpenSSH
ufw allow 80/tcp
ufw --force enable

if [ -n "$DOMAIN_NAME" ] || [ -n "$PUBLIC_EMAIL" ]; then
  echo "Note: HTTPS is not bootstrapped in this Docker Compose only flow yet."
  echo "DOMAIN_NAME and PUBLIC_EMAIL were ignored."
fi

echo "Bootstrap complete for user: $DEPLOY_USER"
echo "Application root: $APP_ROOT"
echo "Docker and Docker Compose are installed."
