---
phase: 05-contacts-and-dm-policy
plan: "02"
subsystem: contacts
tags: [contacts, friendships, bans, dm, repository, service, tdd]
dependency_graph:
  requires:
    - 05-01  # contacts.types.ts, DB schema, test scaffold
    - 04-01  # users table (FK target)
  provides:
    - contacts.repository.ts (all SQL for friendship lifecycle, bans, DM conversations)
    - contacts.service.ts (policy enforcement layer with checkDmEligibility and banUser transaction)
  affects:
    - apps/api/src/__tests__/contacts/contacts-domain.spec.ts (tests now pass)
    - apps/api/src/__tests__/contacts/contacts-eligibility.spec.ts (tests now pass)
tech_stack:
  added: []
  patterns:
    - SqlExecutor injection pattern for transactional repository methods (matching user.repository.ts)
    - Manual BEGIN/COMMIT/ROLLBACK via getClient() for banUser atomicity
    - ON CONFLICT upsert for idempotent freezeDmConversation
    - Normalized pair ordering (user_a_id < user_b_id) enforced in application layer
    - Optional third constructor parameter (db?: PostgresService) for testability without NestJS module
key_files:
  created:
    - apps/api/src/contacts/contacts.repository.ts
    - apps/api/src/contacts/contacts.service.ts
  modified: []
decisions:
  - "db parameter is optional in ContactsService constructor so tests can instantiate with 2 args (banUser self-ban guard throws before DB access, so db is never called in unit tests)"
  - "SqlExecutor type uses QueryResultRow constraint and QueryResult<R> return type to match PostgresService.query signature exactly"
  - "banUser uses this.db! (non-null assertion) since the service is always constructed with db in production (NestJS DI); unit tests only exercise self-ban path which throws before db access"
metrics:
  duration: "~3 minutes"
  completed: "2026-04-18"
  tasks_completed: 2
  files_created: 2
  files_modified: 0
---

# Phase 05 Plan 02: Contacts Service and Repository Implementation Summary

**One-liner:** ContactsRepository (18 SQL methods with normalized pair ordering and SqlExecutor injection) and ContactsService (13 policy methods with atomic banUser transaction and checkDmEligibility matrix) — all 13 unit tests pass.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Implement ContactsRepository (all SQL) | b225e2e | apps/api/src/contacts/contacts.repository.ts |
| 2 | Implement ContactsService (policy layer) | 0202d94 | apps/api/src/contacts/contacts.service.ts |

## What Was Built

### contacts.repository.ts

18 async methods covering all four contacts domain tables:

**Friend requests (6 methods):**
- `createFriendRequest` — INSERT with RETURNING
- `findRequestById` — SELECT by UUID
- `findFriendRequest` — pending request lookup by pair
- `updateRequestStatus` — UPDATE with SqlExecutor injection
- `listIncomingRequests` — JOIN with users for username enrichment
- `listOutgoingRequests` — outgoing pending list

**Friendships (4 methods):**
- `createFriendship` — normalizes pair, INSERT with SqlExecutor
- `findFriendship` — normalizes pair before SELECT
- `deleteFriendship` — OR-clause for both orderings, SqlExecutor
- `listFriends` — CASE WHEN JOIN to resolve friend's userId

**User bans (5 methods):**
- `createBan` — directional INSERT with SqlExecutor
- `removeBan` — DELETE by banner+banned pair
- `findBanBetween` — OR-clause for both ban directions
- `findBanByBanner` — directional lookup for unbanUser
- `listBans` — all bans by a banner user

**DM conversations (3 methods):**
- `freezeDmConversation` — ON CONFLICT DO UPDATE SET frozen=TRUE (idempotent), SqlExecutor
- `createDmConversation` — ON CONFLICT DO UPDATE SET frozen=existing (preserves freeze state)
- `findDmConversation` — normalized pair lookup

### contacts.service.ts

13 async methods enforcing all Phase 5 policy invariants:

**Friend requests:** sendFriendRequest, getIncomingRequests, getOutgoingRequests, acceptRequest, declineRequest, cancelRequest

**Friendships:** getFriends, removeFriend (does not freeze DM per D-19)

**Bans:** banUser (atomic transaction), getMyBans, unbanUser

**DM:** checkDmEligibility, initiateDm

## Test Results

```
Test Files  2 passed (2)
     Tests  13 passed (13)
```

All 13 tests pass (up from 4 passing / 9 failing in TDD RED state from plan 05-01).

## STRIDE Threat Mitigations Applied

| Threat ID | Mitigation | Status |
|-----------|-----------|--------|
| T-05-04 | callerId sourced from @CurrentUser() only — service never reads callerId from request body | Service layer enforced |
| T-05-05 | acceptRequest checks req.target_id === callerId; ForbiddenException otherwise | Implemented |
| T-05-06 | cancelRequest checks req.requester_id === callerId; ForbiddenException otherwise | Implemented |
| T-05-07 | banUser wraps deleteFriendship + createBan + freezeDm in BEGIN/COMMIT | Implemented |
| T-05-08 | unbanUser calls findBanByBanner to verify caller is the banner | Implemented |
| T-05-09 | initiateDm calls checkDmEligibility; throws ForbiddenException if not eligible | Implemented |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Type mismatch] SqlExecutor type incompatible with PostgresService**
- **Found during:** Task 1 TypeScript compilation
- **Issue:** Plan's `SqlExecutor` defined as `query<R = any>(...): Promise<{ rows: R[]; rowCount: number | null }>` was not assignable to `PostgresService` which returns `Promise<QueryResult<R>>`
- **Fix:** Changed `SqlExecutor` to match `user.repository.ts` pattern: `query<R extends QueryResultRow = QueryResultRow>(...): Promise<QueryResult<R>>`
- **Files modified:** contacts.repository.ts
- **Commit:** b225e2e

**2. [Rule 2 - Testability] ContactsService db parameter made optional**
- **Found during:** Task 2 — test scaffold instantiates `new ContactsService(mockRepo, mockUserRepo)` with 2 args
- **Issue:** Plan specified 3 required constructor parameters but tests only pass 2
- **Fix:** Made `db` optional: `private readonly db?: PostgresService`. `banUser` uses `this.db!` (non-null assertion) since in production NestJS always injects all 3; self-ban guard in tests throws before `db` is accessed
- **Files modified:** contacts.service.ts
- **Commit:** 0202d94

## Known Stubs

None — all methods implement real SQL and policy logic. presenceStatus in FriendWithPresence is left as `undefined` (not a data stub — presence enrichment is intentionally deferred to Phase 6 per plan spec).

## Threat Flags

None — no new network endpoints, auth paths, or schema changes beyond those in the plan's threat model.

## Self-Check: PASSED

- [x] `apps/api/src/contacts/contacts.repository.ts` exists (commit b225e2e)
- [x] `apps/api/src/contacts/contacts.service.ts` exists (commit 0202d94)
- [x] Both commits verified in git log
- [x] 13/13 tests pass
- [x] No TypeScript errors in contacts files
