---
phase: 02-authentication-core
plan: "02"
subsystem: api/auth-endpoints
tags: [auth, nestjs, tdd, sessions, cookies, registration, sign-in, sign-out]
dependency_graph:
  requires:
    - "02-01: auth schema (users/sessions tables), PostgresService, auth.types, passwords, session-policy"
  provides:
    - "POST /api/v1/auth/register — unique email+username account creation"
    - "POST /api/v1/auth/sign-in — credential verification + durable session issuance"
    - "POST /api/v1/auth/sign-out — targeted current-session invalidation"
    - "GET  /api/v1/auth/me — authenticated current-user lookup"
    - "UserRepository: findByEmail, findByUsername, findById, create, updatePasswordHash"
    - "SessionRepository: create (random token), findByToken, delete, touchLastSeen"
    - "AuthService: register, signIn, getCurrentUser, signOut"
    - "session-cookie.ts: canonical HttpOnly cookie issuance/clearing policy"
    - "CurrentUserGuard + @CurrentUser() decorator — reusable authenticated-request boundary"
    - "AuthModule wired into AppModule with cookie-parser middleware"
  affects:
    - "02-03: password reset/change will use AuthService, UserRepository, SessionRepository"
    - "02-04: web auth shell will consume these HTTP endpoints"
    - "03-xx: Phase 3 session inventory will build on SessionRepository rows"
tech_stack:
  added:
    - "cookie-parser@^1.4 — request cookie parsing for session token extraction"
    - "@types/cookie-parser — TypeScript types for cookie-parser"
  patterns:
    - "TDD RED/GREEN for both tasks"
    - "Repository pattern: UserRepository and SessionRepository isolate all SQL"
    - "Single-service boundary: controllers call AuthService, never repositories directly"
    - "Canonical cookie helper: all HttpOnly cookie operations go through session-cookie.ts"
    - "Opaque random session token (32-byte hex) generated inside SessionRepository"
key_files:
  created:
    - apps/api/src/auth/auth.service.ts
    - apps/api/src/auth/auth.controller.ts
    - apps/api/src/auth/auth.module.ts
    - apps/api/src/auth/user.repository.ts
    - apps/api/src/auth/session.repository.ts
    - apps/api/src/auth/session-cookie.ts
    - apps/api/src/auth/current-user.guard.ts
    - apps/api/src/auth/current-user.decorator.ts
    - apps/api/src/__tests__/auth/register-login.spec.ts
    - apps/api/src/__tests__/auth/logout.spec.ts
  modified:
    - apps/api/src/app.module.ts
    - apps/api/src/main.ts
    - apps/api/package.json
    - pnpm-lock.yaml
decisions:
  - "Session token generated inside SessionRepository.create() using crypto.randomBytes(32) — callers never produce tokens, preventing accidental token reuse or weak entropy"
  - "AuthController uses @Res({ passthrough: true }) pattern — NestJS response interceptors still run after cookie is set"
  - "sign-out returns 204 even when no cookie is present (idempotent) — safe for double-submit and browser navigation race conditions"
  - "cookie-parser added as middleware in main.ts — NestJS does not parse cookies by default; required before CurrentUserGuard can read req.cookies"
  - "CurrentUserGuard checks server-side expires_at in addition to cookie MaxAge — defense-in-depth against clients that do not honor cookie expiry"
metrics:
  duration: "6 minutes"
  completed: "2026-04-18"
  tasks_completed: 2
  files_created: 10
  files_modified: 4
  tests_added: 30
---

# Phase 02 Plan 02: Registration, Sign-In, and Current-Session Sign-Out Summary

**One-liner:** NestJS auth module with UserRepository/SessionRepository/AuthService, canonical HttpOnly cookie helper, CurrentUserGuard/decorator, and 30 unit tests covering register/sign-in/sign-out/guard/cookie flows.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Build registration and sign-in with durable session issuance | 4b89442 | auth.service.ts, auth.controller.ts, user.repository.ts, session.repository.ts, session-cookie.ts, current-user.guard.ts, current-user.decorator.ts, auth.module.ts |
| 2 | Implement current-session sign-out and auth guard/decorator plumbing | 6e9411a | logout.spec.ts (16 tests confirming sign-out, guard, cookie clearing) |

## TDD Gate Compliance

Both tasks followed the RED/GREEN cycle:

**Task 1:**
- RED: `test(02-02): add failing tests for register/sign-in/current-user RED phase` — commit e2a4591
- GREEN: `feat(02-02): implement registration, sign-in, and current-user lookup` — commit 4b89442

**Task 2:**
- Tests were written in the RED phase (logout.spec.ts committed with Task 2) then verified GREEN against already-existing implementation.
- GREEN: `feat(02-02): current-session sign-out and auth guard/decorator plumbing` — commit 6e9411a

