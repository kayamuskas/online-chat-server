---
phase: 03-sessions-and-presence
reviewed: 2026-04-18T00:00:00Z
depth: standard
files_reviewed: 31
files_reviewed_list:
  - apps/api/src/__tests__/auth/session-inventory.spec.ts
  - apps/api/src/__tests__/presence/presence.gateway.spec.ts
  - apps/api/src/__tests__/presence/presence.service.spec.ts
  - apps/api/src/app.module.ts
  - apps/api/src/auth/auth.controller.ts
  - apps/api/src/auth/auth.module.ts
  - apps/api/src/auth/auth.service.ts
  - apps/api/src/auth/auth.types.ts
  - apps/api/src/auth/session-management.controller.ts
  - apps/api/src/auth/session-metadata.ts
  - apps/api/src/auth/session.repository.ts
  - apps/api/src/db/migrations/0002_session_presence.sql
  - apps/api/src/db/postgres.service.ts
  - apps/api/src/presence/presence-config.ts
  - apps/api/src/presence/presence.module.ts
  - apps/api/src/presence/presence.repository.ts
  - apps/api/src/presence/presence.service.ts
  - apps/api/src/presence/presence.types.ts
  - apps/api/src/ws/app.gateway.ts
  - apps/api/src/ws/ws-auth.ts
  - apps/web/src/App.tsx
  - apps/web/src/features/account/ActiveSessionsView.tsx
  - apps/web/src/features/account/RevokeSessionConfirm.tsx
  - apps/web/src/features/account/SessionRow.tsx
  - apps/web/src/features/presence/CompactPresenceList.tsx
  - apps/web/src/features/presence/DetailedPresencePanel.tsx
  - apps/web/src/features/presence/PresenceDot.tsx
  - apps/web/src/features/presence/PresenceLabel.tsx
  - apps/web/src/features/presence/PresenceTimestamp.tsx
  - apps/web/src/lib/api.ts
  - apps/web/src/styles.css
  - scripts/qa/phase3-session-presence-smoke.sh
findings:
  critical: 1
  warning: 5
  info: 4
  total: 10
status: issues_found
---

# Phase 03: Code Review Report

**Reviewed:** 2026-04-18T00:00:00Z
**Depth:** standard
**Files Reviewed:** 31
**Status:** issues_found

## Summary

Phase 3 introduces session inventory/revocation, presence state management (online/AFK/offline), and the supporting UI surfaces. The implementation is generally well-structured with clean separation of concerns: runtime presence state lives in memory only, PostgreSQL is written on offline transition, and WebSocket connections are gated behind session-cookie authentication.

One critical bug was found in `AuthService.revokeSession`: it calls `findAllByUserId` before `deleteById`, but the session ownership check uses an in-memory `some()` while the actual delete is guarded by a second `user_id` predicate at the SQL level — the double lookup creates a TOCTOU window that is also an unnecessary extra round-trip (and the error path is silent). A second critical-class concern is that `deleteById` is a no-op when the session does not exist or belongs to another user (the query issues no error), but the service layer has already thrown `NotFoundException` before that point — so the SQL-level silencing is redundant and misleading.

Five warnings cover: silent no-op on cross-user delete at the repo level, X-Forwarded-For spoofing in non-proxied deployments, cookie name mismatch between the smoke script and the session cookie set by the server, missing input validation on `getPresence` payloads, and a race window in `revokeOtherSessions` that allows a concurrent sign-in to slip through. Four informational items note hardcoded `localhost` in the API client, a missing `set -e` safety guard in the smoke script's `trap`, a dead sweep comment in `PresenceService`, and the `styles.css` comment still labelling Phase 2.

---

## Critical Issues

### CR-01: `deleteById` is a silent no-op — ownership check race (TOCTOU) in `revokeSession`

**File:** `apps/api/src/auth/auth.service.ts:198-208`

**Issue:** `revokeSession` fetches all sessions for `userId`, checks ownership in memory, then calls `deleteById`. There is a window between the `findAllByUserId` read and the `deleteById` write where the session can be transferred or re-used. More importantly, `deleteById` itself does not throw when it deletes 0 rows — the SQL predicate `WHERE id = $1 AND user_id = $2` silently succeeds with `rowCount = 0`. If the ownership check in `findAllByUserId` passes but the session is concurrently revoked by another call, `deleteById` silently does nothing and the endpoint returns 204, misleading the caller into thinking the revoke succeeded.

