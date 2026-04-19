---
phase: 06-messaging-core
plan: "07"
subsystem: contacts-dm
tags: [bugfix, gap-closure, ban, dm, frozen-history]
dependency_graph:
  requires: ["06-05"]
  provides: ["ban_exists-returns-200", "not_friends-clean-ui"]
  affects: ["DmChatView", "ContactsService.initiateDm"]
tech_stack:
  added: []
  patterns: ["two-branch eligibility check", "error-to-state translation"]
key_files:
  modified:
    - apps/api/src/contacts/contacts.service.ts
    - apps/web/src/features/messages/DmChatView.tsx
decisions:
  - "ban_exists returns HTTP 200 with eligible:false instead of 403 — client renders frozen read-only history (D-32)"
  - "not_friends still returns 403 but catch block now translates it to setIneligibleReason instead of setInitError"
metrics:
  duration_seconds: 62
  completed_date: "2026-04-19T09:12:39Z"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 2
---

# Phase 6 Plan 07: Banned DM Gap Closure Summary

**One-liner:** Backend returns 200 `{conversation, eligible:false}` for `ban_exists` so `DmChatView` renders frozen read-only history instead of a raw "DM not allowed: ban_exists" error string.

## What Was Built

Fixed UAT Gap 3 (Test 7): when one party had banned the other, `initiateDm` threw a 403
`ForbiddenException`, causing `DmChatView` to display "DM not allowed: ban_exists" as raw
error text and never load the frozen conversation history.

**Task 1 — `ContactsService.initiateDm` (backend):** Replaced the single ineligibility
throw with a two-branch check. For `ban_exists`, the method now calls `createDmConversation`
(idempotent upsert that preserves `frozen=TRUE`) and returns `{ conversation, eligible: false }`
with HTTP 200. For `not_friends`, the 403 throw is preserved — no history exists to display.

**Task 2 — `DmChatView.openConversation` catch block (frontend):** The `!result.eligible`
path in the try block was already correct; it just never fired because the backend threw. The
catch block was improved to detect `not_friends` in the error message and route it to
`setIneligibleReason("not_friends")` rather than `setInitError`, producing the clean "Add as
friend to start messaging." UI instead of a raw server error string.

## Deviations from Plan

None — plan executed exactly as written.

## Verification

- [x] `pnpm --filter @chat/api build` — exits 0, no TypeScript errors
- [x] `pnpm --filter @chat/web build` — exits 0, no TypeScript errors
- [ ] Manual: `POST /api/v1/contacts/dm/:bannedUserId` returns HTTP 200 with `eligible: false` and `conversation.frozen: true` when a ban exists
- [ ] Manual: DmChatView for a banned contact shows timeline + read-only banner (not a raw error string)
- [ ] Manual: DmChatView for a non-friend contact shows "Add as friend to start messaging." (not a raw error string)

## Known Stubs

None.

## Threat Flags

None — `callerId` always arrives from session guard; `targetId` from path param only; no body input accepted on the `ban_exists` path (T-06-07 mitigated as designed).

## Self-Check: PASSED

- `apps/api/src/contacts/contacts.service.ts` — modified, committed at 77bd379
- `apps/web/src/features/messages/DmChatView.tsx` — modified, committed at cfbac65
