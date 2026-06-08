#!/usr/bin/env bash
set -euo pipefail

# One-click deploy script for echoes
# Usage: sudo ./scripts/deploy.sh [branch] [--no-backup]

BRANCH=${1:-main}
NO_BACKUP=false
if [ "${2:-}" = "--no-backup" ]; then NO_BACKUP=true; fi

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SITE_DIR="/var/www/gyx.luxe/web"
BACKUP_DIR="/var/backups/echoes"
PM2_NAME="echoes-api"
API_ENV_PATH="$REPO_ROOT/apps/api/.env"

echo "Deploying branch: $BRANCH"
echo "Repo root: $REPO_ROOT"

if [ "$(id -u)" -ne 0 ]; then
  echo "WARNING: it's recommended to run this script as root or with sudo." >&2
fi

cd "$REPO_ROOT"

echo "Fetching latest..."
git fetch --all --prune
git checkout "$BRANCH"
git pull origin "$BRANCH"

echo "Installing dependencies (pnpm)..."
if ! command -v pnpm >/dev/null 2>&1; then
  echo "pnpm not found in PATH. Install pnpm or run from environment where pnpm is available." >&2
  exit 1
fi
pnpm install --frozen-lockfile || pnpm install

echo "Building frontend (@echoes/web)..."
pnpm --filter @echoes/web build

if [ "$NO_BACKUP" = false ]; then
  echo "Backing up current site..."
  sudo mkdir -p "$BACKUP_DIR"
  if [ -d "$SITE_DIR" ]; then
    ts=$(date +%Y%m%d%H%M%S)
    sudo mv "$SITE_DIR" "$BACKUP_DIR/web.$ts"
    echo "Backed up to $BACKUP_DIR/web.$ts"
  fi
fi

echo "Publishing frontend to $SITE_DIR"
sudo mkdir -p "$SITE_DIR"
sudo rm -rf "$SITE_DIR"/* || true
sudo cp -r "$REPO_ROOT/apps/web/dist"/* "$SITE_DIR/"
sudo chown -R www-data:www-data "$SITE_DIR" || true
sudo chmod -R 755 "$SITE_DIR"

echo "Ensure API .env exists at $API_ENV_PATH"
if [ ! -f "$API_ENV_PATH" ]; then
  echo "No $API_ENV_PATH found. Creating a placeholder file (please edit with real values)"
  cat > "$API_ENV_PATH" <<'EOF'
PORT=4000
DEEPSEEK_API_KEY=
DEEPSEEK_API_URL=https://api.deepseek.com/v1
EOF
  echo "$API_ENV_PATH created. Edit it to add secrets before continuing.";
fi

echo "Building backend (@echoes/api)..."
pnpm --filter @echoes/api build

echo "Restarting pm2 process: $PM2_NAME (cluster mode, ${PM2_INSTANCES:-2} instances)"
cd "$REPO_ROOT/apps/api" || exit 1
if pm2 list | grep -q " $PM2_NAME "; then
  pm2 delete "$PM2_NAME" || true
fi
pm2 start dist/server.js --name "$PM2_NAME" -i "${PM2_INSTANCES:-2}"
pm2 save || true

echo "Testing services..."
echo "Local API health:";
curl -I http://127.0.0.1:4000/health || true

echo "Public site health:";
curl -I https://gyx.luxe || true

echo "Reload nginx (if applicable)"
if command -v nginx >/dev/null 2>&1; then
  nginx -t && systemctl reload nginx || echo "nginx reload failed (check config)"
fi

echo "Deploy complete. If you changed $API_ENV_PATH, edit it and restart pm2."

exit 0
