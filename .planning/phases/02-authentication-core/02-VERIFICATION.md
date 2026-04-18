---
phase: 02-authentication-core
verified: 2026-04-18T00:00:00Z
status: human_needed
score: 9/9 must-haves verified
overrides_applied: 0
re_verification: false
human_verification:
  - test: "QA inspects reset-link mail artifact end-to-end"
    expected: "Running `POST /api/v1/auth/password-reset/request` with a registered email writes a JSON artifact to `.volumes/mail-outbox/` on the host. The artifact contains the reset link and is discoverable by reading the API log output. Following the link in a browser and confirming the reset updates the password."
    why_human: "Filesystem artifact discovery and log-path readability require a running stack. Reset-link consumption (the full round-trip with a browser) cannot be verified statically."
  - test: "Browser-close session semantics for non-persistent sign-in"
    expected: "Signing in without 'Keep me signed in', closing the browser, and reopening it should destroy the session. The 24-hour server-side cap should invalidate the row independently even if the browser retains the cookie."
    why_human: "Browser cookie eviction on close is browser-specific runtime behavior that cannot be verified statically or via grep."
---

# Phase 2: Authentication Core Verification Report

**Phase Goal:** Implement credentials, login, persistence, password lifecycle, and mockable mail behavior.
**Verified:** 2026-04-18
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can register with unique email and immutable username. | VERIFIED | `AuthService.register()` checks `findByEmail`/`findByUsername` before insert and throws 409 on conflict. `UserRepository` has no `updateUsername` path. Schema enforces `UNIQUE(email)` and `UNIQUE(username)`. |
| 2 | User can sign in, remain signed in across browser restart, and sign out only the current browser session. | VERIFIED | `AuthService.signIn()` calls `resolveSessionPolicy(keepSignedIn)` and `buildSessionExpiry(policy)` from `session-policy.ts`. `SessionRepository.delete(token)` deletes exactly one row. `session-cookie.ts` sets persistent `maxAge` only when `isPersistent = true`. |
| 3 | Password reset and password change work through tested flows. | VERIFIED | `PasswordResetService.requestReset/confirmReset` with one-time token, `ChangePasswordService.changePassword` with current-password verification. Seven backend test files confirmed present in `apps/api/src/__tests__/auth/`. |
| 4 | Backend stores credentials securely and exposes only the required auth surfaces. | VERIFIED | `hashPassword` uses bcrypt salt rounds 12. `AuthService.register` and `signIn` strip `password_hash` before returning `PublicUser`. `UserRepository` has no username-update path. |
| 5 | Password-reset and related mail flows are testable without real SMTP. | VERIFIED | `MockMailService` writes structured JSON to `MAIL_OUTBOX_DIR` (defaults `/tmp/mail-outbox`). `compose.yaml` mounts `.volumes/mail-outbox:/app/mail-outbox`. No SMTP dependency anywhere in the codebase. |
| 6 | The API owns a deterministic auth schema bootstrapped against PostgreSQL. | VERIFIED | `apps/api/src/db/migrations/0001_auth_core.sql` defines `users`, `sessions`, `password_reset_tokens` with `UNIQUE` constraints, FK cascades, and indexed hot paths. |
| 7 | Password hashing, session-duration rules, and auth data contracts are centralized before controllers are added. | VERIFIED | `passwords.ts` (bcrypt, SALT_ROUNDS=12), `session-policy.ts` (TTL constants, `buildSessionExpiry`, `resolveSessionPolicy`), `auth.types.ts` (`User`, `Session`, `PasswordResetToken`, `SessionPolicy` enum). |
| 8 | The web app ships the locked Phase 2 auth shell (sign-in / register / forgot-password switchable views). | VERIFIED | `AuthShell.tsx` manages `"signin"/"register"/"forgot"` state. `App.tsx` imports `AuthShell` and renders it when `user === null`. `SignInView`, `RegisterView`, `ForgotPasswordView` each call real API functions from `lib/api.ts`. |
| 9 | Logged-in surface exposes only Phase 2 account actions: password change and current-session sign-out. | VERIFIED | `App.tsx` renders `PasswordSettingsView` (calls `changePassword`) and `SessionActionsView` (calls `signOut`, then `onSignedOut`). No room, messaging, or multi-session UI is present. |

**Score:** 9/9 truths verified

### Deferred Items