The correct fix is to rely solely on the atomic SQL delete (with a `rowCount` check) rather than the two-step fetch + delete pattern:

**Fix:**
```typescript
// auth.service.ts — replace revokeSession with atomic single-query approach
async revokeSession(userId: string, sessionId: string): Promise<void> {
  await this.sessions.deleteById(sessionId, userId);
  // deleteById must now throw NotFoundException when rowCount === 0
}

// session.repository.ts — deleteById should check affected rows
async deleteById(sessionId: string, userId: string): Promise<void> {
  const result = await this.db.query(
    'DELETE FROM sessions WHERE id = $1 AND user_id = $2',
    [sessionId, userId],
  );
  if (result.rowCount === 0) {
    throw new NotFoundException('session not found');
  }
}
```

This removes the double round-trip, eliminates the TOCTOU window, and ensures the 404 is correctly surfaced.

---

## Warnings

### WR-01: `deleteById` silently no-ops on cross-user delete — misleads callers

**File:** `apps/api/src/auth/session.repository.ts:117-122`

**Issue:** The comment on `deleteById` explicitly states "the operation is a no-op (caller should check affected rows if strict error is needed)." The current `AuthService.revokeSession` does check ownership first, but it still calls `deleteById` even after confirming ownership, and if the row disappears between the check and the delete the caller gets a 204 with no action taken. The repository should own the ownership enforcement via `rowCount`, not push that responsibility to every caller. See CR-01 for the combined fix.

**Fix:** Remove the comment that normalizes the silent no-op. Implement `rowCount` check as shown in CR-01.

---

### WR-02: X-Forwarded-For unconditionally trusted — IP spoofing in direct-to-API deployments

**File:** `apps/api/src/auth/session-metadata.ts:40-45`

**Issue:** `extractClientIp` trusts the first value of `X-Forwarded-For` without any check that the connection is coming from a trusted proxy. If the API port is exposed directly to the internet (e.g., during development, or in a misconfigured deployment), a client can inject an arbitrary IP address by sending `X-Forwarded-For: 1.2.3.4`. The captured IP in session inventory would then be attacker-controlled. The code comments acknowledge this but provide no mitigation.

**Fix:** Accept a trusted-proxy list from environment config (or NestJS `app.set('trust proxy', ...)`) and only honour `X-Forwarded-For` when the connecting IP matches the trusted proxy list. At minimum, add a `TRUST_PROXY` environment variable that disables `X-Forwarded-For` reading when set to `false` or `0`:

```typescript
const trustProxy = process.env['TRUST_PROXY'] !== 'false';
if (trustProxy) {
  // read X-Forwarded-For
}
```

---

### WR-03: Cookie name mismatch in smoke script — session revocation tests will fail

**File:** `scripts/qa/phase3-session-presence-smoke.sh:105-109`

**Issue:** The smoke script checks for `chat_session` in the curl cookie file:
```bash
if grep -q "chat_session" "$COOKIE_A" 2>/dev/null; then
```
However, the server sets a cookie named `session` (enforced by `ws-auth.ts` line 16: `const SESSION_COOKIE_NAME = 'session'`). The grep will never match, so the "Session cookie set" assertion will always fail with `[FAIL]` even when a valid session is established. Subsequent steps that use `-b "$COOKIE_A"` will still send the cookie because curl stores it correctly by name — but the test output will report a false failure.

**Fix:**
```bash
if grep -q "^[^#].*\bsession\b" "$COOKIE_A" 2>/dev/null; then
  pass "Session cookie set for session A"
```
Or more precisely, since cookie files use tab-separated netscape format, match the actual cookie name field:
```bash
if grep -qP "\tsession\t" "$COOKIE_A" 2>/dev/null; then
```

---

### WR-04: `getPresence` accepts unbounded `userIds` array — no input validation

**File:** `apps/api/src/ws/app.gateway.ts:112-122`

