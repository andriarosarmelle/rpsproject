#!/usr/bin/env bash

set -euo pipefail

# Usage: ./scripts/vps/deploy.sh [branch]
TARGET_BRANCH="${1:-main}"
COMMIT_SHA="${GITHUB_SHA:-$(git rev-parse --short HEAD 2>/dev/null || echo manual)}"

if [ "$TARGET_BRANCH" = "main" ]; then
  ENV="rps_dev"
else
  ENV="development"
fi

APP_DIR="${APP_DIR:-$HOME/rps-$ENV}"
REPO_URL="${REPO_URL:-git@github.com:AzazelSloth/rpsproject.git}"
VPS_HOST="${VPS_HOST:-127.0.0.1}"
DOMAIN_NAME="${DOMAIN_NAME:-}"
PUBLIC_BASE_URL="${PUBLIC_BASE_URL:-}"

DB_HOST="${DB_HOST:-postgres}"
SOURCE_DB_HOST="$DB_HOST"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-rps_user}"
DB_PASSWORD="${DB_PASSWORD:-rps_pass}"
DB_NAME="${DB_NAME:-rps_db}"
JWT_SECRET="${JWT_SECRET:-}"
DB_SYNCHRONIZE="${DB_SYNCHRONIZE:-false}"
DB_LOGGING="${DB_LOGGING:-false}"
ADMIN_ALLOWED_EMAILS="${ADMIN_ALLOWED_EMAILS:-}"
ADMIN_BOOTSTRAP_EMAILS="${ADMIN_BOOTSTRAP_EMAILS:-}"
ADMIN_BOOTSTRAP_PASSWORD="${ADMIN_BOOTSTRAP_PASSWORD:-}"
ALLOWED_REGISTRATION_DOMAINS="${ALLOWED_REGISTRATION_DOMAINS:-localhost.local}"
SWAGGER_ENABLED="${SWAGGER_ENABLED:-true}"
SWAGGER_PATH="${SWAGGER_PATH:-api-docs}"
LOG_LEVEL="${LOG_LEVEL:-info}"

N8N_BASIC_AUTH_ACTIVE="${N8N_BASIC_AUTH_ACTIVE:-true}"
N8N_BASIC_AUTH_USER="${N8N_BASIC_AUTH_USER:-admin}"
N8N_BASIC_AUTH_PASSWORD="${N8N_BASIC_AUTH_PASSWORD:-changeme}"
N8N_ENCRYPTION_KEY="${N8N_ENCRYPTION_KEY:-}"
N8N_USER_FOLDER="${N8N_USER_FOLDER:-/home/node/.n8n}"
N8N_HOST="${N8N_HOST:-n8n}"
N8N_PORT="${N8N_PORT:-5678}"
N8N_PROTOCOL="${N8N_PROTOCOL:-http}"
N8N_SECURE_COOKIE="${N8N_SECURE_COOKIE:-false}"
N8N_PATH="${N8N_PATH:-/n8n/}"
N8N_EDITOR_BASE_URL="${N8N_EDITOR_BASE_URL:-}"
WEBHOOK_URL="${WEBHOOK_URL:-}"
N8N_LISTEN_ADDRESS="${N8N_LISTEN_ADDRESS:-0.0.0.0}"
TZ="${TZ:-Indian/Antananarivo}"
GENERIC_TIMEZONE="${GENERIC_TIMEZONE:-Indian/Antananarivo}"
DB_TYPE="${DB_TYPE:-postgresdb}"
DB_NAME_N8N="${DB_NAME_N8N:-$DB_NAME}"
N8N_WEBHOOK_PATH="${N8N_WEBHOOK_PATH:-/webhook/sondage-rps-solutions-tech}"
N8N_HEALTH_REQUIRED="${N8N_HEALTH_REQUIRED:-false}"

NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-}"
NEXT_PUBLIC_APP_URL="${NEXT_PUBLIC_APP_URL:-}"
NEXT_PUBLIC_STRAPI_URL="${NEXT_PUBLIC_STRAPI_URL:-}"
STRAPI_API_TOKEN="${STRAPI_API_TOKEN:-}"

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "ERROR: required command not found: $1"
    exit 1
  fi
}

require_non_empty() {
  local var_name="$1"
  local value="${!var_name:-}"
  if [ -z "$value" ]; then
    echo "ERROR: required environment variable is missing: $var_name"
    exit 1
  fi
}

