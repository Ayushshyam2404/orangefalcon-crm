#!/usr/bin/env bash
# =============================================================================
#  Orange Falcon CRM -- Maintenance Check
#  Usage:  ./maintenance.sh [options]
#
#  Performs a full pre-deployment and routine maintenance inspection:
#    - Runtime dependency versions
#    - Environment configuration
#    - Node module integrity
#    - MongoDB connectivity
#    - Backend API health
#    - VPS log directory (permissions, disk usage, stale files)
#    - Log rotation (archives entries older than LOG_RETENTION_DAYS)
#    - Disk space thresholds
#    - Security file-permission audit
#
#  Options:
#    --rotate-logs    Rotate stale log files even if threshold not exceeded
#    --fix            Attempt to auto-fix minor issues (permissions, dirs)
#    --quiet          Suppress passing checks; only print warnings and errors
#    --help           Show this help message
# =============================================================================

set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
BACKEND="$ROOT/backend"
LOG_DIR="$ROOT/logs/crm-data"
ARCHIVE_DIR="$ROOT/logs/archive"

# Tunable thresholds
LOG_RETENTION_DAYS="${LOG_RETENTION_DAYS:-30}"       # Days to keep raw CRM logs
DISK_WARN_PERCENT="${DISK_WARN_PERCENT:-80}"          # Warn when disk is X% full
DISK_CRIT_PERCENT="${DISK_CRIT_PERCENT:-90}"          # Critical at X%
BACKEND_PORT="${BACKEND_PORT:-5003}"
BACKEND_HEALTH_URL="http://localhost:${BACKEND_PORT}/api/health"
MONGO_URI="${MONGO_URI:-mongodb://localhost:27017}"

# -- Colours ------------------------------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
RESET='\033[0m'

# -- Parse arguments ----------------------------------------------------------
ROTATE_LOGS=false
FIX=false
QUIET=false

usage() {
  echo ""
  echo -e "${BOLD}Orange Falcon CRM -- Maintenance Check${RESET}"
  echo ""
  echo "  Usage:  ./maintenance.sh [options]"
  echo ""
  echo "  Options:"
  echo "    --rotate-logs    Force log rotation for files older than ${LOG_RETENTION_DAYS} days"
  echo "    --fix            Auto-fix correctable issues (permissions, missing dirs)"
  echo "    --quiet          Only show warnings and errors"
  echo "    --help           Show this help"
  echo ""
  echo "  Environment overrides (set before running):"
  echo "    LOG_RETENTION_DAYS   Days to keep raw logs (default: 30)"
  echo "    DISK_WARN_PERCENT    Disk % usage to trigger a warning (default: 80)"
  echo "    DISK_CRIT_PERCENT    Disk % usage to trigger a critical error (default: 90)"
  echo "    BACKEND_PORT         Backend API port (default: 5003)"
  echo "    MONGO_URI            MongoDB connection string (default: mongodb://localhost:27017)"
  echo ""
  exit 0
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --rotate-logs) ROTATE_LOGS=true; shift ;;
    --fix)         FIX=true;         shift ;;
    --quiet)       QUIET=true;       shift ;;
    --help|-h)     usage ;;
    *)
      echo -e "${RED}[MAINT]${RESET} Unknown option: $1"
      usage
      ;;
  esac
done

# -- Check counters -----------------------------------------------------------
PASS=0
WARN=0
FAIL=0

# -- Logging helpers ----------------------------------------------------------
pass() {
  PASS=$(( PASS + 1 ))
  [ "$QUIET" = false ] && echo -e "  ${GREEN}PASS${RESET}  $*"
}
warn() {
  WARN=$(( WARN + 1 ))
  echo -e "  ${YELLOW}WARN${RESET}  $*"
}
fail() {
  FAIL=$(( FAIL + 1 ))
  echo -e "  ${RED}FAIL${RESET}  $*"
}
info()    { [ "$QUIET" = false ] && echo -e "  ${CYAN}INFO${RESET}  $*"; }
section() { echo -e "\n${BOLD}$*${RESET}"; echo -e "${DIM}$(printf '%.0s-' {1..58})${RESET}"; }
divider() { echo -e "${DIM}────────────────────────────────────────────────────────${RESET}"; }

# =============================================================================
echo ""
echo -e "${BOLD}Orange Falcon CRM -- Maintenance Report${RESET}"
echo -e "${DIM}Generated: $(date '+%Y-%m-%d %H:%M:%S %Z')${RESET}"
divider

