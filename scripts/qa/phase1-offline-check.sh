#!/usr/bin/env bash
# scripts/qa/phase1-offline-check.sh
#
# Phase 1 dependency and startup verification.
# Covers: OPS-02 — startup and usage avoid runtime internet dependencies.
#         T-01-11 — Docker builds install from the committed lockfile
#         T-01-14 — no vendored pnpm store is required in the repository
#
# This script checks that:
#   1. No CDN or runtime fetch paths exist in application source (static check)
#   2. Dockerfiles install from the committed lockfile
#   3. The runtime dependency procedure is documented
#   4. No vendored pnpm store is required
#
# Usage:
#   scripts/qa/phase1-offline-check.sh
#
# Exit codes:
#   0 — dependency path is complete
#   1 — dependency path violation detected

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

PASS=0
FAIL=0

check_pass() { echo "  OK: $1"; PASS=$((PASS + 1)); }
check_fail() { echo "  FAIL: $1" >&2; FAIL=$((FAIL + 1)); }

echo "=== Phase 1 Dependency Check ==="
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

if rg --quiet -n "^RUN (curl|wget) " "${REPO_ROOT}/infra/docker/" 2>/dev/null; then
  check_fail "curl/wget calls found in Dockerfiles (potential internet access)"
else
  check_pass "No curl/wget package fetch calls in Dockerfiles"
fi

echo ""

# ── 2. Dockerfile lockfile install path check ──────────────────────────────
echo "--- 2. Dockerfile lockfile install path check ---"

DOCKERFILES=(
  "${REPO_ROOT}/infra/docker/api.Dockerfile"
  "${REPO_ROOT}/infra/docker/web.Dockerfile"
  "${REPO_ROOT}/infra/docker/worker.Dockerfile"
)

for df in "${DOCKERFILES[@]}"; do
  dfname=$(basename "${df}")

  if rg --quiet -- "--frozen-lockfile" "${df}" 2>/dev/null; then
    check_pass "${dfname}: uses --frozen-lockfile"
  else
    check_fail "${dfname}: does NOT use --frozen-lockfile"
  fi

  if rg --quiet "vendor/pnpm-store|--store-dir|--offline" "${df}" 2>/dev/null; then
    check_fail "${dfname}: still references vendored/offline pnpm install path"
  else
    check_pass "${dfname}: does not depend on vendored/offline pnpm install path"
  fi
done

echo ""

# ── 3. Runtime documentation path check ────────────────────────────────────
echo "--- 3. Runtime documentation check ---"

RUNTIME_DOC="${REPO_ROOT}/docs/offline-runtime.md"
if [[ -f "${RUNTIME_DOC}" ]]; then
  check_pass "docs/offline-runtime.md exists"
else
  check_fail "docs/offline-runtime.md not found"
fi

if rg --quiet "pnpm install -r --frozen-lockfile|docker compose .*build|docker compose .*up --wait" "${RUNTIME_DOC}" 2>/dev/null; then
  check_pass "docs/offline-runtime.md references lockfile-backed Docker install procedure"
else
  check_fail "docs/offline-runtime.md missing lockfile-backed Docker install procedure"
fi

if [[ -f "${REPO_ROOT}/pnpm-lock.yaml" ]]; then
  check_pass "pnpm-lock.yaml exists"
else
  check_fail "pnpm-lock.yaml not found"
fi

echo ""

# ── 4. Vendored store removal check ────────────────────────────────────────
echo "--- 4. Vendored store removal check ---"

if rg --quiet "vendor/pnpm-store" \
  "${REPO_ROOT}/infra/docker/" \
  "${REPO_ROOT}/infra/compose/" \
  "${REPO_ROOT}/docs/offline-runtime.md" \
  2>/dev/null; then
  check_fail "vendor/pnpm-store is still referenced by runtime assets"
else
  check_pass "Runtime assets do not require vendor/pnpm-store"
fi

echo ""

# ── Summary ────────────────────────────────────────────────────────────────
echo "--- Summary ---"
echo "Passed: ${PASS}  Failed: ${FAIL}"
echo ""

if [[ "${FAIL}" -gt 0 ]]; then
  echo "=== Phase 1 Dependency Check FAILED ==="
  echo "Resolve all FAIL items before docker compose up --build"
  exit 1
fi

echo "=== Phase 1 Dependency Check PASSED ==="
