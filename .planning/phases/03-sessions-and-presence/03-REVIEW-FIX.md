---
phase: 03
fixed_at: 2026-04-18T17:56:19Z
review_path: /Users/kayama/work/ai/da/hackaton/online-chat-server/.planning/phases/03-sessions-and-presence/03-REVIEW.md
iteration: 1
findings_in_scope: 6
fixed: 6
skipped: 0
status: all_fixed
---

# Phase 03: Code Review Fix Report

**Fixed at:** 2026-04-18T17:56:19Z
**Source review:** `/Users/kayama/work/ai/da/hackaton/online-chat-server/.planning/phases/03-sessions-and-presence/03-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 6
- Fixed: 6
- Skipped: 0

## Fixed Issues

### CR-01: `deleteById` is a silent no-op — ownership check race (TOCTOU) in `revokeSession`

**Files modified:** `apps/api/src/auth/auth.service.ts`, `apps/api/src/auth/session.repository.ts`
**Commit:** `92b6b1c`
**Fix status:** `fixed: requires human verification`
**Applied fix:** Replaced the read-then-delete revoke flow with a single user-scoped delete, and made the repository throw `NotFoundException` when no row is removed.

### WR-01: `deleteById` silently no-ops on cross-user delete — misleads callers

**Files modified:** `apps/api/src/auth/auth.service.ts`, `apps/api/src/auth/session.repository.ts`
**Commit:** `92b6b1c`
**Applied fix:** Removed the repository comment that normalized silent no-ops and enforced the affected-row check inside `deleteById`.

### WR-02: X-Forwarded-For unconditionally trusted — IP spoofing in direct-to-API deployments

**Files modified:** `apps/api/src/auth/session-metadata.ts`
**Commit:** `c77453b`
**Applied fix:** Added `TRUST_PROXY` gating so forwarded IP headers are ignored when proxy trust is disabled.

### WR-03: Cookie name mismatch in smoke script — session revocation tests will fail

**Files modified:** `scripts/qa/phase3-session-presence-smoke.sh`
**Commit:** `d8f96fd`
**Applied fix:** Updated the smoke script to assert on the actual `session` cookie field in the Netscape cookie jar format.

### WR-04: `getPresence` accepts unbounded `userIds` array — no input validation

**Files modified:** `apps/api/src/ws/app.gateway.ts`
**Commit:** `4cf901b`
**Applied fix:** Validated `getPresence` payloads as unknown input, filtered to string IDs only, and capped lookups at 500 user IDs per request.

### WR-05: `revokeOtherSessions` does not re-validate token ownership — can use a stale token

**Files modified:** `apps/api/src/auth/session-management.controller.ts`
**Commit:** `c423f09`
**Fix status:** `fixed: requires human verification`
**Applied fix:** Switched session inventory and revoke-other-sessions to use `ctx.session.session_token` from the authenticated guard context instead of re-parsing cookies.

---

_Fixed: 2026-04-18T17:56:19Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
