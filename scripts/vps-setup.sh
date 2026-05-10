#!/usr/bin/env bash
# =============================================================================
#  Orange Falcon CRM -- VPS Initial Setup
#  Target OS : Ubuntu 22.04 LTS
#  Run as    : root  (sudo -i, then run this script)
#
#  Usage:
#    curl -o vps-setup.sh https://raw.githubusercontent.com/<YOU>/<REPO>/main/scripts/vps-setup.sh
#    chmod +x vps-setup.sh
#    ./vps-setup.sh
#
#  What this script does:
#    1.  Updates system packages
#    2.  Installs Node.js 18 LTS, npm, git
#    3.  Installs MongoDB 7 Community Edition
#    4.  Installs nginx and PM2
#    5.  Hardens UFW firewall (SSH, HTTP, HTTPS)
#    6.  Creates a dedicated non-root system user: crm
#    7.  Creates the app directory at /var/www/orange-falcon-crm
#    8.  Writes a production nginx config
#    9.  Enables nginx to start on boot
#   10.  Prints next steps
#
#  Run the deploy.sh script AFTER this one to clone and start the app.
# =============================================================================

set -euo pipefail

# -- Colours ------------------------------------------------------------------
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

info()    { echo -e "${CYAN}[SETUP]${RESET} $*"; }
success() { echo -e "${GREEN}[SETUP]${RESET} $*"; }
warn()    { echo -e "${YELLOW}[SETUP]${RESET} $*"; }
err()     { echo -e "${RED}[SETUP]${RESET} $*"; exit 1; }

# -- Must run as root ---------------------------------------------------------
[ "$(id -u)" -eq 0 ] || err "This script must be run as root. Use: sudo -i"

APP_USER="crm"
APP_DIR="/var/www/orange-falcon-crm"
BACKEND_PORT="5003"

echo ""
echo -e "${BOLD}Orange Falcon CRM -- VPS Initial Setup${RESET}"
echo -e "Target: Ubuntu 22.04 LTS"
echo ""

# =============================================================================
# 1. System update
# =============================================================================
info "Updating system packages..."
apt-get update -qq
apt-get upgrade -y -qq
apt-get install -y -qq curl git build-essential ufw
success "System packages updated"

# =============================================================================
# 2. Node.js 18 LTS (NodeSource)
# =============================================================================
info "Installing Node.js 18 LTS..."
if ! command -v node &>/dev/null || [[ "$(node -v)" != v18* && "$(node -v)" < "v18" ]]; then
  curl -fsSL https://deb.nodesource.com/setup_18.x | bash - &>/dev/null
  apt-get install -y -qq nodejs
fi
NODE_VER=$(node -v)
NPM_VER=$(npm -v)
success "Node.js ${NODE_VER} | npm v${NPM_VER}"

# =============================================================================
# 3. MongoDB 7 Community Edition
# =============================================================================
info "Installing MongoDB 7..."
if ! command -v mongod &>/dev/null; then
  curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | \
    gpg --dearmor -o /usr/share/keyrings/mongodb-server-7.0.gpg &>/dev/null
  echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] \
    https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" \
    > /etc/apt/sources.list.d/mongodb-org-7.0.list
  apt-get update -qq
  apt-get install -y -qq mongodb-org
fi

# Bind MongoDB to localhost only (security)
MONGO_CONF="/etc/mongod.conf"
if grep -q "bindIp: 0.0.0.0" "$MONGO_CONF" 2>/dev/null; then
  sed -i 's/bindIp: 0.0.0.0/bindIp: 127.0.0.1/' "$MONGO_CONF"
fi

systemctl enable mongod --quiet
systemctl start  mongod
sleep 2
success "MongoDB 7 installed and running (bound to 127.0.0.1)"

# =============================================================================
# 4. nginx
# =============================================================================
info "Installing nginx..."
apt-get install -y -qq nginx
systemctl enable nginx --quiet
systemctl start  nginx
success "nginx installed"

# =============================================================================
# 5. PM2 (Node.js process manager)
# =============================================================================
info "Installing PM2..."
npm install -g pm2 --silent
success "PM2 installed"

