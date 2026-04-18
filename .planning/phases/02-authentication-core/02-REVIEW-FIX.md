---
phase: 02
fixed_at: 2026-04-18T15:38:49Z
review_path: .planning/phases/02-authentication-core/02-REVIEW.md
iteration: 1
findings_in_scope: 8
fixed: 8
skipped: 0
status: all_fixed
---

# Phase 02: Code Review Fix Report

**Fixed at:** 2026-04-18T15:38:49Z
**Source review:** `.planning/phases/02-authentication-core/02-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 8
- Fixed: 8
- Skipped: 0

## Fixed Issues

### CR-01: CORS configured with no origin restriction

**Files modified:** `apps/api/src/main.ts`, `packages/shared/src/config.ts`, `infra/compose/compose.yaml`
**Commit:** `d1f6776`
**Applied fix:** Restricted API CORS to a configured `ALLOWED_ORIGIN`, enabled credentialed requests explicitly, and wired the origin through shared runtime config plus compose defaults.

### CR-02: No server-side input validation on any auth endpoint

**Files modified:** `apps/api/src/auth/auth.validation.ts`, `apps/api/src/auth/auth.controller.ts`, `apps/api/src/auth/password-reset.controller.ts`
**Commit:** `8d16ea3`
**Applied fix:** Added explicit request-body validation and normalization for auth and password-reset endpoints, including object-shape checks, field whitelisting, email normalization, password length limits, token validation, and boolean validation for `keepSignedIn`.

### CR-03: Password-reset confirm is not atomic — double-spend race condition

**Files modified:** `apps/api/src/auth/password-reset.service.ts`, `apps/api/src/auth/password-reset-token.repository.ts`, `apps/api/src/auth/user.repository.ts`, `apps/api/src/auth/change-password.service.ts`
**Commit:** `351dd94`
**Applied fix:** Wrapped reset-token claim and password-hash update in a single transaction and added an atomic token-claim repository method so concurrent confirm requests cannot consume the same token twice.

### WR-01: TRANSIENT session cookie sends Max-Age, creating a persistent cookie in the browser

**Files modified:** `apps/api/src/auth/session-policy.ts`, `apps/api/src/auth/auth.service.ts`, `apps/api/src/auth/auth.controller.ts`, `apps/api/src/auth/session-cookie.ts`, `apps/api/src/__tests__/auth/session-policy.spec.ts`, `apps/api/src/__tests__/auth/register-login.spec.ts`
**Commit:** `3ca0694`
**Applied fix:** Renamed the misleading `cookieMaxAge` field to `sessionTtlSeconds` across the API and tests so transient-session semantics are explicit and less likely to regress.

### WR-02: `get` helper in api.ts calls `res.json()` unconditionally — crashes on empty 204 responses

**Files modified:** `apps/web/src/lib/api.ts`
**Commit:** `379e5ad`
**Applied fix:** Added the same empty-body guard used by `post()` so `get()` returns cleanly on `204` or zero-length responses instead of throwing a JSON parse error.

### WR-03: `currentUser.decorator.ts` uses non-null assertion on `request.authContext`

**Files modified:** `apps/api/src/auth/current-user.decorator.ts`
**Commit:** `1946942`
**Applied fix:** Replaced the non-null assertion with an explicit runtime error when `@CurrentUser()` is used without `CurrentUserGuard`.

### WR-04: `confirmReset` marks token used before verifying the user exists, but after hashing the new password

**Files modified:** `apps/api/src/auth/password-reset.service.ts`, `apps/api/src/auth/password-reset-token.repository.ts`, `apps/api/src/auth/user.repository.ts`, `apps/api/src/auth/change-password.service.ts`
**Commit:** `351dd94`
**Applied fix:** Resolved alongside CR-03 by moving token claim and password update into one transaction and checking the password-update result before commit, so a failed update rolls back token consumption.

### WR-05: No rate limiting on authentication endpoints

**Files modified:** `apps/api/src/auth/auth-rate-limit.guard.ts`, `apps/api/src/auth/auth.controller.ts`, `apps/api/src/auth/password-reset.controller.ts`, `apps/api/src/auth/auth.module.ts`
**Commit:** `9cf49d9`
**Applied fix:** Added a local in-memory guard that rate-limits sign-in and password-reset endpoints per client IP and route. This closes the unlimited-attempt gap in the current single-process deployment shape, but should be human-reviewed before multi-instance production use.

---

_Fixed: 2026-04-18T15:38:49Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
