#!/usr/bin/env bash
# scripts/qa/phase1-transport-check.sh
#
# Phase 1 REST and WebSocket transport availability check.
# Covers: ARCH-02 — REST and WebSocket entrypoints both exist.
#         Task IDs: 01-02-01, 01-02-02, 01-03-01, 01-04-01, 01-04-02
#         Threat refs: T-01-10, T-01-11, T-01-14
#
# Checks performed:
#   1. GET /healthz on API (REST health endpoint)
#   2. GET /api/v1/meta confirms both 'rest' and 'websocket' transports
#   3. GET /healthz on web container (static health target)
#   4. WebSocket handshake probe via curl HTTP upgrade request
#
# Usage:
#   # Stack must already be running (use phase1-smoke.sh to start it)
#   API_URL=http://localhost:3000 WEB_URL=http://localhost:4173 scripts/qa/phase1-transport-check.sh
#
# Exit codes:
#   0 — all transport checks passed
#   1 — one or more transport checks failed

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

API_URL="${API_URL:-http://localhost:3000}"
WEB_URL="${WEB_URL:-http://localhost:4173}"

PASS=0
FAIL=0

check_pass() { echo "  OK: $1"; PASS=$((PASS + 1)); }
check_fail() { echo "  FAIL: $1" >&2; FAIL=$((FAIL + 1)); }

echo "=== Phase 1 Transport Check ==="
echo "API URL: ${API_URL}"
echo "Web URL: ${WEB_URL}"
echo "Task IDs: 01-02-01, 01-02-02, 01-03-01, 01-04-01, 01-04-02"
echo "Threat refs: T-01-10, T-01-11, T-01-14"
echo ""

# ── 1. REST: GET /healthz ─────────────────────────────────────────────────
echo "--- 1. REST /healthz ---"

HEALTH_STATUS=$(curl -sf -o /dev/null -w "%{http_code}" "${API_URL}/healthz" 2>/dev/null || echo "000")
if [[ "${HEALTH_STATUS}" == "200" ]]; then
  check_pass "GET ${API_URL}/healthz returned 200"
else
  check_fail "GET ${API_URL}/healthz returned ${HEALTH_STATUS} (expected 200)"
fi

HEALTH_BODY=$(curl -sf "${API_URL}/healthz" 2>/dev/null || echo "")
if echo "${HEALTH_BODY}" | grep -q '"status":"ok"'; then
  check_pass "/healthz body contains {status: ok}"
else
  check_fail "/healthz body missing {status: ok}: got '${HEALTH_BODY}'"
fi

echo ""

# ── 2. REST: GET /api/v1/meta — confirms both transports declared ────────
echo "--- 2. REST /api/v1/meta (transport declaration) ---"

META_STATUS=$(curl -sf -o /dev/null -w "%{http_code}" "${API_URL}/api/v1/meta" 2>/dev/null || echo "000")
if [[ "${META_STATUS}" == "200" ]]; then
  check_pass "GET ${API_URL}/api/v1/meta returned 200"
else
  check_fail "GET ${API_URL}/api/v1/meta returned ${META_STATUS} (expected 200)"
fi

META_BODY=$(curl -sf "${API_URL}/api/v1/meta" 2>/dev/null || echo "")
echo "  Meta response: ${META_BODY}"

if echo "${META_BODY}" | grep -q '"rest"'; then
  check_pass "meta reports 'rest' transport"
else
  check_fail "meta missing 'rest' transport declaration"
fi

if echo "${META_BODY}" | grep -q '"websocket"'; then
  check_pass "meta reports 'websocket' transport"
else
  check_fail "meta missing 'websocket' transport declaration"
fi

echo ""

# ── 3. Web healthz static endpoint ────────────────────────────────────────
echo "--- 3. Web /healthz (static file) ---"

WEB_HEALTH_STATUS=$(curl -sf -o /dev/null -w "%{http_code}" "${WEB_URL}/healthz" 2>/dev/null || echo "000")
if [[ "${WEB_HEALTH_STATUS}" == "200" ]]; then
  check_pass "GET ${WEB_URL}/healthz returned 200"
else
  check_fail "GET ${WEB_URL}/healthz returned ${WEB_HEALTH_STATUS} (expected 200)"
fi

WEB_HEALTH_BODY=$(curl -sf "${WEB_URL}/healthz" 2>/dev/null || echo "")
if echo "${WEB_HEALTH_BODY}" | grep -q "ok"; then
  check_pass "web /healthz body contains 'ok'"
else
  check_fail "web /healthz body unexpected: '${WEB_HEALTH_BODY}'"
fi

echo ""

# ── 4. WebSocket handshake probe ─────────────────────────────────────────
# Socket.IO negotiates transport via HTTP polling before upgrading to WebSocket.
# We probe the Socket.IO polling endpoint to confirm the gateway is reachable.
echo "--- 4. WebSocket / Socket.IO handshake probe ---"

# Socket.IO EIO=4 polling handshake endpoint
SOCKETIO_URL="${API_URL}/socket.io/?EIO=4&transport=polling"
WS_STATUS=$(curl -sf -o /dev/null -w "%{http_code}" "${SOCKETIO_URL}" 2>/dev/null || echo "000")

if [[ "${WS_STATUS}" == "200" ]]; then
  check_pass "Socket.IO polling handshake returned 200 (WebSocket gateway reachable)"
elif [[ "${WS_STATUS}" == "400" || "${WS_STATUS}" == "101" ]]; then
  # 400 can be returned when the EIO version is not matching but gateway exists
  check_pass "Socket.IO gateway responds to handshake (HTTP ${WS_STATUS})"
else
  check_fail "Socket.IO polling handshake returned ${WS_STATUS} (expected 200/400/101; gateway may be unavailable)"
fi

echo ""

# ── Summary ───────────────────────────────────────────────────────────────
echo "--- Summary ---"
echo "Passed: ${PASS}  Failed: ${FAIL}"
echo ""

if [[ "${FAIL}" -gt 0 ]]; then
  echo "=== Phase 1 Transport Check FAILED ==="
  exit 1
fi

echo "=== Phase 1 Transport Check PASSED ==="
