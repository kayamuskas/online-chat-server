---
phase: 08-moderation-and-destructive-actions
plan: "04"
subsystem: auth
tags: [account-deletion, cascade, password-verification, danger-zone, frontend, websocket]
dependency_graph:
  requires: [08-01, 08-03]
  provides: [AUTH-08-account-deletion-complete]
  affects: []
tech_stack:
  added: []
  patterns: [full-cascade-delete, password-verified-destructive-action, two-step-confirm-ui]
key_files:
  created: []
  modified:
    - apps/api/src/auth/user.repository.ts
    - apps/api/src/auth/session.repository.ts
    - apps/api/src/contacts/contacts.repository.ts
    - apps/api/src/auth/auth.service.ts
    - apps/api/src/auth/auth.controller.ts
    - apps/api/src/auth/auth.module.ts
    - apps/web/src/lib/api.ts
    - apps/web/src/features/account/AccountOverviewView.tsx
key_decisions:
  - "forwardRef used for AuthModule <-> RoomsModule and AuthModule <-> ContactsModule circular deps"
  - "deleteAccount cascade follows D-15 order exactly: owned rooms (WS) -> admin roles -> memberships -> contacts -> DM convos -> sessions -> user"
  - "DM messages preserved via FK ON DELETE SET NULL (D-13) — only dm_conversations rows deleted, not messages"
  - "deleteAllByUserId deletes ALL sessions including current (D-14); controller also clears cookie on response"
  - "inline fetch used for DELETE with JSON body since del() helper does not accept a body"
requirements-completed: [AUTH-08]
duration: 15min
completed: 2026-04-20
---

# Phase 08 Plan 04: Account Deletion Cascade Summary

**Full account deletion (AUTH-08): password-verified cascade deleting owned rooms (WS-first), stripping roles, removing contacts/DM-conversations/sessions, and deleting the user record — with danger zone UI in AccountOverviewView.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-04-20T16:30:00Z
- **Completed:** 2026-04-20T16:47:00Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- DELETE /api/v1/auth/account endpoint with password verification (T-08-09 mitigated)
- Full D-15 cascade: owned rooms deleted with WS broadcast, admin roles stripped, memberships removed, contacts/friendships/bans deleted, DM conversations deleted (messages preserved), all sessions deleted, user record deleted
- Danger zone UI with two-step password confirmation in AccountOverviewView
- Client redirects to auth screen after successful deletion (D-16)

## Task Commits

1. **Task 1: Backend — repository methods, auth service cascade, controller endpoint** - `1946bb0` (feat)
2. **Task 2: Frontend — account deletion UI with password confirmation** - `741e2fc` (feat)

## Files Created/Modified

- `apps/api/src/auth/user.repository.ts` - Added `deleteById(userId)` method
- `apps/api/src/auth/session.repository.ts` - Added `deleteAllByUserId(userId)` method
- `apps/api/src/contacts/contacts.repository.ts` - Added `deleteAllFor(userId)` and `deleteDmConversationsFor(userId)`
- `apps/api/src/auth/auth.module.ts` - Added RoomsModule and ContactsModule imports via forwardRef
- `apps/api/src/auth/auth.service.ts` - Injected RoomsService/RoomsRepository/ContactsRepository, added `deleteAccount()` cascade
- `apps/api/src/auth/auth.controller.ts` - Added `DELETE /account` endpoint with password validation and cookie clear
- `apps/web/src/lib/api.ts` - Added `deleteAccount({ password })` function using inline fetch with JSON body
- `apps/web/src/features/account/AccountOverviewView.tsx` - Added danger zone section with two-step confirm

## Decisions Made

- forwardRef used for the AuthModule <-> RoomsModule and AuthModule <-> ContactsModule circular dependencies (same pattern established in 08-03)
- DM messages are NOT deleted — only `dm_conversations` rows are removed; message rows retain the conversation_id FK but author_id becomes NULL via the 08-01 migration
- `deleteAllByUserId` deletes ALL sessions (not just others), so the current session becomes invalid server-side; `clearSessionCookie(res)` ensures the cookie is removed on the requesting client
- The frontend uses an inline `fetch` call (not the `del()` helper) because `del()` does not accept a request body

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all functionality fully wired. Account deletion cascade is connected end to end: UI -> DELETE /account -> authService.deleteAccount() -> rooms/contacts/sessions/user cascade.

## Threat Flags

None — no new network surface beyond what the plan's threat register covers. T-08-09 (Spoofing) mitigated by password verification; T-08-10 (EoP) mitigated by using ctx.user.id from session; T-08-12 (Info Disclosure) mitigated by generic error messages; T-08-13 (Repudiation) mitigated by deleteAllByUserId + clearSessionCookie.

## Self-Check: PASSED

- `apps/api/src/auth/user.repository.ts` — deleteById FOUND
- `apps/api/src/auth/session.repository.ts` — deleteAllByUserId FOUND
- `apps/api/src/contacts/contacts.repository.ts` — deleteAllFor/deleteDmConversationsFor FOUND
- `apps/api/src/auth/auth.service.ts` — deleteAccount with full cascade FOUND
- `apps/api/src/auth/auth.controller.ts` — @Delete('account') FOUND
- `apps/web/src/lib/api.ts` — deleteAccount FOUND
- `apps/web/src/features/account/AccountOverviewView.tsx` — danger-zone / Confirm Delete Account FOUND
- commit 1946bb0 — FOUND
- commit 741e2fc — FOUND
