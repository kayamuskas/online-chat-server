---
phase: 06-messaging-core
plan: "02"
subsystem: messages
tags: [messages, repository, service, access-control, watermarks, room-access, dm-access, frozen-dm]
dependency_graph:
  requires:
    - 06-01  # messages.types.ts, messages.helpers.ts, migration
    - 04-01  # RoomsRepository (membership, ban checks)
    - 05-01  # ContactsRepository (DM conversation, ban, frozen state)
  provides:
    - messages.repository.ts (createMessage, editMessage, findMessageById, listHistory, resolveReplyMessage)
    - messages.service.ts (sendMessage, listHistory, editMessage — with full access control)
    - contacts.repository.ts (findDmConversationById — added for DM access guard)
  affects:
    - apps/api/src/contacts/contacts.repository.ts (added findDmConversationById)
    - apps/api/src/__tests__/messages/ (26 new service unit tests)
tech_stack:
  added: []
  patterns:
    - CTE-based atomic watermark assignment (SELECT MAX + 1 within INSERT)
    - Stub-based unit testing for service-layer policy (no DB, no NestJS DI)
    - Access-guard methods as private async helpers with typed throws
    - Frozen DM read-only semantics — allowFrozen flag in assertDmAccess
key_files:
  created:
    - apps/api/src/messages/messages.repository.ts
    - apps/api/src/messages/messages.service.ts
    - apps/api/src/__tests__/messages/messages-service.spec.ts
  modified:
    - apps/api/src/contacts/contacts.repository.ts
decisions:
  - "MessagesService delegates access control to RoomsRepository and ContactsRepository directly (not to their services) to avoid circular dependency chains"
  - "assertDmAccess uses allowFrozen=true for listHistory: frozen DM is read-only (D-32), not invisible"
  - "editMessage checks access guard BEFORE author-only check so ban/frozen violations surface before auth confusion"
  - "CTE watermark: COALESCE(MAX(watermark), 0)+1 within INSERT CTE; DB UNIQUE constraint is the final race guard"
  - "findDmConversationById added to ContactsRepository (Rule 2 — required by service DM access guard)"
metrics:
  duration: "~4 minutes"
  completed: "2026-04-19"
  tasks_completed: 2
  files_created: 3
  files_modified: 1
---

# Phase 06 Plan 02: Repository and Service Layer Summary

**One-liner:** Shared MessagesRepository (atomic watermark writes, paginated history with reply JOINs) and MessagesService (D-30/D-31/D-32 access control, MSG-02/03/04 invariants) with 65 total tests passing.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Implement repository queries | 0f9c99f | messages.repository.ts |
| 2 | Implement service-layer policy + tests | 6b4e1b2 | messages.service.ts, messages-service.spec.ts, contacts.repository.ts |

## What Was Built

### messages.repository.ts

Persistence boundary for the shared messaging engine (no SQL outside this class):

- `createMessage(input)` — CTE-based atomic watermark assignment: `COALESCE(MAX(watermark), 0)+1` per `(conversation_type, conversation_id)` within the INSERT CTE. DB UNIQUE constraint provides final race guard (D-28).
- `editMessage(messageId, newContent, editedAt)` — updates `content` and `edited_at` only; `conversation_watermark` and `created_at` are never touched (D-25, MSG-04).
- `findMessageById(id)` — raw `Message` row for author-check and reply validation.
- `listHistory(query)` — paginated `MessageView` list with JOIN-resolved `author_username` and reply preview (`LEFT JOIN messages rm ON rm.id = m.reply_to_id`). Returns DESC-fetched rows reversed to ASC, plus `MessageHistoryRange` metadata from `computeHistoryRange` helper (MSG-08, D-27). Supports `before_watermark` cursor for older-page pagination.
- `resolveReplyMessage(replyToId)` — resolves reply target for MSG-03 cross-conversation validation.

### messages.service.ts

Policy enforcement layer; access guards run before all invariant checks:

- `assertRoomAccess(roomId, callerId)` — ban check then membership check (D-30); throws `ForbiddenException`.
- `assertDmAccess(conversationId, callerId, allowFrozen?)` — participant check, ban check, frozen check (D-31/D-32); throws `ForbiddenException` or `NotFoundException`.
- `sendMessage(input)` — access guard → content validation (MSG-02) → reply validation (MSG-03) → `repo.createMessage`.
- `listHistory(callerId, query)` — access guard (frozen DM allowed via `allowFrozen=true`) → `repo.listHistory`.
- `editMessage(input)` — fetch message → access guard → author check (MSG-04) → content validation → `repo.editMessage`.

### messages-service.spec.ts (26 new tests)

Stub-based unit tests using `vi.fn()` mocks — no NestJS DI, no DB:

- D-30: room member + ban combinations (5 tests)
- D-31 + D-32: DM participant + ban + frozen combinations (7 tests)
- MSG-02: content validation wired through service (3 tests)
- MSG-03: cross-conversation reply rejection + happy path (3 tests)
- MSG-04: author-only edit + NotFoundException + watermark preservation (4 tests)
- Room/DM variants: both paths for send/list/edit (4 tests)

## Test Results

```
Test Files  3 passed (3)
     Tests  65 passed (65)
       (39 original domain/watermark + 26 new service tests)
```

Verification commands passed:
- `pnpm --filter @chat/api exec vitest run src/__tests__/messages/messages-domain.spec.ts src/__tests__/messages/messages-watermarks.spec.ts` — 39/39
- `pnpm --filter @chat/api exec vitest run src/__tests__/messages/messages-service.spec.ts` — 26/26
- `pnpm --filter @chat/api build` — clean build

## Deviations from Plan

### Auto-added missing methods

**1. [Rule 2 - Missing critical functionality] Added ContactsRepository.findDmConversationById**

- **Found during:** Task 2 — `assertDmAccess` in the service needs to look up a DM conversation by its UUID (the `conversation_id` stored on message rows), but `ContactsRepository` only exposed `findDmConversation(userAId, userBId)`.
- **Fix:** Added `findDmConversationById(conversationId: string)` to `ContactsRepository`.
- **Files modified:** `apps/api/src/contacts/contacts.repository.ts`
- **Commit:** 6b4e1b2

### Additional test file

**2. [Rule 2 - Missing tests for new module] Created messages-service.spec.ts**

- **Found during:** Task 2 — Plan specified updating existing domain/watermark tests, but the service introduces new access-control policy not covered by the pure-domain helpers tests.
- **Fix:** Created a dedicated `messages-service.spec.ts` with 26 stub-based tests covering all acceptance criteria.
- **Files modified:** `apps/api/src/__tests__/messages/messages-service.spec.ts` (new)
- **Commit:** 6b4e1b2

## Known Stubs

None — all service methods implement real logic. No UI data flows in this plan (backend service layer only).

## Threat Flags

None — no new network endpoints, auth paths, or trust boundaries introduced. Access control is implemented (not deferred). `findDmConversationById` is a read-only lookup using a primary key, exposing no new attack surface.

## Self-Check: PASSED

- [x] `apps/api/src/messages/messages.repository.ts` exists (commit 0f9c99f)
- [x] `apps/api/src/messages/messages.service.ts` exists (commit 6b4e1b2)
- [x] `apps/api/src/__tests__/messages/messages-service.spec.ts` exists (commit 6b4e1b2)
- [x] `apps/api/src/contacts/contacts.repository.ts` modified (commit 6b4e1b2)
- [x] All commits verified in git log: 0f9c99f, 6b4e1b2
- [x] 65/65 tests pass
- [x] `pnpm --filter @chat/api build` clean
