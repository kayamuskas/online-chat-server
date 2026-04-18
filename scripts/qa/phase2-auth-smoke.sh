#!/usr/bin/env bash
# =============================================================================
# Phase 2 Auth Smoke — end-to-end coverage for the authentication slice
#
# Usage:
#   ./scripts/qa/phase2-auth-smoke.sh [API_BASE]
#
# Defaults:
#   API_BASE=http://localhost:3000
#
# Prerequisites:
#   - The Docker Compose stack is running (docker compose up -d)
#   - curl is available
#   - The API service is healthy at /healthz
#
# Coverage:
#   1. Register a new account
#   2. Sign in (without keep-signed-in)
#   3. Fetch current user (/auth/me)
#   4. Change password (authenticated)
#   5. Sign out current session
#   6. Confirm session is invalidated after sign-out
#   7. Request a password reset link (enumeration-safe)
#
# Exit codes:
#   0 — all checks passed
#   1 — one or more checks failed
#
# All IDs covered by this script:
#   02-01-01, 02-01-02, 02-02-01, 02-02-02, 02-03-01, 02-03-02, 02-04-01, 02-04-02
#   T-02-01, T-02-02, T-02-03, T-02-04, T-02-05, T-02-06, T-02-07, T-02-08, T-02-09
# =============================================================================

set -euo pipefail

API_BASE="${1:-http://localhost:3000}"
AUTH_BASE="${API_BASE}/api/v1/auth"

# ── Helpers ───────────────────────────────────────────────────────────────────

PASS=0
FAIL=0
COOKIE_JAR=$(mktemp)
trap 'rm -f "$COOKIE_JAR"' EXIT

pass() { echo "[PASS] $1"; ((PASS++)) || true; }
fail() { echo "[FAIL] $1"; ((FAIL++)) || true; }

# ── Smoke test data ───────────────────────────────────────────────────────────

TIMESTAMP=$(date +%s)
EMAIL="smoketest-${TIMESTAMP}@example.com"
USERNAME="smoke${TIMESTAMP}"
PASSWORD="SmokePass1!"
NEW_PASSWORD="SmokePass2!"

# =============================================================================
# 1. API health check
# =============================================================================
echo ""
echo "=== 1. API Health ==="
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${API_BASE}/healthz")
if [ "$STATUS" = "200" ]; then
  pass "API is healthy (HTTP 200)"
else
  fail "API healthz returned HTTP ${STATUS} (expected 200)"
fi

# =============================================================================
# 2. Register a new account (02-02-01, T-02-04)
# =============================================================================
echo ""
echo "=== 2. Register ==="
REGISTER_BODY=$(curl -s -X POST "${AUTH_BASE}/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${EMAIL}\",\"username\":\"${USERNAME}\",\"password\":\"${PASSWORD}\"}" \
  -w "\n__STATUS__%{http_code}")

REGISTER_STATUS=$(echo "$REGISTER_BODY" | grep "__STATUS__" | sed 's/__STATUS__//')
REGISTER_JSON=$(echo "$REGISTER_BODY" | grep -v "__STATUS__")

if [ "$REGISTER_STATUS" = "201" ]; then
  pass "Register returns HTTP 201"
else
  fail "Register returned HTTP ${REGISTER_STATUS} (expected 201)"
fi

if echo "$REGISTER_JSON" | grep -q "\"username\""; then
  pass "Register response contains user object with username"
else
  fail "Register response missing user object"
fi

# =============================================================================
# 3. Sign in (02-02-01, T-02-05)
# =============================================================================
echo ""
echo "=== 3. Sign In ==="
SIGNIN_BODY=$(curl -s -X POST "${AUTH_BASE}/sign-in" \
  -H "Content-Type: application/json" \
  -c "$COOKIE_JAR" \
  -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\",\"keepSignedIn\":false}" \
  -w "\n__STATUS__%{http_code}")

SIGNIN_STATUS=$(echo "$SIGNIN_BODY" | grep "__STATUS__" | sed 's/__STATUS__//')
SIGNIN_JSON=$(echo "$SIGNIN_BODY" | grep -v "__STATUS__")

if [ "$SIGNIN_STATUS" = "200" ]; then
  pass "Sign in returns HTTP 200"
else
  fail "Sign in returned HTTP ${SIGNIN_STATUS} (expected 200)"
fi

if echo "$SIGNIN_JSON" | grep -q "\"username\""; then
  pass "Sign in response contains user object"
else
  fail "Sign in response missing user object"
fi

if grep -q "chat_session" "$COOKIE_JAR" 2>/dev/null; then
  pass "Session cookie (chat_session) is set after sign-in"
else
  fail "Session cookie (chat_session) not found in cookie jar"
fi

# =============================================================================
# 4. Current user lookup via /me (02-02-01, T-02-05)
# =============================================================================
echo ""
echo "=== 4. Current User (/me) ==="
ME_BODY=$(curl -s -X GET "${AUTH_BASE}/me" \
  -b "$COOKIE_JAR" \
  -w "\n__STATUS__%{http_code}")

ME_STATUS=$(echo "$ME_BODY" | grep "__STATUS__" | sed 's/__STATUS__//')
ME_JSON=$(echo "$ME_BODY" | grep -v "__STATUS__")

