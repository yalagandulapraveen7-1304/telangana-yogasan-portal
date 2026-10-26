#!/usr/bin/env bash
# ==============================================================================
# Zero-Downtime Application Deployment Script for Telangana Yogasana Portal
# Run on the server to pull latest code, rebuild assets, and reload cluster:
#   bash scripts/deploy.sh
# ==============================================================================

set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${APP_DIR}"

echo "==> [1/4] Pulling latest code from git..."
git pull origin master

echo "==> [2/4] Installing dependencies..."
npm ci --omit=dev

echo "==> [3/4] Compiling Tailwind CSS & updating public templates..."
npm run build

echo "==> [4/4] Reloading PM2 application cluster with zero downtime..."
pm2 reload ecosystem.config.js --env production

echo "==> Testing Nginx configuration..."
sudo nginx -t && sudo systemctl reload nginx

echo "==> Deployment completed successfully at $(date)!"
