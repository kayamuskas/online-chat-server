---
phase: 02-authentication-core
plan: "03"
subsystem: api/auth-password-flows
tags: [auth, password-reset, password-change, mock-mail, tdd, security, compose]
dependency_graph:
  requires:
    - "02-01: password_reset_tokens table, UserRepository.updatePasswordHash, passwords helpers"
    - "02-02: CurrentUserGuard, AuthController, AuthModule, AuthService"
  provides:
    - "POST /api/v1/auth/password-reset/request — silent reset initiation with mail artifact"
    - "POST /api/v1/auth/password-reset/confirm — one-time token consumption and hash update"
    - "POST /api/v1/auth/change-password — authenticated current-password-verified hash update"
    - "MockMailService: filesystem-backed structured JSON mail artifacts (OPS-04)"
    - "MailModule: DI module exporting MockMailService"
    - "PasswordResetService: requestReset/confirmReset orchestration"
    - "PasswordResetController: HTTP surface for reset endpoints"
    - "PasswordResetTokenRepository: create/findByToken/markUsed boundary"
    - "ChangePasswordService: current-password-verified hash replacement"
    - "compose.yaml: narrow writable /app/mail-outbox mount + MAIL_OUTBOX_DIR + APP_BASE_URL"
    - "docs/offline-runtime.md: QA guide for mock mail outbox inspection"
  affects:
    - "02-04: web auth shell will call reset-request/confirm and change-password endpoints"
    - "03-xx: MailModule can be extended for other mail flows without adding SMTP"
tech_stack:
  added: []
  patterns:
    - "TDD RED/GREEN for both tasks"
    - "Enumeration protection: requestReset always returns void regardless of email existence"
    - "One-time token: markUsed called before updatePasswordHash to prevent double-spend"
    - "Filesystem artifact generation pattern: structured JSON per mail event, path logged"
    - "Narrow writable volume: only /app/mail-outbox is writable; rest of API container is read-only"
key_files:
  created:
    - apps/api/src/auth/password-reset.service.ts
    - apps/api/src/auth/password-reset.controller.ts
    - apps/api/src/auth/password-reset-token.repository.ts
    - apps/api/src/auth/change-password.service.ts
    - apps/api/src/mail/mock-mail.service.ts
    - apps/api/src/mail/mail.module.ts
    - apps/api/src/__tests__/auth/password-reset.spec.ts
    - apps/api/src/__tests__/auth/change-password.spec.ts
  modified:
    - apps/api/src/auth/auth.controller.ts
    - apps/api/src/auth/auth.module.ts
    - infra/compose/compose.yaml
    - docs/offline-runtime.md
decisions:
  - "requestReset always returns void regardless of email existence — prevents email enumeration (T-02-07)"
  - "markUsed called before updatePasswordHash — prevents token double-spend even if hash update fails"
  - "Reset token TTL is 1 hour — generous for UX, short for security"
  - "MAIL_OUTBOX_DIR env var controls outbox path — defaults to /tmp/mail-outbox for tests, /app/mail-outbox in compose"
  - "APP_BASE_URL env var controls reset link base — defaults to http://localhost:4173"
  - "Only /app/mail-outbox is writable in the API container — read_only posture preserved everywhere else"
metrics:
  duration: "6 minutes"
  completed: "2026-04-18"
  tasks_completed: 2
  files_created: 8
  files_modified: 4
  tests_added: 29
---

# Phase 02 Plan 03: Password Reset, Password Change, and Mock Mail Outbox Summary

**One-liner:** Reset-link flow with filesystem-backed JSON mail artifacts (OPS-04), one-time server-side token validation, and authenticated current-password-verified hash update — all without SMTP.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Build password reset request/confirm with reset-link outbox artifacts | 491c0db | password-reset.service.ts, password-reset.controller.ts, password-reset-token.repository.ts, mock-mail.service.ts, mail.module.ts, compose.yaml, offline-runtime.md |
| 2 | Add authenticated password-change flow | fef2f80 | change-password.service.ts, auth.controller.ts (changePassword endpoint), auth.module.ts |

## TDD Gate Compliance

Both tasks followed the RED/GREEN cycle:

**Task 1:**
- RED: `test(02-03): add failing tests for password reset flows RED phase` — commit ca8979e
- GREEN: `feat(02-03): implement password reset flow with filesystem mock mail outbox` — commit 491c0db

**Task 2:**
- RED: `test(02-03): add failing tests for authenticated password-change flow RED phase` — commit c937da6
- GREEN: `feat(02-03): add authenticated password-change flow` — commit fef2f80

## What Was Built

### Password Reset Flow

**PasswordResetService (`password-reset.service.ts`)**