# =============================================================================
section "1. Runtime Dependencies"

# Node.js
if command -v node &>/dev/null; then
  NODE_VER=$(node -v | tr -d 'v')
  MAJOR=$(echo "$NODE_VER" | cut -d. -f1)
  if [ "$MAJOR" -ge 18 ]; then
    pass "Node.js v${NODE_VER} (required: 18+)"
  else
    fail "Node.js v${NODE_VER} is below the required minimum of v18"
  fi
else
  fail "Node.js is not installed"
fi

# npm
if command -v npm &>/dev/null; then
  NPM_VER=$(npm -v)
  pass "npm v${NPM_VER}"
else
  fail "npm is not installed"
fi

# MongoDB daemon
if command -v mongod &>/dev/null; then
  MONGO_VER=$(mongod --version 2>/dev/null | head -1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1 || echo "unknown")
  pass "mongod found (v${MONGO_VER})"
else
  warn "mongod binary not found -- MongoDB may be remote-only (Atlas/cloud)"
fi

# curl (used by health check)
if command -v curl &>/dev/null; then
  pass "curl available"
else
  warn "curl not found -- backend health check will be skipped"
fi

# =============================================================================
section "2. Environment Configuration"

ENV_FILE="$BACKEND/.env"
if [ -f "$ENV_FILE" ]; then
  pass ".env file exists at backend/.env"

  # Check each critical variable
  check_env() {
    local var="$1"
    local label="$2"
    if grep -q "^${var}=" "$ENV_FILE" 2>/dev/null; then
      local val
      val=$(grep "^${var}=" "$ENV_FILE" | cut -d= -f2-)
      if [ -z "$val" ]; then
        warn "${label} (${var}) is set but empty"
      else
        pass "${label} (${var}) is configured"
      fi
    else
      warn "${label} (${var}) is not set in .env"
    fi
  }

  check_env "MONGO_URI"         "MongoDB connection string"
  check_env "JWT_SECRET"        "JWT signing secret"
  check_env "REPORT_FROM_EMAIL" "Report sender email"
  check_env "REPORT_FROM_PASS"  "Report sender password"
  check_env "REPORT_TO_EMAIL"   "Report recipient email (fallback)"
  check_env "REPORT_SMTP_HOST"  "SMTP host"

  # Warn if JWT_SECRET looks like the default placeholder
  if grep -q "^JWT_SECRET=your_super_secret" "$ENV_FILE" 2>/dev/null; then
    fail "JWT_SECRET is using the default placeholder value -- change this before deploying"
  fi

  # Check .env is not world-readable
  ENV_PERMS=$(stat -f "%OLp" "$ENV_FILE" 2>/dev/null || stat -c "%a" "$ENV_FILE" 2>/dev/null || echo "unknown")
  if [ "$ENV_PERMS" = "600" ] || [ "$ENV_PERMS" = "640" ]; then
    pass ".env file permissions are ${ENV_PERMS} (secure)"
  else
    if [ "$FIX" = true ]; then
      chmod 600 "$ENV_FILE"
      warn ".env permissions were ${ENV_PERMS} -- corrected to 600"
    else
      warn ".env file permissions are ${ENV_PERMS} -- should be 600 or 640 (run with --fix to correct)"
    fi
  fi
else
  fail ".env file not found at backend/.env -- copy .env.example and configure it"
fi

# =============================================================================
section "3. Node Module Integrity"

if [ -d "$BACKEND/node_modules" ]; then
  pass "backend/node_modules exists"

  # Check if package.json has changed since last install
  PKG="$BACKEND/package.json"
  LOCK="$BACKEND/package-lock.json"
  if [ -f "$LOCK" ] && [ "$PKG" -nt "$LOCK" ]; then
    warn "package.json is newer than package-lock.json -- consider running npm install"
  else
    pass "package.json is consistent with last install"
  fi

  # Check for critical dev dependencies used by tests
  for dep in jest supertest mongodb-memory-server; do
    if [ -d "$BACKEND/node_modules/$dep" ]; then
      pass "Dev dependency present: $dep"
    else
      fail "Dev dependency missing: $dep -- run: cd backend && npm install"
    fi
  done