trim_trailing_slash() {
  printf '%s' "${1%/}"
}

ensure_leading_and_trailing_slash() {
  local value="$1"
  value="/${value#/}"
  printf '%s/' "${value%/}"
}

ensure_absolute_path_or_default() {
  local value="${1:-}"
  local fallback="$2"

  if [ -z "$value" ] || [ "${value#/}" = "$value" ]; then
    printf '%s' "$fallback"
    return
  fi

  printf '%s' "$value"
}

resolve_container_db_host() {
  local value="${1:-}"

  case "$value" in
    localhost|127.0.0.1|::1)
      printf '%s' "host.docker.internal"
      ;;
    *)
      printf '%s' "$value"
      ;;
  esac
}

is_local_db_host() {
  case "${1:-}" in
    localhost|127.0.0.1|::1)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

csf_rule_exists() {
  local rule="$1"

  if [ ! -f /etc/csf/csf.allow ]; then
    return 1
  fi

  grep -Fqx "$rule" /etc/csf/csf.allow
}

warn_if_csf_may_block_local_db() {
  if ! command -v csf >/dev/null 2>&1; then
    return 0
  fi

  local missing_rules=0

  if ! csf_rule_exists 'tcp|in|d=5432|s=172.17.0.0/16'; then
    missing_rules=1
  fi

  if ! csf_rule_exists 'tcp|in|d=5432|s=172.18.0.0/16'; then
    missing_rules=1
  fi

  if [ "$missing_rules" -eq 1 ]; then
    echo "WARNING: CSF is installed and may block Docker containers from reaching PostgreSQL on the VPS host."
    echo "WARNING: If DB_HOST points to the VPS itself, make sure /etc/csf/csf.allow contains:"
    echo "WARNING:   tcp|in|d=5432|s=172.17.0.0/16"
    echo "WARNING:   tcp|in|d=5432|s=172.18.0.0/16"
    echo "WARNING: Then reload CSF with: sudo csf -r"
  fi
}

if [ -z "$PUBLIC_BASE_URL" ]; then
  if [ -n "$DOMAIN_NAME" ]; then
    PUBLIC_BASE_URL="https://$DOMAIN_NAME"
  else
    PUBLIC_BASE_URL="http://$VPS_HOST"
  fi
fi

PUBLIC_BASE_URL="$(trim_trailing_slash "$PUBLIC_BASE_URL")"
N8N_PATH="$(ensure_leading_and_trailing_slash "$N8N_PATH")"
N8N_USER_FOLDER="$(ensure_absolute_path_or_default "$N8N_USER_FOLDER" "/home/node/.n8n")"
CONTAINER_DB_HOST="$(resolve_container_db_host "$DB_HOST")"

if [ -z "$NEXT_PUBLIC_APP_URL" ]; then
  NEXT_PUBLIC_APP_URL="$PUBLIC_BASE_URL"
fi

if [ -z "$NEXT_PUBLIC_API_URL" ]; then
  NEXT_PUBLIC_API_URL="$PUBLIC_BASE_URL/api"
fi

if [ -z "$N8N_EDITOR_BASE_URL" ]; then
  N8N_EDITOR_BASE_URL="$PUBLIC_BASE_URL${N8N_PATH}"
fi

if [ -z "$WEBHOOK_URL" ]; then
  WEBHOOK_URL="$PUBLIC_BASE_URL${N8N_PATH}"
fi

require_command git
require_command docker
require_command curl
require_non_empty JWT_SECRET
require_non_empty DB_HOST
require_non_empty DB_PORT
require_non_empty DB_USER
require_non_empty DB_PASSWORD
require_non_empty DB_NAME
require_non_empty DB_NAME_N8N
require_non_empty N8N_ENCRYPTION_KEY

echo "=== Starting Docker Compose deployment: $ENV ==="
echo "Branch: $TARGET_BRANCH"
echo "Commit: $COMMIT_SHA"
echo "Public base URL: $PUBLIC_BASE_URL"
echo "Database host for containers: $CONTAINER_DB_HOST:$DB_PORT"

echo "Fetching latest code from Git..."
echo "Disk usage before cleanup:"
df -h /

