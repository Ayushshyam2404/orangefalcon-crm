#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
#  Orange Falcon CRM — Dev Startup Script
#  Usage:  ./start.sh
#  Stops cleanly on Ctrl+C (kills Mongo, backend, and frontend together)
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"
MONGO_DATA="$HOME/mongo-data"
LOG_DIR="$ROOT/.logs"

# ── Colours ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

info()    { echo -e "${CYAN}[CRM]${RESET} $*"; }
success() { echo -e "${GREEN}[CRM]${RESET} $*"; }
warn()    { echo -e "${YELLOW}[CRM]${RESET} $*"; }
error()   { echo -e "${RED}[CRM]${RESET} $*"; }

# ── Cleanup on exit ───────────────────────────────────────────────────────────
PIDS=()
cleanup() {
  echo ""
  warn "Shutting down..."
  for pid in "${PIDS[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
  # Give processes a moment then force-kill
  sleep 1
  for pid in "${PIDS[@]}"; do
    kill -9 "$pid" 2>/dev/null || true
  done
  success "All services stopped. Goodbye!"
  exit 0
}
trap cleanup SIGINT SIGTERM

# ── Prerequisite checks ───────────────────────────────────────────────────────
info "Checking prerequisites..."

if ! command -v node &>/dev/null; then
  error "Node.js is not installed. Install it from https://nodejs.org"
  exit 1
fi

if ! command -v mongod &>/dev/null; then
  error "MongoDB is not installed. Install it from https://www.mongodb.com/try/download/community"
  exit 1
fi

if ! command -v npm &>/dev/null; then
  error "npm is not installed."
  exit 1
fi

NODE_VER=$(node -v)
success "Node.js $NODE_VER found"

# ── Create required directories ───────────────────────────────────────────────
mkdir -p "$MONGO_DATA"
mkdir -p "$LOG_DIR"

# ── Install dependencies (only if node_modules is missing or package.json changed) ──
install_if_needed() {
  local dir="$1"
  local label="$2"
  if [ ! -d "$dir/node_modules" ]; then
    info "Installing $label dependencies..."
    (cd "$dir" && npm install)
    success "$label dependencies installed"
  else
    info "$label dependencies already installed — skipping"
  fi
}

install_if_needed "$BACKEND"  "backend"
install_if_needed "$FRONTEND" "frontend"

# ── Check if MongoDB is already running ──────────────────────────────────────
MONGO_RUNNING=false
if pgrep -x mongod &>/dev/null; then
  warn "MongoDB is already running — reusing existing instance"
  MONGO_RUNNING=true
fi

# ── Start MongoDB ─────────────────────────────────────────────────────────────
if [ "$MONGO_RUNNING" = false ]; then
  info "Starting MongoDB (dbpath: $MONGO_DATA)..."
  mongod --dbpath "$MONGO_DATA" --quiet > "$LOG_DIR/mongo.log" 2>&1 &
  MONGO_PID=$!
  PIDS+=("$MONGO_PID")

  # Wait up to 8 seconds for Mongo to accept connections
  for i in $(seq 1 16); do
    if mongosh --quiet --eval "db.runCommand({ping:1})" &>/dev/null 2>&1; then
      success "MongoDB is ready"
      break
    fi
    if [ "$i" -eq 16 ]; then
      error "MongoDB failed to start. Check $LOG_DIR/mongo.log"
      cat "$LOG_DIR/mongo.log"
      exit 1
    fi
    sleep 0.5
  done
fi

# ── Start Backend ─────────────────────────────────────────────────────────────
info "Starting backend (port 5003)..."
(cd "$BACKEND" && npm run dev > "$LOG_DIR/backend.log" 2>&1) &
BACKEND_PID=$!
PIDS+=("$BACKEND_PID")

# Wait for backend to be ready
for i in $(seq 1 20); do
  if curl -sf http://localhost:5003/api/health &>/dev/null; then
    success "Backend is ready at http://localhost:5003"
    break
  fi
  if [ "$i" -eq 20 ]; then
    error "Backend failed to start. Check $LOG_DIR/backend.log"
    tail -20 "$LOG_DIR/backend.log"
    exit 1
  fi
  sleep 0.5
done

# ── Start Frontend ────────────────────────────────────────────────────────────
info "Starting frontend (port 5173)..."
(cd "$FRONTEND" && npm run dev > "$LOG_DIR/frontend.log" 2>&1) &
FRONTEND_PID=$!
PIDS+=("$FRONTEND_PID")

# Wait for Vite to be ready
for i in $(seq 1 20); do
  if curl -sf http://localhost:5173 &>/dev/null; then
    success "Frontend is ready at http://localhost:5173"
    break
  fi
  if [ "$i" -eq 20 ]; then
    error "Frontend failed to start. Check $LOG_DIR/frontend.log"
    tail -20 "$LOG_DIR/frontend.log"
    exit 1
  fi
  sleep 0.5
done

# ── All services up ───────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "${BOLD}${GREEN}  Orange Falcon CRM is running!${RESET}"
echo -e "${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "  ${CYAN}Frontend${RESET}  →  http://localhost:5173"
echo -e "  ${CYAN}Backend ${RESET}  →  http://localhost:5003"
echo -e "  ${CYAN}MongoDB ${RESET}  →  mongodb://localhost:27017"
echo ""
echo -e "  Logs saved to  ${YELLOW}.logs/${RESET}"
echo -e "  Press ${BOLD}Ctrl+C${RESET} to stop all services"
echo -e "${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo ""

# ── Open browser (macOS) ──────────────────────────────────────────────────────
if command -v open &>/dev/null; then
  sleep 1
  open http://localhost:5173
fi

# ── Tail logs to terminal so you can see live output ─────────────────────────
tail -f "$LOG_DIR/backend.log" "$LOG_DIR/frontend.log" &
TAIL_PID=$!
PIDS+=("$TAIL_PID")

# ── Wait forever until Ctrl+C ────────────────────────────────────────────────
wait