else
  if [ "$FIX" = true ]; then
    info "node_modules missing -- running npm install..."
    (cd "$BACKEND" && npm install --silent)
    pass "backend/node_modules installed"
  else
    fail "backend/node_modules not found -- run: cd backend && npm install (or use --fix)"
  fi
fi

# =============================================================================
section "4. Database Connectivity"

MONGO_LIVE=false
if command -v mongosh &>/dev/null; then
  if mongosh --quiet --eval "db.runCommand({ping:1})" "$MONGO_URI" &>/dev/null 2>&1; then
    pass "MongoDB is reachable at ${MONGO_URI}"
    MONGO_LIVE=true

    # Collection count
    COL_COUNT=$(mongosh --quiet --eval "db.getCollectionNames().length" "$MONGO_URI/orange-falcon-crm" 2>/dev/null || echo "?")
    info "Collections in orange-falcon-crm database: ${COL_COUNT}"
  else
    warn "MongoDB did not respond at ${MONGO_URI} -- the server may not be running"
  fi
elif command -v mongo &>/dev/null; then
  if mongo --quiet --eval "db.runCommand({ping:1})" "$MONGO_URI" &>/dev/null 2>&1; then
    pass "MongoDB is reachable (via legacy mongo shell)"
    MONGO_LIVE=true
  else
    warn "MongoDB did not respond at ${MONGO_URI}"
  fi
else
  warn "Neither mongosh nor mongo shell found -- skipping live DB check"
fi

# =============================================================================
section "5. Backend API Health"

if command -v curl &>/dev/null; then
  # Use || true so curl's own "000" output is not doubled by the fallback echo
  HTTP_CODE=$(curl -o /dev/null -s -w "%{http_code}" --max-time 5 "$BACKEND_HEALTH_URL" 2>/dev/null) || true
  if [ "$HTTP_CODE" = "200" ]; then
    pass "Backend health endpoint returned HTTP 200 (${BACKEND_HEALTH_URL})"
  elif [ -z "$HTTP_CODE" ] || [ "$HTTP_CODE" = "000" ]; then
    warn "Backend is not running on port ${BACKEND_PORT} -- this is expected if running maintenance before startup"
  else
    warn "Backend health endpoint returned HTTP ${HTTP_CODE} at ${BACKEND_HEALTH_URL}"
  fi
else
  warn "curl not available -- backend health check skipped"
fi

# =============================================================================
section "6. VPS Security Log Directory"

if [ -d "$LOG_DIR" ]; then
  pass "Log directory exists: logs/crm-data/"

  # Permission check on directory
  DIR_PERMS=$(stat -f "%OLp" "$LOG_DIR" 2>/dev/null || stat -c "%a" "$LOG_DIR" 2>/dev/null || echo "unknown")
  if [ "$DIR_PERMS" = "700" ] || [ "$DIR_PERMS" = "750" ]; then
    pass "Log directory permissions are ${DIR_PERMS} (secure)"
  else
    if [ "$FIX" = true ]; then
      chmod 700 "$LOG_DIR"
      warn "Log directory permissions were ${DIR_PERMS} -- corrected to 700"
    else
      warn "Log directory permissions are ${DIR_PERMS} -- should be 700 (run with --fix to correct)"
    fi
  fi

  # Count log files and compute total size
  LOG_COUNT=$(find "$LOG_DIR" -name "*.json" -type f 2>/dev/null | wc -l | tr -d ' ')
  if [ "$LOG_COUNT" -gt 0 ]; then
    LOG_SIZE=$(du -sh "$LOG_DIR" 2>/dev/null | cut -f1 || echo "unknown")
    pass "${LOG_COUNT} log file(s) found, total size: ${LOG_SIZE}"

    # Check permissions on individual log files
    INSECURE_FILES=$(find "$LOG_DIR" -name "*.json" -type f ! -perm 600 2>/dev/null | wc -l | tr -d ' ')
    if [ "$INSECURE_FILES" -gt 0 ]; then
      if [ "$FIX" = true ]; then
        find "$LOG_DIR" -name "*.json" -type f ! -perm 600 -exec chmod 600 {} \;
        warn "${INSECURE_FILES} log file(s) had incorrect permissions -- corrected to 0600"
      else
        warn "${INSECURE_FILES} log file(s) do not have 0600 permissions -- run with --fix to correct"
      fi
    else
      pass "All log files have 0600 permissions"
    fi

    # Find oldest log
    OLDEST=$(find "$LOG_DIR" -name "*.json" -type f -print0 2>/dev/null | xargs -0 ls -t 2>/dev/null | tail -1 || echo "")
    if [ -n "$OLDEST" ]; then
      info "Oldest log file: $(basename "$OLDEST")"
    fi

    # Find stale files older than LOG_RETENTION_DAYS
    STALE_COUNT=$(find "$LOG_DIR" -name "*.json" -type f -mtime "+${LOG_RETENTION_DAYS}" 2>/dev/null | wc -l | tr -d ' ')
    if [ "$STALE_COUNT" -gt 0 ]; then
      if [ "$ROTATE_LOGS" = true ]; then
        mkdir -p "$ARCHIVE_DIR"
        find "$LOG_DIR" -name "*.json" -type f -mtime "+${LOG_RETENTION_DAYS}" \
          -exec mv {} "$ARCHIVE_DIR/" \;
        pass "Rotated ${STALE_COUNT} stale log file(s) to logs/archive/"
      else
        warn "${STALE_COUNT} log file(s) older than ${LOG_RETENTION_DAYS} days -- run with --rotate-logs to archive them"
      fi
    else
      pass "No log files older than ${LOG_RETENTION_DAYS} days"
    fi
  else
    info "No log files yet (no daily report has been sent)"
  fi
