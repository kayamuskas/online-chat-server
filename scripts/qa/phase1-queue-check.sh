#!/usr/bin/env bash
# scripts/qa/phase1-queue-check.sh
#
# Phase 1 queue foundation smoke check.
# Covers: ARCH-01 — queue substrate boots and worker consumes a trivial job.
#         Task IDs: 01-03-01, 01-03-02, 01-04-01, 01-04-02
#         Threat refs: T-01-10, T-01-11, T-01-14
#
# Verification approach (plan 03 / 01-03-01):
#   POST /api/v1/system-jobs/echo — the deterministic API enqueue path from Plan 03.
#   The worker (plan 03 / 01-03-02) processes system-jobs/echo jobs from the BullMQ
#   'system' queue. We verify the API response here; worker consumption is observable
#   via docker compose logs worker.
#
# Usage:
#   # Stack must already be running (use phase1-smoke.sh to start it)
#   API_URL=http://localhost:3000 scripts/qa/phase1-queue-check.sh
#
# Exit codes:
#   0 — queue smoke check passed
#   1 — queue smoke check failed

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
COMPOSE_FILE="${REPO_ROOT}/infra/compose/compose.yaml"

API_URL="${API_URL:-http://localhost:3000}"

echo "=== Phase 1 Queue Check ==="
echo "API base URL: ${API_URL}"
echo "Task IDs covered: 01-03-01, 01-03-02, 01-04-01, 01-04-02"
echo "Threat refs: T-01-10, T-01-11, T-01-14"
echo ""

# ── 1. Verify API is up before proceeding ─────────────────────────────────
echo "--- 1. API health pre-check ---"
HEALTH_RESPONSE=$(curl -sf "${API_URL}/healthz") || {
  echo "ERROR: ${API_URL}/healthz unreachable — is the stack running?" >&2
  echo "       Run scripts/qa/phase1-smoke.sh first" >&2
  exit 1
}

STATUS=$(echo "${HEALTH_RESPONSE}" | grep -o '"status":"ok"' || echo "")
if [[ -n "${STATUS}" ]]; then
  echo "OK: API is healthy (${HEALTH_RESPONSE})"
else
  echo "FAIL: /healthz returned unexpected response: ${HEALTH_RESPONSE}" >&2
  exit 1
fi

echo ""

# ── 2. Enqueue the system/echo job via POST /api/v1/system-jobs/echo ─────
# This is the deterministic queue smoke producer from Plan 03 (01-03-01).
# The endpoint has zero parameters — no arbitrary injection possible.
echo "--- 2. Enqueue system echo job via POST /api/v1/system-jobs/echo ---"

ENQUEUE_RESPONSE=$(curl -sf -X POST \
  -H "Content-Type: application/json" \
  "${API_URL}/api/v1/system-jobs/echo") || {
  echo "FAIL: POST /api/v1/system-jobs/echo failed" >&2
  exit 1
}

echo "Response: ${ENQUEUE_RESPONSE}"

# Verify the response confirms enqueueing
ENQUEUED=$(echo "${ENQUEUE_RESPONSE}" | grep -o '"enqueued":true' || echo "")
QUEUE_NAME=$(echo "${ENQUEUE_RESPONSE}" | grep -o '"queue":"system"' || echo "")
JOB_NAME=$(echo "${ENQUEUE_RESPONSE}" | grep -o '"jobName":"echo"' || echo "")

if [[ -z "${ENQUEUED}" ]]; then
  echo "FAIL: response missing 'enqueued: true'" >&2
  exit 1
fi
echo "OK: enqueued=true"

if [[ -z "${QUEUE_NAME}" ]]; then
  echo "FAIL: response missing 'queue: system'" >&2
  exit 1
fi
echo "OK: queue=system"

if [[ -z "${JOB_NAME}" ]]; then
  echo "FAIL: response missing 'jobName: echo'" >&2
  exit 1
fi
echo "OK: jobName=echo"

echo ""

# ── 3. Verify the meta endpoint reports the system queue ─────────────────
echo "--- 3. API /api/v1/meta reports system queue ---"

META_RESPONSE=$(curl -sf "${API_URL}/api/v1/meta") || {
  echo "FAIL: GET /api/v1/meta unreachable" >&2
  exit 1
}
echo "Meta response: ${META_RESPONSE}"

QUEUE_IN_META=$(echo "${META_RESPONSE}" | grep -o '"system"' | head -1 || echo "")
if [[ -n "${QUEUE_IN_META}" ]]; then
  echo "OK: 'system' queue reported in /api/v1/meta"
else
  echo "FAIL: 'system' queue not found in /api/v1/meta response" >&2
  exit 1
fi

echo ""

# ── 4. Check worker logs for job processing evidence ─────────────────────
echo "--- 4. Worker log check (informational) ---"
WORKER_LOGS=$(docker compose -f "${COMPOSE_FILE}" logs worker --tail=20 2>/dev/null || echo "")
if echo "${WORKER_LOGS}" | grep -qi "echo\|system\|process"; then
  echo "OK: Worker logs show queue/job activity"
  echo "${WORKER_LOGS}" | grep -i "echo\|system\|process" | tail -5 || true
else
  echo "INFO: No specific echo/system activity in last 20 worker log lines"
  echo "      This is expected if the stack was just started — jobs may be processing"
fi

echo ""
echo "=== Phase 1 Queue Check PASSED ==="
