---
phase: 02-authentication-core
plan: "04"
subsystem: web/auth-shell
tags: [auth, react, vite, web, ui, smoke, validation]
dependency_graph:
  requires:
    - "02-02: POST /api/v1/auth/register, sign-in, sign-out, me"
    - "02-03: POST /api/v1/auth/change-password, password-reset/request"
  provides:
    - "AuthShell: single centered card with Sign in / Register top nav, three switchable views"
    - "SignInView: email+password + Keep me signed in + Forgot password link"
    - "RegisterView: email/username/password/confirm with username-permanent reminder"
    - "ForgotPasswordView: reset-link request (enumeration-safe response)"
    - "PasswordSettingsView: authenticated password-change form"
    - "SessionActionsView: current-session sign-out only"
    - "lib/api.ts: typed fetch client covering all Phase 2 auth/account endpoints"
    - "scripts/qa/phase2-auth-smoke.sh: 9-step end-to-end Phase 2 auth smoke harness"
    - "02-VALIDATION.md: 02-04-01 and 02-04-02 marked green"
  affects:
    - "03-xx: chat shell will extend App.tsx beyond the current minimal logged-in surface"
tech_stack:
  added: []
  patterns:
    - "Single-file fetch client (lib/api.ts) — one typed function per API endpoint"
    - "Local view-state switching inside AuthShell — no router needed for Phase 2"
    - "Enumeration-safe UX: ForgotPasswordView shows success message regardless of email existence"
    - "Phase 2 scope boundary enforced: SessionActionsView exposes only current-session sign-out"
key_files:
  created:
    - apps/web/src/lib/api.ts
    - apps/web/src/features/auth/AuthShell.tsx
    - apps/web/src/features/auth/SignInView.tsx
    - apps/web/src/features/auth/RegisterView.tsx
    - apps/web/src/features/auth/ForgotPasswordView.tsx
    - apps/web/src/features/account/PasswordSettingsView.tsx
    - apps/web/src/features/account/SessionActionsView.tsx
    - scripts/qa/phase2-auth-smoke.sh
  modified:
    - apps/web/src/App.tsx
    - apps/web/src/styles.css
    - .planning/phases/02-authentication-core/02-VALIDATION.md
decisions:
  - "Variation A (Variation A from auth.jsx prototype) chosen as auth shell layout — one centered card, top-right Sign in/Register nav — matches D-03"
  - "View switching via local React state in AuthShell — no URL router introduced for Phase 2; avoids scope creep"
  - "ForgotPasswordView shows success message on submit regardless of email existence — mirrors server-side enumeration protection (T-02-07)"
  - "SessionActionsView explicitly names multi-session management as deferred — enforces T-02-11 at the UX layer"
  - "lib/api.ts uses credentials: include on all requests — required for HttpOnly session cookie to be sent cross-origin"
metrics:
  duration: "5 minutes"
  completed: "2026-04-18"
  tasks_completed: 2
  files_created: 8
  files_modified: 3
---

# Phase 02 Plan 04: Phase 2 Web UX and Validation Loop Summary

**One-liner:** React auth shell (sign-in/register/forgot-password), minimal logged-in account actions (password change + current-session sign-out), typed fetch client, and a 9-step end-to-end smoke harness that closes the Phase 2 validation loop.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Replace Phase 1 shell with locked Phase 2 auth shell | f01434b | AuthShell.tsx, SignInView.tsx, RegisterView.tsx, ForgotPasswordView.tsx, lib/api.ts, App.tsx, styles.css |
| 2 | Add minimal logged-in account actions and Phase 2 validation assets | f58b083 | PasswordSettingsView.tsx, SessionActionsView.tsx, phase2-auth-smoke.sh, 02-VALIDATION.md |

## What Was Built

### Auth Shell (`features/auth/`)

**AuthShell** (`AuthShell.tsx`) — single-screen entry point (Variation A):
- Top bar with product logo (`◯ chatsrv`) and Sign in / Register buttons
- Centered card area (360 px max-width) that switches between three views via local state
- No URL router — Phase 2 scope only

**SignInView** (`SignInView.tsx`):
- Email + password inputs
- `Keep me signed in` checkbox (visible, per D-04)
- `Forgot password?` link → ForgotPasswordView
- `Register` link → RegisterView
- Calls `signIn({ email, password, keepSignedIn })` from `lib/api.ts`

**RegisterView** (`RegisterView.tsx`):
- Email, Username, Password, Confirm password inputs
- Username permanence note ("Username is permanent")
- Client-side confirm-password and min-length check before API call
- Calls `register({ email, username, password })`

