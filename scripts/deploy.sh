#!/usr/bin/env bash
# =============================================================================
#  Orange Falcon CRM -- Deploy / Update Script
#  Run on the VPS as the crm user (or root) inside the app directory.
#
#  First deploy:
#    cd /var/www/orange-falcon-crm
#    bash scripts/deploy.sh
#
#  Every subsequent update (after git pull on your machine + git push):
#    cd /var/www/orange-falcon-crm
#    bash scripts/deploy.sh
# =============================================================================

set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

info()    { echo -e "${CYAN}[DEPLOY]${RESET} $*"; }
success() { echo -e "${GREEN}[DEPLOY]${RESET} $*"; }
warn()    { echo -e "${YELLOW}[DEPLOY]${RESET} $*"; }
err()     { echo -e "${RED}[DEPLOY]${RESET} $*"; exit 1; }

APP_DIR="/var/www/orangefalcon-crm"
BACKEND="$APP_DIR/backend"
FRONTEND="$APP_DIR/frontend"
PM2_APP_NAME="orange-falcon-crm"

cd "$APP_DIR" || err "App directory not found: $APP_DIR — run vps-setup.sh first"

echo ""
echo -e "${BOLD}Orange Falcon CRM -- Deploy${RESET}"
echo -e "Directory : $APP_DIR"
echo -e "Timestamp : $(date '+%Y-%m-%d %H:%M:%S %Z')"
echo ""

# =============================================================================
# 1. Pull latest code
# =============================================================================
info "Pulling latest code from git..."
git fetch --all --quiet
git reset --hard origin/main --quiet 2>/dev/null || git reset --hard origin/master --quiet
success "Code updated to $(git log --oneline -1)"

# =============================================================================
# 2. Verify .env exists
# =============================================================================
if [ ! -f "$BACKEND/.env" ]; then
  err ".env not found at $BACKEND/.env

  Create it now:
    cp $BACKEND/.env.example $BACKEND/.env
    nano $BACKEND/.env

  Required variables:
    MONGO_URI=mongodb://localhost:27017/orange-falcon-crm
    JWT_SECRET=<64-char-random-string>
    REPORT_FROM_EMAIL=<your-smtp-email>
    REPORT_FROM_PASS=<your-smtp-password>
    REPORT_TO_EMAIL=<recipient-email>
    REPORT_SMTP_HOST=smtp.ionos.com
    CLIENT_URL=http://<your-vps-ip>

  Then re-run: bash scripts/deploy.sh"
fi

# Enforce .env permissions
chmod 600 "$BACKEND/.env"
success ".env found (permissions: 600)"

# =============================================================================
# 3. Backend dependencies
# =============================================================================
info "Installing backend dependencies..."
(cd "$BACKEND" && npm install --omit=dev --silent)
success "Backend dependencies installed"

# =============================================================================
# 4. Frontend build
# =============================================================================
info "Building frontend..."
if [ ! -d "$FRONTEND/node_modules" ]; then
  info "Installing frontend dependencies..."
  (cd "$FRONTEND" && npm install --silent)
fi
(cd "$FRONTEND" && npm run build --silent)
success "Frontend built to frontend/dist/"

# =============================================================================
# 5. Ensure log directories exist with correct permissions
# =============================================================================
mkdir -p "$APP_DIR/logs/crm-data"
mkdir -p "$APP_DIR/.logs"
chmod 700 "$APP_DIR/logs/crm-data"

# =============================================================================
# 6. Start or restart backend with PM2
# =============================================================================
info "Starting/restarting backend with PM2..."

if pm2 describe "$PM2_APP_NAME" &>/dev/null; then
  pm2 reload "$PM2_APP_NAME" --silent
  success "Backend reloaded (zero-downtime)"
else
  pm2 start "$BACKEND/server.js" \
    --name "$PM2_APP_NAME" \
    --cwd  "$BACKEND" \
    --log  "$APP_DIR/.logs/backend.log" \
    --time
  success "Backend started with PM2"
fi

# Save PM2 process list so it survives reboots
pm2 save --silent

# Register PM2 as a systemd startup service (idempotent)
pm2 startup systemd -u "$(whoami)" --hp "$HOME" 2>/dev/null | grep "sudo" | bash 2>/dev/null || true

# =============================================================================
# 7. Verify backend is responding
# =============================================================================
info "Waiting for backend health check..."
BACKEND_PORT=$(grep "^PORT=" "$BACKEND/.env" 2>/dev/null | cut -d= -f2 || echo "5003")
for i in $(seq 1 20); do
  if curl -sf "http://127.0.0.1:${BACKEND_PORT}/api/health" &>/dev/null; then
    success "Backend is responding on port ${BACKEND_PORT}"
    break
  fi
  if [ "$i" -eq 20 ]; then
    warn "Backend health check timed out. Check logs:"
    warn "  pm2 logs $PM2_APP_NAME"
    warn "  cat $APP_DIR/.logs/backend.log"
  fi
  sleep 1
done

# =============================================================================
# 8. Reload nginx (picks up any config changes)
# =============================================================================
if command -v nginx &>/dev/null; then
  nginx -t &>/dev/null && nginx -s reload &>/dev/null && success "nginx reloaded"
fi

# =============================================================================
# 9. First-time seed check
# =============================================================================
SEEDED_FLAG="$APP_DIR/.seeded"
if [ ! -f "$SEEDED_FLAG" ]; then
  echo ""
  warn "First deploy detected."
  warn "Create the initial admin user by running:"
  warn "  cd $BACKEND && node seed.js"
  warn "Then delete seed.js or restrict its execution for security."
  warn "After seeding, touch $SEEDED_FLAG to suppress this message."
  echo ""
fi

# =============================================================================
# Done
# =============================================================================
SERVER_IP=$(curl -s --max-time 5 ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')

echo ""
echo -e "${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "${BOLD}${GREEN}  Deployment complete!${RESET}"
echo -e "${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo ""
echo -e "  App is live at:  ${BOLD}http://${SERVER_IP}${RESET}"
echo ""
echo -e "  Useful commands:"
echo -e "    ${BOLD}pm2 logs $PM2_APP_NAME${RESET}           — Live backend logs"
echo -e "    ${BOLD}pm2 status${RESET}                       — Process status"
echo -e "    ${BOLD}pm2 reload $PM2_APP_NAME${RESET}         — Reload after changes"
echo -e "    ${BOLD}bash scripts/maintenance.sh${RESET}      — Health check (run from repo root)"
echo ""
