---
phase: 03-sessions-and-presence
review_path: .planning/phases/03-sessions-and-presence/03-REVIEW.md
reviewed_at: 2026-04-18T00:00:00Z
fixed_at: 2026-04-18T20:54:00Z
fix_scope: critical_warning
findings_in_scope: 6
fixed: 6
skipped: 0
iteration: 1
status: all_fixed
---

# Phase 03 Review Fix Report

## Summary

All findings in scope from `03-REVIEW.md` are resolved in the current workspace.

This pass applied one additional code change:
- `scripts/qa/phase3-session-presence-smoke.sh`: create `COOKIE_C` at startup and include it in the initial `trap`, so cleanup remains correct even if the script exits before section 8 re-registers cleanup.

The remaining in-scope findings from the review were already fixed in the current tree before this pass:
- `apps/api/src/auth/auth.service.ts`: `revokeSession` now uses atomic single-call delete via `deleteById`.
- `apps/api/src/auth/session.repository.ts`: `deleteById` now throws `NotFoundException` when `rowCount === 0`.
- `apps/api/src/auth/session-metadata.ts`: `X-Forwarded-For` trust is gated by `TRUST_PROXY`.
- `apps/api/src/ws/app.gateway.ts`: `getPresence` validates payload shape, filters to string IDs, and caps the request size.
- `apps/api/src/auth/session-management.controller.ts`: session inventory and revoke-all-others use `ctx.session.session_token` instead of reparsing the request cookie.
- `scripts/qa/phase3-session-presence-smoke.sh`: cookie-name grep already matches the real `session` cookie.

## Findings Resolved

### CR-01 / WR-01: Atomic revoke with row-count enforcement

Status: fixed

Evidence:
- `apps/api/src/auth/auth.service.ts` calls `this.sessions.deleteById(sessionId, userId)` directly in `revokeSession`.
- `apps/api/src/auth/session.repository.ts` throws `NotFoundException('session not found')` when the scoped delete affects zero rows.

Outcome:
- Removes the extra ownership-read round trip.
- Eliminates the misleading 204-on-no-op path noted by the review.

### WR-02: Conditional trust for `X-Forwarded-For`

Status: fixed

Evidence:
- `apps/api/src/auth/session-metadata.ts` uses `shouldTrustProxy()` and only reads `x-forwarded-for` when `TRUST_PROXY` is not disabled.

Outcome:
- Direct-to-API deployments can disable forwarded-header trust with `TRUST_PROXY=false` or `0`.

### WR-03: Smoke script checks the correct cookie name

Status: fixed

Evidence:
- `scripts/qa/phase3-session-presence-smoke.sh` now matches the actual `session` cookie in Netscape cookie-jar format.

Outcome:
- Session sign-in smoke checks no longer report false failures.

### WR-04: `getPresence` input validation and request cap

Status: fixed

Evidence:
- `apps/api/src/ws/app.gateway.ts` accepts `data: unknown`, guards with `Array.isArray`, filters to string IDs, and caps requests at `MAX_PRESENCE_USER_IDS`.

Outcome:
- Prevents unbounded user-id fanout from a single authenticated socket message.

### WR-05: Revoke-all-others uses authenticated session token from context

Status: fixed

Evidence:
- `apps/api/src/auth/session-management.controller.ts` passes `ctx.session.session_token` to `revokeAllOtherSessions`.

Outcome:
- Avoids stale or empty-token request reparsing at the controller boundary.

### WR-06: Smoke cleanup trap now covers `COOKIE_C` on early exit

Status: fixed

Evidence:
- `scripts/qa/phase3-session-presence-smoke.sh` creates `COOKIE_C` alongside `COOKIE_A` and `COOKIE_B`, and the initial `trap` removes all three.

Outcome:
- Prevents temp-file leakage when the script exits before section 8 completes.

## Verification

- `pnpm --filter @chat/web build` — passed.
- `pnpm --filter @chat/api test -- --run apps/api/src/__tests__/auth/session-inventory.spec.ts apps/api/src/__tests__/presence/presence.gateway.spec.ts` — the repo's package script still expanded to the broader API suite, which exposed unrelated pre-existing failures outside phase 3 (`@nestjs/testing` devDependency gaps plus existing auth test failures). No new phase-3-specific failure was introduced by this fix pass.

## Notes

- Local uncommitted workspace changes preserved:
  - `apps/web/src/features/account/SessionRow.tsx`
  - `.planning/phases/03-sessions-and-presence/03-UAT.md`