Two operations:
- `requestReset(email)` — looks up the user by email; if not found, returns silently (no enumeration). If found, creates a reset token via `PasswordResetTokenRepository.create()`, builds a reset link (`APP_BASE_URL/reset-password?token=<token>`), calls `MockMailService.sendPasswordResetMail()`, and logs the artifact path at `LOG` level.
- `confirmReset({ token, newPassword })` — validates the token (exists, not used, not expired, user still exists). On success, marks the token used then updates the password hash.

**PasswordResetController (`password-reset.controller.ts`)**

Under `/api/v1/auth/password-reset`:
- **POST /request** — delegates to `requestReset`, returns 200 regardless of email existence
- **POST /confirm** — delegates to `confirmReset`, returns 200; 400 on invalid/used/expired token

**PasswordResetTokenRepository (`password-reset-token.repository.ts`)**

SQL boundary over `password_reset_tokens`:
- `create({ userId })` — generates 32-byte hex token, sets 1-hour expiry, inserts row
- `findByToken(token)` — lookup by token string
- `markUsed(tokenId)` — sets `used_at = NOW()` (one-way, permanent)

### Mock Mail Outbox

**MockMailService (`mock-mail.service.ts`)**

Generates structured JSON artifacts for password-reset mail:
- Creates the outbox directory if absent (`mkdir --recursive`)
- Writes `password-reset-<uuid>.json` containing: `type`, `to`, `username`, `subject`, `resetLink`, `generatedAt`
- Returns `{ artifactPath }` so callers can log the path
- Outbox directory from `MAIL_OUTBOX_DIR` env (default: `/tmp/mail-outbox`)

**MailModule (`mail.module.ts`)**

NestJS module providing and exporting `MockMailService` for DI injection.

### Compose and Runtime Changes

**`infra/compose/compose.yaml`** — Added to the `api` service:
- `MAIL_OUTBOX_DIR: /app/mail-outbox` env
- `APP_BASE_URL: ${APP_BASE_URL:-http://localhost:4173}` env
- `volumes: - ../../.volumes/mail-outbox:/app/mail-outbox` — narrow writable bind mount; rest of container remains `read_only: true`

**`docs/offline-runtime.md`** — Added "Mock Mail Outbox Volume" section explaining the deliberate narrow writable mount, QA inspection steps, and artifact JSON structure.

### Authenticated Password-Change Flow

**ChangePasswordService (`change-password.service.ts`)**

- `changePassword({ userId, currentPassword, newPassword })` — looks up user by session `userId`, calls `verifyPassword(currentPassword, hash)`, throws `UnauthorizedException` if wrong, hashes new password and calls `updatePasswordHash` on success

**AuthController extension**

New endpoint `POST /api/v1/auth/change-password`:
- Protected by `CurrentUserGuard` — only authenticated sessions reach this handler
- `userId` comes from `ctx.user.id` (session), not from request body
- Returns 204 on success; 401 if not authenticated or current password is wrong

### AuthModule wiring

`AuthModule` updated to import `MailModule` and provide/register `ChangePasswordService`, `PasswordResetService`, `PasswordResetTokenRepository`, and `PasswordResetController`.

## Deviations from Plan

None. Plan executed exactly as written.

## Known Stubs

None. All services are fully wired. No placeholder data flows to UI rendering.

## Threat Flags

No new threat surface beyond the plan's threat model. All three STRIDE mitigations implemented:

- **T-02-07** (I — reset-link artifacts): Token validation is server-side; mail artifacts contain only structured metadata; `requestReset` never reveals whether an email is registered — done
- **T-02-08** (S/T — password-change flow): `CurrentUserGuard` enforces authenticated session; `verifyPassword` verifies current password before hash replacement; `userId` comes from session not request — done
- **T-02-09** (T/E — API container write surface): Only `/app/mail-outbox` is writable; `read_only: true` on the API container is preserved for all other paths — done

## Self-Check: PASSED

Files created:
- apps/api/src/auth/password-reset.service.ts — FOUND
- apps/api/src/auth/password-reset.controller.ts — FOUND
- apps/api/src/auth/password-reset-token.repository.ts — FOUND
- apps/api/src/auth/change-password.service.ts — FOUND
- apps/api/src/mail/mock-mail.service.ts — FOUND
- apps/api/src/mail/mail.module.ts — FOUND
- apps/api/src/__tests__/auth/password-reset.spec.ts — FOUND
- apps/api/src/__tests__/auth/change-password.spec.ts — FOUND

Files modified:
- apps/api/src/auth/auth.controller.ts — FOUND
- apps/api/src/auth/auth.module.ts — FOUND
- infra/compose/compose.yaml — FOUND
- docs/offline-runtime.md — FOUND

Commits:
- ca8979e — test(02-03): RED phase password-reset tests — FOUND
- 491c0db — feat(02-03): password reset flow with mock mail — FOUND
- c937da6 — test(02-03): RED phase change-password tests — FOUND
- fef2f80 — feat(02-03): authenticated password-change flow — FOUND
