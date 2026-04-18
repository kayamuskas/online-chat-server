---
phase: 02-authentication-core
plan: "01"
subsystem: api/auth-persistence
tags: [auth, postgres, schema, tdd, security]
dependency_graph:
  requires:
    - "01-04: Docker Compose topology with postgres service"
    - "01-01: Monorepo workspace with shared contracts"
  provides:
    - "Deterministic auth SQL schema (users, sessions, password_reset_tokens)"
    - "PostgresService NestJS injectable pool wrapper"
    - "DbModule for DI-based database access"
    - "auth.types.ts: domain contracts (User, Session, PasswordResetToken, SessionPolicy)"
    - "passwords.ts: centralized bcrypt hash/verify boundary"
    - "session-policy.ts: locked Phase 2 session-duration helpers"
  affects:
    - "02-02: Registration and sign-in endpoints depend on PostgresService, auth.types, passwords, session-policy"
    - "02-03: Password reset depends on password_reset_tokens table and passwords helper"
    - "02-04: Web auth shell depends on session semantics from session-policy"
tech_stack:
  added:
    - "bcrypt@6 — password hashing with work factor 12"
    - "vitest@4 — test runner replacing the no-op test script"
    - "@vitest/coverage-v8 — coverage support"
  patterns:
    - "TDD RED/GREEN for both tasks"
    - "SQL-first schema ownership (checked-in migrations)"
    - "NestJS Injectable service wrapping pg Pool"
    - "Opaque server-side session model (one row per browser/session)"
key_files:
  created:
    - apps/api/src/db/migrations/0001_auth_core.sql
    - apps/api/src/db/postgres.service.ts
    - apps/api/src/db/db.module.ts
    - apps/api/src/auth/auth.types.ts
    - apps/api/src/auth/passwords.ts
    - apps/api/src/auth/session-policy.ts
    - apps/api/src/__tests__/auth/db-schema.spec.ts
    - apps/api/src/__tests__/auth/passwords.spec.ts
    - apps/api/src/__tests__/auth/session-policy.spec.ts
    - apps/api/vitest.config.ts
  modified:
    - apps/api/package.json
    - pnpm-lock.yaml
decisions:
  - "Used bcrypt (work factor 12) over argon2 — bcrypt is already widely deployed, simpler native binding story for offline Docker builds"
  - "SQL-file migrations over ORM — keeps Phase 2 focused on auth behavior, no new infrastructure framework needed"
  - "PostgresService constructs Pool from parseRuntimeEnv() — single config source aligned with shared contracts"
  - "SessionPolicy enum (TRANSIENT/PERSISTENT) exported from auth.types so policy decisions are type-safe across packages"
metrics:
  duration: "6 minutes"
  completed: "2026-04-18"
  tasks_completed: 2
  files_created: 10
  files_modified: 2
  tests_added: 44
---

# Phase 02 Plan 01: Auth Persistence and Security Primitives Summary

**One-liner:** bcrypt password helpers and server-side session-duration policy backed by a deterministic PostgreSQL auth schema (users, sessions, reset tokens).

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Establish PostgreSQL auth schema and DB bootstrap | c7806b1 | 0001_auth_core.sql, postgres.service.ts, db.module.ts, auth.types.ts |
| 2 | Centralize password and session policy helpers | 0965958 | passwords.ts, session-policy.ts |

## TDD Gate Compliance

Both tasks followed the RED/GREEN/REFACTOR cycle:

**Task 1:**
- RED: `test(02-01): add failing tests for auth persistence layer RED phase` — commit 34f3a03
- GREEN: `feat(02-01): auth persistence layer — schema, DB module, and auth types` — commit c7806b1

**Task 2:**
- RED: `test(02-01): add failing tests for password and session policy helpers RED phase` — commit 4ae30a9
- GREEN: `feat(02-01): centralized password and session-policy helpers` — commit 0965958

## What Was Built

### SQL Schema (`0001_auth_core.sql`)

Three tables with proper constraints:

- **users**: `id` (UUID PK), `email` (UNIQUE), `username` (UNIQUE, immutable-by-API), `password_hash`, timestamps
- **sessions**: one row per browser session; `session_token` (opaque, UNIQUE), `is_persistent` flag, `expires_at`, `last_seen_at` for idle-timeout enforcement, FK to users
- **password_reset_tokens**: `token` (opaque, UNIQUE), `expires_at`, `used_at` (NULL until consumed), FK to users

All tables use UUID PKs via `gen_random_uuid()` and have indexed lookup paths for hot query patterns.

### DB Module

