#!/usr/bin/env bash
# scripts/qa/phase1-smoke.sh
#
# Phase 1 general startup smoke check.
# Covers: OPS-01 — fresh clone can be started with docker compose up.
#
# Usage:
#   scripts/qa/phase1-smoke.sh
#
# Prerequisites:
#   - Docker daemon running
#   - All required base images pre-pulled (node:22-slim, postgres:18, redis:8)
#   - vendor/pnpm-store/ populated (see docs/offline-runtime.md)
#
# Exit codes:
#   0 — all services healthy
#   1 — startup failed or services unhealthy

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
COMPOSE_FILE="${REPO_ROOT}/infra/compose/compose.yaml"

echo "=== Phase 1 Smoke Check ==="
echo "Compose file: ${COMPOSE_FILE}"
echo ""

# Verify compose file exists
if [[ ! -f "${COMPOSE_FILE}" ]]; then
  echo "ERROR: ${COMPOSE_FILE} not found" >&2
  exit 1
fi

# Validate compose file syntax
echo "--- Validating Compose configuration ---"
docker compose -f "${COMPOSE_FILE}" config --quiet
echo "OK: Compose configuration is valid"
echo ""

# Build and start all services, waiting for all healthchecks to pass
echo "--- Starting Phase 1 stack (docker compose up --build --wait) ---"
docker compose -f "${COMPOSE_FILE}" up --build --wait --timeout 180

echo ""
echo "--- Verifying service health status ---"
docker compose -f "${COMPOSE_FILE}" ps

echo ""
echo "=== Phase 1 Smoke Check PASSED ==="
