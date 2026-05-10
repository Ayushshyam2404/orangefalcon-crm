#!/usr/bin/env bash
# =============================================================================
#  Orange Falcon CRM -- Test Runner
#  Usage:  ./tests.sh [options]
#
#  Options:
#    --watch       Run Jest in watch mode
#    --coverage    Generate a code coverage report
#    --verbose     Show individual test names
#    --filter <pattern>  Run only tests whose name matches <pattern>
#    --help        Show this help message
# =============================================================================

set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
BACKEND="$ROOT/backend"

# -- Colours ------------------------------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
RESET='\033[0m'

# -- Logging helpers ----------------------------------------------------------
info()    { echo -e "${CYAN}[TEST]${RESET} $*"; }
success() { echo -e "${GREEN}[TEST]${RESET} $*"; }
warn()    { echo -e "${YELLOW}[TEST]${RESET} $*"; }
error()   { echo -e "${RED}[TEST]${RESET} $*"; }
divider() { echo -e "${DIM}────────────────────────────────────────────────────────${RESET}"; }

# -- Parse arguments ----------------------------------------------------------
WATCH=false
COVERAGE=false
VERBOSE=false
FILTER=""

usage() {
  echo ""
  echo -e "${BOLD}Orange Falcon CRM -- Test Runner${RESET}"
  echo ""
  echo "  Usage:  ./tests.sh [options]"
  echo ""
  echo "  Options:"
  echo "    --watch              Run Jest in watch mode (re-runs on file change)"
  echo "    --coverage           Generate HTML + text code coverage report"
  echo "    --verbose            Print every individual test name"
  echo "    --filter <pattern>   Run only tests matching the given pattern"
  echo "    --help               Show this help message"
  echo ""
  exit 0
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --watch)    WATCH=true;        shift ;;
    --coverage) COVERAGE=true;     shift ;;
    --verbose)  VERBOSE=true;      shift ;;
    --filter)   FILTER="${2:-}";   shift 2 ;;
    --help|-h)  usage ;;
    *)
      error "Unknown option: $1"
      usage
      ;;
  esac
done

# -- Environment checks -------------------------------------------------------
echo ""
echo -e "${BOLD}Orange Falcon CRM -- Test Suite${RESET}"
divider

info "Checking environment..."

if ! command -v node &>/dev/null; then
  error "Node.js is not installed. Install it from https://nodejs.org"
  exit 1
fi

if ! command -v npm &>/dev/null; then
  error "npm is not installed."
  exit 1
fi

NODE_VER=$(node -v)
NPM_VER=$(npm -v)
info "Node.js ${NODE_VER}  |  npm v${NPM_VER}"

if [ ! -d "$BACKEND/node_modules" ]; then
  warn "node_modules not found -- running npm install..."
  (cd "$BACKEND" && npm install --silent)
  success "Dependencies installed"
fi

# -- Build Jest arguments -----------------------------------------------------
JEST_ARGS="--forceExit --detectOpenHandles"

[ "$WATCH"    = true ] && JEST_ARGS="$JEST_ARGS --watch"
[ "$COVERAGE" = true ] && JEST_ARGS="$JEST_ARGS --coverage"
[ "$VERBOSE"  = true ] && JEST_ARGS="$JEST_ARGS --verbose"
[ -n "$FILTER" ]       && JEST_ARGS="$JEST_ARGS -t \"$FILTER\""

# -- Print run configuration --------------------------------------------------
divider
info "Test directory : $BACKEND/tests/"
info "Jest arguments : $JEST_ARGS"
[ "$COVERAGE" = true ] && info "Coverage report: $BACKEND/coverage/lcov-report/index.html"
[ -n "$FILTER" ]       && info "Filter pattern : $FILTER"
divider
echo ""

# -- Record start time --------------------------------------------------------
START_TS=$(date +%s)

# -- Run tests ----------------------------------------------------------------
EXIT_CODE=0
(cd "$BACKEND" && eval "npx jest $JEST_ARGS") || EXIT_CODE=$?

# -- Report -------------------------------------------------------------------
END_TS=$(date +%s)
ELAPSED=$(( END_TS - START_TS ))
MINS=$(( ELAPSED / 60 ))
SECS=$(( ELAPSED % 60 ))

echo ""
divider
if [ "$EXIT_CODE" -eq 0 ]; then
  success "All tests passed in ${MINS}m ${SECS}s"
  [ "$COVERAGE" = true ] && info "Open $BACKEND/coverage/lcov-report/index.html to view coverage"
else
  error "Tests FAILED (exit code $EXIT_CODE) in ${MINS}m ${SECS}s"
  error "Run with --verbose for per-test detail, or check output above for stack traces"
fi
divider
echo ""

exit "$EXIT_CODE"