if [ "$ME_STATUS" = "200" ]; then
  pass "/me returns HTTP 200 with valid session"
else
  fail "/me returned HTTP ${ME_STATUS} (expected 200)"
fi

if echo "$ME_JSON" | grep -q "\"${USERNAME}\""; then
  pass "/me response matches registered username"
else
  fail "/me response does not contain expected username '${USERNAME}'"
fi

# =============================================================================
# 5. Change password (02-03-02, T-02-08)
# =============================================================================
echo ""
echo "=== 5. Change Password ==="
CHANGEPW_STATUS=$(curl -s -o /dev/null -X POST "${AUTH_BASE}/change-password" \
  -H "Content-Type: application/json" \
  -b "$COOKIE_JAR" \
  -d "{\"currentPassword\":\"${PASSWORD}\",\"newPassword\":\"${NEW_PASSWORD}\"}" \
  -w "%{http_code}")

if [ "$CHANGEPW_STATUS" = "204" ]; then
  pass "Change password returns HTTP 204"
else
  fail "Change password returned HTTP ${CHANGEPW_STATUS} (expected 204)"
fi

# Verify new password works by signing in again
SIGNIN2_BODY=$(curl -s -X POST "${AUTH_BASE}/sign-in" \
  -H "Content-Type: application/json" \
  -c "$COOKIE_JAR" \
  -d "{\"email\":\"${EMAIL}\",\"password\":\"${NEW_PASSWORD}\",\"keepSignedIn\":false}" \
  -w "\n__STATUS__%{http_code}")

SIGNIN2_STATUS=$(echo "$SIGNIN2_BODY" | grep "__STATUS__" | sed 's/__STATUS__//')

if [ "$SIGNIN2_STATUS" = "200" ]; then
  pass "Sign in with new password succeeds after change"
else
  fail "Sign in with new password returned HTTP ${SIGNIN2_STATUS} (expected 200)"
fi

# =============================================================================
# 6. Sign out current session (02-02-02, T-02-06)
# =============================================================================
echo ""
echo "=== 6. Sign Out ==="
SIGNOUT_STATUS=$(curl -s -o /dev/null -X POST "${AUTH_BASE}/sign-out" \
  -b "$COOKIE_JAR" \
  -c "$COOKIE_JAR" \
  -w "%{http_code}")

if [ "$SIGNOUT_STATUS" = "204" ]; then
  pass "Sign out returns HTTP 204"
else
  fail "Sign out returned HTTP ${SIGNOUT_STATUS} (expected 204)"
fi

# =============================================================================
# 7. Verify session is invalidated after sign-out (02-02-02, T-02-06)
# =============================================================================
echo ""
echo "=== 7. Session Invalidated After Sign-Out ==="
ME_AFTER_SIGNOUT=$(curl -s -o /dev/null -X GET "${AUTH_BASE}/me" \
  -b "$COOKIE_JAR" \
  -w "%{http_code}")

if [ "$ME_AFTER_SIGNOUT" = "401" ]; then
  pass "/me returns 401 after sign-out (session invalidated)"
else
  fail "/me returned HTTP ${ME_AFTER_SIGNOUT} after sign-out (expected 401)"
fi

# =============================================================================
# 8. Password reset request — enumeration-safe (02-03-01, T-02-07)
# =============================================================================
echo ""
echo "=== 8. Password Reset Request ==="
# Real registered email
RESET_STATUS=$(curl -s -o /dev/null -X POST "${AUTH_BASE}/password-reset/request" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${EMAIL}\"}" \
  -w "%{http_code}")

if [ "$RESET_STATUS" = "200" ]; then
  pass "Password reset request returns HTTP 200 for registered email"
else
  fail "Password reset request returned HTTP ${RESET_STATUS} for registered email (expected 200)"
fi

# Non-existent email must also return 200 (enumeration protection)
RESET_GHOST_STATUS=$(curl -s -o /dev/null -X POST "${AUTH_BASE}/password-reset/request" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"ghost-${TIMESTAMP}@example.com\"}" \
  -w "%{http_code}")

if [ "$RESET_GHOST_STATUS" = "200" ]; then
  pass "Password reset request returns HTTP 200 for non-existent email (enumeration-safe)"
else
  fail "Password reset request returned HTTP ${RESET_GHOST_STATUS} for non-existent email (expected 200 for enumeration safety)"
fi

# =============================================================================
# 9. Duplicate registration rejected (02-02-01, T-02-04)
# =============================================================================
echo ""
echo "=== 9. Duplicate Registration Rejected ==="
DUP_STATUS=$(curl -s -o /dev/null -X POST "${AUTH_BASE}/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${EMAIL}\",\"username\":\"dup-${USERNAME}\",\"password\":\"${PASSWORD}\"}" \
  -w "%{http_code}")

if [ "$DUP_STATUS" = "409" ]; then
  pass "Duplicate email registration returns HTTP 409"
else
  fail "Duplicate email registration returned HTTP ${DUP_STATUS} (expected 409)"
fi

# =============================================================================
# Summary
# =============================================================================
echo ""
echo "============================================="
echo "Phase 2 Auth Smoke — Results"
echo "  Passed: ${PASS}"
echo "  Failed: ${FAIL}"
echo "============================================="

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
exit 0
