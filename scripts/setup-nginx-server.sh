#!/usr/bin/env bash
# ==============================================================================
# Automated Server Provisioning & Nginx Setup for Telangana Yogasana Portal
# Supported OS: Ubuntu 20.04 / 22.04 / 24.04 LTS, Debian 11 / 12
# Run on the Linux server with: sudo bash scripts/setup-nginx-server.sh
# ==============================================================================

set -euo pipefail

echo "==> [1/7] Checking root / sudo privileges..."
if [ "$EUID" -ne 0 ]; then
  echo "ERROR: Please run this script with sudo: sudo bash $0"
  exit 1
fi

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
echo "==> Application Directory: ${APP_DIR}"

echo "==> [2/7] Installing system dependencies (Node.js 22 LTS, Nginx, Certbot, Git)..."
apt-get update -y
apt-get install -y curl git ufw

# Install Node.js 22.x LTS if not installed
if ! command -v node >/dev/null 2>&1; then
  echo "Installing Node.js 22 LTS via NodeSource..."
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
else
  echo "Node.js is already installed: $(node -v)"
fi

# Install Nginx and Certbot
apt-get install -y nginx certbot python3-certbot-nginx

# Install PM2 globally if missing
if ! command -v pm2 >/dev/null 2>&1; then
  echo "Installing PM2 globally..."
  npm install -g pm2
else
  echo "PM2 is already installed: $(pm2 -v)"
fi

echo "==> [3/7] Setting up application directories and permissions..."
mkdir -p "${APP_DIR}/uploads"
mkdir -p "${APP_DIR}/logs"
chmod 755 "${APP_DIR}/uploads"
chmod 755 "${APP_DIR}/logs"

echo "==> [4/7] Installing npm dependencies and building frontend assets..."
cd "${APP_DIR}"
npm ci --omit=dev
npm run build

echo "==> [5/7] Configuring Nginx..."
NGINX_CONF_SRC="${APP_DIR}/config/nginx/telanganayoga.org.in.conf"
NGINX_CONF_DEST="/etc/nginx/sites-available/telanganayoga.org.in"

if [ -f "${NGINX_CONF_SRC}" ]; then
  cp "${NGINX_CONF_SRC}" "${NGINX_CONF_DEST}"
  ln -sf "${NGINX_CONF_DEST}" "/etc/nginx/sites-enabled/telanganayoga.org.in"
  rm -f "/etc/nginx/sites-enabled/default"
  
  # Test configuration syntax
  nginx -t
  systemctl reload nginx
  echo "Nginx configured and reloaded successfully."
else
  echo "WARNING: Nginx configuration template not found at ${NGINX_CONF_SRC}"
fi

echo "==> [6/7] Starting Node.js application cluster via PM2..."
cd "${APP_DIR}"
pm2 start ecosystem.config.js --env production || pm2 reload ecosystem.config.js --env production
pm2 save
pm2 startup systemd -u "${SUDO_USER:-root}" --hp "${HOME}" || true

echo "==> [7/7] Configuring Firewall (UFW)..."
ufw allow OpenSSH || true
ufw allow 'Nginx Full' || true

echo "=============================================================================="
echo " SUCCESS: Telangana Yogasana Portal is running under PM2 and Nginx!"
echo "=============================================================================="
echo ""
echo "Next Steps for the Owner:"
echo " 1. Ensure your .env file has production credentials (MONGO_URI, JWT_SECRET, RAZORPAY_KEY_ID, etc.)."
echo " 2. Ensure domain DNS (A record) points to this server's public IP address."
echo " 3. Run Certbot to generate and install free SSL certificates:"
echo "      sudo certbot --nginx -d telanganayoga.org.in -d www.telanganayoga.org.in"
echo ""
echo " Operational Commands:"
echo "   - View App Logs:   pm2 logs yogasana-portal"
echo "   - Restart App:     pm2 reload yogasana-portal"
echo "   - Check Status:    pm2 status"
echo "=============================================================================="