else
  if [ "$FIX" = true ]; then
    mkdir -p "$LOG_DIR"
    chmod 700 "$LOG_DIR"
    pass "Log directory created: logs/crm-data/ (0700)"
  else
    info "Log directory does not exist yet (will be created on first report send)"
  fi
fi

# Check archive directory
if [ -d "$ARCHIVE_DIR" ]; then
  ARCHIVE_COUNT=$(find "$ARCHIVE_DIR" -name "*.json" -type f 2>/dev/null | wc -l | tr -d ' ')
  ARCHIVE_SIZE=$(du -sh "$ARCHIVE_DIR" 2>/dev/null | cut -f1 || echo "unknown")
  info "Archive: ${ARCHIVE_COUNT} file(s), ${ARCHIVE_SIZE} total"
fi

# =============================================================================
section "7. Disk Space"

# Check disk usage on the partition containing the repo
DISK_INFO=$(df -h "$ROOT" 2>/dev/null | tail -1)
DISK_USED_PCT=$(df "$ROOT" 2>/dev/null | tail -1 | awk '{gsub(/%/,"",$5); print $5}' || echo "0")
DISK_AVAIL=$(echo "$DISK_INFO" | awk '{print $4}')
DISK_TOTAL=$(echo "$DISK_INFO" | awk '{print $2}')

if [ "$DISK_USED_PCT" -ge "$DISK_CRIT_PERCENT" ]; then
  fail "Disk usage is ${DISK_USED_PCT}% (critical threshold: ${DISK_CRIT_PERCENT}%) -- ${DISK_AVAIL} free of ${DISK_TOTAL}"
elif [ "$DISK_USED_PCT" -ge "$DISK_WARN_PERCENT" ]; then
  warn "Disk usage is ${DISK_USED_PCT}% (warning threshold: ${DISK_WARN_PERCENT}%) -- ${DISK_AVAIL} free of ${DISK_TOTAL}"
else
  pass "Disk usage is ${DISK_USED_PCT}% -- ${DISK_AVAIL} free of ${DISK_TOTAL}"
fi

# Check inode usage (on Linux)
if df -i "$ROOT" &>/dev/null 2>&1; then
  INODE_PCT=$(df -i "$ROOT" 2>/dev/null | tail -1 | awk '{gsub(/%/,"",$5); print $5}' || echo "0")
  if [ "$INODE_PCT" -ge "$DISK_WARN_PERCENT" ]; then
    warn "Inode usage is ${INODE_PCT}% -- low inode count can prevent new files from being created"
  else
    pass "Inode usage is ${INODE_PCT}%"
  fi
fi

# =============================================================================
section "8. Security Audit"

# Ensure .env is not tracked by git
if git -C "$ROOT" ls-files --error-unmatch backend/.env &>/dev/null 2>&1; then
  fail ".env is tracked by git -- remove it: git rm --cached backend/.env"
else
  pass ".env is not tracked by git"
fi

# Ensure logs/ is git-ignored
if git -C "$ROOT" check-ignore -q logs/ 2>/dev/null; then
  pass "logs/ directory is git-ignored"