find "$HOME" -maxdepth 1 -type d -name "rps-${ENV}.backup.*" -printf '%T@ %p\n' 2>/dev/null \
  | sort -nr \
  | awk 'NR>3 {print $2}' \
  | xargs -r rm -rf

echo "Disk usage after cleanup:"
df -h /

if [ -d "$APP_DIR" ]; then
  echo "Backing up current deployment..."
  mv "$APP_DIR" "${APP_DIR}.backup.$(date +%Y%m%d%H%M%S)" || true
fi

mkdir -p "$APP_DIR"
git clone --depth 1 -b "$TARGET_BRANCH" "$REPO_URL" "$APP_DIR"

COMPOSE_DIR="$APP_DIR/scripts/vps"
COMPOSE_ENV_FILE="$COMPOSE_DIR/.env"

if [ ! -f "$COMPOSE_DIR/docker-compose.yml" ]; then
  echo "ERROR: docker-compose.yml not found in $COMPOSE_DIR"
  exit 1
fi

echo "Writing Docker Compose environment file..."
cat > "$COMPOSE_ENV_FILE" <<EOF
COMPOSE_PROJECT_NAME=rps-$ENV
NODE_ENV=production
PORT=3000
JWT_SECRET=$JWT_SECRET
DB_HOST=$CONTAINER_DB_HOST
DB_PORT=$DB_PORT
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASSWORD
DB_NAME=$DB_NAME
DB_SYNCHRONIZE=$DB_SYNCHRONIZE
DB_LOGGING=$DB_LOGGING
ADMIN_ALLOWED_EMAILS=$ADMIN_ALLOWED_EMAILS
ADMIN_BOOTSTRAP_EMAILS=$ADMIN_BOOTSTRAP_EMAILS
ADMIN_BOOTSTRAP_PASSWORD=$ADMIN_BOOTSTRAP_PASSWORD
ALLOWED_REGISTRATION_DOMAINS=$ALLOWED_REGISTRATION_DOMAINS
SWAGGER_ENABLED=$SWAGGER_ENABLED
SWAGGER_PATH=$SWAGGER_PATH
LOG_LEVEL=$LOG_LEVEL
NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
NEXT_PUBLIC_STRAPI_URL=$NEXT_PUBLIC_STRAPI_URL
STRAPI_API_TOKEN=$STRAPI_API_TOKEN
N8N_BASIC_AUTH_ACTIVE=$N8N_BASIC_AUTH_ACTIVE
N8N_BASIC_AUTH_USER=$N8N_BASIC_AUTH_USER
N8N_BASIC_AUTH_PASSWORD=$N8N_BASIC_AUTH_PASSWORD
N8N_ENCRYPTION_KEY=$N8N_ENCRYPTION_KEY
N8N_USER_FOLDER=$N8N_USER_FOLDER
N8N_HOST=$N8N_HOST
N8N_PORT=$N8N_PORT
N8N_PROTOCOL=$N8N_PROTOCOL
N8N_SECURE_COOKIE=$N8N_SECURE_COOKIE
N8N_PATH=$N8N_PATH
N8N_LISTEN_ADDRESS=$N8N_LISTEN_ADDRESS
TZ=$TZ
GENERIC_TIMEZONE=$GENERIC_TIMEZONE
DB_TYPE=$DB_TYPE
DB_NAME_N8N=$DB_NAME_N8N
DB_POSTGRESDB_HOST=$CONTAINER_DB_HOST
DB_POSTGRESDB_PORT=$DB_PORT
DB_POSTGRESDB_DATABASE=$DB_NAME_N8N
DB_POSTGRESDB_USER=$DB_USER
DB_POSTGRESDB_PASSWORD=$DB_PASSWORD
N8N_BASE_URL=$N8N_PROTOCOL://$N8N_HOST:$N8N_PORT${N8N_PATH%/}
N8N_WEBHOOK_URL=$N8N_PROTOCOL://$N8N_HOST:$N8N_PORT${N8N_PATH%/}
N8N_WEBHOOK_PATH=$N8N_WEBHOOK_PATH
N8N_HEALTH_REQUIRED=$N8N_HEALTH_REQUIRED
N8N_EDITOR_BASE_URL=$N8N_EDITOR_BASE_URL
WEBHOOK_URL=$WEBHOOK_URL
APP_URL=$NEXT_PUBLIC_APP_URL
EOF