# =============================================================================
# 6. Firewall (UFW)
# =============================================================================
info "Configuring UFW firewall..."
ufw --force reset &>/dev/null
ufw default deny incoming  &>/dev/null
ufw default allow outgoing &>/dev/null
ufw allow OpenSSH          &>/dev/null
ufw allow 'Nginx Full'     &>/dev/null   # ports 80 and 443
ufw --force enable         &>/dev/null
success "UFW firewall enabled: SSH + HTTP (80) + HTTPS (443) allowed"

# =============================================================================
# 7. Dedicated system user
# =============================================================================
info "Creating system user: $APP_USER..."
if ! id "$APP_USER" &>/dev/null; then
  adduser --system --group --shell /bin/bash --home "/home/$APP_USER" "$APP_USER"
fi
success "System user '$APP_USER' ready"

# =============================================================================
# 8. App directory
# =============================================================================
info "Creating app directory: $APP_DIR..."
mkdir -p "$APP_DIR"
mkdir -p "$APP_DIR/logs/crm-data"
mkdir -p "$APP_DIR/.logs"
chown -R "$APP_USER:$APP_USER" "$APP_DIR"
chmod 700 "$APP_DIR/logs/crm-data"
success "App directory ready"

# =============================================================================
# 9. nginx configuration
# =============================================================================
info "Writing nginx configuration..."

# Get the server's public IP
SERVER_IP=$(curl -s --max-time 5 ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')

cat > /etc/nginx/sites-available/orange-falcon-crm << NGINX_CONF
# Orange Falcon CRM — nginx configuration
# Generated by vps-setup.sh
# To add HTTPS later: sudo certbot --nginx -d yourdomain.com

server {
    listen 80;
    server_name ${SERVER_IP} _;

    # Security headers
    add_header X-Frame-Options        "SAMEORIGIN"   always;
    add_header X-Content-Type-Options "nosniff"      always;
    add_header X-XSS-Protection       "1; mode=block" always;
    add_header Referrer-Policy        "strict-origin-when-cross-origin" always;

    # Serve the React frontend (built static files)
    root ${APP_DIR}/frontend/dist;
    index index.html;

    # API proxy — forward /api/* to the Node.js backend
    location /api {
        proxy_pass         http://127.0.0.1:${BACKEND_PORT};
        proxy_http_version 1.1;
        proxy_set_header   Upgrade \$http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host \$host;
        proxy_set_header   X-Real-IP \$remote_addr;
        proxy_set_header   X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 60s;
        client_max_body_size 11M;
    }

    # React Router — return index.html for all non-asset routes
    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # Deny access to dotfiles
    location ~ /\. {
        deny all;
    }
}
NGINX_CONF

# Enable the site
ln -sf /etc/nginx/sites-available/orange-falcon-crm \
        /etc/nginx/sites-enabled/orange-falcon-crm
rm -f /etc/nginx/sites-enabled/default

# Validate and reload
nginx -t &>/dev/null && nginx -s reload
success "nginx configured for http://${SERVER_IP}"

# =============================================================================
# Log rotation for PM2 logs
# =============================================================================
pm2 install pm2-logrotate --silent 2>/dev/null || true
pm2 set pm2-logrotate:max_size 10M  2>/dev/null || true
pm2 set pm2-logrotate:retain 7      2>/dev/null || true

# =============================================================================
# Done — print next steps
# =============================================================================
echo ""
echo -e "${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "${BOLD}${GREEN}  VPS initial setup complete!${RESET}"
echo -e "${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo ""
echo -e "  ${CYAN}Next steps — run these as the crm user:${RESET}"
echo ""
echo -e "  1. Switch to the crm user:"
echo -e "       ${BOLD}sudo -u crm bash${RESET}"
echo ""
echo -e "  2. Clone your repository:"
echo -e "       ${BOLD}git clone https://github.com/<YOU>/<REPO>.git $APP_DIR${RESET}"
echo ""
echo -e "  3. Run the deploy script:"
echo -e "       ${BOLD}cd $APP_DIR && bash scripts/deploy.sh${RESET}"
echo ""
echo -e "  4. After deploying, the app will be live at:"
echo -e "       ${BOLD}http://${SERVER_IP}${RESET}"
echo ""
echo -e "  ${YELLOW}Security reminders:${RESET}"
echo -e "   - Set a strong JWT_SECRET in $APP_DIR/backend/.env"
echo -e "   - Change the default admin password after first login"
echo -e "   - Add a domain + SSL certificate when ready (see scripts/add-ssl.sh)"
echo ""
