#!/usr/bin/env bash
# =============================================================================
#  Orange Falcon CRM -- Add HTTPS / SSL Certificate
#  Run on the VPS after you have pointed a domain name at your server IP.
#
#  Usage:
#    bash scripts/add-ssl.sh yourdomain.com your@email.com
#
#  Prerequisites:
#    - vps-setup.sh has already been run
#    - Your domain's DNS A record points to this VPS IP
#    - DNS has propagated (check: dig +short yourdomain.com)
#
#  This script:
#    1. Installs Certbot and the nginx plugin
#    2. Obtains a free Let's Encrypt certificate
#    3. Rewrites the nginx config for HTTPS
#    4. Sets up automatic renewal via a cron job
# =============================================================================

set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

info()    { echo -e "${CYAN}[SSL]${RESET} $*"; }
success() { echo -e "${GREEN}[SSL]${RESET} $*"; }
err()     { echo -e "${RED}[SSL]${RESET} $*"; exit 1; }

DOMAIN="${1:-}"
EMAIL="${2:-}"

[ -n "$DOMAIN" ] || err "Usage: bash scripts/add-ssl.sh <domain> <email>"
[ -n "$EMAIL"  ] || err "Usage: bash scripts/add-ssl.sh <domain> <email>"
[ "$(id -u)" -eq 0 ] || err "Run as root: sudo bash scripts/add-ssl.sh $DOMAIN $EMAIL"

BACKEND_PORT="5003"
APP_DIR="/var/www/orange-falcon-crm"

echo ""
echo -e "${BOLD}Orange Falcon CRM -- Add SSL for $DOMAIN${RESET}"
echo ""

# Verify DNS resolves to this machine
SERVER_IP=$(curl -s --max-time 5 ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')
DNS_IP=$(dig +short "$DOMAIN" 2>/dev/null | tail -1 || echo "")
if [ "$DNS_IP" != "$SERVER_IP" ]; then
  err "DNS check failed. $DOMAIN resolves to '$DNS_IP' but this server is '$SERVER_IP'.
  Update your domain's A record, wait for propagation, then re-run."
fi
success "DNS verified: $DOMAIN -> $SERVER_IP"

# Install Certbot
info "Installing Certbot..."
apt-get install -y -qq certbot python3-certbot-nginx
success "Certbot installed"

# Obtain certificate
info "Obtaining Let's Encrypt certificate..."
certbot certonly --nginx \
  --non-interactive \
  --agree-tos \
  --email "$EMAIL" \
  --domains "$DOMAIN"
success "Certificate obtained"

# Rewrite nginx config with HTTPS
info "Updating nginx configuration for HTTPS..."
cat > /etc/nginx/sites-available/orange-falcon-crm << NGINX_CONF
# Orange Falcon CRM — nginx HTTPS configuration

# Redirect all HTTP to HTTPS
server {
    listen 80;
    server_name ${DOMAIN};
    return 301 https://\$host\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name ${DOMAIN};

    ssl_certificate     /etc/letsencrypt/live/${DOMAIN}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${DOMAIN}/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;

    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options        "SAMEORIGIN"    always;
    add_header X-Content-Type-Options "nosniff"       always;
    add_header X-XSS-Protection       "1; mode=block" always;
    add_header Referrer-Policy        "strict-origin-when-cross-origin" always;

    root ${APP_DIR}/frontend/dist;
    index index.html;

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

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location ~ /\. {
        deny all;
    }
}
NGINX_CONF

nginx -t && nginx -s reload
success "nginx updated for HTTPS"

# Auto-renewal cron
info "Setting up auto-renewal..."
(crontab -l 2>/dev/null; echo "0 3 * * * certbot renew --quiet --nginx") | sort -u | crontab -
success "Auto-renewal registered (runs daily at 3 AM)"

# Update CLIENT_URL in .env
ENV_FILE="$APP_DIR/backend/.env"
if [ -f "$ENV_FILE" ]; then
  sed -i "s|^CLIENT_URL=.*|CLIENT_URL=https://${DOMAIN}|" "$ENV_FILE"
  info "CLIENT_URL updated in .env to https://${DOMAIN}"
fi

echo ""
echo -e "${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "${BOLD}${GREEN}  HTTPS is live!${RESET}"
echo -e "${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo ""
echo -e "  App is live at:  ${BOLD}https://${DOMAIN}${RESET}"
echo ""
echo -e "  Reload the backend so it picks up the updated CLIENT_URL:"
echo -e "    ${BOLD}pm2 reload orange-falcon-crm${RESET}"
echo ""
