---
phase: 05-contacts-and-dm-policy
plan: "03"
subsystem: contacts
tags: [contacts, controller, module, rest-api, nestjs, http-layer]
dependency_graph:
  requires:
    - 05-02  # contacts.service.ts, contacts.repository.ts
    - 04-02  # RoomsModule pattern for wiring
  provides:
    - contacts.controller.ts (12 REST routes at /api/v1/contacts/*)
    - contacts.module.ts (NestJS module wiring, exports ContactsService)
  affects:
    - apps/api/src/app.module.ts (ContactsModule added to imports)
tech_stack:
  added: []
  patterns:
    - Plain function validation helpers (parseSendRequestBody, parseBanBody) — no class-validator, same pattern as rooms.controller.ts
    - Class-level @UseGuards(CurrentUserGuard) guards all 12 routes (T-05-10)
    - callerId always from ctx.user.id via @CurrentUser() — never from request body
    - Static route segments declared before parameterized segments (outgoing before :id)
    - @HttpCode(HttpStatus.NO_CONTENT) on all void DELETE/POST handlers
    - ContactsModule exports ContactsService for Phase 6 MessagingModule injection
key_files:
  created:
    - apps/api/src/contacts/contacts.controller.ts
    - apps/api/src/contacts/contacts.module.ts
  modified:
    - apps/api/src/app.module.ts
decisions:
  - "GET requests/outgoing declared before GET requests and POST requests/:id/accept to prevent NestJS treating 'outgoing' as a :id parameter"
  - "banUser endpoint body parsed via parseBanBody (targetUserId) rather than @Param — banning is a policy action that names the target explicitly in the body, not a resource URL"
  - "ContactsModule exports ContactsService (not ContactsRepository) so Phase 6 consumes only the policy API surface, not raw SQL methods"
metrics:
  duration: "~21 minutes"
  completed: "2026-04-19"
  tasks_completed: 2
  files_created: 2
  files_modified: 1
---

# Phase 05 Plan 03: Contacts Controller, Module Wiring, and API Endpoints Summary

**One-liner:** ContactsController with 12 REST routes at /api/v1/contacts/* (CurrentUserGuard, parse helpers, correct route ordering) and ContactsModule registered in AppModule — full contacts backend now reachable via HTTP.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Implement ContactsController and ContactsModule | 03b60ec | apps/api/src/contacts/contacts.controller.ts, apps/api/src/contacts/contacts.module.ts |
| 2 | Register ContactsModule in AppModule | 83c49f2 | apps/api/src/app.module.ts |

## What Was Built

### contacts.controller.ts

12 REST endpoints at `api/v1/contacts`:

| Method | Route | Handler | Status |
|--------|-------|---------|--------|
| GET | requests/outgoing | getOutgoingRequests | 200 |
| POST | requests | sendFriendRequest | 201 |
| GET | requests | getIncomingRequests | 200 |
| POST | requests/:id/accept | acceptRequest | 200 |
| POST | requests/:id/decline | declineRequest | 204 |
| DELETE | requests/:id | cancelRequest | 204 |
| GET | friends | getFriends | 200 |
| DELETE | friends/:userId | removeFriend | 204 |
| POST | bans | banUser | 204 |
| GET | bans | getMyBans | 200 |
| DELETE | bans/:userId | unbanUser | 204 |
| POST | dm/:userId | initiateDm | 200 |

Validation helpers:
- `parseSendRequestBody` — validates targetUsername (non-empty string), trims whitespace
- `parseBanBody` — validates targetUserId (non-empty string)

### contacts.module.ts

NestJS module wiring DbModule + AuthModule, registering ContactsController, ContactsRepository, ContactsService, UserRepository as providers. Exports ContactsService for Phase 6 DM eligibility injection.

### app.module.ts (modified)

- Import added: `import { ContactsModule } from './contacts/contacts.module.js'`
- ContactsModule added after RoomsModule in the imports array
- JSDoc updated with Phase 5 additions note

## STRIDE Threat Mitigations Applied

| Threat ID | Mitigation | Status |
|-----------|-----------|--------|
| T-05-10 | @UseGuards(CurrentUserGuard) at class level on ContactsController | Implemented |
| T-05-11 | parseSendRequestBody validates non-empty targetUsername before service call | Implemented |
| T-05-12 | initiateDm delegates to contactsService.initiateDm() which calls checkDmEligibility and throws ForbiddenException | Implemented (service layer from 05-02) |

## Test Results

```
Test Files  2 passed (2)
     Tests  13 passed (13)
```

All 13 existing contacts unit tests still pass after HTTP layer wiring.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all 12 routes call real service methods. presenceStatus in FriendWithPresence remains undefined (intentionally deferred to Phase 6 per plan spec — not a stub blocking this plan's goal).

## Threat Flags

None — no new network surface beyond the planned 12 routes; all routes protected by CurrentUserGuard.

## Self-Check: PASSED

- [x] `apps/api/src/contacts/contacts.controller.ts` exists (commit 03b60ec)
- [x] `apps/api/src/contacts/contacts.module.ts` exists (commit 03b60ec)
- [x] `apps/api/src/app.module.ts` modified (commit 83c49f2)
- [x] `grep -c "@Get\|@Post\|@Delete" contacts.controller.ts` = 13 (>= 12)
- [x] `grep "@Controller('api/v1/contacts')"` matches
- [x] `grep "@UseGuards(CurrentUserGuard)"` matches
- [x] `grep -c "ctx.user.id"` = 13 (multiple matches)
- [x] `grep "exports.*ContactsService"` in contacts.module.ts matches
- [x] ContactsModule appears 2 times in app.module.ts (import + array)
- [x] `grep "Phase 5"` in app.module.ts matches
- [x] No TypeScript errors in contacts or app.module.ts files
- [x] 13/13 tests pass