**ForgotPasswordView** (`ForgotPasswordView.tsx`):
- Email input + "Send reset link" button
- After submit, shows success message regardless of email existence (UX-level enumeration protection)
- Calls `requestPasswordReset({ email })`

### Account Surface (`features/account/`)

**PasswordSettingsView** (`PasswordSettingsView.tsx`):
- Current password + new password + confirm fields
- Client-side match and min-length validation
- Calls `changePassword({ currentPassword, newPassword })` (authenticated, 204 on success)
- Shows success/error feedback inline

**SessionActionsView** (`SessionActionsView.tsx`):
- Shows signed-in username and "Current browser session" label
- Single "Sign out" button calls `signOut()` then invokes `onSignedOut` to return to auth shell
- Explicitly notes multi-session management is deferred (Phase 3 per D-07/D-14)

### API Client (`lib/api.ts`)

Typed `fetch` client with `credentials: "include"` on all requests:

| Function | Method | Path |
|----------|--------|------|
| `register` | POST | `/api/v1/auth/register` |
| `signIn` | POST | `/api/v1/auth/sign-in` |
| `signOut` | POST | `/api/v1/auth/sign-out` |
| `me` | GET | `/api/v1/auth/me` |
| `changePassword` | POST | `/api/v1/auth/change-password` |
| `requestPasswordReset` | POST | `/api/v1/auth/password-reset/request` |
| `confirmPasswordReset` | POST | `/api/v1/auth/password-reset/confirm` |

### Phase 2 Smoke Script (`scripts/qa/phase2-auth-smoke.sh`)

9-step end-to-end smoke harness covering all critical Phase 2 auth flows:

1. API health check (`/healthz`)
2. Register new account → HTTP 201
3. Sign in → HTTP 200 + `chat_session` cookie
4. `/me` lookup → HTTP 200 + correct username
5. Change password → HTTP 204
6. Re-sign-in with new password → HTTP 200
7. Sign out → HTTP 204
8. `/me` after sign-out → HTTP 401 (session invalidated)
9. Password reset request — registered email → 200; non-existent email → 200 (enumeration-safe)
10. Duplicate registration rejected → HTTP 409

Task IDs covered: `02-01-01, 02-01-02, 02-02-01, 02-02-02, 02-03-01, 02-03-02, 02-04-01, 02-04-02`
Threat refs covered: `T-02-01` through `T-02-09`

### `02-VALIDATION.md` Updates

- `02-04-01` and `02-04-02` marked `✅ green`

## Deviations from Plan

None. Plan executed exactly as written.

## Known Stubs

None. All API endpoints are wired to real backend calls. No hardcoded empty arrays, mock users, or placeholder strings flow to UI rendering.

## Threat Flags

No new threat surface beyond the plan's threat model. All three STRIDE mitigations implemented:

- **T-02-10** (T — auth shell UX scope): AuthShell exposes only sign-in/register/forgot-password; no chat navigation, room UI, or session-inventory surface is present — done
- **T-02-11** (S/T — logged-in web actions): SessionActionsView exposes only current-session sign-out; no sign-out-all or session-list surface is present; note in UI explicitly names Phase 3 deferral — done
- **T-02-12** (D — phase validation loop): `phase2-auth-smoke.sh` provides a concrete end-to-end Phase 2 exercise path; `02-VALIDATION.md` maps every task to a verification command — done

## Self-Check: PASSED

Files created:
- apps/web/src/lib/api.ts — FOUND
- apps/web/src/features/auth/AuthShell.tsx — FOUND
- apps/web/src/features/auth/SignInView.tsx — FOUND
- apps/web/src/features/auth/RegisterView.tsx — FOUND
- apps/web/src/features/auth/ForgotPasswordView.tsx — FOUND
- apps/web/src/features/account/PasswordSettingsView.tsx — FOUND
- apps/web/src/features/account/SessionActionsView.tsx — FOUND
- scripts/qa/phase2-auth-smoke.sh — FOUND

Files modified:
- apps/web/src/App.tsx — FOUND
- apps/web/src/styles.css — FOUND
- .planning/phases/02-authentication-core/02-VALIDATION.md — FOUND

Commits:
- f01434b — feat(02-04): Phase 2 auth shell with sign-in, register, and forgot-password views — FOUND
- f58b083 — feat(02-04): minimal logged-in account actions, smoke script, and validation map — FOUND