chmod 600 "$COMPOSE_ENV_FILE"

echo "Stopping legacy PM2 runtime if present..."
if command -v pm2 >/dev/null 2>&1; then
  pm2 delete all >/dev/null 2>&1 || true
  pm2 save >/dev/null 2>&1 || true
fi

if command -v systemctl >/dev/null 2>&1 && systemctl is-active --quiet nginx; then
  if command -v sudo >/dev/null 2>&1 && sudo -n true >/dev/null 2>&1; then
    echo "Stopping host nginx to free ports 80/443 for Docker..."
    sudo -n systemctl stop nginx || true
    sudo -n systemctl disable nginx || true
  else
    echo "Host nginx is active but passwordless sudo is unavailable; skipping host nginx shutdown."
  fi
fi

cd "$COMPOSE_DIR"

# Docker Compose variable interpolation prefers the current shell environment
# over the .env file we just wrote. Normalize DB_HOST here so backend/n8n
# containers use the container-reachable host instead of the original VPS-local
# value (e.g. localhost).
export DB_HOST="$CONTAINER_DB_HOST"

echo "Pulling registry images..."
docker compose pull --ignore-buildable

echo "Building application images..."
docker compose build backend frontend

ensure_external_database_ready() {
  local maintenance_db="${DB_MAINTENANCE_DB:-postgres}"

  if is_local_db_host "$SOURCE_DB_HOST"; then
    echo "Database host '$SOURCE_DB_HOST' is local to the VPS; containers will use '$CONTAINER_DB_HOST'."
    echo "Make sure PostgreSQL listens on the Docker bridge interface and allows connections from containers."
    echo "Typical fix: set listen_addresses = '*' (or the bridge IP) and add a matching pg_hba.conf host rule."
    warn_if_csf_may_block_local_db
  fi

  echo "Verifying external database connectivity..."
  docker compose run --rm --no-deps \
    -e DB_HOST="$CONTAINER_DB_HOST" \
    -e DB_PORT="$DB_PORT" \
    -e DB_USER="$DB_USER" \
    -e DB_PASSWORD="$DB_PASSWORD" \
    -e DB_NAME="$maintenance_db" \
    backend \
    node -e "const { Client } = require('pg'); (async () => { const client = new Client({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME, connectionTimeoutMillis: 10000 }); await client.connect(); await client.end(); console.log('[db] External database connection OK.'); })().catch((error) => { console.error('[db] External database connection failed:', error.stack || error.message); console.error('[db] If PostgreSQL runs on the VPS host, ensure it listens beyond localhost and accepts Docker bridge connections.'); console.error('[db] Check postgresql.conf listen_addresses and pg_hba.conf host entries for the Docker bridge subnet.'); console.error('[db] If CSF is enabled, allow Docker bridge ranges to reach 5432 and reload CSF.'); process.exit(1); });"

  echo "Ensuring application and n8n databases exist..."
  docker compose run --rm --no-deps \
    -e DB_HOST="$CONTAINER_DB_HOST" \
    -e DB_PORT="$DB_PORT" \
    -e DB_USER="$DB_USER" \
    -e DB_PASSWORD="$DB_PASSWORD" \
    -e DB_NAME="$maintenance_db" \
    -e APP_DB_NAME="$DB_NAME" \
    -e N8N_APP_DB_NAME="$DB_NAME_N8N" \
    backend \
    node -e "const { Client } = require('pg'); const targetDbs = [...new Set([process.env.APP_DB_NAME, process.env.N8N_APP_DB_NAME].filter(Boolean))]; const quoteIdent = (value) => '\"' + value.replace(/\"/g, '\"\"') + '\"'; (async () => { const client = new Client({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME }); await client.connect(); for (const targetDb of targetDbs) { const result = await client.query('SELECT 1 FROM pg_database WHERE datname = \$1', [targetDb]); if (result.rowCount === 0) { await client.query('CREATE DATABASE ' + quoteIdent(targetDb)); console.log('[db] Database created:', targetDb); } else { console.log('[db] Database already exists:', targetDb); } } await client.end(); })().catch((error) => { console.error('[db] Database provisioning failed:', error.stack || error.message); process.exit(1); });"
}

ensure_external_database_ready

echo "Starting dependencies..."
docker compose up -d n8n