`PostgresService` wraps a `pg.Pool` with config read from `parseRuntimeEnv()` (shared contract: POSTGRES_HOST/PORT/DB/USER/PASSWORD). Implements `OnApplicationShutdown` for clean pool drain. `DbModule` exports it for NestJS DI injection in feature modules.

### Auth Types (`auth.types.ts`)

`User`, `Session`, `PasswordResetToken` interfaces matching the schema columns. `SessionPolicy` enum (`TRANSIENT` | `PERSISTENT`) used by session-policy helpers and later controllers.

### Password Helper (`passwords.ts`)

`hashPassword(plaintext)` — bcrypt hash with salt rounds 12. `verifyPassword(plaintext, hash)` — bcrypt compare, returns `false` on invalid hash instead of throwing.

### Session Policy Helper (`session-policy.ts`)

Exported constants lock the approved Phase 2 durations:
- `SESSION_TRANSIENT_TTL_MS` = 86,400,000 ms (24 hours)
- `SESSION_PERSISTENT_TTL_MS` = 2,592,000,000 ms (30 days)

`buildSessionExpiry(policy)` returns `{ expiresAt, cookieMaxAge, isPersistent }` — everything a sign-in handler needs to write the session row and set the cookie. `isCookiePersistent(keepSignedIn)` and `resolveSessionPolicy(keepSignedIn)` map the checkbox state to the policy.

## Deviations from Plan

### Auto-added: vitest test infrastructure [Rule 3 - Blocking]

**Found during:** Task 1 setup  
**Issue:** `apps/api/package.json` had `"test": "echo \"No tests yet\" && exit 0"` — no test runner, so TDD was impossible.  
**Fix:** Added `vitest` + `@vitest/coverage-v8` devDependencies, created `vitest.config.ts`, updated test script to `vitest run`.  
**Files modified:** `apps/api/package.json`, `apps/api/vitest.config.ts`, `pnpm-lock.yaml`

### Auto-added: bcrypt dependency [Rule 3 - Blocking]

**Found during:** Task 2 implementation  
**Issue:** No password hashing library was installed; `passwords.ts` requires one.  
**Fix:** Added `bcrypt` + `@types/bcrypt` via pnpm.  
**Files modified:** `apps/api/package.json`, `pnpm-lock.yaml`

### Auto-fixed: test regex false-positive on password column detection [Rule 1 - Bug]

**Found during:** Task 1 GREEN phase  
**Issue:** `\bpassword\b(?!_hash)` matched comment text "password reset" in the SQL file, causing a false test failure.  
**Fix:** Replaced regex with a pattern that strips `-- comment` lines first and then checks for bare `password TEXT|VARCHAR` column definitions.  
**Files modified:** `apps/api/src/__tests__/auth/db-schema.spec.ts`

### Out-of-scope: pre-existing @nestjs/testing failures

The existing Phase 1 test files (`health.spec.ts`, `gateway.spec.ts`, `system-jobs.spec.ts`) use `@nestjs/testing` which is not installed. These were always silent because the old test script never ran vitest. Logged to deferred items — not caused by this plan's changes.

## Known Stubs

None. All functionality is fully implemented and tested. No placeholder data flows to UI rendering.

## Threat Flags

No new threat surface beyond what was in the plan's threat model. All three mitigations from the STRIDE register were implemented:
- **T-02-01**: Deterministic auth schema with unique constraints and explicit table design — done
- **T-02-02**: Password helper boundary (raw passwords never stored or returned) — done
- **T-02-03**: Session policy encoded in one helper with tests preventing drift — done

## Self-Check: PASSED

Files created:
- apps/api/src/db/migrations/0001_auth_core.sql — FOUND
- apps/api/src/db/postgres.service.ts — FOUND
- apps/api/src/db/db.module.ts — FOUND
- apps/api/src/auth/auth.types.ts — FOUND
- apps/api/src/auth/passwords.ts — FOUND
- apps/api/src/auth/session-policy.ts — FOUND
- apps/api/src/__tests__/auth/db-schema.spec.ts — FOUND
- apps/api/src/__tests__/auth/passwords.spec.ts — FOUND
- apps/api/src/__tests__/auth/session-policy.spec.ts — FOUND
- apps/api/vitest.config.ts — FOUND

Commits:
- 34f3a03 — test(02-01): RED phase schema tests — FOUND
- c7806b1 — feat(02-01): auth persistence layer — FOUND
- 4ae30a9 — test(02-01): RED phase helper tests — FOUND
- 0965958 — feat(02-01): password and session-policy helpers — FOUND
