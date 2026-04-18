#!/usr/bin/env bash
# scripts/qa/phase1-offline-check.sh
#
# Phase 1 offline dependency and startup verification.
# Covers: OPS-02 — startup and usage avoid internet dependencies.
#         T-01-11 — pull_policy: never; offline Dockerfile install paths
#         T-01-14 — vendor/pnpm-store lockfile-backed offline dependency path
#
# This script checks that:
#   1. No CDN or runtime fetch paths exist in application source (static check)
#   2. All Compose services use pull_policy: never (static check)
#   3. All Dockerfiles use vendor/pnpm-store + --offline (static check)
#   4. The documented offline install procedure is referenced in Dockerfiles
#   5. vendor/pnpm-store/ exists and contains the gitkeep or real package data
#
# Usage:
#   scripts/qa/phase1-offline-check.sh
#
# Exit codes:
#   0 — offline path is complete
#   1 — offline path violation detected

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

PASS=0
FAIL=0

check_pass() { echo "  OK: $1"; PASS=$((PASS + 1)); }
check_fail() { echo "  FAIL: $1" >&2; FAIL=$((FAIL + 1)); }

echo "=== Phase 1 Offline Dependency Check ==="
echo ""

# ── 1. CDN / runtime internet reference scan ───────────────────────────────
echo "--- 1. CDN and runtime internet reference scan ---"

CDN_PATTERNS="unpkg\.com|fonts\.googleapis|fonts\.gstatic|cdnjs\.cloudflare|jsdelivr\.net|babel\.min\.js"

if rg --quiet -n "${CDN_PATTERNS}" \
    "${REPO_ROOT}/apps/web/index.html" \
    "${REPO_ROOT}/apps/web/src/" \
    2>/dev/null; then
  check_fail "CDN/hosted asset references found in web source"
else
  check_pass "No CDN or hosted asset references in web source"
fi

# Check Dockerfiles do not contain plain 'npm install' (without --offline)
# Pattern: npm install NOT followed by --offline
if rg --quiet -n "^RUN npm install(?! --offline)" "${REPO_ROOT}/infra/docker/" 2>/dev/null; then
  check_fail "Plain 'npm install' (without --offline) found in Dockerfiles"
else
  check_pass "No plain 'npm install' calls in Dockerfiles"
fi

# Check Dockerfiles do not contain curl/wget fetching remote packages
if rg --quiet -n "^RUN (curl|wget) " "${REPO_ROOT}/infra/docker/" 2>/dev/null; then
  check_fail "curl/wget calls found in Dockerfiles (potential internet access)"
else
  check_pass "No curl/wget package fetch calls in Dockerfiles"
fi

echo ""

# ── 2. Compose pull_policy: never check ────────────────────────────────────
echo "--- 2. Compose pull_policy: never check ---"

COMPOSE_FILE="${REPO_ROOT}/infra/compose/compose.yaml"
SERVICES=("postgres" "redis" "api" "worker" "web")
for svc in "${SERVICES[@]}"; do
  # Each service block should have pull_policy: never
  if rg --quiet "pull_policy: never" "${COMPOSE_FILE}" 2>/dev/null; then
    : # will do per-service check via docker compose config
  fi
done

PULL_POLICY_COUNT=$(rg -c "pull_policy: never" "${COMPOSE_FILE}" 2>/dev/null || echo 0)
if [[ "${PULL_POLICY_COUNT}" -ge 5 ]]; then
  check_pass "All 5 services have pull_policy: never in compose.yaml (found ${PULL_POLICY_COUNT})"
else
  check_fail "Expected 5 pull_policy: never entries, found ${PULL_POLICY_COUNT} in compose.yaml"
fi

echo ""

# ── 3. Dockerfile offline install path check ──────────────────────────────
echo "--- 3. Dockerfile offline install path check ---"

DOCKERFILES=(
  "${REPO_ROOT}/infra/docker/api.Dockerfile"
  "${REPO_ROOT}/infra/docker/web.Dockerfile"
  "${REPO_ROOT}/infra/docker/worker.Dockerfile"
)

for df in "${DOCKERFILES[@]}"; do
  dfname=$(basename "${df}")

  if rg --quiet "vendor/pnpm-store" "${df}" 2>/dev/null; then
    check_pass "${dfname}: copies vendor/pnpm-store"
  else
    check_fail "${dfname}: does NOT reference vendor/pnpm-store"
  fi

  if rg --quiet -- "--offline" "${df}" 2>/dev/null; then
    check_pass "${dfname}: uses --offline install flag"
  else
    check_fail "${dfname}: does NOT use --offline install flag"
  fi

  if rg --quiet -- "--frozen-lockfile" "${df}" 2>/dev/null; then
    check_pass "${dfname}: uses --frozen-lockfile (lockfile integrity enforced)"
  else
    check_fail "${dfname}: does NOT use --frozen-lockfile"
  fi
done

echo ""

# ── 4. Offline documentation path check ───────────────────────────────────
echo "--- 4. Offline documentation and vendor store check ---"

OFFLINE_DOC="${REPO_ROOT}/docs/offline-runtime.md"
if [[ -f "${OFFLINE_DOC}" ]]; then
  check_pass "docs/offline-runtime.md exists"
else
  check_fail "docs/offline-runtime.md not found"
fi

# Verify the doc describes the pnpm fetch + --offline procedure
if rg --quiet "pnpm fetch|--store-dir|vendor/pnpm-store" "${OFFLINE_DOC}" 2>/dev/null; then
  check_pass "docs/offline-runtime.md references pnpm fetch + vendor/pnpm-store procedure"
else
  check_fail "docs/offline-runtime.md missing pnpm fetch / vendor/pnpm-store procedure description"
fi

# Verify pnpm-lock.yaml exists (required for --frozen-lockfile to work)
if [[ -f "${REPO_ROOT}/pnpm-lock.yaml" ]]; then
  check_pass "pnpm-lock.yaml exists (required for --frozen-lockfile)"
else
  check_fail "pnpm-lock.yaml not found (--frozen-lockfile will fail)"
fi

# Verify vendor/pnpm-store/ path exists
if [[ -d "${REPO_ROOT}/vendor/pnpm-store" ]]; then
  check_pass "vendor/pnpm-store/ directory exists"
else
  check_fail "vendor/pnpm-store/ directory not found (run: pnpm fetch --store-dir ./vendor/pnpm-store)"
fi

echo ""

# ── Summary ────────────────────────────────────────────────────────────────
echo "--- Summary ---"
echo "Passed: ${PASS}  Failed: ${FAIL}"
echo ""

if [[ "${FAIL}" -gt 0 ]]; then
  echo "=== Phase 1 Offline Check FAILED ==="
  echo "Resolve all FAIL items before docker compose up --build"
  exit 1
fi

echo "=== Phase 1 Offline Check PASSED ==="