MIGRATION_RETRIES=8
MIGRATION_INTERVAL=5
MIGRATION_DONE=false

for i in $(seq 1 $MIGRATION_RETRIES); do
  echo "Running backend migrations... (attempt $i/$MIGRATION_RETRIES)"
  if docker compose run --rm --no-deps backend npm run migration:run:prod; then
    MIGRATION_DONE=true
    echo "Migration command completed."
    break
  fi

  if [ $i -lt $MIGRATION_RETRIES ]; then
    echo "Migration attempt failed, retrying in ${MIGRATION_INTERVAL}s..."
    sleep $MIGRATION_INTERVAL
  fi
done

if [ "$MIGRATION_DONE" != "true" ]; then
  echo "ERROR: migrations failed after $MIGRATION_RETRIES attempts"
  docker compose logs backend n8n --tail 100 || true
  exit 1
fi

echo "Starting full stack..."
docker compose up -d --build --force-recreate --remove-orphans nginx backend frontend

echo "Ensuring nginx is recreated with the latest mounted configuration..."
docker compose up -d --force-recreate nginx

wait_for_url() {
  local name="$1"
  local url="$2"
  local retries="$3"
  local interval="$4"

  for i in $(seq 1 "$retries"); do
    echo "Checking ${name}... (attempt $i/$retries)"
    if curl --fail --silent --show-error --max-time 10 "$url" >/dev/null 2>&1; then
      echo "$name is ready."
      return 0
    fi
    sleep "$interval"
  done

  echo "ERROR: ${name} did not become ready."
  return 1
}

wait_for_nginx_path() {
  local name="$1"
  local path="$2"
  local retries="$3"
  local interval="$4"

  for i in $(seq 1 "$retries"); do
    echo "Checking ${name} through nginx... (attempt $i/$retries)"
    if docker compose exec -T nginx sh -lc "wget -qO- http://127.0.0.1:8786${path} >/dev/null"; then
      echo "$name is ready through nginx."
      return 0
    fi
    sleep "$interval"
  done

  echo "ERROR: ${name} did not become ready through nginx."
  return 1
}

if ! wait_for_nginx_path "backend" "/api/health" 18 5; then
  echo "Backend is running but nginx could not serve /api/health."
  echo "Collecting direct container and nginx diagnostics..."
  docker compose exec -T backend sh -lc "node -e \"fetch('http://127.0.0.1:3000/api/health').then(async (response) => { console.log('[backend direct]', response.status, await response.text()); }).catch((error) => { console.error('[backend direct] request failed:', error.message); process.exit(1); })\"" || true
  docker compose exec -T nginx sh -lc "wget -qO- http://127.0.0.1:8786/api/health || true" || true
  docker compose logs backend --tail 120 || true
  docker compose logs nginx --tail 120 || true
  exit 1
fi

if ! wait_for_nginx_path "frontend" "/login" 12 5; then
  docker compose logs frontend nginx --tail 120 || true
  exit 1
fi

if [ "$N8N_BASIC_AUTH_ACTIVE" = "true" ]; then
  n8n_basic_auth_header="$(printf '%s' "${N8N_BASIC_AUTH_USER}:${N8N_BASIC_AUTH_PASSWORD}" | base64 | tr -d '\n')"
  if ! docker compose exec -T nginx sh -lc "wget -qO- --header='Authorization: Basic ${n8n_basic_auth_header}' http://127.0.0.1:8786/n8n/ >/dev/null"; then
    echo "ERROR: n8n did not respond behind nginx."
    docker compose logs n8n nginx --tail 120 || true
    exit 1
  fi
else
  if ! wait_for_nginx_path "n8n" "/n8n/" 12 5; then
    docker compose logs n8n nginx --tail 120 || true
    exit 1
  fi
fi

echo "Running final smoke tests..."
docker compose exec -T nginx sh -lc "wget -qO- http://127.0.0.1:8786/api/health >/dev/null"
docker compose exec -T nginx sh -lc "wget -qO- http://127.0.0.1:8786/login >/dev/null"
docker compose exec -T nginx sh -lc "wget -qO- http://127.0.0.1:8786/results >/dev/null"

echo "Deployment status:"
docker compose ps

echo "=== Deployment completed: $ENV ==="
echo "Commit deployed: $COMMIT_SHA"
echo "Public URL: $PUBLIC_BASE_URL"