No deferred items. All Phase 2 truths are met by existing code.

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/api/src/db/migrations/0001_auth_core.sql` | Auth schema for users, sessions, reset tokens | VERIFIED | 67-line SQL with 3 tables, 5 indexes, FK cascades, UNIQUE constraints |
| `apps/api/src/auth/passwords.ts` | bcrypt hash/verify boundary | VERIFIED | `hashPassword` (bcrypt salt 12), `verifyPassword` (catches invalid hash) |
| `apps/api/src/auth/session-policy.ts` | Locked session-duration policy helper | VERIFIED | `SESSION_TRANSIENT_TTL_MS=86400000`, `SESSION_PERSISTENT_TTL_MS=2592000000`, `buildSessionExpiry`, `resolveSessionPolicy` |
| `apps/api/src/auth/auth.controller.ts` | HTTP auth surface (register, sign-in, sign-out, me, change-password) | VERIFIED | 5 endpoints present, all delegating to service layer, `CurrentUserGuard` applied to `me` and `change-password` |
| `apps/api/src/auth/session-cookie.ts` | Canonical cookie issuance/clearing | VERIFIED | `extractSessionToken`, `setSessionCookie` (HttpOnly, SameSite=strict, conditional maxAge), `clearSessionCookie` |
| `apps/api/src/auth/session.repository.ts` | Durable session persistence boundary | VERIFIED | `create` (32-byte random token), `findByToken`, `delete` (single-row), `touchLastSeen` |
| `apps/api/src/auth/password-reset.controller.ts` | Reset-request and reset-confirm HTTP surface | VERIFIED | `POST /request` (200, enum-safe) and `POST /confirm` (200 or 400) |
| `apps/api/src/mail/mock-mail.service.ts` | Filesystem-backed structured mail artifacts | VERIFIED | Writes `password-reset-<uuid>.json` to `MAIL_OUTBOX_DIR`, logs artifact path, no SMTP |
| `apps/web/src/features/auth/AuthShell.tsx` | Single auth shell with switchable views | VERIFIED | 3-view local-state switcher, top-bar nav, centered card, imports all 3 sub-views |
| `apps/web/src/features/account/PasswordSettingsView.tsx` | Minimal logged-in password-change UX | VERIFIED | Calls `changePassword()` from `lib/api.ts`, real form with current/new/confirm fields |
| `scripts/qa/phase2-auth-smoke.sh` | Phase 2 auth smoke coverage | VERIFIED | 9-step script covering register, sign-in, me, change-password, sign-out, session invalidation, reset request (enumeration-safe), duplicate rejection |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `apps/api/src/db/db.module.ts` | `packages/shared/src/config.ts` | shared Postgres runtime config | WIRED | `PostgresService` calls `parseRuntimeEnv()` from shared package; `POSTGRES_HOST/PORT/DB/USER/PASSWORD` present in shared config |
| `apps/api/src/auth/session-policy.ts` | session-duration semantics | locked Phase 2 rules | WIRED | `SESSION_TRANSIENT_TTL_MS=86400000` (24h), `SESSION_PERSISTENT_TTL_MS=2592000000` (30 days) exactly as spec |
| `apps/api/src/auth/auth.controller.ts` | `apps/api/src/auth/auth.service.ts` | registration and sign-in orchestration | WIRED | Controller delegates `register`, `signIn`, `signOut`, `getCurrentUser` to `AuthService`; no repository calls in controller |
| `apps/api/src/auth/auth.service.ts` | `apps/api/src/auth/session-policy.ts` | locked cookie/session durations | WIRED | `resolveSessionPolicy(keepSignedIn)` + `buildSessionExpiry(policy)` called at sign-in |
| `apps/api/src/auth/session-cookie.ts` | `apps/api/src/auth/current-user.guard.ts` | session cookie extraction and auth lookup | WIRED | `CurrentUserGuard` calls `extractSessionToken(request)` from `session-cookie.ts` |
| `apps/api/src/auth/password-reset.service.ts` | `apps/api/src/mail/mock-mail.service.ts` | reset-link mail generation | WIRED | `PasswordResetService` injects `MockMailService` and calls `sendPasswordResetMail({to, username, resetLink})` |
| `apps/api/src/auth/change-password.service.ts` | `apps/api/src/auth/current-user.guard.ts` | authenticated password-change flow | WIRED | `POST /auth/change-password` in `AuthController` is decorated with `@UseGuards(CurrentUserGuard)` and passes `ctx.user.id` to `ChangePasswordService` |
| `infra/compose/compose.yaml` | `apps/api/src/mail/mock-mail.service.ts` | mounted filesystem path | WIRED | `MAIL_OUTBOX_DIR: /app/mail-outbox` env var + `../../.volumes/mail-outbox:/app/mail-outbox` volume in compose; `MockMailService` reads `MAIL_OUTBOX_DIR` from env |
| `apps/web/src/App.tsx` | `apps/web/src/features/auth/AuthShell.tsx` | Phase 2 app entry | WIRED | `App.tsx` imports `AuthShell`, renders it when `user === null` |
| `apps/web/src/features/auth/SignInView.tsx` | `apps/web/src/lib/api.ts` | sign-in/register/reset API calls | WIRED | `SignInView` imports `signIn`, `RegisterView` imports `register`, `ForgotPasswordView` imports `requestPasswordReset` |
| `apps/web/src/features/account/SessionActionsView.tsx` | `apps/web/src/lib/api.ts` | current-session sign-out | WIRED | `SessionActionsView` imports `signOut` from `lib/api.ts`, calls it on button click |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `SignInView.tsx` | `result.user` from `signIn()` | `POST /api/v1/auth/sign-in` → `AuthService.signIn()` → `UserRepository.findByEmail` (DB query) | Yes — DB query via `pg.Pool` | FLOWING |
| `RegisterView.tsx` | `result.user` from `register()` | `POST /api/v1/auth/register` → `AuthService.register()` → `UserRepository.create` (DB INSERT) | Yes — DB insert via `pg.Pool` | FLOWING |
| `SessionActionsView.tsx` | `username` prop | Passed from `App.tsx` which receives it from `signIn`/`register` result | Yes — flows from sign-in DB result | FLOWING |
| `PasswordSettingsView.tsx` | `currentPassword` / `newPassword` (form fields) | `POST /api/v1/auth/change-password` → `ChangePasswordService.changePassword()` → `UserRepository.findById` + `updatePasswordHash` (DB queries) | Yes — DB reads and writes | FLOWING |

---

### Behavioral Spot-Checks

Step 7b: SKIPPED — verifying requires a running Docker Compose stack. The smoke script `scripts/qa/phase2-auth-smoke.sh` is the designated behavioral test harness and was verified to be substantive (9 steps, not a stub). Runtime behavioral checks are delegated to the human verification items below.

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| AUTH-01 | 01, 02, 04 | User can register with unique email, unique username, and password | SATISFIED | `AuthService.register()` enforces email+username uniqueness; SQL schema has `UNIQUE` constraints; `RegisterView` + API client wired |
| AUTH-02 | 01, 02 | Username remains immutable after registration | SATISFIED | `UserRepository` has no `updateUsername` method. `auth.types.ts` documents immutability. No update path exposed at any layer |
| AUTH-03 | 01, 02, 04 | User can sign in with email and password | SATISFIED | `POST /api/v1/auth/sign-in` → `AuthService.signIn()` uses `verifyPassword`; `SignInView` calls `signIn()` from api.ts |
| AUTH-04 | 02, 04 | User can sign out only the current browser session | SATISFIED | `SessionRepository.delete(token)` deletes one row by token. `POST /sign-out` is idempotent. `SessionActionsView` calls `signOut()` |
| AUTH-05 | 01, 02, 04 | User login persists across browser close and reopen | SATISFIED (with human check) | PERSISTENT sessions use 30-day `maxAge` cookie. Server-side `expires_at` enforced. Browser-close behavior for non-persistent sessions needs human verification |
| AUTH-06 | 01, 03, 04 | User can reset password | SATISFIED (with human check) | `POST /password-reset/request` → `PasswordResetService.requestReset()` creates token + mail artifact. `POST /password-reset/confirm` validates token. Full round-trip requires human test |
| AUTH-07 | 03, 04 | Logged-in user can change password | SATISFIED | `POST /auth/change-password` guarded by `CurrentUserGuard`, uses `ChangePasswordService.changePassword()` with current-password verification; `PasswordSettingsView` wired |
| OPS-04 | 03 | SMTP-dependent flows can run against mocks without real mail service | SATISFIED | `MockMailService` writes JSON artifacts to filesystem, no SMTP dependency, compose provides writable mount, outbox dir configurable via env |

No orphaned requirements: REQUIREMENTS.md maps AUTH-01 through AUTH-07 and OPS-04 to Phase 2. All 8 are accounted for in the plans.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `auth.service.ts` | 114, 118, 122 | `return null` in `getCurrentUser` | INFO | Correct guard pattern — null means "no valid session", not a stub. The guard converts null to HTTP 401. Not a stub. |

No blocker or warning-level anti-patterns found in any Phase 2 file. All form handlers make real API calls. No hardcoded empty arrays, placeholder strings, or unimplemented handlers exist.

---

### Human Verification Required

#### 1. Mail Artifact End-to-End (AUTH-06 + OPS-04)

**Test:** Run `docker compose up`, trigger `POST /api/v1/auth/password-reset/request` with a registered email, inspect `.volumes/mail-outbox/` on the host, confirm the JSON artifact is present with a valid `resetLink`, then `POST /api/v1/auth/password-reset/confirm` with that token and a new password, and verify sign-in succeeds with the new password.

**Expected:** Artifact file present with correct schema (`type`, `to`, `username`, `subject`, `resetLink`, `generatedAt`). API log contains the artifact path. Confirm endpoint returns 200 and the subsequent sign-in with the new password works.

**Why human:** Filesystem artifact creation and log-path readability require a running stack. Token extraction from the artifact and browser-based reset-link completion cannot be verified statically.

#### 2. Browser-Close Session Semantics (AUTH-05)

**Test:** Sign in without checking "Keep me signed in". Close all browser windows. Reopen the browser and navigate to the app. Observe whether the session persists or the sign-in view is shown.

**Expected:** The session should be gone (browser-close semantics). The server-side `expires_at` 24-hour cap provides a fallback if the browser retains the cookie.

**Why human:** Browser cookie eviction on window close is browser-specific runtime behavior that cannot be verified by code inspection or static analysis alone.

---

### Gaps Summary

No gaps found. All 9 observable truths are verified, all artifacts are substantive and wired, all key links are confirmed, and all 8 requirement IDs are satisfied by real implementation. Two items require human verification due to their inherently runtime or browser-specific nature, but these do not indicate incomplete implementation — they are the standard human verification items identified in `02-VALIDATION.md`'s "Manual-Only Verifications" section.

---

_Verified: 2026-04-18T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