else
  warn "logs/ is not in .gitignore -- sensitive data could be committed accidentally"
fi

# Ensure no .env appears in git history (last 50 commits)
if git -C "$ROOT" log --oneline -50 -- backend/.env 2>/dev/null | grep -q .; then
  fail ".env appears in recent git history -- consider rotating secrets"
else
  pass ".env has not appeared in the last 50 commits"
fi

# Check that seed.js is not deployed with default credentials embedded
if grep -q "admin123\|password123" "$BACKEND/seed.js" 2>/dev/null; then
  warn "seed.js contains a default password -- do not run seed.js in production without changing it first"
fi

# =============================================================================
section "9. Application Logs (.logs/)"

APP_LOG_DIR="$ROOT/.logs"
if [ -d "$APP_LOG_DIR" ]; then
  for logfile in backend.log frontend.log mongo.log; do
    LF="$APP_LOG_DIR/$logfile"
    if [ -f "$LF" ]; then
      LF_SIZE=$(du -sh "$LF" 2>/dev/null | cut -f1 || echo "?")
      LF_LINES=$(wc -l < "$LF" 2>/dev/null || echo "?")
      # Warn if log file exceeds 50 MB
      LF_BYTES=$(du -k "$LF" 2>/dev/null | cut -f1 || echo "0")
      if [ "$LF_BYTES" -gt 51200 ]; then
        warn "${logfile}: ${LF_SIZE} (${LF_LINES} lines) -- consider truncating"
      else
        pass "${logfile}: ${LF_SIZE} (${LF_LINES} lines)"
      fi

      # Scan for genuine error/fatal entries in the last 200 lines.
      # MongoDB structured logs use severity "s":"E" (Error) or "s":"F" (Fatal).
      # For plain-text logs, match " ERROR " / " FATAL " with surrounding spaces to
      # avoid false positives from field names like "shutDownAbortExpiredTransactions".
      MATCHING_LINES=$(tail -200 "$LF" 2>/dev/null | grep -iE '"s":"[EF]"|uncaught|crash| ERROR | FATAL ' || true)
      ERR_COUNT=$(echo "$MATCHING_LINES" | grep -c . 2>/dev/null || true)
      if [ "${ERR_COUNT:-0}" -gt 0 ] && [ -n "$MATCHING_LINES" ]; then
        warn "${logfile}: ${ERR_COUNT} genuine error/fatal line(s) in last 200 lines"
        echo "$MATCHING_LINES" | tail -3 | while IFS= read -r line; do
          info "    ${line}"
        done
      fi
    else
      info "${logfile}: not present (service may not have been started yet)"
    fi
  done
else
  info ".logs/ directory not found (services have not been started)"
fi

# =============================================================================
section "10. Test Suite Status"

if [ -d "$BACKEND/tests" ]; then
  TEST_COUNT=$(find "$BACKEND/tests" -name "*.test.js" | wc -l | tr -d ' ')
  pass "${TEST_COUNT} test file(s) found in backend/tests/"
  info "Run ./tests.sh to execute the full test suite"
else
  warn "backend/tests/ directory not found"
fi

# =============================================================================
# Summary
# =============================================================================

echo ""
divider
echo -e "${BOLD}Maintenance Summary${RESET}"
divider
TOTAL=$(( PASS + WARN + FAIL ))
echo -e "  Total checks : ${TOTAL}"
echo -e "  ${GREEN}Passed${RESET}       : ${PASS}"
echo -e "  ${YELLOW}Warnings${RESET}     : ${WARN}"
echo -e "  ${RED}Failed${RESET}       : ${FAIL}"
divider

if [ "$FAIL" -gt 0 ]; then
  echo -e "  ${BOLD}${RED}Action required.${RESET} Resolve the FAIL items above before deploying to production."
elif [ "$WARN" -gt 0 ]; then
  echo -e "  ${BOLD}${YELLOW}Review warnings.${RESET} The system is functional but some items need attention."
else
  echo -e "  ${BOLD}${GREEN}All checks passed.${RESET} System is healthy."
fi

divider
echo -e "${DIM}Run with --fix to auto-correct permission issues.${RESET}"
echo -e "${DIM}Run with --rotate-logs to archive old CRM data logs.${RESET}"
echo ""

# Exit with non-zero if any checks failed
[ "$FAIL" -gt 0 ] && exit 1 || exit 0