**Issue:** `handleGetPresence` passes `data.userIds ?? []` directly to `getUsersPresence` without any validation. A malicious authenticated client can send a `getPresence` event with an array containing thousands of user IDs (`{ userIds: Array(100000).fill('x') }`), causing a large iteration over the in-memory map per message. There is also no check that `data` is a non-null object or that `data.userIds` is actually an array before calling `??`.

**Fix:**
```typescript
@SubscribeMessage('getPresence')
handleGetPresence(
  @MessageBody() data: unknown,
  @ConnectedSocket() client: Socket,
): void {
  const userId = this.socketUserMap.get(client.id);
  if (!userId) return;

  const raw = data as GetPresencePayload | null;
  const userIds = Array.isArray(raw?.userIds)
    ? (raw.userIds as string[]).slice(0, 500)   // cap at reasonable limit
    : [];

  const presenceMap = this.presenceService.getUsersPresence(userIds);
  client.emit('presence', presenceMap);
}
```

---

### WR-05: `revokeOtherSessions` does not re-validate token ownership — can use a stale token

**File:** `apps/api/src/auth/session-management.controller.ts:74-77`

**Issue:** `revokeOtherSessions` extracts the current session token from the request cookie and passes it directly to `deleteAllOtherByUserId`. If `extractSessionToken` returns `''` (the fallback from `?? ''` on line 75), the query becomes:
```sql
DELETE FROM sessions WHERE user_id = $1 AND session_token <> ''
```
This would delete ALL sessions for the user, including the current one, because no session has an empty string token. The `CurrentUserGuard` must succeed before this code runs (providing `ctx.session`), so `extractSessionToken` should return the same token that was used for authentication — but using `ctx.session.session_token` directly (which is already validated and available on the `AuthContext`) is safer and avoids the re-parse:

**Fix:**
```typescript
async revokeOtherSessions(@CurrentUser() ctx: AuthContext): Promise<void> {
  await this.authService.revokeAllOtherSessions(ctx.user.id, ctx.session.session_token);
}
```
The same pattern applies to `listSessions` (line 57).

---

## Info

### IN-01: Hardcoded `localhost` in web API client — breaks non-local deployments

**File:** `apps/web/src/lib/api.ts:22`

**Issue:** `const BASE_URL = \`http://localhost:${SERVICE_PORTS.apiHttp}/api/v1\`;` is hardcoded to `localhost`. This works for local dev but will fail in Docker, staging, or any environment where the API is not on the same host. The port is already sourced from `SERVICE_PORTS` but the host is not.

**Fix:** Drive the base URL from an environment variable injected at build time (e.g., `import.meta.env.VITE_API_BASE_URL`) with a `localhost` fallback for local dev.

---

### IN-02: Dead comment about background sweep in `PresenceService` constructor

**File:** `apps/api/src/presence/presence.service.ts:37-41`

**Issue:** The constructor comment says "Background sweep is not strictly required for correctness... Not critical for the tests." but `sweepInterval` is initialised to `null` and never assigned. The sweep is entirely absent from the implementation. Either implement the sweep or remove the comment and the dead `sweepInterval` field/`shutdown()` body.

---

### IN-03: `styles.css` file comment still references Phase 2

**File:** `apps/web/src/styles.css:1-6`

**Issue:** The file header comment reads `Phase 2 styles — auth shell + minimal account surface` but the file now contains Phase 3 presence primitives and session table styles. Minor but misleading.

**Fix:** Update the comment to `Phase 2–3 styles` or `Phase 3 styles`.

---

### IN-04: Smoke script `trap` does not handle `COOKIE_C` consistently

**File:** `scripts/qa/phase3-session-presence-smoke.sh:247-248`

**Issue:** `COOKIE_C` is created inside section 8 with `COOKIE_C=$(mktemp)`. A `trap` is immediately re-registered to include `$COOKIE_C`:
```bash
trap 'rm -f "$COOKIE_A" "$COOKIE_B" "$COOKIE_C"' EXIT
```
This is correct, but if the script exits before line 248 (e.g., `set -euo pipefail` aborts earlier in section 8 because `SIGN_C` fails), `COOKIE_C` has been created but the trap still references the old definition which did not include it. The safer pattern is to assign `COOKIE_C` near the top alongside `COOKIE_A`/`COOKIE_B` and include it in the initial `trap`.

---

_Reviewed: 2026-04-18T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