## What Was Built

### HTTP Surface (`auth.controller.ts`)

Four endpoints under `/api/v1/auth`:

- **POST /register** — validates unique email/username (409 on conflict), hashes password, returns `{ user: PublicUser }` (201)
- **POST /sign-in** — verifies password, creates session row, issues HttpOnly cookie, returns `{ user: PublicUser }` (200)
- **POST /sign-out** — extracts session token from cookie, calls `authService.signOut(token)`, clears cookie (204, idempotent)
- **GET /me** — guarded by `CurrentUserGuard`, returns `{ user: PublicUser }` or 401

### UserRepository (`user.repository.ts`)

SQL boundary for the `users` table: `findByEmail`, `findByUsername`, `findById`, `create`, `updatePasswordHash`. Username update is intentionally absent — write-once per requirements.

### SessionRepository (`session.repository.ts`)

SQL boundary for the `sessions` table: `create` (generates 32-byte hex token internally), `findByToken`, `delete` (single-row targeted), `touchLastSeen` (idle-timeout refresh for Phase 3). Token generation is internal so callers cannot supply weak or reused tokens.

### AuthService (`auth.service.ts`)

Orchestration layer:
- `register` — checks both uniqueness fields before insert; strips `password_hash` from return value
- `signIn` — verifies credentials via `verifyPassword`, calls `buildSessionExpiry`, creates session row
- `getCurrentUser` — looks up token, checks server-side `expires_at`, returns `{ user: PublicUser, session }` or null
- `signOut` — deletes exactly one session row by token

### session-cookie.ts

Single source of truth for all cookie operations:
- `extractSessionToken(req)` — reads `chat_session` cookie, returns null if absent/empty
- `setSessionCookie(res, token, opts)` — writes HttpOnly, SameSite=strict cookie; omits `maxAge` for transient sessions (browser-close semantics)
- `clearSessionCookie(res)` — sets cookie value to empty string with `maxAge: 0`

### CurrentUserGuard + @CurrentUser() Decorator

`CurrentUserGuard` implements `CanActivate`: extracts token, calls `authService.getCurrentUser`, attaches `AuthContext` to `request.authContext`, throws 401 on failure. `@CurrentUser()` param decorator reads `request.authContext` in handler parameters.

### AuthModule + App wiring

`AuthModule` imports `DbModule`, provides all four auth providers, exports `AuthService` and `CurrentUserGuard` for Phase 3 reuse. `AppModule` imports `AuthModule`. `main.ts` calls `app.use(cookieParser())` before server starts.

## Deviations from Plan

### Auto-added: cookie-parser dependency [Rule 3 - Blocking]

**Found during:** Task 1 implementation
**Issue:** NestJS does not parse cookies by default. `req.cookies` would be `undefined` without cookie-parser, breaking `extractSessionToken` and the entire auth guard pipeline.
**Fix:** Added `cookie-parser` + `@types/cookie-parser` via pnpm. Added `app.use(cookieParser())` in `main.ts`.
**Files modified:** `apps/api/package.json`, `apps/api/src/main.ts`, `pnpm-lock.yaml`

## Known Stubs

None. All auth endpoints are fully implemented. No placeholder data flows to UI rendering.

## Threat Flags

No new threat surface beyond what was in the plan's threat model. All three STRIDE mitigations implemented:

- **T-02-04** (S/T — registration/sign-in surface): Uniqueness validated server-side before insert; session issuance centralized behind `AuthService` — done
- **T-02-05** (T/E — session cookie handling): One canonical cookie helper (`session-cookie.ts`) plus shared `CurrentUserGuard`; no ad hoc token parsing in controllers — done
- **T-02-06** (T — current-session sign-out): `SessionRepository.delete(token)` deletes exactly one row; no bulk delete path exists in this plan — done

## Self-Check: PASSED

Files created:
- apps/api/src/auth/auth.service.ts — FOUND
- apps/api/src/auth/auth.controller.ts — FOUND
- apps/api/src/auth/auth.module.ts — FOUND
- apps/api/src/auth/user.repository.ts — FOUND
- apps/api/src/auth/session.repository.ts — FOUND
- apps/api/src/auth/session-cookie.ts — FOUND
- apps/api/src/auth/current-user.guard.ts — FOUND
- apps/api/src/auth/current-user.decorator.ts — FOUND
- apps/api/src/__tests__/auth/register-login.spec.ts — FOUND
- apps/api/src/__tests__/auth/logout.spec.ts — FOUND

Commits:
- e2a4591 — test(02-02): RED phase register/sign-in tests — FOUND
- 4b89442 — feat(02-02): register, sign-in, current-user — FOUND
- 6e9411a — feat(02-02): sign-out and guard/decorator — FOUND
