---
phase: 05-contacts-and-dm-policy
plan: "07"
subsystem: contacts-ban-request-consistency
tags: [contacts, backend, nestjs, postgres, bans, friend-requests, regression-tests]
dependency_graph:
  requires:
    - 05-06  # Existing contacts-management UI and prior Phase 5 gap closure
  provides:
    - apps/api/src/contacts/contacts.service.ts (ban-aware request creation and ban-triggered pending-request cleanup)
    - apps/api/src/contacts/contacts.repository.ts (transactional helper to cancel pending requests between two users)
    - apps/api/src/__tests__/contacts/contacts-domain.spec.ts (regression coverage for blocked-user request suppression)
  affects:
    - Phase 5 ban/request lifecycle consistency
    - UAT scenario where blocked users previously appeared in incoming friend requests
tech_stack:
  added: []
  patterns:
    - Directional ban policy now gates friend-request creation in the same service layer that already gates DM eligibility
    - Ban transaction now cleans up pending requests between the pair so stale incoming requests disappear immediately after block
    - Focused regression tests lock down the exact blocked-user overlap reported in UAT
key_files:
  created: []
  modified:
    - apps/api/src/contacts/contacts.service.ts
    - apps/api/src/contacts/contacts.repository.ts
    - apps/api/src/__tests__/contacts/contacts-domain.spec.ts
key_decisions:
  - "Blocked relationships are rejected at request-creation time with a server-side ForbiddenException instead of relying on the frontend to hide or explain inconsistent pending state"
  - "Ban applies cleanup to both friendship and pending friend requests in one transaction so blocked users cannot linger in incoming-request surfaces after reload"
  - "The fix stays inside the existing contacts endpoints and tables; no new route or schema expansion was needed"
patterns-established:
  - "When a relationship becomes restricted, stale pending social state should be cleaned up transactionally at the backend boundary"
requirements-completed:
  - FRND-01
  - FRND-04
  - FRND-06
duration: "~10 minutes"
completed: "2026-04-19"
---

# Phase 05 Plan 07 Summary

**Blocked relationships now stop both new and stale friend requests server-side, so a banned user no longer survives as a pending incoming request beside the blocked-users list.**

## Performance

- **Duration:** ~10 min
- **Completed:** 2026-04-19
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- `sendFriendRequest()` now rejects request creation or reactivation when any ban exists between the two users.
- `banUser()` now cancels pending requests between the pair inside the same transaction that removes friendship and creates the ban.
- Regression tests now cover both the blocked-request rejection path and the pending-request cleanup path.

## Files Modified

- `apps/api/src/contacts/contacts.service.ts` - Added ban guard in `sendFriendRequest()` and pending-request cleanup inside `banUser()`.
- `apps/api/src/contacts/contacts.repository.ts` - Added `cancelPendingRequestsBetween()` helper for transactional cleanup of pending requests in either direction.
- `apps/api/src/__tests__/contacts/contacts-domain.spec.ts` - Added focused tests for banned-request rejection and ban-driven pending-request cleanup.

## Decisions Made

- Solved the overlap at the backend policy layer instead of hiding request rows in the frontend.
- Treated pending friend requests as stale relationship state that must be cancelled when a ban lands.

## Deviations from Plan

None - plan executed as intended.

## Issues Encountered

None.

## Verification

- [x] `pnpm --filter @chat/api exec vitest run src/__tests__/contacts/contacts-domain.spec.ts src/__tests__/contacts/contacts-eligibility.spec.ts`
- [x] `pnpm --filter @chat/api build`
- [ ] Human re-test of the blocked-user/request overlap in the browser

## Next Phase Readiness

The code-side ban/request consistency fix is in place and covered by regression tests.
One human verification pass remains to confirm the blocked user no longer appears in `Incoming Requests` after the end-to-end UI flow.
